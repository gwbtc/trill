import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Swords } from "lucide-react";
import useLocalState from "@/state/state";
import ShipName from "./ShipName";
import {
  debateKey,
  debatePath,
  debatesOfFollows,
  presenceLabel,
  trackedShips,
  type Presence,
} from "@/logic/debates";
import "@/styles/Debates.css";

// keeps %debates following the presence of the ships we follow and of the
// profile we're looking at. renders nothing
export function DebatePresenceSync() {
  const [location] = useLocation();
  const { api, following, loaded } = useLocalState((s) => ({
    api: s.api,
    following: s.following,
    loaded: s.stateLoaded,
  }));
  const sent = useRef("");
  useEffect(() => {
    if (!api || !loaded) return;
    const who = trackedShips(following.keys(), location);
    const key = who.join(",");
    if (key === sent.current) return;
    sent.current = key;
    api.trackDebates(who);
  }, [api, loaded, following, location]);
  return null;
}

// the debate we're in, on every page: back to it in one click
export function NowInDebate() {
  const [location, navigate] = useLocation();
  const current = useLocalState((s) => s.currentDebate);
  if (!current) return null;
  const path = debatePath(current.key);
  // no need on its own page
  if (location === path) return null;
  return (
    <button type="button" className="now-in-debate" onClick={() => navigate(path)}>
      <span className={`debate-live-dot${current.stage === "live" ? "" : " idle"}`} aria-hidden="true" />
      <span className="now-in-debate-text">
        <span className="now-in-debate-label">
          {current.stage === "live" ? "You're" : "You'll be"} {presenceLabel(current)}
        </span>
        <span className="now-in-debate-topic">{current.topic}</span>
      </span>
      <span className="now-in-debate-go">Open</span>
    </button>
  );
}

// on a profile: the debate this ship is in
export function PresenceChip({ ship, isMe }: { ship: string; isMe: boolean }) {
  const [, navigate] = useLocation();
  const p: Presence | null | undefined = useLocalState((s) =>
    isMe ? s.currentDebate : s.debatePresences.get(ship),
  );
  if (!p) return null;
  return (
    <button type="button" className="presence-chip" onClick={() => navigate(debatePath(p.key))}>
      <Swords size={14} aria-hidden="true" />
      <span>
        {p.stage === "live" ? "In a debate" : "Debating soon"}, {presenceLabel(p)}:{" "}
        <strong>{p.topic}</strong>
      </span>
    </button>
  );
}

// on the home feed: live debates the ships we follow are in
export function FollowsDebating() {
  const [, navigate] = useLocation();
  const { presences, following, current } = useLocalState((s) => ({
    presences: s.debatePresences,
    following: s.following,
    current: s.currentDebate,
  }));
  const live = debatesOfFollows(presences, following, current);
  if (live.length === 0) return null;
  return (
    <section className="follows-debating" aria-label="Live debates">
      {live.map(({ presence, ships }) => (
        <button
          type="button"
          key={debateKey(presence.key)}
          className="follows-debating-card"
          onClick={() => navigate(debatePath(presence.key))}
        >
          <span className="debate-live-dot" aria-hidden="true" />
          <span className="follows-debating-text">
            <span className="follows-debating-who">
              {ships.slice(0, 2).map((s, i) => (
                <span key={s}>
                  {i > 0 && ", "}
                  <ShipName ship={s} />
                </span>
              ))}
              {ships.length > 2 && ` and ${ships.length - 2} more`}
              {ships.length === 1 ? ` is ${presenceLabel(presence)}` : " are in a debate"}
            </span>
            <span className="follows-debating-topic">{presence.topic}</span>
          </span>
          <span className="follows-debating-join">Join</span>
        </button>
      ))}
    </section>
  );
}
