import type { Wevent, Event } from "@/types/nostr";
import type { Content, Cursor, FC, FlatFeed, Poast } from "@/types/trill";
import { defaultGate, engagementBunt } from "./bunts";
import type {
  BasicProfile,
  Disaggregated,
  NostrFeeds,
  SourcedFeed,
  UrbitID,
  UserProfile,
  UserType,
} from "@/types/nostrill";
import type { Result } from "@/types/ui";
import { isValidPatp } from "urbit-ob";
import { IMAGE_SUBREGEX, URL_REGEX, VIDEO_SUBREGEX } from "./constants";
import { decodeNostrKey } from "./nostr";
import { patpToFallbackUID } from "./gw";

// Signed event bodies are shared by timeline, author and thread views. Bound
// retained entries, and compare the body too so replacements cannot go stale.
const parsedEvents = new Map<string, Poast>();
const PARSED_EVENT_LIMIT = 4096;
const sameStrings = (a: readonly string[] = [], b: readonly string[] = []) =>
  a === b || (a.length === b.length && a.every((value, i) => value === b[i]));
export function sameEventBody(a: Wevent, b: Wevent) {
  return (
    a === b ||
    (a.id === b.id &&
      a.pubkey === b.pubkey &&
      a.created_at === b.created_at &&
      a.kind === b.kind &&
      a.content === b.content &&
      a.sig === b.sig &&
      (a.tags === b.tags ||
        (a.tags.length === b.tags.length &&
          a.tags.every((tag, i) => sameStrings(tag, b.tags[i])))))
  );
}
export function mergeEventRelays(
  previous: Wevent | undefined,
  event: Wevent,
  relay?: string,
): Wevent {
  const relays = [
    ...new Set([
      ...(previous?.relays ?? []),
      ...(event.relays ?? []),
      ...(relay ? [relay] : []),
    ]),
  ];
  if (
    previous &&
    sameEventBody(previous, event) &&
    sameStrings(previous.relays, relays)
  )
    return previous;
  return sameStrings(event.relays, relays) ? event : { ...event, relays };
}

