import type { DFollowGraph, Disaggregated } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { userId, type Lists } from "./lists";

type UserTagged = { urbit: string } | { nostr: string };

// "who to follow": people followed by the people we follow, ranked by how
// many of them follow each one. never suggests ourselves, anyone we already
// follow, or anyone we muted
export function suggestFollows(
  followGraph: Record<string, UserTagged[]>,
  following: { has: (id: string) => boolean },
  lists: Lists,
  ourIds: string[],
  limit = 4,
): { id: string; followedBy: number }[] {
  const exclude = new Set(ourIds);
  const isFollowing = (id: string) =>
    following.has(id);
  const counts = new Map<string, number>();
  for (const [follower, follows] of Object.entries(followGraph)) {
    // only the graph of people we follow counts
    if (!isFollowing(follower)) continue;
    for (const u of Array.isArray(follows) ? follows : []) {
      const id = userId(u);
      if (!id || exclude.has(id) || isFollowing(id) || lists.muted.has(id))
        continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([id, followedBy]) => ({ id, followedBy }));
}

// Graph entries use rich Urbit/Nostr identities; profiles use tagged users.
// Normalize both into an ID-keyed graph for ranking, one edge per follower
// and candidate so overlapping graph/profile data cannot inflate the count.
export function followGraphWithProfiles(
  followGraph: DFollowGraph,
  profiles: Map<string, { following?: unknown }>,
): Record<string, UserTagged[]> {
  const graph: Record<string, UserTagged[]> = {};
  const add = (follower: string, follows: unknown) => {
    if (!Array.isArray(follows)) return;
    const seen = new Set((graph[follower] ?? []).map(userId));
    const list = graph[follower] ?? [];
    for (const raw of follows) {
      const u = toTaggedUser(raw);
      if (!u) continue;
      const id = userId(u);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push(u);
    }
    graph[follower] = list;
  };
  for (const [follower, follows] of followGraph.urbit)
    add(follower.patp, follows);
  for (const [follower, follows] of followGraph.nostr)
    add(follower.pubkey, follows.map((user) => ({ nostr: user.pubkey })));
  for (const [follower, prof] of profiles) add(follower, prof?.following);
  return graph;
}

function toTaggedUser(value: unknown): UserTagged | null {
  if (!value || typeof value !== "object") return null;
  if ("urbit" in value) {
    const u = value.urbit;
    const id = typeof u === "string"
      ? u
      : u && typeof u === "object" && "patp" in u ? u.patp : null;
    return typeof id === "string" && id ? { urbit: id } : null;
  }
  if ("nostr" in value) {
    const u = value.nostr;
    const id = typeof u === "string"
      ? u
      : u && typeof u === "object" && "pubkey" in u ? u.pubkey : null;
    return typeof id === "string" && id ? { nostr: id } : null;
  }
  return null;
}
