import PostList from "@/components/feed/PostList";
import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import toast from "react-hot-toast";
import { Contact, RefreshCw } from "lucide-react";
import type { FC } from "@/types/trill";
import { useRelayActions } from "@/hooks/useRelayActions";

export default function Nostr() {
  const { nostrFeed, api, relays, lastEose, setEose } = useLocalState((s) => ({
    nostrFeed: s.nostrFeed,
    api: s.api,
    relays: s.relays,
    lastEose: s.lastEose,
    setEose: s.setEose,
  }));
  const [fetchingPosts, setFetchingPosts] = useState("");
  const [fetchingProfiles, setFetchingProfiles] = useState("");
  const { syncRelays } = useRelayActions();

  const refetch = () => nostrFeed;

  // pokes no longer return subIds; on eose the store refreshes feeds from
  // the /x/j/nostr scry, so any eose closes whichever sync we're waiting on
  useEffect(() => {
    if (!lastEose) return;
    if (fetchingProfiles) {
      setFetchingProfiles("");
      toast.success("Nostr profiles sync complete");
    } else if (fetchingPosts) {
      setFetchingPosts("");
      toast.success("Nostr feed sync complete");
    }
    setEose("");
  }, [lastEose]);
  const handleResync = async () => {
    if (!api) return;
    toast.loading("Nostr post sync initiated");
    setFetchingPosts("temp");
    await syncRelays();
  };

  async function fetchProfiles() {
    if (!api) return;
    const rels = Object.values(relays)
      .map((r) => r.wid)
      .filter((w): w is number => w != null);
    const authors = [
      ...new Set(
        Object.values(nostrFeed.feed).flatMap((p) =>
          p.event ? [p.event.pubkey] : [],
        ),
      ),
    ];
    if (authors.length === 0) return;
    setFetchingProfiles("temp");
    try {
      await api.nostrProfiles(rels, authors);
      toast.loading("Nostr profile sync initiated");
    } catch (error) {
      toast.error("Failed to sync Nostr feed");
      console.error("Sync error:", error);
    }
  }
  if (Object.keys(relays).length === 0)
    return (
      <div className="nostr-empty-state">
        <div className="empty-content">
          <Icon name="nostr" size={48} color="textMuted" />
          <h3>No Nostr Relays Set Up</h3>
          <p>
            You haven't set any Nostr Relays to sync data from. You can do so in
            the Settings page.
          </p>
          <p>
            If you don't know of any, we recommend the following public relays:
          </p>
          <ul>
            <li>wss://nos.lol</li>
            <li>wss://relay.damus.io</li>
          </ul>
        </div>
      </div>
    );
  // Show empty state with resync option when no feed data
  if (Object.keys(nostrFeed.feed).length === 0) {
    return (
      <div className="nostr-empty-state">
        <div className="empty-content">
          <Icon name="nostr" size={48} color="textMuted" />
          <h3>No Nostr Posts</h3>
          <p>
            Your Nostr feed appears to be empty. Try syncing with your relays to
            fetch the latest posts.
          </p>
          <button
            onClick={handleResync}
            disabled={!!fetchingPosts}
            className="resync-btn"
          >
            {fetchingPosts ? (
              <>
                <img src={spinner} alt="Loading" className="btn-spinner" />
                Syncing...
              </>
            ) : (
              <>
                <Icon name="settings" size={16} />
                Sync Relays
              </>
            )}
          </button>
        </div>
      </div>
    );
  }
  return <NostrFeed resync={handleResync} data={nostrFeed} fetching={fetchingPosts === "" && fetchingProfiles === ""}/>
}



export function NostrFeed({ resync,fetching, data }: { fetching: boolean; data: FC;
  resync: () => Promise<void>

}) {
  // TODO remove the "refetch" stuff
  // Show feed with resync button in header
  return (
    <div className="nostr-feed">
      <PostList data={data} refetch={resync} />
    </div>
  );
}
