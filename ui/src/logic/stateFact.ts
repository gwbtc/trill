import type { DFollowGraph, Disaggregated, FollowGraph, Fact, NostrData, NostrFeeds, Relays, UserProfile } from "@/types/nostrill";
import type { FC, Poast } from "@/types/trill";
import { SYNC_SUB_NAME } from "./constants";
import { nostrFeedsToFcMap } from "./nostrill";
import { parseLists, type Lists } from "./lists";
import { isRecord, parseNostrData, parseProfiles, parseFollowGraph, projectSocial } from "./socialState";

export type UserTagged = { urbit: string } | { nostr: string };
export type StateFactSlices = {
  relays: Relays; myFeed: FC; timeline: FC; pubkey: string; lists: Lists;
  nostrData: NostrData; nostrFeedsRaw: NostrFeeds; nostrFeeds: Record<string, FC>; nostrFeed: FC;
  urbitProfiles: Map<string, UserProfile>; profiles: Map<string, UserProfile>;
  nativeFollowGraph: FollowGraph; followGraph: DFollowGraph;
  following: Disaggregated<Map<string, FC>>; followedUsers: Set<string>; nostrUserFeeds: Map<string, FC>;
};
export const emptyFC = (): FC => ({ feed: {}, start: null, end: null });

export function parseStateFact(raw: unknown, our = ""): StateFactSlices {
  const st = isRecord(raw) ? raw : {};
  const nostrData = parseNostrData(st.nostr);
  const nostrFeedsRaw = nostrData.feeds;
  const nostrFeeds = nostrFeedsToFcMap(nostrFeedsRaw);
  const urbitProfiles = parseProfiles(st.profiles);
  const nativeFollowGraph = parseFollowGraph(st.followGraph);
  const nativeFeeds = new Map<string, FC>(Object.entries(isRecord(st.following) ? st.following : {}));
  return {
    relays: isRecord(st.relays) ? st.relays : {},
    myFeed: isRecord(st.feed) ? st.feed as FC : emptyFC(),
    timeline: isRecord(st.timeline) ? {
      feed: isRecord(st.timeline.global) ? st.timeline.global : {},
      start: st.timeline.start ?? null, end: st.timeline.end ?? null,
    } : emptyFC(),
    nostrData, nostrFeedsRaw, nostrFeeds, nostrFeed: nostrFeeds[SYNC_SUB_NAME] ?? emptyFC(),
    urbitProfiles, nativeFollowGraph,
    ...projectSocial(nativeFeeds, nativeFollowGraph, urbitProfiles, nostrData, our),
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
export function updateFollowing(
  f: Map<string, FC>,
  post: Poast,
  action: "add" | "del",
): Map<string, FC> {
  const curr = f.get(post.host);
  if (action === "del") {
    if (curr && curr.feed[post.id]) {
      const feed = { ...curr.feed };
      delete feed[post.id];
      const nfc = { ...curr, feed };
      const nmap = new Map(f).set(post.host, nfc);
      return nmap;
    } else return f;
  }
  const fc = curr ? curr : { feed: {}, start: null, end: null };
  const nf = { ...fc, feed: { ...fc.feed, [post.id]: post } };
  const nmap = new Map(f).set(post.host, nf);
  return nmap;
}
