import type {
  DeliveryStatus,
  DeliveryStatusMap,
  DM,
  DMJail,
  DMRequest,
  DMRequests,
  DMs,
  UrbitID,
  UserProfile,
  UserType,
} from "@/types/nostrill";
import type { FC, Poast } from "@/types/trill";
import { patpToFallbackUID } from "./gw";
import { postToText } from "./search";

export interface DmMessageView {
  id: bigint;
  post: Poast;
  mine: boolean;
  text: string;
  time: string;
  day?: string;
  unread: boolean;
  delivery?: DeliveryStatus;
}

export interface DmConversationView {
  id: string;
  id2: string;
  name: string;
  user: UserType;
  muted: boolean;
  blocked: boolean;
  time: string;
  unread: number;
  preview: string;
  messages: DmMessageView[];
  lastId: bigint | null;
  lastReadId: bigint | null;
}

export interface DmRequestView {
  id: string;
  id2: string;
  name: string;
  user: UserType;
  time: string;
  preview: string;
}

export function buildDmConversations(
  dms: DMs,
  profiles: Map<string, UserProfile>,
  our: string,
) {
  return Object.entries(dms)
    .map(([key, dm]) => buildDmConversation(dm, profiles, our, key))
    .sort((a, b) => {
      const bb = b.lastId || 0n;
      const aa = a.lastId || 0n;
      return bb > aa
        ? 1
        : aa > bb
          ? -1
          : 0;
    });
}

