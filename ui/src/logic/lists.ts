import type { Poast } from "@/types/trill";
import type { UserType } from "@/types/nostrill";

// bookmarks, mutes and reports, as kept by the %nostrill agent

// a post pointed at from a list: urbit posts by host and id, nostr posts by
// event id (mirrors post-ref in backend/sur/nostrill.hoon)
export type PostRef = { urbit: { host: string; id: string } } | { nostr: string };
type UserTagged = { urbit: string } | { nostr: string };
export type ListsFact = {
  bookmarks: { ref: PostRef; at: number }[];
  muted: UserTagged[];
  reported: PostRef[];
};
export type Lists = {
  // refKey -> bookmark
  bookmarks: Map<string, { ref: PostRef; at: number }>;
  // user ids: "~ship" or a nostr pubkey
  muted: Set<string>;
  // refKeys
  reported: Set<string>;
};

export const emptyLists = (): Lists => ({
  bookmarks: new Map(),
  muted: new Set(),
  reported: new Set(),
});

export function postRef(p: Poast): PostRef {
  return p.event ? { nostr: p.event.id } : { urbit: { host: p.host, id: p.id } };
}

export function refKey(r: PostRef): string {
  return "urbit" in r ? `u/${r.urbit.host}/${r.urbit.id}` : `n/${r.nostr}`;
}

// the user id a mute applies to: the ship for urbit posts, the pubkey for
// nostr ones
export function authorId(p: Poast): string {
  return p.event ? p.event.pubkey : p.author;
}

export function userId(u: UserType | UserTagged): string {
  if ("nostr" in u) return u.nostr;
  return typeof u.urbit === "string" ? u.urbit : u.urbit.patp;
}

export function parseLists(raw: unknown): Lists {
  const l = (raw ?? {}) as Partial<ListsFact>;
  const lists = emptyLists();
  for (const b of Array.isArray(l.bookmarks) ? l.bookmarks : [])
    if (b?.ref) lists.bookmarks.set(refKey(b.ref), { ref: b.ref, at: Number(b.at) || 0 });
  for (const u of Array.isArray(l.muted) ? l.muted : []) if (u) lists.muted.add(userId(u));
  for (const r of Array.isArray(l.reported) ? l.reported : []) if (r) lists.reported.add(refKey(r));
  return lists;
}

// reported posts are always hidden; muted authors' posts unless the caller
// shows them on purpose (their own profile page)
export function isHiddenPost(p: Poast, lists: Lists, showMuted = false): boolean {
  if (lists.reported.has(refKey(postRef(p)))) return true;
  return !showMuted && lists.muted.has(authorId(p));
}

// notifications from muted users are hidden (they stay on the ship)
export function withoutMuted<T extends { from?: UserType }>(items: T[], lists: Lists): T[] {
  if (lists.muted.size === 0) return items;
  return items.filter((n) => !(n.from && lists.muted.has(userId(n.from))));
}
