import "@/styles/Search.css";
import Avatar from "@/components/Avatar";
import UserModal from "@/components/modals/UserModal";
import Post from "@/components/post/Post";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { consolidateFeeds, stringToUser } from "@/logic/nostrill";
import { postToText, profileSearchText } from "@/logic/search";
import { userFromPost } from "@/logic/trill/helpers";
import { getHandleLabel, getUserId, getUserKind } from "@/logic/userDisplay";
import type { Poast } from "@/types/trill";
import type { UserProfile, UserType } from "@/types/nostrill";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

type SearchTab = "top" | "people" | "posts" | "channels";

const SEARCH_TABS: TabItem<SearchTab>[] = [
  { key: "top", label: "Top" },
  { key: "people", label: "People" },
  { key: "posts", label: "Posts" },
  { key: "channels", label: "Channels" },
];

const RECENT_KEY = "trill-search-recent";
const CHANNELS = [
  { name: "#hoon", posts: "1.2k posts" },
  { name: "#nostr", posts: "880 posts" },
  { name: "#runtime", posts: "440 posts" },
  { name: "#design", posts: "310 posts" },
];

const SEARCH_TAB_KEYS: SearchTab[] = ["top", "people", "posts", "channels"];

export default function SearchPage() {
  const [_, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialQuery = params.get("q") || "";
  const initialTab = (params.get("tab") as SearchTab) || "top";
  const [query, setQuery] = useState(initialQuery);
  // the page's own search box (narrow screens), kept in step with the url
  const [draft, setDraft] = useState(initialQuery);
  useEffect(() => setDraft(query), [query]);
  const [tab, setTab] = useState<SearchTab>(
    SEARCH_TAB_KEYS.includes(initialTab)
      ? initialTab
      : "top",
  );
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(stored)
        ? stored.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const nextParams = new URLSearchParams(searchString);
    const nextQuery = nextParams.get("q") || "";
    const nextTab = (nextParams.get("tab") as SearchTab) || "top";
    setQuery(nextQuery);
    setTab(
      SEARCH_TAB_KEYS.includes(nextTab)
        ? nextTab
        : "top",
    );
  }, [searchString]);

  const { profiles, following, myFeed, globalFeed, nostrFeed, setModal } =
    useLocalState((s) => ({
      profiles: s.profiles,
      following: s.following,
      myFeed: s.myFeed,
      globalFeed: s.globalFeed,
      nostrFeed: s.nostrFeed,
      setModal: s.setModal,
    }));

  const cleanQuery = query.trim();
  const lowerQuery = cleanQuery.toLowerCase();
  const searchableQuery = lowerQuery.replace(/^[#~@]/, "");
  const hasQuery = cleanQuery.length > 0;

  const peopleResults = useMemo(() => {
    if (!hasQuery) return [];
    const entries = Array.from(profiles.entries());
    return entries
      .filter(([id, profile]) => {
        const haystack = profileSearchText(id, profile);
        return haystack.includes(searchableQuery) || haystack.includes(lowerQuery);
      })
      .slice(0, 8)
      .map(([id, profile]) => {
        const parsed = stringToUser(id);
        return parsed && "ok" in parsed
          ? { id, user: parsed.ok, profile }
          : ({ id, user: { nostr: id }, profile } as {
              id: string;
              user: UserType;
              profile: UserProfile;
            });
      });
  }, [profiles, hasQuery, searchableQuery, lowerQuery]);

  const feed = useMemo(() => {
    const consolidated = consolidateFeeds(following);
    return {
      feed: {
        ...globalFeed.feed,
        ...nostrFeed.feed,
        ...myFeed.feed,
        ...consolidated.feed,
      },
      start: null,
      end: null,
    };
  }, [following, globalFeed, nostrFeed, myFeed]);

  const postResults = useMemo(() => {
    if (!hasQuery) return [];
    return Object.values(feed.feed)
      .filter((post): post is Poast => Boolean(post && post.contents))
      .filter((post) => !post.parent)
      .filter((post) => {
        const user = userFromPost(post);
        const userId = getUserId(user);
        const profile = profiles.get(userId);
        const haystack = [
          userId,
          profile?.name,
          profile?.about,
          post.tags?.join(" "),
          postToText(post),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchableQuery) || haystack.includes(lowerQuery);
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 12);
  }, [feed, profiles, hasQuery, searchableQuery, lowerQuery]);

  const channelResults = useMemo(() => {
    if (!hasQuery) return [];
    return CHANNELS.filter((channel) =>
      channel.name.toLowerCase().includes(searchableQuery),
    );
  }, [hasQuery, searchableQuery]);

  const pickQuery = (next: string) => {
    setQuery(next);
    setTab("top");
    const search = new URLSearchParams();
    if (next.trim()) search.set("q", next);
    navigate(`/search${search.toString() ? `?${search.toString()}` : ""}`, {
      replace: true,
    });
  };

  const clearSearch = () => pickQuery("");

  const setSearchTab = (next: SearchTab) => {
    setTab(next);
    const search = new URLSearchParams();
    if (query.trim()) search.set("q", query);
    if (next !== "top") search.set("tab", next);
    navigate(`/search${search.toString() ? `?${search.toString()}` : ""}`, {
      replace: true,
    });
  };

  const commitRecent = (term = query) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((item) => item !== trimmed)].slice(
      0,
      6,
    );
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const clearRecent = () => {
    setRecent([]);
    localStorage.removeItem(RECENT_KEY);
  };

  const hasVisibleResults =
    tab === "top"
      ? peopleResults.length > 0 ||
        postResults.length > 0 ||
        channelResults.length > 0
      : tab === "people"
        ? peopleResults.length > 0
        : tab === "posts"
          ? postResults.length > 0
          : channelResults.length > 0;
  const noResults = hasQuery && !hasVisibleResults;

  return (
    <div id="screen-search" className="trill-screen" data-screen-label="Search">
      <header className="search-results-header trill-screen-header">
        <div className="search-header-main">
          <button
            type="button"
            className="search-back"
            aria-label="Back to Home"
            onClick={() => navigate("/f")}
          >
            <ArrowLeft size={20} />
          </button>
          {hasQuery ? (
            <div className="search-results-title">
              <h1 title={cleanQuery}>{cleanQuery}</h1>
              <span>Search results</span>
            </div>
          ) : (
            <h1 className="search-page-title">Search</h1>
          )}
          {hasQuery && (
            <button
              type="button"
              className="search-header-clear"
              aria-label="Clear search query"
              onClick={clearSearch}
            >
              <X size={18} />
            </button>
          )}
        </div>
        {/* the right rail's search box, for screens where the rail is
            hidden (styles: max-width 1080px) */}
        <form
          className="search-page-form"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            pickQuery(draft);
            commitRecent(draft);
          }}
        >
          <SearchIcon size={17} aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search Trill"
            aria-label="Search Trill"
          />
        </form>
        {hasQuery && (
          <TabStrip
            id="search-tabs"
            items={SEARCH_TABS}
            active={tab}
            onChange={setSearchTab}
            className="search-tabs"
            itemRole="tab"
          />
        )}
      </header>

      {!hasQuery ? (
        <SearchEmpty
          recent={recent}
          onPick={pickQuery}
          onRemove={(term) => {
            const next = recent.filter((item) => item !== term);
            setRecent(next);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          }}
          onClear={clearRecent}
          onPickChannel={pickQuery}
        />
      ) : (
        <div className="search-results">
          {(tab === "top" || tab === "people") && peopleResults.length > 0 && (
            <section className="search-section">
              <h2>People</h2>
              {peopleResults.map((person) => (
                <button
                  key={person.id}
                  className="search-person-row"
                  onClick={() => {
                    commitRecent();
                    setModal(<UserModal user={person.user} />);
                  }}
                >
                  <Avatar
                    user={person.user}
                    profile={person.profile}
                    size={44}
                    picOnly
                    noClick
                  />
                  <span className="search-person-copy">
                    <strong>{person.profile.name || person.id}</strong>
                    <span className="mono">
                      {getHandleLabel(person.user, person.id)}
                    </span>
                  </span>
                  <span
                    className={`search-kind-badge ${getUserKind(person.user)}`}
                  >
                    {getUserKind(person.user)}
                  </span>
                </button>
              ))}
            </section>
          )}

          {(tab === "top" || tab === "channels") &&
            channelResults.length > 0 && (
              <section className="search-section">
                <h2>Channels</h2>
                {channelResults.map((channel) => (
                  <ChannelRow
                    key={channel.name}
                    channel={channel}
                    onClick={() => {
                      commitRecent(channel.name);
                      pickQuery(channel.name);
                    }}
                  />
                ))}
              </section>
            )}

          {(tab === "top" || tab === "posts") && postResults.length > 0 && (
            <section className="search-section posts">
              <h2>Posts</h2>
              {postResults.map((post) => {
                const user = userFromPost(post);
                const userId = getUserId(user);
                return (
                  <Post
                    key={post.id}
                    poast={post}
                    user={user}
                    profile={profiles.get(userId)}
                    spine={false}
                  />
                );
              })}
            </section>
          )}

          {noResults && (
            <div className="search-no-results">
              <SearchIcon size={40} />
              <strong>No results for "{cleanQuery}"</strong>
              <span>
                Try a different term, a <span className="mono">~ship</span>, or
                a #channel.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchEmpty({
  recent,
  onPick,
  onRemove,
  onClear,
  onPickChannel,
}: {
  recent: string[];
  onPick: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
  onPickChannel: (term: string) => void;
}) {
  return (
    <div className="search-empty">
      {recent.length > 0 && (
        <section>
          <div className="search-empty-head">
            <h2>Recent</h2>
            <button onClick={onClear}>Clear</button>
          </div>
          {recent.map((term) => (
            <div className="search-recent-row" key={term}>
              <button type="button" onClick={() => onPick(term)}>
                <Clock3 size={17} />
                <span>{term}</span>
              </button>
              <button
                type="button"
                className="search-recent-remove"
                aria-label={`Remove ${term} from recent searches`}
                onClick={() => onRemove(term)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <div className="search-section-break" />
        </section>
      )}
      <section>
        <div className="search-empty-head">
          <h2>Trending channels</h2>
        </div>
        {CHANNELS.map((channel) => (
          <ChannelRow
            key={channel.name}
            channel={channel}
            onClick={() => onPickChannel(channel.name)}
          />
        ))}
      </section>
    </div>
  );
}

function ChannelRow({
  channel,
  onClick,
}: {
  channel: { name: string; posts: string };
  onClick: () => void;
}) {
  return (
    <button className="search-channel-row" onClick={onClick}>
      <span className="search-channel-icon">#</span>
      <span className="search-channel-copy">
        <strong className="mono">{channel.name}</strong>
        <span>{channel.posts}</span>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