// nostr post ids are created_at in ms, so two events from the same second
// collide: give a newcomer the next free id instead of overwriting. an
// event we already hold (same hash) keeps its slot.
// mutates `fc`; callers hand it a feed they own
function putPoast(fc: FC, p: Poast) {
  let id = Number(p.id);
  while (fc.feed[`${id}`] && fc.feed[`${id}`].hash !== p.hash) id++;
  const key = `${id}`;
  fc.feed[key] = p.id === key ? p : { ...p, id: key };
  if (!fc.start || id < Number(fc.start)) fc.start = key;
  if (!fc.end || id > Number(fc.end)) fc.end = key;
}
// Store raw event indexes at ingestion. Converting their bodies is deferred
// until a feed view actually reads .feed; a thread can look up one raw event.
const rawFeedEvents = new WeakMap<FC, Map<string, Wevent>>();
const rawFeedSlots = new WeakMap<FC, Map<string, string>>();
const materializedFeeds = new WeakMap<FC, FlatFeed>();
function indexedNostrFeed(events: Map<string, Wevent>, previous?: FC): FC {
  let reuseFeed = previous ? materializedFeeds.get(previous) : undefined;
  let reuseEvents = reuseFeed && previous ? rawFeedEvents.get(previous) : undefined;
  let reuseSlots = reuseFeed && previous ? rawFeedSlots.get(previous) : undefined;
  const slots = new Map<string, string>();
  const used = new Set<string>();
  let start: string | null = null;
  let end: string | null = null;
  for (const event of events.values()) {
    let slot = event.created_at * 1000;
    while (used.has(`${slot}`)) slot++;
    const key = `${slot}`;
    used.add(key);
    slots.set(event.id, key);
    if (start === null || slot < Number(start)) start = key;
    if (end === null || slot > Number(end)) end = key;
  }
  let converted: FlatFeed | undefined;
  const fc: FC = {
    start, end,
    get feed() {
      if (!converted) {
        converted = {};
        for (const event of events.values()) {
          const id = slots.get(event.id)!;
          const oldSlot = reuseSlots?.get(event.id);
          if (reuseFeed && oldSlot !== undefined && reuseEvents?.get(event.id) === event) {
            const post = reuseFeed[oldSlot];
            converted[id] = post.id === id ? post : { ...post, id };
          } else {
            const post = eventToPoast(event);
            if (post) converted[id] = post.id === id ? post : { ...post, id };
          }
        }
        materializedFeeds.set(fc, converted);
        // Avoid retaining previous feed snapshots after they have been reused.
        reuseFeed = undefined;
        reuseEvents = undefined;
        reuseSlots = undefined;
      }
      return converted;
    },
  };
  rawFeedEvents.set(fc, events);
  rawFeedSlots.set(fc, slots);
  return fc;
}
export function eventsToFc(postEvents: Wevent[]): FC {
  const events = new Map<string, Wevent>();
  for (const event of postEvents) {
    if (event.kind !== 1 && event.kind !== 667) continue;
    events.set(event.id, mergeEventRelays(events.get(event.id), event));
  }
  return indexedNostrFeed(events);
}
export function nostrEventsInFeed(fc: FC): Iterable<Wevent> {
  return rawFeedEvents.get(fc)?.values() ?? Object.values(fc.feed).flatMap(p => p.event ? [p.event] : []);
}
export function nostrEventInFeed(fc: FC, id: string): Wevent | undefined {
  const events = rawFeedEvents.get(fc);
  return events ? events.get(id) : Object.values(fc.feed).find(p => p.hash === id)?.event;
}
// Merge one sub's per-relay feeds into a single FC, deduping by event id
// while accumulating each event's source relays into Wevent.relays.
export function sourcedFeedsToFc(sources: Record<string, SourcedFeed>): FC {
  const byId = new Map<string, Wevent>();
  for (const [url, sf] of Object.entries(sources)) {
    if (!Array.isArray(sf?.feed)) continue;
    for (const event of sf.feed) {
      const prev = byId.get(event.id);
      const relays = new Set([
        ...(prev?.relays ?? []),
        ...(event.relays ?? []),
        url,
      ]);
      byId.set(event.id, { ...event, relays: [...relays] });
    }
  }
  return eventsToFc([...byId.values()]);
}
export function nostrFeedsToFcMap(nf: NostrFeeds): Record<string, FC> {
  const out: Record<string, FC> = {};
  for (const [name, sources] of Object.entries(nf))
    out[name] = sourcedFeedsToFc(sources);
  return out;
}
// returns a new FC (never mutates `fc`) so store/state updates re-render
export function addEventToFc(event: Wevent, fc: FC): FC {
  if (event.kind !== 1 && event.kind !== 667) return fc;
  const events = rawFeedEvents.get(fc);
  if (events || Object.keys(fc.feed).length === 0) {
    const previous = events?.get(event.id);
    const next = mergeEventRelays(previous, event);
    if (next === previous) return fc;
    return indexedNostrFeed(new Map(events).set(event.id, next), fc);
  }
  // Preserve callers' already-materialized (including native) feed entries.
  const p = eventToPoast(event);
  if (!p) return fc;
  let slot = Number(p.id);
  while (fc.feed[`${slot}`] && fc.feed[`${slot}`].hash !== p.hash) slot++;
  const existing = fc.feed[`${slot}`];
  if (existing?.event === p.event && existing?.contents === p.contents) return fc;
  const next = { ...fc, feed: { ...fc.feed } };
  putPoast(next, p);
  return next;
}
export function extractURLs(text: string): {
  text: Array<{ text: string } | { link: { href: string; show: string } }>;
  pics: string[];
  vids: string[];
} {
  const pics: string[] = [];
  const vids: string[] = [];
  const tokens: Array<
    { text: string } | { link: { href: string; show: string } }
  > = [];
  // matchAll, not split/test: split also emits URL_REGEX's inner capture
  // group, and .test() on a /g regex carries lastIndex between calls.
  // text between links is kept verbatim so surrounding spaces survive
  let last = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index;
    if (start > last) tokens.push({ text: text.slice(last, start) });
    if (IMAGE_SUBREGEX.test(url)) pics.push(url);
    else if (VIDEO_SUBREGEX.test(url)) vids.push(url);
    else tokens.push({ link: { href: url, show: url } });
    last = start + url.length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last) });

  return { text: tokens, pics, vids };
}

