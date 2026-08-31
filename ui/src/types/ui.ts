import type { NostrMetadata, NostrPost } from "./nostrill";
import type { Poast } from "./trill";
import type { Tweet } from "./twatter";
import type { Ship } from "./urbit";
export type Result<T> = { ok: T } | { error: string };
export type AsyncRes<T> = Promise<Result<T>>;

export type Timestamp = number;
export type UrbitTime = string;

export interface ComposerData {
  type: "quote" | "reply";
  post: SPID;
}
export type SPID = TrillPID | NostrPID | TwatterPID | RumorsPID;

export interface TrillPID {
  trill: Poast;
}
export interface NostrPID {
  nostr: NostrMetadata;
}
export interface TwatterPID {
  twatter: Tweet;
}
export interface RumorsPID {
  rumors: Poast;
}
export interface Guanxi {
  trill: Relationship;
  pals: Relationship;
}
export type Relationship = "mutual" | "incoming" | "outgoing" | "none";

// should make a sortug type codebase

export type BucketCreds = {
  opts: {
    bucket: string;
    origin: string; // this is the endpoint
    region: string;
  };
  creds: {
    credentials: {
      accessKey: string;
      secretKey: string;
    };
  };
};

export type DateStruct = { year: number; month: number; day: number };
export type ChatQuoteParams = { p: Ship; nest: string; id: string };
export type ReactGrouping = Array<{ react: string; ships: Ship[] }>;
