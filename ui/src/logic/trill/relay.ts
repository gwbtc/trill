import { isValidPatp } from "urbit-ob";
import type { Event } from "@/types/nostr";
import type { Poast } from "@/types/trill";

export const TRILL_EVENT_KIND = 667;
export interface NativePostRef {
  host: string;
  id: string;
}

// Kind 667 is Trill's relay namespace. A ship tag is a display claim, not an
// Urbit signature or permission grant. Ordinary Nostr notes never use it.
export function trillEventAuthor(
  event: Pick<Event, "kind" | "tags">,
): string | null {
  if (event.kind !== TRILL_EVENT_KIND) return null;
  const tags = event.tags.filter((tag) => tag[0] === "patp");
  const author = tags[0]?.[1];
  return author && isValidPatp(author) && tags.every((tag) => tag[1] === author)
    ? author
    : null;
}
export function trillEventRef(
  event: Pick<Event, "kind" | "tags">,
): NativePostRef | null {
  const host = trillEventAuthor(event);
  if (!host) return null;
  const tags = event.tags.filter((tag) => tag[0] === "trill");
  const id = tags[0]?.[1];
  if (
    !id ||
    !/^[1-9]\d{0,38}$/.test(id) ||
    BigInt(id) >= 1n << 128n ||
    !tags.every((tag) => tag[1] === id)
  )
    return null;
  return { host, id };
}
export function nativePostRef(post: Poast): NativePostRef | null {
  return post.event
    ? (post.trillRef ?? null)
    : { host: post.host, id: post.id };
}
// Feed IDs are display slots; native operations require the exact @da ID.
export function nativePost(post: Poast): Poast | null {
  const ref = nativePostRef(post);
  return ref ? { ...post, ...ref, event: undefined } : null;
}