export function eventToPoast(event: Wevent): Poast | null {
  const valid = [1, 667];
  if (!valid.includes(event.kind)) return null;
  const cached = parsedEvents.get(event.id);
  if (cached?.event && sameEventBody(cached.event, event)) {
    const post = sameStrings(cached.event.relays, event.relays)
      ? cached
      : { ...cached, event };
    parsedEvents.delete(event.id);
    parsedEvents.set(event.id, post);
    return post;
  }
  const inl = extractURLs(event.content || "");
  const contents: Content = [
    { paragraph: inl.text },
    { media: { images: inl.pics } },
  ];
  if (inl.vids.length > 0) contents.push({ media: { video: inl.vids[0] } });
  const inContent = new Set([
    ...inl.pics,
    ...inl.vids,
    ...inl.text.flatMap((t) => ("link" in t ? [t.link.href] : [])),
  ]);
  const ts = event.created_at * 1000;
  const id = `${ts}`;
  const uid: UrbitID = {
    point: 0n,
    patp: "~zod",
    gwid: {
      english: { nym: "", abridged: "", foreshortened: "" },
      hanzi: { nym: "", abridged: "", foreshortened: "" },
    },
  };
  const authorFull = { host: uid, author: uid };

  const poast: Poast = {
    id,
    host: event.pubkey,
    author: event.pubkey,
    authorFull,
    contents,
    thread: null,
    parent: null,
    perms: { read: defaultGate, write: defaultGate },
    tags: [],
    hash: event.id,
    time: ts,
    engagement: engagementBunt,
    children: [],
    event,
  };
  for (const tag of event.tags) {
    const f = tag[0];
    if (!f) continue;
    const ff = f.toLowerCase();
    // console.log("tag", ff);
    if (ff === "patp") poast.author = tag[1];
    if (ff === "e") {
      const [, eventId, _relayURL, marker, _pubkey, ..._] = tag;
      // TODO
      if (marker === "root") poast.thread = eventId;
      else if (marker === "reply") poast.parent = eventId;
      // TODO this are kinda useful too as quotes or whatever
      // else if (marker === "mention") poast.parent = eventId;
    }
    //
    // r tags list the urls a note references, mostly ones already in its
    // text: only those that aren't get a link of their own (an image url
    // in both used to render twice)
    else if (ff === "r" && tag[1] && !inContent.has(tag[1]))
      contents.push({
        paragraph: [{ link: { show: tag[1], href: tag[1] } }],
      });
    else if (ff === "p") {
      //
    }
    //   contents.push({
    //     paragraph: [{ ship: tag[1]! }],
    // });
    else if (ff === "q")
      contents.push({
        ref: {
          type: "nostr",
          ship: tag[1]!,
          path: (tag[2] || "") + `/${tag[3] || ""}`,
        },
      });
    // else console.log("odd tag", tag);
  }
  if (!poast.parent && poast.thread) poast.parent = poast.thread;
  parsedEvents.delete(event.id);
  parsedEvents.set(event.id, poast);
  if (parsedEvents.size > PARSED_EVENT_LIMIT)
    parsedEvents.delete(parsedEvents.keys().next().value!);
  return poast;
}

