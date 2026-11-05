import type { DFollowGraph, Disaggregated, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { patpToFallbackUID } from "./gw";

export type FollowEntryData = {
  id: string;
  user: UserType;
  feed: FC | null;
};

// Graph keys retain full identities and include follows without a loaded feed.
// Merge feed-map keys too, since graph and feed updates arrive separately.
export function buildFollowEntries(
  following: Disaggregated<ReadonlyMap<string, FC>>,
  graph: DFollowGraph,
  ownIds: readonly string[],
): Disaggregated<FollowEntryData[]> {
  const excluded = new Set(ownIds);
  const urbit = new Map<string, FollowEntryData>();
  const nostr = new Map<string, FollowEntryData>();

  for (const [identity] of graph.urbit) {
    const id = identity.patp;
    if (!excluded.has(id))
      urbit.set(id, { id, user: { urbit: identity }, feed: following.urbit.get(id) ?? null });
  }
  for (const [identity] of graph.nostr) {
    const id = identity.pubkey;
    if (!excluded.has(id))
      nostr.set(id, { id, user: { nostr: id }, feed: following.nostr.get(id) ?? null });
  }
  for (const [id, feed] of following.urbit) {
    if (!excluded.has(id) && !urbit.has(id))
      urbit.set(id, { id, user: { urbit: patpToFallbackUID(id) }, feed });
  }
  for (const [id, feed] of following.nostr) {
    if (!excluded.has(id) && !nostr.has(id))
      nostr.set(id, { id, user: { nostr: id }, feed });
  }
  return { urbit: [...urbit.values()], nostr: [...nostr.values()] };
}
