import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NRelay1 } from "@nostrify/nostrify";
import { nostrThreadRefs, relayHint } from "@/logic/nostrThread";
import type { Wevent } from "@/types/nostr";

const LIMIT = 100;
type Replies = { events: Wevent[]; loading: boolean; error: boolean; limited: boolean };
const EMPTY: Replies = { events: [], loading: false, error: false, limited: false };

// Keep this subscription independent of feed/profile updates. A root's #e
// results also contain descendants and mentions, so validate the direct parent.
export function useNostrReplies(id: string, source: string | undefined, enabled: boolean) {
  const client = useQueryClient();
  const url = relayHint(source);
  const key = `${id}@${url ?? ""}`;
  const [state, setState] = useState<Replies & { key: string }>({ ...EMPTY, key: "" });
  const [attempt, retry] = useState(0);

  useEffect(() => {
    if (!enabled || !url) { setState({ ...EMPTY, key }); return; }
    const controller = new AbortController();
    const relay = new NRelay1(url);
    const events = new Map<string, Wevent>();
    const seen = new Set<string>();
    let loading = true;
    let limited = false;
    const update = (error = false) => {
      if (!controller.signal.aborted) setState({ key, events: [...events.values()].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)), loading, error, limited });
    };
    update();
    const timeout = window.setTimeout(() => {
      loading = false;
      update(true);
      controller.abort();
      void relay.close();
    }, 8000);

    (async () => {
      try {
        for await (const message of relay.req([{ kinds: [1], "#e": [id], limit: LIMIT }], { signal: controller.signal })) {
          if (message[0] === "EOSE") {
            window.clearTimeout(timeout);
            loading = false;
            update();
          } else if (message[0] === "EVENT") {
            const event = message[2];
            if (seen.has(event.id)) continue;
            seen.add(event.id);
            if (seen.size >= LIMIT) limited = true;
            // Bound bookkeeping even for a long-lived stream.
            if (seen.size > LIMIT * 2) seen.delete(seen.values().next().value!);
            if (nostrThreadRefs(event).parent?.id !== id) continue;
            const note = { ...event, relays: [url] };
            events.set(note.id, note);
            if (events.size > LIMIT) {
              const oldest = [...events.values()].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))[0];
              events.delete(oldest.id);
            }
            client.setQueryData(["nostr-event", note.id], note);
            update();
          }
        }
        // NRelay1 ends the iterator when a relay sends CLOSED.
        loading = false;
        update(true);
      } catch {
        loading = false;
        update(true);
      } finally {
        window.clearTimeout(timeout);
        void relay.close();
      }
    })();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      void relay.close();
    };
  }, [id, url, key, enabled, attempt, client]);

  return { ...(state.key === key ? state : { ...EMPTY, loading: enabled && Boolean(url) }), available: Boolean(url), retry: () => retry(value => value + 1) };
}
