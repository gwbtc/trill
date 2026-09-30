import useLocalState from "@/state/state";
import { unwrap } from "@/logic/result";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import toast from "react-hot-toast";
import type { FC } from "@/types/trill";
import PostList from "@/components/feed/PostList";
import { addEventToFc, eventsToFc, oldestNoteTime } from "@/logic/nostrill";

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
  const { api, lastFact, relays, storedUserFeed } = useLocalState((s) => ({
    api: s.api,
    lastFact: s.lastFact,
    relays: s.relays,
    // the backend sends no %user fact at eose (a TODO there); the store's
    // /j/nostr refresh after eose files the req under its sub name
    storedUserFeed: s.nostrFeeds[`user/${pubkey}`],
  }));
  const [fc, setFC] = useState<FC>();
  // the store's copy first: it's what older pages land in
  const shownFeed = storedUserFeed || fc;
  const wids = Object.values(relays)
    .map((r) => r.wid)
    .filter((w): w is number => w != null);
  // someone we don't follow: fetch their notes and profile on arrival,
  // once, as soon as a relay is connected
  const fetchedFor = useRef("");
  useEffect(() => {
    if (!api || feed || wids.length === 0 || fetchedFor.current === pubkey) return;
    fetchedFor.current = pubkey;
    handleRequestAccess();
  }, [api, feed, pubkey, wids.length]);

  // paging back: ask for notes before the oldest we have. done when the
  // feed grows; a page that adds nothing (after a while) means there are
  // no older notes on these relays
  const noteCount = Object.keys(shownFeed?.feed ?? {}).length;
  const countRef = useRef(noteCount);
  countRef.current = noteCount;
  const [olderFrom, setOlderFrom] = useState<number | null>(null);
  const [noOlder, setNoOlder] = useState(false);
  useEffect(() => {
    if (olderFrom !== null && noteCount > olderFrom) setOlderFrom(null);
  }, [noteCount, olderFrom]);
  useEffect(() => {
    if (olderFrom === null) return;
    const t = setTimeout(() => {
      if (countRef.current <= olderFrom) setNoOlder(true);
      setOlderFrom(null);
    }, 15000);
    return () => clearTimeout(t);
  }, [olderFrom]);
  async function loadOlder() {
    const oldest = oldestNoteTime(shownFeed);
    if (!api || oldest === null || wids.length === 0) return;
    setOlderFrom(noteCount);
    try {
      await api.nostrFeed(pubkey, wids, oldest - 1);
    } catch {
      toast.error("Couldn't load older posts");
      setOlderFrom(null);
    }
  }

  useEffect(() => {
    if (!lastFact) return;
    if (!("nostr" in lastFact)) return;
    if ("user" in lastFact.nostr) {
      // user feeds arrive for whichever profile was requested last; only
      // take ours (sub name set in IO.nostrFeed)
      if (lastFact.nostr.user.name !== `user/${pubkey}`) return;
      const feed = eventsToFc(lastFact.nostr.user.feed);
      setFC(feed);
    } else if ("event" in lastFact.nostr) {
      const ev = lastFact.nostr.event;
      if (ev.kind === 1 && ev.pubkey === pubkey) {
        const f = feed || shownFeed;
        if (!f) return;
        const nf = addEventToFc(ev, f);
        setFC(nf);
      }
    }
  }, [lastFact]);
  useEffect(() => {
    const visibleFeed = shownFeed || feed;
    if (visibleFeed) onFeedChange?.(visibleFeed);
  }, [shownFeed, feed, onFeedChange]);
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
        unwrap(await api.unfollow(user));
      } else {
        unwrap(await api.follow(user));
        toast.success(`Follow request sent to ${userString}`);
      }
    } catch (error) {
      toast.error(`Failed to ${!!feed ? "unfollow" : "follow"} ${userString}`);
      console.error("Follow error:", error);
    } finally {
      // nostr follows get no confirming fact to wait on, unlike urbit ones
      setIsFollowLoading(false);
    }
  }
  async function handleRequestAccess() {
    if (!api) return;
    setIsAccessLoading(true);
    try {
      await api.nostrFeed(pubkey, wids);
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

        {Object.keys((feed || shownFeed)?.feed ?? {}).length === 0 && (
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
      {(feed || shownFeed) && (
        <div id="feed-proper">
          {Object.values((feed || shownFeed)!.feed).some((post) => !post.parent) ? (
            <>
              <PostList data={(feed || shownFeed)!} refetch={refetch} spine={false} />
              {/* followed users' feeds come through the follow, not this sub */}
              {!feed && !noOlder && (
                <button
                  type="button"
                  className="load-older-btn"
                  onClick={loadOlder}
                  disabled={olderFrom !== null}
                >
                  {olderFrom !== null ? "Loading…" : "Load older posts"}
                </button>
              )}
              {!feed && noOlder && (
                <p className="load-older-end">No older posts on your relays.</p>
              )}
            </>
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