export function eventToProfile(event: Event): UserProfile | null {
  try {
    const data = JSON.parse(event.content);
    const { name, picture, about, ...other } = data;
    const patp = data.patp ? data.patp : null;
    const bp: BasicProfile = { name, picture, about, other };
    const prof: UserProfile = {
      pubkey: event.pubkey,
      followers: [],
      following: [],
      followerCount: 0,
      followingCount: 0,
      urbitID: null,
      ...bp,
    };
    return prof;
  } catch (e) {
    console.error("error parsing nostr event 0", e);
    return null;
  }
}
export function stringToUser(s: string): Result<UserType> {
  const p = isValidPatp(s);
  if (p) return { ok: { urbit: patpToFallbackUID(s) } };
  const dec = decodeNostrKey(s);
  if (dec) return { ok: { nostr: s } };
  else return { error: "invalid user" };
}
export function userToStringSafe(user: UserType): string {
  if ("urbit" in user) return user.urbit.patp;
  else return user.nostr;
}
// NOTE common tags:
// imeta
// client
// nonce
// proxy

// export function parseEventTags(event: Event) {
//   const effects: any[] = [];
//   for (const tag of event.tags) {
//     const f = tag[0];
//     if (!f) continue;
//     const ff = f.toLowerCase();
//     switch (ff) {
//       case "p": {
//         const [, pubkey, relayURL, ..._] = tag;
//         // people mention
//         break;
//       }
//       case "e": {
//         // marker to be "root" or "reply"
//         // event mention
//         break;
//       }
//       case "q": {
//         const [, eventId, relayURL, pubkey, ..._] = tag;
//         // event mention
//         break;
//       }
//       case "t": {
//         const [, hashtag, ..._] = tag;
//         // event mention
//         break;
//       }
//       case "r": {
//         const [, url, ..._] = tag;
//         // event mention
//         break;
//       }
//       case "alt": {
//         const [, summary, ..._] = tag;
//         // event mention
//         break;
//       }
//       default: {
//         break;
//       }
//     }
//   }
//   return effects;
// }
//

function findId(feed: FlatFeed, id: string): Result<string> {
  const has = feed[id];
  if (!has) return { ok: id };
  else {
    try {
      const bigint = BigInt(id);
      const n = bigint + 1n;
      return findId(feed, n.toString());
    } catch (e) {
      return { error: "not a number" };
    }
  }
}
function updateCursor(cursor: Cursor, ncursor: Cursor, earlier: boolean) {
  if (!cursor) return ncursor;
  if (!ncursor) return cursor;
  const or = BigInt(cursor);
  const nw = BigInt(ncursor);
  const shouldChange = earlier ? nw < or : nw > or;
  return shouldChange ? ncursor : cursor;
}
export function consolidateFeeds(fols: Disaggregated<Map<string, FC>>): FC {
  const f: FlatFeed = {};
  let start: Cursor = null;
  let end: Cursor = null;
  const urbitfeeds = fols.urbit.entries();
  const nostrfeeds = fols.nostr.entries();

  // TODO make this code DRY
  for (const [_userString, fc] of urbitfeeds) {
    start = updateCursor(start, fc.start, true);
    end = updateCursor(end, fc.end, false);

    const poasts = Object.values(fc.feed);
    for (const p of poasts) {
      const nid = findId(f, p.id);
      if ("error" in nid) continue;
      f[nid.ok] = p;
    }
  }
  for (const [_userString, fc] of nostrfeeds) {
    start = updateCursor(start, fc.start, true);
    end = updateCursor(end, fc.end, false);

    const poasts = Object.values(fc.feed);
    for (const p of poasts) {
      const nid = findId(f, p.id);
      if ("error" in nid) continue;
      f[nid.ok] = p;
    }
  }
  return { start, end, feed: f };
}

// the oldest note's created_at (unix seconds), where paging back starts
export function oldestNoteTime(fc: FC | undefined): number | null {
  let oldest: number | null = null;
  for (const p of Object.values(fc?.feed ?? {})) {
    const t = p.event?.created_at;
    if (typeof t === "number" && (oldest === null || t < oldest)) oldest = t;
  }
  return oldest;
}
