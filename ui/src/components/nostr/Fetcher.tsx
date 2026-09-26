import { NRelay1 } from "@nostrify/nostrify";
import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useState } from "react";
import type { Wevent } from "@/types/nostr";
import NostrThread from "./Thread";

export default function Thread({ id }: { id: string }) {
  const relays = useLocalState((s) => s.relays);
  // TODO iterate over relays; for now the first one is asked
  const relayUrl = Object.keys(relays)[0];
  const [data, setData] = useState<Wevent>();
  const [status, setStatus] = useState<"loading" | "done">("loading");

  // depends on the url, not the relays object: that changes on every relay
  // status fact, and re-running would open (and leak) a socket each time
  useEffect(() => {
    if (!relayUrl) return;
    const relay = new NRelay1(relayUrl);
    const ctrl = new AbortController();
    setStatus("loading");
    (async () => {
      try {
        for await (const msg of relay.req([{ ids: [id] }], { signal: ctrl.signal })) {
          if (msg[0] === "EVENT") setData({ ...msg[2], relays: [relayUrl] });
          if (msg[0] === "EOSE" || msg[0] === "CLOSED") break;
        }
      } catch {
        // aborted on unmount, or the relay failed; show what we have
      }
      if (!ctrl.signal.aborted) setStatus("done");
    })();
    return () => {
      ctrl.abort();
      relay.close();
    };
  }, [relayUrl, id]);

  if (data) return <NostrThread event={data} relays={data.relays ?? []} />;
  if (!relayUrl)
    return <p className="x-center not-found">Add a Nostr relay to load this thread.</p>;
  if (status === "done")
    return <p className="x-center not-found">This note wasn't found on {relayUrl}.</p>;
  return (
    <div className="loading-container">
      <img className="x-center" src={spinner} alt="Loading" />
    </div>
  );
}
