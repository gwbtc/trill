import "@/styles/trill.css";
import "@/styles/feed.css";
import "@/styles/FeedPage.css";
import PostList from "@/components/feed/PostList";
import useLocalState from "@/state/state";
import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import { ErrorPage } from "@/pages/Error";
import NostrFeed from "@/components/nostr/Feed";
import { consolidateFeeds } from "@/logic/nostrill";
import Global from "@/components/feed/Global";
import Composer from "@/components/composer/Composer";
import FeedStatusModal from "@/components/modals/FeedStatusModal";
import { getFeedStatusSummary } from "@/logic/feedStatus";
import { useRelayActions } from "@/hooks/useRelayActions";
import { RefreshCw, UserPlus } from "lucide-react";

type FeedType = "global" | "following" | "nostr";

const FEED_TABS: TabItem<FeedType>[] = [
  { key: "nostr", label: "Nostr" },
  { key: "following", label: "Following" },
  { key: "global", label: "Global" },
];

function Loader() {
  const params = useParams();
  if (!params.taip) return <FeedPage t="nostr" />;
  if (params.taip === "global") return <FeedPage t="global" />;
  if (params.taip === "following") return <FeedPage t="following" />;
  if (params.taip === "nostr") return <FeedPage t="nostr" />;
  return <ErrorPage msg="No such page" />;
}

function FeedPage({ t }: { t: FeedType }) {
  const [active, setActive] = useState<FeedType>(t);
  const [feedLoading, setFeedLoading] = useState(true);
  const [cursorIndex, setCursorIndex] = useState(-1);
  const { relays, setModal } = useLocalState((s) => ({
    relays: s.relays,
    setModal: s.setModal,
  }));
  const { syncRelays, isSyncingRelays } = useRelayActions();
  const relayCount = Object.keys(relays).length;
  const feedStatus = getFeedStatusSummary(relays, {}, isSyncingRelays);

  useEffect(() => {
    setFeedLoading(true);
    setCursorIndex(-1);
    const timer = window.setTimeout(() => setFeedLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const posts = Array.from(
      document.querySelectorAll<HTMLElement>("#home-feed .trill-post"),
    );
    posts.forEach((post, index) => {
      post.classList.toggle("keyboard-selected", index === cursorIndex);
    });
    if (cursorIndex >= 0) {
      posts[cursorIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return () => posts.forEach((post) => post.classList.remove("keyboard-selected"));
  }, [cursorIndex, feedLoading, active]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest("input, textarea, select, [contenteditable='true'], #modal-background"),
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (!["j", "k", "l"].includes(e.key)) return;
      const posts = Array.from(
        document.querySelectorAll<HTMLElement>("#home-feed .trill-post"),
      );
      if (posts.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        setCursorIndex((index) => Math.min(posts.length - 1, index < 0 ? 0 : index + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setCursorIndex((index) => Math.max(0, index < 0 ? 0 : index - 1));
      } else if (e.key === "l") {
        e.preventDefault();
        const selected = posts[cursorIndex >= 0 ? cursorIndex : 0];
        selected?.querySelector<HTMLElement>(".reaction-action")?.click();
        if (cursorIndex < 0) setCursorIndex(0);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cursorIndex]);

  const changeFeed = (next: FeedType) => {
    setActive(next);
  };

  const openFeedStatus = () => {
    setModal(<FeedStatusModal />);
  };

  const resyncFeed = async () => {
    await syncRelays();
  };

  return (
    <div id="screen-home" className="trill-screen">
      {/* Sticky feed header */}
      <header className="feed-header trill-screen-header">
        <div className="feed-title-row">
          <h1 className="feed-title">Home</h1>
          <button
            type="button"
            className="feed-status-trigger"
            onClick={openFeedStatus}
            aria-label={`Feed status: ${feedStatus.label}`}
            title="Feed status"
          >
            <span className={`feed-status-trigger-dot ${feedStatus.state}`} />
            <span className="mono">{feedStatus.label}</span>
          </button>
          <button
            type="button"
            className="feed-resync-button"
            onClick={resyncFeed}
            disabled={relayCount === 0 || isSyncingRelays}
            aria-label="Resync feed"
            title="Resync feed"
          >
            <RefreshCw
              size={17}
              strokeWidth={2}
              className={isSyncingRelays ? "is-spinning" : undefined}
            />
          </button>
        </div>
        <TabStrip
          id="home-feed-tabs"
          items={FEED_TABS}
          active={active}
          onChange={changeFeed}
          className="feed-tabs trill-tabs"
          buttonClassName="feed-tab"
        />
      </header>

      {/* Inline composer */}
      <div id="home-composer-prompt" className="feed-composer-wrap">
        <Composer />
      </div>

      {/* Feed content */}
      <div id="home-feed" className="trill-feed">
        {feedLoading ? (
          <FeedSkeleton />
        ) : active === "global" ? (
          <Global />
        ) : active === "following" ? (
          <Following />
        ) : active === "nostr" ? (
          <NostrFeed />
        ) : null}
      </div>
    </div>
  );
}

function Following() {
  const following = useLocalState((s) => s.following);
  const [, navigate] = useLocation();
  const feed = consolidateFeeds(following);
  const hasPosts = Object.values(feed.feed).some((post) => !post.parent);
  if (!hasPosts) {
    return (
      <div className="home-following-empty">
        <UserPlus size={42} />
        <h3>Your Following feed is quiet</h3>
        <p>Find people to follow and their posts will show up here.</p>
        <button type="button" onClick={() => navigate("/fols")}>
          Find people to follow
        </button>
      </div>
    );
  }
  return <PostList data={feed} refetch={() => {}} />;
}

function FeedSkeleton() {
  return (
    <div className="home-feed-skeleton" aria-label="Loading feed">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="home-feed-skeleton-row" key={index}>
          <div className="trill-skeleton skeleton-avatar" />
          <div className="skeleton-body">
            <div className="trill-skeleton skeleton-name" />
            <div className="trill-skeleton skeleton-line wide" />
            <div className="trill-skeleton skeleton-line" />
            <div className="skeleton-actions">
              <div className="trill-skeleton" />
              <div className="trill-skeleton" />
              <div className="trill-skeleton" />
              <div className="trill-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Loader;
