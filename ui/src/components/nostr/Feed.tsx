import PostList from "@/components/feed/PostList";
import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import toast from "react-hot-toast";
import type { FC } from "@/types/trill";
import { useRelayActions } from "@/hooks/useRelayActions";

// loading toasts never time out; the completion toast reuses the id to replace it
const SYNC_TOAST = "nostr-sync";

export default function Nostr() {
  const { nostrFeed, api, relays, lastEose, setEose } = useLocalState((s) => ({
    nostrFeed: s.nostrFeed,
    api: s.api,
    relays: s.relays,
    lastEose: s.lastEose,
    setEose: s.setEose,
  }));
  const [fetchingPosts, setFetchingPosts] = useState("");
  // eose seen, waiting for the store's /x/j/nostr rescry to land
  const [awaitingFeed, setAwaitingFeed] = useState(false);
  const { syncRelays } = useRelayActions();

  // pokes no longer return subIds; on eose the store refreshes feeds from
  // the /x/j/nostr scry, so any eose closes whichever sync we're waiting on.
  // that scry can take seconds on a big backlog: the sync is only done
  // once its result is in the store
  useEffect(() => {
    if (!lastEose) return;
    if (fetchingPosts) setAwaitingFeed(true);
    setEose("");
  }, [lastEose]);
  useEffect(() => {
    if (!awaitingFeed) return;
    setAwaitingFeed(false);
    setFetchingPosts("");
    toast.success("Nostr feed sync complete", { id: SYNC_TOAST });
  }, [nostrFeed]);
  const handleResync = async () => {
    if (!api) return;
    toast.loading("Nostr post sync initiated", { id: SYNC_TOAST });
    setFetchingPosts("temp");
    // syncRelays toasts its own error; just drop the spinner
    if (!(await syncRelays())) {
      toast.dismiss(SYNC_TOAST);
      setFetchingPosts("");
    }
  };

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
  return <NostrFeed resync={handleResync} data={nostrFeed} fetching={fetchingPosts !== ""}/>
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