export function mergeDmJailConversations(
  conversations: DmConversationView[],
  jail: DMJail | null | undefined,
) {
  const muted = new Map((jail?.muted || []).map((peer) => [peer.patp, peer]));
  const blocked = new Map((jail?.blocked || []).map((peer) => [peer.patp, peer]));
  if (muted.size === 0 && blocked.size === 0) return conversations;

  const seen = new Set<string>();
  const merged = conversations.map((conversation) => {
    seen.add(conversation.id);
    seen.add(conversation.id2);
    const isBlocked = blocked.has(conversation.id) || blocked.has(conversation.id2);
    const isMuted = muted.has(conversation.id) || muted.has(conversation.id2);
    return {
      ...conversation,
      blocked: conversation.blocked || isBlocked,
      muted: conversation.muted || isMuted,
    };
  });

  const jailedOnly = [...blocked.values(), ...muted.values()]
    .filter((peer, index, peers) => {
      if (seen.has(peer.patp)) return false;
      return peers.findIndex((other) => other.patp === peer.patp) === index;
    })
    .map((peer) =>
      buildDmJailConversation(peer, muted.has(peer.patp), blocked.has(peer.patp)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...merged, ...jailedOnly];
}

export function buildDmRequestRows(requests: DMRequests) {
  return Object.entries(requests)
    .map(([key, request]) => buildDmRequestRow(request, key))
    .sort((a, b) => b.sortTime - a.sortTime)
    .map(({ sortTime: _sortTime, ...row }) => row);
}

function buildDmRequestRow(
  request: DMRequest,
  key = request.peer.patp,
): DmRequestView & { sortTime: number } {
  const preview = postToText(request.post);
  return {
    id: key,
    id2: request.peer.patp,
    name: formatPeerName(request.peer),
    user: { urbit: request.peer },
    time: formatDmTime(request.post.time),
    preview: preview || "[empty message]",
    sortTime: request.post.time || 0,
  };
}

export function getPinnedDmPatps(settings: Record<string, any> | null | undefined) {
  const value = settings?.noschat?.pinned;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function orderPinnedDmConversations<T extends { id: string }>(
  conversations: T[],
  pinnedPatps: string[],
) {
  if (pinnedPatps.length === 0) return conversations;

  const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const pinned = pinnedPatps
    .map((id) => byId.get(id))
    .filter((conversation): conversation is T => Boolean(conversation));
  const pinnedIds = new Set(pinned.map((conversation) => conversation.id));
  const rest = conversations.filter((conversation) => !pinnedIds.has(conversation.id));

  return [...pinned, ...rest];
}

export function dmConversationSearchText(conversation: DmConversationView) {
  return [
    conversation.id,
    conversation.id2,
    conversation.name,
    ...conversation.messages.map((message) => message.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterDmConversationsForSearch(
  conversations: DmConversationView[],
  normalizedQuery: string,
  rawQuery: string,
) {
  if (!normalizedQuery && !rawQuery) return [];
  return conversations.filter((conversation) => {
    const haystack = dmConversationSearchText(conversation);
    const has = haystack.includes(normalizedQuery) || haystack.includes(rawQuery);
    return has
  });
}

export function buildDmConversation(
  dm: DM,
  profiles: Map<string, UserProfile>,
  our: string,
  key = dm.peer.patp,
): DmConversationView {
  const peerPatp = dm.peer.patp;
  const messages = fcToMessages(dm.fc, our, dm.lastRead, getDmDeliveryMap(dm));
  const last = messages[messages.length - 1];
  const peerLabel = formatPeerName(dm.peer);

  return {
    id: key,
    name: peerLabel,
    id2: peerPatp,
    user: { urbit: dm.peer },
    muted: Boolean(dm.muted),
    blocked: Boolean(dm.blocked),
    time: dm.lastTs ? formatDmTime(dm.lastTs) : "",
    unread: dm.unread ?? 0,
    preview: last ? `${last.mine ? "you: " : ""}${last.text}` : "",
    messages,
    lastId: dm.lastId,
    lastReadId: dm.lastRead,
  };
}

function buildDmJailConversation(
  peer: UrbitID,
  muted: boolean,
  blocked: boolean,
): DmConversationView {
  const name = formatPeerName(peer);
  return {
    id: peer.patp,
    name,
    id2: peer.patp,
    user: { urbit: peer },
    muted,
    blocked,
    time: "",
    unread: 0,
    preview: blocked
      ? "Blocked before a conversation started"
      : "Muted before a conversation started",
    messages: [],
    lastId: null,
    lastReadId: null,
  };
}

export function fcToMessages(
  fc: FC | null | undefined,
  our: string,
  lastRead: bigint | null,
  delivery: DeliveryStatusMap = {},
) {
  const posts = Object.values(fc?.feed || {}).sort((a, b) => a.time - b.time);
  return posts.map((post, index) => {
    const mine = post.author === our;
    const id = BigInt(post.id);
    const unread = lastRead === null ? true : id > lastRead;
    return {
      id,
      post,
      mine,
      text: postToText(post) || "[empty message]",
      time: formatDmTime(post.time),
      day: shouldShowDay(posts[index - 1], post) ? formatDmDay(post.time) : undefined,
      unread,
      delivery: delivery[post.id],
    } satisfies DmMessageView;
  });
}

export function getDmDeliveryMap(dm: Pick<DM, "delivery">): DeliveryStatusMap {
  return dm.delivery || {};
}

export function getDmUnreadCount(dms: DMs) {
  return Object.values(dms).reduce((total, dm) => {
    return total + (dm.unread > 0 ? 1 : 0);
  }, 0);
}

export function filterDmDirectory(
  query: string,
  dms: DMs,
  profiles: Map<string, UserProfile>,
) {
  const normalized = query.trim().toLowerCase();
  const compare = normalized.replace(/^[~@]/, "");
  const known = new Map<string, { id2: string; name: string; label: string }>();

  Object.entries(dms).forEach(([key, dm]) => {
    const label = formatPeerName(dm.peer);
    known.set(key, {
      id2: key,
      name: label,
      label,
    });
  });
  profiles.forEach((profile, id) => {
    const urbitID = profile.urbitID;
    const label = urbitID ? formatPeerName(urbitID) : formatPeerId(id);
    known.set(id, {
      id2: urbitID?.patp || id,
      name: profile.name || label,
      label,
    });
  });

  return Array.from(known.values())
    .filter((person) => {
      if (!normalized) return true;
      return (
        person.name.toLowerCase().includes(compare) ||
        person.label.toLowerCase().includes(compare) ||
        person.id2.toLowerCase().includes(normalized) ||
        person.id2.toLowerCase().includes(compare)
      );
    })
    .slice(0, 12)
    .map((person) => ({ ...person, existing: Boolean(dms[person.id2]) }));
}

export function canCreateRawDm(query: string) {
  const trimmed = query.trim();
  return (
    trimmed.length > 3 &&
    (trimmed.startsWith("~") || trimmed.toLowerCase().startsWith("npub1"))
  );
}

export function dmUserFromId(id2: string): UserType {
  if (id2.startsWith("~")) {
    try {
      return { urbit: patpToFallbackUID(id2) };
    } catch {
      return { nostr: id2 };
    }
  }
  return { nostr: id2 };
}

export function formatPeerName(peer: UrbitID) {
  return peer.gwid?.english?.abridged || peer.gwid?.english?.foreshortened || peer.patp;
}

export function formatPeerId(peer: string) {
  if (peer.length <= 24) return peer;
  return `${peer.slice(0, 12)}...${peer.slice(-6)}`;
}

function numericReadId(post: Poast) {
  if (Number.isFinite(post.time)) return post.time;
  const parsed = Number(post.id);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldShowDay(previous: Poast | undefined, current: Poast) {
  if (!previous) return true;
  const prev = numericReadId(previous);
  const curr = numericReadId(current);
  if (!prev || !curr) return false;
  return new Date(prev).toDateString() !== new Date(curr).toDateString();
}

function formatDmTime(timestamp: number | null) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDmDay(timestamp: number | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString([], { weekday: "long" });
}
