import * as nip19 from "nostr-tools/nip19";

// NIP-27 references in note text: "nostr:npub1…", "nostr:nprofile1…" (people)
// and "nostr:note1…", "nostr:nevent1…" (notes). anything else, or anything
// that doesn't decode, stays text

export type NostrRefToken =
  | { text: string }
  | { profile: string; raw: string } // hex pubkey
  | { event: string; raw: string }; // hex event id

const NOSTR_REF = /nostr:((?:npub|nprofile|note|nevent)1[02-9ac-hj-np-z]+)/gi;

export function splitNostrRefs(text: string): NostrRefToken[] {
  const out: NostrRefToken[] = [];
  let last = 0;
  const pushText = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && "text" in prev) prev.text += s;
    else out.push({ text: s });
  };
  for (const m of text.matchAll(NOSTR_REF)) {
    const start = m.index;
    pushText(text.slice(last, start));
    last = start + m[0].length;
    const ref = decodeRef(m[1]);
    if (ref) out.push({ ...ref, raw: m[0] });
    else pushText(m[0]);
  }
  pushText(text.slice(last));
  return out;
}

function decodeRef(bech: string): { profile: string } | { event: string } | null {
  try {
    const { type, data } = nip19.decode(bech.toLowerCase());
    if (type === "npub") return { profile: data };
    if (type === "nprofile") return { profile: data.pubkey };
    if (type === "note") return { event: data };
    if (type === "nevent") return { event: data.id };
    return null;
  } catch {
    return null;
  }
}

// "npub1abcd…wxyz", for people we have no name for
export function shortNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

// "note1abcd…wxyz"
export function shortNote(id: string): string {
  const note = nip19.noteEncode(id);
  return `${note.slice(0, 9)}…${note.slice(-4)}`;
}

// everyone mentioned in these texts, once each
export function mentionedPubkeys(texts: string[]): string[] {
  const out = new Set<string>();
  for (const text of texts) {
    if (!text.includes("nostr:")) continue;
    for (const t of splitNostrRefs(text)) if ("profile" in t) out.add(t.profile);
  }
  return [...out];
}
