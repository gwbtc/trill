import { trillEventAuthor } from "@/logic/trill/relay";
import { NRelay1 } from "@nostrify/nostrify";
import useLocalState from "@/state/state";
import { useEffect, useState } from "react";
import type { Wevent } from "@/types/nostr";
import NostrThread from "./Thread";
import ThreadState from "@/components/thread/ThreadState";

export default function Thread({ id }: { id: string }) {
  const { relayKey, stateLoaded } = useLocalState((s) => ({
    relayKey: JSON.stringify(Object.keys(s.relays)), stateLoaded: s.stateLoaded,
  }));
  const [data, setData] = useState<Wevent>();
  const [status, setStatus] = useState<"loading" | "done">("loading");

  // Depend on URLs, not connection-status objects. Query the configured
  // relays together; a miss on the first one is not a miss everywhere.
  useEffect(() => {
    const urls = JSON.parse(relayKey) as string[];
    if (!urls.length) return;
    const connections = urls.map(url => ({ url, relay: new NRelay1(url) }));
    const ctrl = new AbortController();
    const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(8000)]);
    setStatus("loading");
    (async () => {
      try {
        const note = await Promise.any(connections.map(async ({ url, relay }) => {
          for await (const msg of relay.req([{ ids: [id], kinds: [1, 667] }], { signal })) {
            if (msg[0] === "EVENT" && msg[2].id === id && (msg[2].kind === 1 || trillEventAuthor(msg[2]))) return { ...msg[2], relays: [url] };
            if (msg[0] === "EOSE" || msg[0] === "CLOSED") break;
          }
          throw new Error("Note unavailable");
        }));
        if (!ctrl.signal.aborted) setData(note);
      } catch {
        // Aborted on unmount, timed out, or no configured relay had the note.
      } finally {
        for (const { relay } of connections) void relay.close();
      }
      if (!ctrl.signal.aborted) setStatus("done");
    })();
    return () => {
      ctrl.abort();
      for (const { relay } of connections) void relay.close();
    };
  }, [relayKey, id]);

  if (data) return <NostrThread event={data} relays={data.relays ?? []} />;
  const urls = JSON.parse(relayKey) as string[];
  if (!stateLoaded) return <ThreadState title="Loading note…" loading />;
  if (!urls.length)
    return <ThreadState title="No relay configured">Add a Nostr relay to load this thread.</ThreadState>;
  if (status === "done")
    return <ThreadState title="Note not found">{urls.length === 1 ? `This note wasn't found on ${urls[0]}.` : "This note wasn’t found on the configured relays."}</ThreadState>;
  return <ThreadState title="Loading note…" loading />;
}
