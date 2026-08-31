// relays = provenance: which relay(s) delivered this event.
// Optional because plain events (scries, %event/%thread facts) don't carry it.
export type Wevent = Event & { relays?: string[] };
export type Event = {
  id: string; // hex, no 0x, 32bytes
  pubkey: string; // ""
  sig: string; // "", 64 bytes
  created_at: number;
  kind: number;
  tags: Tag[];
  content: string;
};

export type NostrEvent = Event;
export type Tag = string[];
