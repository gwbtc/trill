import { NRelay1 } from "@nostrify/nostrify";
import useLocalState, { useStore } from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useRef, useState } from "react";
import {NostrFeed} from "@/components/nostr/Feed";
import Icon from "@/components/Icon";
import { addEventToFc } from "@/logic/nostrill";
import { GLOBAL_RELAY_URL } from "@/logic/constants";

export default function Global() {
  const { setGlobal, globalFeed } = useLocalState((s) => ({
    setGlobal: s.setGlobal,
    globalFeed: s.globalFeed,
  }));

  const relayRef = useRef<NRelay1>(undefined);
  const reqRef = useRef<AbortController>(undefined);
  useEffect(() => {
    const r = new NRelay1(GLOBAL_RELAY_URL);
    relayRef.current = r;
    fetchGlobal();
    return () => {
      reqRef.current?.abort();
      r.close();
      relayRef.current = undefined;
    };
  }, []);

  const fetchGlobal = async () => {
    const relay = relayRef.current;
    if (!relay) return;
    // one live subscription at a time: a resync replaces the previous one
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setIsLoading(true);
    try {
      const req = relay.req([{ kinds: [667] }], { signal: ctrl.signal });
      for await (const msg of req) {
        if (msg[0] === "EVENT") {
          const event = msg[2];
          const wevent = { ...event, relays: [GLOBAL_RELAY_URL] };
          // read the live feed: this loop outlives the render that started it
          const nf = addEventToFc(wevent, useStore.getState().globalFeed);
          setGlobal(nf);
        }
        // stay subscribed past EOSE to keep streaming new posts
        if (msg[0] === "EOSE") setIsLoading(false);
      }
    } catch {
      // aborted by a resync or unmount
    }
  };
  const [isLoading, setIsLoading] = useState(false);

  // Show empty state with resync option when no feed data
  if (!globalFeed)
    return (
      <>
        <img src={spinner} alt="Loading" className="btn-spinner" />
        Syncing...
      </>
    );
  if (Object.keys(globalFeed.feed).length === 0) {
    return (
      <div className="nostr-empty-state">
        <div className="empty-content">
          <h3>No Posts</h3>
          <p>
            Your Trill feed appears to be empty. Click the button below to sync
            with the global Trill feed
          </p>
          <button
            onClick={fetchGlobal}
            disabled={isLoading}
            className="resync-btn"
          >
            {isLoading ? (
              <>
                <img src={spinner} alt="Loading" className="btn-spinner" />
                Syncing...
              </>
            ) : (
              <>
                <Icon name="settings" size={16} />
                Sync
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Show feed with resync button in header
  return (
    <NostrFeed resync={fetchGlobal} data={globalFeed} fetching={isLoading}/>
    
  );
}
