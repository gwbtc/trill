// %chat API v4 on the installed Tlon %groups desk (chat mold v7).
// Keep message IDs and Urbit time IDs as strings throughout this layer.
export type TlonWhom = string;
export type TlonStory = ReadonlyArray<{
  inline?: ReadonlyArray<unknown>;
  block?: Readonly<Record<string, unknown>>;
}>;

export interface TlonMessage {
  id: string;
  time: string;
  sequence: number;
  author: string;
  sent: number;
  content: TlonStory;
  delivery?: "sending" | "failed";
}

export interface TlonConversation {
  id: TlonWhom;
  kind: "direct" | "group";
  title: string;
  members: string[];
  invitedMembers: string[];
  invited: boolean;
  archived: boolean;
  blocked: boolean;
  unread: number;
  recency: number;
  latest: TlonMessage | null;
  firstUnreadTime?: string;
}

export interface TlonInbox {
  conversations: Map<TlonWhom, TlonConversation>;
  blocked: string[];
}

export interface TlonMessagePage {
  messages: TlonMessage[];
  older: string | null;
  newer: string | null;
  total: number;
}

export interface TlonDraft {
  // The caller supplies a unique ship/@da ID; acknowledgement is not delivery.
  id: string;
  sent: number;
  content: TlonStory;
}

export type TlonEvent =
  | { type: "chat"; data: Readonly<Record<string, unknown>> }
  | { type: "unread"; data: Readonly<Record<string, unknown>> }
  | { type: "invites"; ships: string[] };
