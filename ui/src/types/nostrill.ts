import type { ListsFact } from "@/logic/lists";
import type { Wevent as NostrEvent } from "./nostr";
import type { NostrFilter } from "@nostrify/nostrify";
import type { Cursor, FC, FlatFeed, FullNode, Poast } from "./trill";

// export type UserType = { urbit: string } | { nostr: string };
export type UserType = { urbit: UrbitID } | { nostr: string };
export interface UserProfile extends BasicProfile {
  pubkey: string;
  following: UserType[];
  followingCount: number;
  followers: UserType[];
  followerCount: number;
  urbitID: UrbitID | null;
  gwid?: GroundwireID;
}
export interface BasicProfile {
  name: string;
  picture: string; // URL
  about: string;
  other: Record<string, any>;
}
export interface UrbitIDRaw {
  patp: string;
  point: string;
  gwid: GroundwireID;
}
export interface UrbitID {
  patp: string;
  point: bigint;
  gwid: GroundwireID;
}
export interface GroundwireID {
  english: GWNyms;
  hanzi: GWNyms;
}
export interface GWNyms {
  nym: string;
  abridged: string;
  foreshortened: string;
}
export type DateObj = { month: number; day: number; year?: number };
// who may reply to a post; the backend turns this into a ship
// whitelist on the post's write perms
export type ReplyPolicy = "everyone" | "following" | "mentioned";

export type PostWrapper =
  | { nostr: NostrPost }
  | { urbit: { post: Poast; nostr?: NostrMetadata } };
export type NostrPost = {
  relay: string;
  event: NostrEvent;
  post: Poast;
};
export type NostrMetadata = {
  pubkey: string;
  eventId: string;
  relay?: string;
  post: Poast;
};
export type Relays = Record<string, RelayStats>;
export type RelayStats = {
  start: number;
  // current socket id; null while disconnected/backing off
  wid: number | null;
  reqs: RelayReqs;
  // reconnect machinery; null while a deliberate close is in flight
  status?: RelayConn | null;
};
export type RelayConn = {
  stage: "idle" | "connecting" | "connected";
  tries: number;
  since: number;
  next: number | null;
  subs: string[]; // sub names replayed after reconnect
};
export type RelayReqs = Record<string, RelayRequest>;
export type RelayRequest = {
  // subID: string; // actually the key, not to add it
  eventsReceived: number;
  filters: NostrFilter[];
  name: string;
  ongoing: true | false | null;
  chunked?: boolean;
  subId?: string;
  sent?: number;
  eose?: null | { ts: number; count: number };
};
// nostr-feeds from the backend: per-sub-name, per-relay-url sourced feeds.
// Provenance is the point: every event stays traceable to the relay(s) that
// served it and the request (sub) that asked for it.
export type SourcedFeed = { feed: NostrEvent[]; sub: RelayRequest };
export type NostrFeeds = Record<string, Record<string, SourcedFeed>>; // subName → relayUrl
export type Timeline = { global: FlatFeed; start: Cursor; end: Cursor };

export type PeekRes = { feed: PeekFeedRes } | { thread: PeekThreadRes };
export type PeekFeedRes = Deferred<FeedData>;
export type PeekThreadRes = { id: string; data: Deferred<ThreadData> };

export type ThreadData = { node: FullNode; thread: FullNode[] };
export type Fact =
  | { nostr: NostrFact }
  | { post: PostFact }
  | { fols: FolsFact }
  | { prof: Record<string, UserProfile> }
  | { keys: string }
  | { lists: ListsFact };

export type NamedWfeed = { name: string; feed: NostrEvent[] };
export type NostrFact =
  | { feed: NamedWfeed }
  | { user: NamedWfeed }
  | { thread: NostrEvent[] }
  | { event: NostrEvent }
  | { sub: { subId: string; type: string } }
  | { eose: string }
  | { drop: string }
  | { relays: Relays }
  | { "sent-post": { host: any; id: string; relays: string[] } }
  | { "sent-prof": string[] };

export type PostFact =
  | { add: { post: Poast } }
  | { upd: { post: Poast } }
  | { del: { post: Poast } };

export type EngaFact = { add: NostrEvent[] } | { del: NostrEvent[] };

export type FolsFact =
  | { "new-urbit": Enbowled<Deferred<FeedData>> }
  | { "new-nostr": NostrFollow }
  | { quit: string };

export type NostrFollow = {
  pubkey: string;
  profile: UserProfile | null;
  relays: string[];
};
export type FeedData = { feed: FC; profile: UserProfile | null };

export type Notification =
  | { prof: NostrEvent[] }
  | { fols: NostrEvent[] }
  | { beg: NostrEvent[] }
  | { fans: NostrEvent[] }
  | { post: NostrEvent[] };

export type Enbowled<T> = {
  user: string;
  ts: number;
  data: T;
};
export type Deferred<T> = {
  data: "maybe" | Approved<T>;
  msg: string;
};
export type Approved<T> = T | null;
// chat
export type PeekDMsRes = Record<string, DMRaw>;
export type DMJail = { muted: UrbitID[]; blocked: UrbitID[] }
export type PeekDMInboxRes = { dms: PeekDMsRes, requests: DMRequests, jail: DMJail };
export type DMRaw = {
  fc: FC,
  lastId: string | null;
  lastTs: number | null;
  lastRead: string | null;
  unread: number;
  peer: UrbitID;
  muted: boolean;
  blocked: boolean;
  delivery: DeliveryStatusMap;
};
export type DeliveryStatusMap =  Record<string, DeliveryStatus>;
export type DeliveryStatus =   "sending" | "pending" | "failed"
export type DM = {
  fc: FC;
  lastId: bigint | null;
  lastTs: number | null;
  lastRead: bigint | null;
  unread: number;
  peer: UrbitID;
  muted: boolean;
  blocked: boolean;
  delivery: DeliveryStatusMap;
};
export type DMs = Record<string, DM>
export type PeekDMRes = DMRaw;
export type DMRequests = Record<string, DMRequest>;
export type DMRequest = { peer: UrbitID, post: Poast };
export type DMFact =
  | { init: PeekDMInboxRes }
  | { peer: DMRaw }
  | { requests: DMRequests }
  | { error: string }
