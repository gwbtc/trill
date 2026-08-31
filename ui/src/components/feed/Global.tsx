import { NRelay1 } from "@nostrify/nostrify";
import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useRef, useState } from "react";
import {NostrFeed} from "@/components/nostr/Feed";
import Icon from "@/components/Icon";
import {  RefreshCw } from "lucide-react";
import { addEventToFc, eventsToFc, eventToProfile } from "@/logic/nostrill";
import { GLOBAL_RELAY_URL } from "@/logic/constants";

export default function Global() {
  const { addProfile, setGlobal, globalFeed } = useLocalState((s) => ({
    addProfile: s.addProfile,
    setGlobal: s.setGlobal,
    globalFeed: s.globalFeed,
  }));

  const relayRef = useRef<NRelay1>(undefined);
  useEffect(() => {
    const r = new NRelay1(GLOBAL_RELAY_URL);
    relayRef.current = r;
    fetchGlobal();
  }, []);

  const fetchGlobal = async () => {
    setIsLoading(true);
    // TODO
    if (!relayRef.current) return;
    const relay = relayRef.current;
    const req = relay.req([{ kinds: [667] }]);
    for await (const msg of req) {
      // console.log("relay msg", msg);
      if (msg[0] === "EVENT") {
        const event = msg[2];
        const wevent = { ...event, relays: [GLOBAL_RELAY_URL] };
        const nf = addEventToFc(wevent, globalFeed);
        setGlobal(nf);
      }
      if (msg[0] === "EOSE") {
        setIsLoading(false);
        // break; closes the subscription
      }
    }
  };
  const [isLoading, setIsLoading] = useState(false);

  async function fetchProfiles() {
    setIsLoading(true);
    const ids = Object.values(globalFeed.feed).map((p) => p.author);
    if (!relayRef.current) return;
    const relay = relayRef.current;
    const req = relay.req([{ kinds: [0], ids }]);
    for await (const msg of req) {
      if (msg[0] === "EVENT") {
        const prof = eventToProfile(msg[2]);
        if (!prof) continue;
        addProfile(prof.pubkey, prof);
      }
      if (msg[0] === "EOSE") {
        setIsLoading(false);
        break;
      }
    }
  }

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
