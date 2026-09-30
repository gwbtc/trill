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
  const counts = new Map<string, number>();
  for (const [follower, follows] of Object.entries(followGraph)) {
    // only the graph of people we follow counts
    if (!following.has(follower)) continue;
    for (const u of Array.isArray(follows) ? follows : []) {
      const id = userId(u);
      if (!id || exclude.has(id) || following.has(id) || lists.muted.has(id)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([id, followedBy]) => ({ id, followedBy }));
}

// the backend's followGraph only ever holds our own follows, so the follows
// of the people we follow come from their profiles. merges both, one entry
// per user
export function followGraphWithProfiles(
  followGraph: Record<string, UserTagged[]>,
  profiles: Map<string, { following?: unknown }>,
): Record<string, UserTagged[]> {
  const graph: Record<string, UserTagged[]> = {};
  const add = (follower: string, follows: unknown) => {
    if (!Array.isArray(follows)) return;
    const seen = new Set((graph[follower] ?? []).map(userId));
    const list = graph[follower] ?? [];
    for (const u of follows) {
      const id = u && userId(u);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push(u);
    }
    graph[follower] = list;
  };
  for (const [follower, follows] of Object.entries(followGraph)) add(follower, follows);
  for (const [follower, prof] of profiles) add(follower, prof?.following);
  return graph;
}
