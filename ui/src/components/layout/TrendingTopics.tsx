import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Share2 } from "lucide-react";
import useLocalState from "@/state/state";
import ComposerModal from "@/components/modals/ComposerModal";
import {
  availableTabs,
  parseTrending,
  pickTopics,
  topicMeta,
  TOPIC_PREFS_EVENT,
  type TopicSpam,
  type TrendingData,
} from "@/logic/topics";
import type { SharedCard } from "@/logic/cards";
import TopicThumb from "@/components/TopicThumb";
import TopicModal from "@/components/topics/TopicModal";
import SpamReview from "@/components/topics/SpamReview";

// %topics refetches its sources hourly; checking more often than this
// just catches that sooner
const REFRESH_MS = 10 * 60 * 1000;

// trending topics from the %topics agent. hidden when there's nothing to show
export default function TrendingTopics() {
  const [location] = useLocation();
  const { api, setComposerData, setModal } = useLocalState((s) => ({
    api: s.api,
    setComposerData: s.setComposerData,
    setModal: s.setModal,
  }));
  const [data, setData] = useState<TrendingData | null>(null);
  const [spam, setSpam] = useState<TopicSpam | null>(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!api) return;
    let live = true;
    const load = async () => {
      const res = await api.scryTopics();

      if (!live || !("ok" in res)) return;
      const trending = parseTrending(res.ok);
      setData(trending?.sources ?? null);
      setSpam(trending?.spam ?? null);
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    // new prefs (settings page): %topics refetches everything, which takes
    // a few seconds, so look now and again shortly
    const pending: ReturnType<typeof setTimeout>[] = [];
    const onPrefs = () => {
      load();
      pending.push(setTimeout(load, 4000), setTimeout(load, 12000));
    };
    window.addEventListener(TOPIC_PREFS_EVENT, onPrefs);
    return () => {
      live = false;
      clearInterval(timer);
      pending.forEach(clearTimeout);
      window.removeEventListener(TOPIC_PREFS_EVENT, onPrefs);
    };
  }, [api]);

  const tabs = useMemo(() => (data ? availableTabs(data) : []), [data]);
  // a category dropped in settings takes its tab with it
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "all";
  const topics = useMemo(
    () => (data ? pickTopics(data, activeTab) : []),
    [data, activeTab],
  );
  if (!data || topics.length === 0) return null;
  const tabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "All";

  function share() {
    const card: SharedCard = {
      v: 1,
      kind: "trending",
      title: "Trending topics",
      subtitle: activeTab === "all" ? "" : tabLabel,
      at: Date.now(),
      items: topics.map((t) => ({
        title: t.title,
        url: t.url,
        meta: topicMeta(t),
        pic: t.pic,
      })),
    };
    setComposerData({ type: "card", card });
    // as quoting a post: the feed has an inline composer at the top,
    // anywhere else opens the composer modal
    const onFeed = location === "/f" || location.startsWith("/f/");
    if (onFeed) window.scrollTo({ top: 0, behavior: "smooth" });
    else setModal(<ComposerModal />);
  }

  return (
    <div id="trending-topics" className="rail-card rail-trending-card">
      <div className="rail-card-header">
        <h2 className="rail-card-title">Trending topics</h2>
        <button
          type="button"
          className="rail-card-share"
          onClick={share}
          title="Share in a post"
          aria-label="Share trending topics in a post"
        >
          <Share2 size={15} />
        </button>
      </div>
      {tabs.length > 1 && (
        <div className="rail-trending-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === activeTab}
              className={`rail-trending-tab${t.id === activeTab ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {topics.map((t) => {
        const body = (
          <>
            <div className="rail-trending-text">
              <div className="rail-trending-title">{t.title}</div>
              <div className="rail-trending-meta">{topicMeta(t)}</div>
            </div>
            {t.pic && <TopicThumb src={t.pic} className="rail-trending-pic" />}
          </>
        );
        return (
          <button
            type="button"
            key={`${t.source}-${t.title}`}
            className="rail-trending-row"
            onClick={() => setModal(<TopicModal topic={t} />)}
          >
            {body}
          </button>
        );
      })}
      {spam?.provider && spam.flagged.length > 0 && (
        <button
          type="button"
          className="rail-trending-spam"
          onClick={() =>
            setModal(<SpamReview flagged={spam.flagged} threshold={spam.threshold} />)
          }
        >
          {hiddenCount(spam) > 0
            ? `${hiddenCount(spam)} hidden as spam`
            : `${spam.flagged.length} marked not spam`}
        </button>
      )}
    </div>
  );
}

const hiddenCount = (spam: TopicSpam) => spam.flagged.filter((t) => t.hidden).length;
