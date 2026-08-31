import useLocalState from "@/state/state";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import toast from "react-hot-toast";
import type { FC } from "@/types/trill";
import PostList from "@/components/feed/PostList";
import { addEventToFc, eventsToFc } from "@/logic/nostrill";

export default function NostrUser({
  userString,
  pubkey,
  feed,
  isFollowLoading,
  setIsFollowLoading,
  isAccessLoading,
  setIsAccessLoading,
  onFeedChange,
}: {
  userString: string;
  pubkey: string;
  feed: FC | undefined;
  isFollowLoading: boolean;
  setIsFollowLoading: (b: boolean) => void;
  isAccessLoading: boolean;
  setIsAccessLoading: (b: boolean) => void;
  onFeedChange?: (feed: FC) => void;
}) {
  const { api, lastFact, relays } = useLocalState((s) => ({
    api: s.api,
    lastFact: s.lastFact,
    relays: s.relays,
  }));
  const [fc, setFC] = useState<FC>();

  useEffect(() => {
    if (!lastFact) return;
    if (!("nostr" in lastFact)) return;
    if ("user" in lastFact.nostr) {
      const feed = eventsToFc(lastFact.nostr.user.feed);
      setFC(feed);
    } else if ("event" in lastFact.nostr) {
      const ev = lastFact.nostr.event;
      if (ev.kind === 1 && ev.pubkey === pubkey) {
        const f = feed || fc;
        if (!f) return;
        const nf = addEventToFc(ev, f);
        setFC(nf);
      }
    }
  }, [lastFact]);
  useEffect(() => {
    const visibleFeed = fc || feed;
    if (visibleFeed) onFeedChange?.(visibleFeed);
  }, [fc, feed, onFeedChange]);
  // Show empty state with resync option when no feed data

  async function refetch() {
    //
  }
  async function handleFollow() {
    if (!api) return;

    setIsFollowLoading(true);
    try {
      const user = { nostr: pubkey };
      if (feed) {
        await api.unfollow(user);
      } else {
        await api.follow(user);
        toast.success(`Follow request sent to ${userString}`);
      }
    } catch (error) {
      toast.error(`Failed to ${!!feed ? "unfollow" : "follow"} ${userString}`);
      setIsFollowLoading(false);
      console.error("Follow error:", error);
    }
  }
  async function handleRequestAccess() {
    if (!api) return;
    const rels = Object.values(relays)
      .map((r) => r.wid)
      .filter((w): w is number => w != null);
    setIsAccessLoading(true);
    try {
      await api.nostrFeed(pubkey, rels);
    } catch (error) {
      toast.error(`Failed to request access from ${pubkey}`);
      console.error("Access request error:", error);
    } finally {
      setIsAccessLoading(false);
    }
  }
  return (
    <>
      <div className="user-actions">
        <button
          onClick={handleFollow}
          disabled={isFollowLoading}
          className={`action-btn ${!!feed ? "" : "follow"}`}
        >
          {isFollowLoading ? (
            <>
              <Icon name="settings" size={16} />
              {!!feed ? "Unfollowing..." : "Following..."}
            </>
          ) : (
            <>
              <Icon name={!!feed ? "bell" : "pals"} size={16} />
              {!!feed ? "Unfollow" : "Follow"}
            </>
          )}
        </button>

        {(!feed || !feed.feed || Object.keys(feed.feed).length === 0) && (
          <button
            onClick={handleRequestAccess}
            disabled={isAccessLoading}
            className="action-btn access"
          >
            {isAccessLoading ? (
              <>
                <Icon name="settings" size={16} />
                Fetching...
              </>
            ) : (
              <>
                <Icon name="key" size={16} />
                Fetch Feed
              </>
            )}
          </button>
        )}
      </div>
      {(feed || fc) && (
        <div id="feed-proper">
          {Object.values((feed || fc)!.feed).some((post) => !post.parent) ? (
            <PostList data={(feed || fc)!} refetch={refetch} spine={false} />
          ) : (
            <div className="profile-tab-empty">
              <Icon name="messages" size={38} color="textMuted" />
              <h3>No posts yet</h3>
              <p>This profile has not published any visible posts.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
