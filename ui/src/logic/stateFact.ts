import type {
  DFollowGraph,
  Disaggregated,
  Fact,
  FollowGraph,
  NostrFeeds,
  Relays,
  UserProfile,
} from "@/types/nostrill";
import type { FC, Poast } from "@/types/trill";
import { SYNC_SUB_NAME } from "./constants";
import { nostrFeedsToFcMap, stringToUser } from "./nostrill";
import { parseLists, type Lists } from "./lists";

export type UserTagged = { urbit: string } | { nostr: string };

export type StateFactSlices = {
  relays: Relays;
  myFeed: FC;
  nostrFeedsRaw: NostrFeeds;
  nostrFeeds: Record<string, FC>;
  nostrFeed: FC;
  profiles: Map<string, UserProfile>;
  timeline: FC;
  following: Disaggregated<Map<string, FC>>;
  followGraph: DFollowGraph;
  pubkey: string;
  lists: Lists;
};

export const emptyFC = (): FC => ({ feed: {}, start: null, end: null });

const isObject = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);

// Maps the raw `{ state: {...} }` fact from %nostrill's /ui subscription into
// store slices. Defensive: missing or oddly-shaped keys must never throw.
export function parseStateFact(s: unknown): StateFactSlices {
  const st = isObject(s) ? s : {};
  const nostrFeedsRaw: NostrFeeds = isObject(st.nostr) ? st.nostr : {};
  const nostrFeeds = nostrFeedsToFcMap(nostrFeedsRaw);
  // timeline arrives as { global, start, end }; the FE uses FCs everywhere
  const timeline: FC = isObject(st.timeline)
    ? {
        feed: isObject(st.timeline.global) ? st.timeline.global : {},
        start: st.timeline.start ?? null,
        end: st.timeline.end ?? null,
      }
    : emptyFC();
  const following = disaggregateFollowing(st.following);
  const followGraph = disaggregateFollowGraph(st.followGraph);

  return {
    relays: isObject(st.relays) ? st.relays : {},
    myFeed: isObject(st.feed) ? (st.feed as FC) : emptyFC(),
    nostrFeedsRaw,
    nostrFeeds,
    nostrFeed: nostrFeeds[SYNC_SUB_NAME] ?? emptyFC(),
    profiles: new Map(Object.entries(isObject(st.profiles) ? st.profiles : {})),
    following,
    timeline,
    followGraph,
    pubkey: typeof st.key === "string" ? st.key : "",
    lists: parseLists(st.lists),
  };
}

// the backend encodes an enbowl's user tagged ({ urbit: "~nec" }) while
// everything in the UI (following keys, patp comparisons) uses the bare id;
// flatten it once on arrival so every consumer of lastFact sees a string
export function normalizeFact(fact: Fact): Fact {
  if ("fols" in fact && "new-urbit" in fact.fols) {
    const nu = fact.fols["new-urbit"];
    const user = nu.user as string | UserTagged;
    if (typeof user === "object" && user)
      return {
        fols: {
          "new-urbit": {
            ...nu,
            user: "urbit" in user ? user.urbit : user.nostr,
          },
        },
      };
  }
  return fact;
}
export function disaggregateFollowing(
  f: Record<string, FC>,
): Disaggregated<Map<string, FC>> {
  const r = { urbit: new Map(), nostr: new Map() };
  console.log("disaggregating", f);
  for (const e of Object.entries(f)) {
    const u = stringToUser(e[0]);
    console.log({ e, u });
    if ("error" in u) continue;
    if ("urbit" in u.ok) r.urbit.set(e[0], e[1]);
    if ("nostr" in u.ok) r.nostr.set(e[0], e[1]);
  }
  return r;
}
export function disaggregateFollowGraph(f: FollowGraph): DFollowGraph {
  const r: DFollowGraph = { urbit: [], nostr: [] };
  for (const e of f) {
    if ("urbit" in e) r.urbit.push(e.urbit);
    if ("nostr" in e) r.nostr.push(e.nostr);
  }
  return r;
}
export function updateFollowing(
  f: Map<string, FC>,
  post: Poast,
  action: "add" | "del",
): Map<string, FC> {
  const curr = f.get(post.author);
  if (action === "del") {
    if (curr && curr.feed[post.id]) {
      const feed = { ...curr.feed };
      delete feed[post.id];
      const nfc = { ...curr, feed };
      const nmap = new Map(f).set(post.author, nfc);
      return nmap;
    } else return f;
  }
  const fc = curr ? curr : { feed: {}, start: null, end: null };
  const nf = { ...fc, feed: { ...fc.feed, [post.id]: post } };
  const nmap = new Map(f).set(post.author, nf);
  return nmap;
}
