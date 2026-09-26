import useLocalState from "@/state/state";
import { buildRelayModels } from "@/logic/relayDisplay";
import { getRailSearchRoute } from "@/logic/searchRouting";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { followGraphWithProfiles, suggestFollows } from "@/logic/suggestions";
import { stringToUser } from "@/logic/nostrill";
import UserModal from "@/components/modals/UserModal";
import "./RightRail.css";

export default function RightRail() {
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const {
    relays,
    relayLatency,
    following,
    profiles,
    modal,
    setModal,
    followGraph,
    lists,
    our,
    pubkey,
  } = useLocalState((s) => ({
    relays: s.relays,
    relayLatency: s.relayLatency,
    following: s.following,
    profiles: s.profiles,
    modal: s.modal,
    setModal: s.setModal,
    followGraph: s.followGraph,
    lists: s.lists,
    our: s.api?.airlock.our,
    pubkey: s.pubkey,
  }));

  const relayModels = buildRelayModels(relays, relayLatency);
  const openRelayDashboard = () => {
    import("@/components/RelayDashboard").then(({ default: RelayDashboard }) => {
      setModal(<RelayDashboard />);
    });
  };

  const suggestions = useMemo(
    () =>
      suggestFollows(
        followGraphWithProfiles(followGraph, profiles),
        following,
        lists,
        [our ?? "", pubkey].filter(Boolean),
      ),
    [followGraph, profiles, following, lists, our, pubkey],
  );
  const searchParams = new URLSearchParams(searchString);
  const isSearchScreen = location === "/search";
  const urlSearchQuery = isSearchScreen ? searchParams.get("q") || "" : "";
  const [railSearchQuery, setRailSearchQuery] = useState(urlSearchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousRouteRef = useRef(location === "/search" ? "/f" : location);
  useEffect(() => {
    setRailSearchQuery(urlSearchQuery);
  }, [urlSearchQuery]);
  useEffect(() => {
    if (!isSearchScreen) previousRouteRef.current = location || "/f";
  }, [isSearchScreen, location]);
  const updateSearch = (next: string) => {
    setRailSearchQuery(next);
    const route = getRailSearchRoute({
      currentLocation: location,
      isSearchScreen,
      nextQuery: next,
      previousRoute: previousRouteRef.current,
    });
    previousRouteRef.current = route.previousRoute;
    navigate(route.nextPath);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (
        event.key === "/" &&
        !typing &&
        !modal &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (!isSearchScreen) navigate("/search");
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (event.key !== "Escape" || modal || !isSearchScreen) return;

      event.preventDefault();
      if (railSearchQuery.trim()) {
        setRailSearchQuery("");
        navigate("/search", { replace: true });
      } else {
        searchInputRef.current?.blur();
        navigate("/f");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSearchScreen, modal, navigate, railSearchQuery]);

  return (
    <aside id="right-rail" className="trill-right-rail">
      <div id="right-rail-search-box" className="rail-search-box" role="search">
        <Search className="rail-search-icon" size={18} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          name="global-search"
          value={railSearchQuery}
          placeholder="Search Trill"
          aria-label="Search Trill"
          onFocus={() => {
            if (!isSearchScreen) navigate("/search");
          }}
          onChange={(e) => updateSearch(e.target.value)}
        />
        {railSearchQuery ? (
          <button
            className="rail-search-clear"
            type="button"
            onClick={() => updateSearch("")}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className="rail-search-key">/</kbd>
        )}
      </div>

      <div id="right-rail-relay-stats" className="rail-card rail-relay-card">
        <div className="rail-relay-header">
          <h2>Network</h2>
          <span
            className={`rail-network-pulse${relayModels.length === 0 ? " inactive" : ""}`}
          />
          <button className="rail-manage-link" onClick={openRelayDashboard}>
            Manage
          </button>
        </div>

        {relayModels.length === 0 ? (
          <button className="rail-relay-empty" onClick={openRelayDashboard}>
            <span>No relays configured</span>
            <small>Add a relay to connect to the network.</small>
          </button>
        ) : (
          relayModels.map((relay) => (
            <button
              key={relay.url}
              className="rail-relay-row"
              onClick={openRelayDashboard}
            >
              <div className="rail-relay-row-top">
                <span className="rail-relay-url mono">{relay.short}</span>
                <span className="rail-relay-status mono" style={{ color: relay.color }}>
                  {relay.status}
                </span>
              </div>
              <div className="rail-relay-bar">
                <span
                  style={{
                    width: `${relay.barWidth}%`,
                    background: relay.color,
                  }}
                />
              </div>
            </button>
          ))
        )}
      </div>

      <div id="fleet-online" className="rail-card rail-fleet-card">
        <h2 className="rail-card-title">Fleet online</h2>
        <div className="rail-fleet-row">
          <span className="status-pulse" />
          <span>{following.size} known contacts</span>
        </div>
      </div>

      {/* Who to follow */}
      {suggestions.length > 0 && (
        <div id="who-to-follow" className="rail-card">
          <h2 className="rail-card-title">Who to follow</h2>
          {suggestions.map(({ id, followedBy }) => {
            const user = stringToUser(id);
            const handle = id.startsWith("~") ? id : `${id.slice(0, 12)}…`;
            return (
              <button
                type="button"
                key={id}
                className="rail-follow-row"
                onClick={() => "ok" in user && setModal(<UserModal user={user.ok} />)}
              >
                <div className="rail-follow-info">
                  <div className="rail-follow-name">{profiles.get(id)?.name ?? handle}</div>
                  <div className="rail-follow-handle mono">
                    {handle} · followed by {followedBy} you follow
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
