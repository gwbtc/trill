import type { NostrFeeds, Relays, UserProfile } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { SYNC_SUB_NAME } from "./constants";
import { nostrFeedsToFcMap } from "./nostrill";

export type UserTagged = { urbit: string } | { nostr: string };

export type StateFactSlices = {
  relays: Relays;
  myFeed: FC;
  nostrFeedsRaw: NostrFeeds;
  nostrFeeds: Record<string, FC>;
  nostrFeed: FC;
  profiles: Map<string, UserProfile>;
  following: Map<string, FC>;
  timeline: FC;
  followGraph: Record<string, UserTagged[]>;
  pubkey: string;
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
  return {
    relays: isObject(st.relays) ? st.relays : {},
    myFeed: isObject(st.feed) ? (st.feed as FC) : emptyFC(),
    nostrFeedsRaw,
    nostrFeeds,
    nostrFeed: nostrFeeds[SYNC_SUB_NAME] ?? emptyFC(),
    profiles: new Map(Object.entries(isObject(st.profiles) ? st.profiles : {})),
    following: new Map(
      Object.entries(isObject(st.following) ? st.following : {}),
    ),
    timeline,
    followGraph: isObject(st.followGraph) ? st.followGraph : {},
    pubkey: typeof st.key === "string" ? st.key : "",
  };
}
