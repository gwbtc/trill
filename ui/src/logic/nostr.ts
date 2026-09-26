// import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { NRelay1 } from "@nostrify/nostrify";
import * as nip19 from "nostr-tools/nip19";
import type { Event } from "@/types/nostr";

export function generateNevent(event: Event) {
  const evp: nip19.EventPointer = {
    id: event.id,
    author: event.pubkey,
    kind: event.kind,
  };
  const nev = nip19.neventEncode(evp);
  return nev;
}

export function generateNpub(pubkey: string) {
  const npub = nip19.npubEncode(pubkey);
  return npub;
}
export function generateNprofile(pubkey: string) {
  const prof = { pubkey };
  const nprofile = nip19.nprofileEncode(prof);
  return nprofile;
}
const HEX64 = /^[0-9a-f]{64}$/i;

// a user's pubkey (hex) from npub/nprofile/naddr or raw hex. never decodes
// an nsec: that would turn a pasted secret key into a "pubkey" that ends up
// in URLs and relay filters. note/nevent ids are not users either
export function decodeNostrKey(key: string): string | null {
  if (HEX64.test(key)) return key.toLowerCase();
  try {
    const { type, data } = nip19.decode(key);
    if (type === "npub") return data;
    if (type === "nprofile") return data.pubkey;
    if (type === "naddr") return data.pubkey;
    return null;
  } catch {
    return null;
  }
}

// an event id (hex) from note/nevent or raw hex
export function decodeNostrEventId(id: string): string | null {
  if (HEX64.test(id)) return id.toLowerCase();
  try {
    const { type, data } = nip19.decode(id);
    if (type === "note") return data;
    if (type === "nevent") return data.id;
    return null;
  } catch {
    return null;
  }
}

export async function fetchProfiles(relayURL: string, pubkeys: string[]) {
  //
  //
  const relay = new NRelay1(relayURL);
  const res = relay.req([{ kinds: [0], authors: pubkeys }]);
  return res;
}
export async function fetchFollows(relayURL: string, pubkey: string) {
  //
  //
  const relay = new NRelay1(relayURL);
  const res = relay.req([{ kinds: [3], authors: [pubkey] }]);
  let ret: string[] = [];
  for await (const msg of res) {
    if (msg[0] === "EVENT") {
      //
      ret = msg[2].tags.map((t) => t[1]);
    }
    if (msg[0] === "EOSE") {
      break;
    }
  }
  return ret;
}
export async function fetchFollowers(relayURL: string, pubkey: string) {
  //
  //
  const relay = new NRelay1(relayURL);
  // const res = await relay.count([{ kinds: [3], "#p": [pubkey] }]);
  const res = await relay.query([{ kinds: [3], "#p": [pubkey] }]);
  return res.map((ev) => ev.pubkey);
}
