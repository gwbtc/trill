import type { DFollowGraph, Disaggregated, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { patpToFallbackUID } from "./gw";

export type FollowEntryData = {
  id: string;
  user: UserType;
  feed: FC | null;
};

// Membership is independent from cached author data and social-graph neighbors.
export function buildFollowEntries(
  following: Disaggregated<ReadonlyMap<string, FC>>,
  graph: DFollowGraph,
  ownIds: readonly string[],
  selected: ReadonlySet<string>,
): Disaggregated<FollowEntryData[]> {
  const excluded = new Set(ownIds);
  const identities = new Map(graph.urbit.map(([identity]) => [identity.patp, identity]));
  const entries: Disaggregated<FollowEntryData[]> = { urbit: [], nostr: [] };
  for (const id of selected) {
    if (excluded.has(id)) continue;
    if (id.startsWith("~")) {
      entries.urbit.push({ id, user: { urbit: identities.get(id) ?? patpToFallbackUID(id) }, feed: following.urbit.get(id) ?? null });
    } else {
      entries.nostr.push({ id, user: { nostr: id }, feed: following.nostr.get(id) ?? null });
    }
  }
  return entries;
}
