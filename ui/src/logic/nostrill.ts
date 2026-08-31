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

export function eventsToFc(postEvents: Wevent[]): FC {
  const fc = postEvents.reduce(
    (acc: FC, event: Wevent) => {
      const p = eventToPoast(event);
      // console.log({ event, p });
      if (!p) return acc;
      acc.feed[p.id] = p;
      if (!acc.start || event.created_at < Number(acc.start)) acc.start = p.id;
      if (!acc.end || event.created_at > Number(acc.end)) acc.end = p.id;
      return acc;
    },
    { feed: {}, start: null, end: null } as FC,
  );
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
export function addEventToFc(event: Wevent, fc: FC): FC {
  const p = eventToPoast(event);
  if (!p) return fc;
  fc.feed[p.id] = p;
  if (!fc.start || event.created_at < Number(fc.start)) fc.start = p.id;
  if (!fc.end || event.created_at > Number(fc.end)) fc.end = p.id;
  return fc;
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
  const sections = text.split(URL_REGEX);
  for (const sec of sections) {
    if (!sec) continue;
    const s = sec.trim();
    if (!s) continue;
    if (URL_REGEX.test(s)) {
      if (IMAGE_SUBREGEX.test(s)) {
        pics.push(s);
      } else if (VIDEO_SUBREGEX.test(s)) {
        vids.push(s);
      } else tokens.push({ link: { href: s, show: s } });
    } else tokens.push({ text: s });
  }

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
    else if (ff === "r")
      contents.push({
        paragraph: [{ link: { show: tag[1]!, href: tag[1]! } }],
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
          path: tag[2] || "" + `/${tag[3] || ""}`,
        },
      });
    // else console.log("odd tag", tag);
  }
  if (!poast.parent && !poast.thread) {
    const tags = event.tags.filter((t) => t[0] !== "p");
    // console.log("no parent", { event, poast, tags });
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
export function userToString(user: UserType): Result<string> {
  if ("urbit" in user) {
    const isValid = isValidPatp(user.urbit.patp);
    if (isValid) return { ok: user.urbit.patp };
    else return { error: "invalid @p" };
  } else if ("nostr" in user) return { ok: user.nostr };
  else return { error: "unknown user" };
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
export function disaggregate(
  fols: Map<string, FC>,
  choice: "urbit" | "nostr",
): FC {
  const f: FlatFeed = {};
  let start: Cursor = null;
  let end: Cursor = null;
  const feeds = fols.entries();
  for (const [userString, fc] of feeds) {
    const want =
      choice === "urbit"
        ? isValidPatp(userString)
        : !!decodeNostrKey(userString);
    if (!want) continue;
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
