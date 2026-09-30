import type { Wevent, Event } from "@/types/nostr";
import type { Content, Cursor, FC, FlatFeed, Poast } from "@/types/trill";
import { defaultGate, engagementBunt } from "./bunts";
import type {
  BasicProfile,
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

// nostr post ids are created_at in ms, so two events from the same second
// collide: give a newcomer the next free id instead of overwriting. an
// event we already hold (same hash) keeps its slot.
// mutates `fc`; callers hand it a feed they own
function putPoast(fc: FC, p: Poast) {
  let id = Number(p.id);
  while (fc.feed[`${id}`] && fc.feed[`${id}`].hash !== p.hash) id++;
  p.id = `${id}`;
  fc.feed[p.id] = p;
  if (!fc.start || id < Number(fc.start)) fc.start = p.id;
  if (!fc.end || id > Number(fc.end)) fc.end = p.id;
}
export function eventsToFc(postEvents: Wevent[]): FC {
  const fc: FC = { feed: {}, start: null, end: null };
  for (const event of postEvents) {
    const p = eventToPoast(event);
    if (p) putPoast(fc, p);
  }
  return fc;
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
  const p = eventToPoast(event);
  if (!p) return fc;
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
    point: 0n, patp: "~zod", gwid: {
      english:
        { nym: "", abridged: "", foreshortened: "" },
      hanzi: { nym: "", abridged: "", foreshortened: "" },
    }
  }
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
export function consolidateFeeds(fols: Map<string, FC>): FC {
  const f: FlatFeed = {};
  let start: Cursor = null;
  let end: Cursor = null;
  const feeds = fols.entries();
  for (const [_userString, fc] of feeds) {
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
