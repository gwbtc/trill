// import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { NPool, NRelay1, type NostrEvent } from "@nostrify/nostrify";
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
export function decodeNostrKey(key: string): string | null {
  try {
    const { type, data } = nip19.decode(key);
    if (type === "nevent") return data.id;
    else if (type === "nprofile") return data.pubkey;
    else if (type === "naddr") return data.pubkey;
    else if (type === "npub") return data;
    else if (type === "nsec") return uint8ArrayToHexString(data);
    else if (type === "note") return data;
    else return null;
  } catch (e) {
    try {
      // TODO do we want this for something
      nip19.npubEncode(key);
      return key;
    } catch (e2) {
      console.error(e2, "not valid nostr key");
      return null;
    }
  }
}
function uint8ArrayToHexString(uint8Array: Uint8Array) {
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

// let pk = getPublicKey(generateSecretKey())
// let npub = nip19.npubEncode(pk)
// let { type, data } = nip19.decode(npub)
// assert(type === 'npub')
// assert(data === pk)

// let pk = getPublicKey(generateSecretKey())
// let relays = ['wss://relay.nostr.example.mydomain.example.com', 'wss://nostr.banana.com']
// let nprofile = nip19.nprofileEncode({ pubkey: pk, relays })
// let { type, data } = nip19.decode(nprofile)
// assert(type === 'nprofile')
// assert(data.pubkey === pk)
// assert(data.relays.length === 2)
//
// nevent1qqsp3faj5jy9fpc6779rcs9kdccc0mxwlv2pnhymwqtjmletn72u5echttguv;
