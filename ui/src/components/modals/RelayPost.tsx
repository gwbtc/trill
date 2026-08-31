import type { Poast } from "@/types/trill";
import triangles from "@/assets/triangles.svg";
import useLocalState from "@/state/state";
import { useEffect, useState } from "react";
import type { NostrEvent } from "@/types/nostr";
import CodeBlock from "../CodeBlock";

export default function ({ poast }: { poast: Poast }) {
  const { relays, api, setModal, lastFact } = useLocalState((s) => ({
    relays: s.relays,
    api: s.api,
    setModal: s.setModal,
    lastFact: s.lastFact,
  }));
  const [status, setStatus] = useState<"init" | "pending" | "done">("init");
  const [event, setEvent] = useState<NostrEvent>();

  useEffect(() => {
    if (!lastFact) return;
    if (!("nostr" in lastFact)) return;
    if (!("sent-post" in lastFact.nostr)) return;
    const { id, host, event } = (lastFact.nostr as any)["sent-post"];
    if (id !== poast.id || host !== poast.host) return;
    setEvent(event);

  }, [lastFact]);

  async function handleConfirm() {
    setStatus("pending");
    try {
      // relays are keyed by url; the pokes take live wids
      const wids = Object.values(relays)
        .map((r) => r.wid)
        .filter((w): w is number => w != null);
      await api!.relayPost(poast.host, poast.id, wids);
    } finally {
      // setStatus("done");
    }
  }

  return (
    <div className="confirmation-dialog">
      {event ? (
        <div>
          <p>Your post was sent to Nostr</p>
          <p>Event ID:</p>
          <CodeBlock>{event.id}</CodeBlock>
        </div>
      ) : status === "pending" ? (
        <div className="loading-spinner">
          <img src={triangles} alt="Loading..." />
        </div>
      ) : status === "init" ? (
        <>
          <p>Send this post to your Nostr Relays?</p>

          <div className="confirmation-buttons">
            <button className="btn-confirm" onClick={handleConfirm}>
              Yes
            </button>
            <button className="btn-cancel" onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// npub1w8k2hk9kkv653cr4luqmx9tglldpn59vy7yqvlvex2xxmeygt96s4dlh8p
