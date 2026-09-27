import type { YarnContent } from "./hark";
import type { Ship } from "./urbit";
import type { UserType } from "./nostrill";
import type { PID } from "./trill";
import type { Rope } from "./hark";

export type ReqStatus = "pending" | "ng" | "ok";
type BegType = { feed: null } | { thread: string };
export type Req =
  | { fols: Ship; status: ReqStatus }
  | { begs: BegType; status: ReqStatus };

export type Post =
  | { reply: { user: Ship; parent: PID; id: string } }
  | { quote: { user: Ship; src: PID; target: PID } }
  | { rp: { user: Ship; src: PID; target: PID } }
  | { reaction: { user: Ship; post: PID; reaction: string } }
  | { report: { user: Ship; post: PID; reason: string } }
  | { mention: { user: Ship; post: PID } }
  | { delReply: { user: Ship; parent: PID; id: string } }
  | { delQuote: { user: Ship; parent: PID; id: string } };

type Nostr =
  | { relayDown: string }
  | { newRelay: string }
  | { keys: { user: Ship; pubkey: string } };

export type NotificationType =
  | { prof: Ship }
  | { req: Req }
  | { res: Req }
  | { post: Post }
  | { nostr: Nostr }
  // %debates: a host inviting us
  | { debate: { invite: { host: Ship; id: string } } };

export interface Notification {
  id: string;
  type: NotificationType;
  timestamp: number;
  unread: boolean;
  // Optional context data
  from?: UserType;
  postId?: string;
  message: YarnContent[];
  reaction?: string;
  rope?: Rope;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}
