import type { NostrEvent } from "@/types/nostr";

export type NostrEventRef = { id: string; relay?: string; pubkey?: string };
const HEX = /^[0-9a-f]{64}$/i;

// Prefer NIP-10 markers. Positional ancestry applies only to unmarked e tags;
// mentions, quotes and unknown markers must never become thread parents.
export function nostrThreadRefs(event: NostrEvent): { root?: NostrEventRef; parent?: NostrEventRef } {
  let root: NostrEventRef | undefined;
  let parent: NostrEventRef | undefined;
  const positional: NostrEventRef[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== "e" || !HEX.test(tag[1] ?? "")) continue;
    const ref = {
      id: tag[1].toLowerCase(),
      relay: relayHint(tag[2]),
      pubkey: HEX.test(tag[4] ?? "") ? tag[4].toLowerCase() : undefined,
    };
    if (tag[3] === "root") root ??= ref;
    else if (tag[3] === "reply") parent = ref;
    else if (!tag[3]) positional.push(ref);
  }
  if (root || parent) return { root, parent: parent ?? root };
  return { root: positional[0], parent: positional.at(-1) };
}

export function relayHint(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return (url.protocol === "wss:" || url.protocol === "ws:") && !url.username && !url.password
      ? url.href : undefined;
  } catch { return undefined; }
}
