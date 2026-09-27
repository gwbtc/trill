import type { SharedCard } from "./cards";
// debates, from the %debates agent (backend/app/debates.hoon): two sides
// argue, onlookers vote. the ship that created a debate hosts it

export type Side = "a" | "b";
export type DebateKey = { host: string; id: string };
export type Stage = "scheduled" | "live" | "ended";
export type DebateMessage = { id: string; time: number; author: string; side: Side; text: string };
export type Debate = {
  key: DebateKey;
  topic: string;
  sides: { a: string; b: string };
  moderator: string | null;
  start: number | null;
  end: number | null;
  debaters: "open" | "invite";
  revote: boolean;
  tally: "live" | "hidden";
  stage: Stage;
  members: Record<string, Side>; // debaters, by side
  onlookers: string[];
  invited: string[];
  muted: string[];
  // who voted for what: everyone's when the tally is live or it's over,
  // else only ours
  votes: Record<string, Side>;
  total: number;
  messages: DebateMessage[];
  ended: number | null;
};
export type Invitation = { key: DebateKey; topic: string; sides: { a: string; b: string }; at: number };

export type DebateUpdate =
  | { init: Debate }
  | { said: DebateMessage }
  | {
      meta: {
        stage: Stage;
        members: Record<string, Side>;
        onlookers: string[];
        invited: string[];
        muted: string[];
        ended: number | null;
      };
    }
  | { tally: { votes: Record<string, Side>; total: number } }
  | { gone: null };

// the debate a ship is in: one at a time, the one it hosts or joined,
// until it ends or they leave
export type Presence = {
  key: DebateKey;
  topic: string;
  sides: { a: string; b: string };
  stage: Stage;
  role: Side | "onlooker" | "host";
};

// "arguing for Yes", "watching", "hosting"
export function presenceLabel(p: Presence): string {
  if (p.role === "host") return "hosting";
  if (p.role === "onlooker") return "watching";
  return `arguing for ${p.sides[p.role]}`;
}

// what the agent sends on /ui
export type DebatesFact =
  | {
      all: {
        debates: Debate[];
        invites: Invitation[];
        current: Presence | null;
        presences: Record<string, Presence>;
      };
    }
  | { current: Presence | null }
  | { presence: { ship: string; presence: Presence | null } }
  | { update: { key: DebateKey; update: DebateUpdate } }
  | { invited: Invitation }
  | { dismissed: DebateKey }
  | { error: { key: DebateKey; msg: string } };

export const debateKey = (k: DebateKey) => `${k.host}/${k.id}`;
export const debatePath = (k: DebateKey) => `/debates/${k.host}/${k.id}`;

// an update from a debate's host applied to our copy. a hidden tally
// doesn't say how we voted, so our own vote is kept
export function applyDebateUpdate(
  debates: Map<string, Debate>,
  key: DebateKey,
  u: DebateUpdate,
  our: string,
): Map<string, Debate> {
  const k = debateKey(key);
  const next = new Map(debates);
  if ("init" in u) {
    const mine = debates.get(k)?.votes[our];
    const votes = { ...u.init.votes };
    if (mine && !(our in votes) && Object.keys(votes).length === 0) votes[our] = mine;
    next.set(k, { ...u.init, votes });
    return next;
  }
  if ("gone" in u) {
    next.delete(k);
    return next;
  }
  const d = debates.get(k);
  if (!d) return debates;
  if ("said" in u) {
    if (d.messages.some((m) => m.id === u.said.id)) return debates;
    next.set(k, { ...d, messages: [...d.messages, u.said].sort(byTime) });
  } else if ("meta" in u) {
    next.set(k, { ...d, ...u.meta });
  } else if ("tally" in u) {
    const mine = d.votes[our];
    const votes = { ...u.tally.votes };
    if (mine && Object.keys(votes).length === 0) votes[our] = mine;
    next.set(k, { ...d, votes, total: u.tally.total });
  }
  return next;
}

const byTime = (a: DebateMessage, b: DebateMessage) =>
  a.time - b.time || (BigInt(a.id) < BigInt(b.id) ? -1 : 1);

export type Role = { kind: "debater"; side: Side } | { kind: "onlooker" } | { kind: "none" };

export function roleOf(d: Debate, who: string): Role {
  const side = d.members[who];
  if (side) return { kind: "debater", side };
  if (d.onlookers.includes(who)) return { kind: "onlooker" };
  return { kind: "none" };
}

export const moderates = (d: Debate, who: string) =>
  d.key.host === who || d.moderator === who;

// the same rules the host applies (lib/debates.hoon): the UI only offers
// what would be accepted
export function canTakeSide(d: Debate, who: string): boolean {
  return (
    d.stage !== "ended" &&
    (d.debaters === "open" || d.invited.includes(who) || d.key.host === who)
  );
}
export function canSpeak(d: Debate, who: string): boolean {
  return d.stage === "live" && !!d.members[who] && !d.muted.includes(who);
}
export function canVote(d: Debate, who: string): boolean {
  if (d.stage !== "live" || !d.onlookers.includes(who)) return false;
  return d.revote || !d.votes[who];
}

// counts per side, when they're known
export function tallyOf(d: Debate): { a: number; b: number; total: number; known: boolean } {
  const known = d.tally === "live" || d.stage === "ended";
  const votes = Object.values(d.votes);
  return {
    a: known ? votes.filter((v) => v === "a").length : 0,
    b: known ? votes.filter((v) => v === "b").length : 0,
    total: d.total,
    known,
  };
}

// the list page's sections: newest first, except upcoming ones, soonest first
export function groupDebates(debates: Debate[]) {
  const newest = (a: Debate, b: Debate) => (BigInt(b.key.id) > BigInt(a.key.id) ? 1 : -1);
  return {
    live: debates.filter((d) => d.stage === "live").sort(newest),
    scheduled: debates
      .filter((d) => d.stage === "scheduled")
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0)),
    ended: debates.filter((d) => d.stage === "ended").sort(newest),
  };
}

// "in 2h", "3d ago": for start and end times
export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const unit =
    abs < 60_000
      ? "less than a minute"
      : abs < 3_600_000
        ? `${Math.round(abs / 60_000)}m`
        : abs < 86_400_000
          ? `${Math.round(abs / 3_600_000)}h`
          : `${Math.round(abs / 86_400_000)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

// what the create form sends (the agent's %create command)
export type NewDebate = {
  topic: string;
  sides: { a: string; b: string };
  moderator: string | null;
  start: number | null; // ms; null: starts now
  end: number | null; // ms; null: open ended
  debaters: "open" | "invite";
  revote: boolean;
  tally: "live" | "hidden";
  invite: string[];
};

// the checks the agent makes (+valid-config), so the form can say so first
export function newDebateProblem(d: NewDebate, now = Date.now()): string | null {
  if (!d.topic.trim()) return "A debate needs a topic";
  if (d.topic.length > 300) return "The topic is too long";
  if (!d.sides.a.trim() || !d.sides.b.trim()) return "Both sides need a name";
  if (d.start !== null && d.end !== null && d.end <= d.start)
    return "It has to end after it starts";
  if (d.end !== null && d.end <= now) return "The end time has passed";
  const bad = [...d.invite, ...(d.moderator ? [d.moderator] : [])].find(
    (s) => !/^~[a-z-]+$/.test(s),
  );
  if (bad) return `"${bad}" isn't a ship name`;
  return null;
}

// "~nec, ~bus  ~wes": ship names in any separator
export function parseShips(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .map((s) => (s.startsWith("~") ? s : `~${s}`)),
    ),
  ];
}

// whose debate presence to follow: the urbit ships we follow, and the
// ship whose profile is open (nostr keys have no %debates)
export function trackedShips(following: Iterable<string>, location: string): string[] {
  const ships = new Set([...following].filter((id) => id.startsWith("~")));
  const m = /^\/u\/(~[a-z-]+)(?:\/|$)/.exec(location);
  if (m) ships.add(m[1]);
  return [...ships].sort();
}

// followed ships in live debates, for the feed: one card per debate,
// naming who's in it
export function debatesOfFollows(
  presences: Map<string, Presence>,
  following: { has: (id: string) => boolean },
  current: Presence | null,
): { presence: Presence; ships: string[] }[] {
  const byDebate = new Map<string, { presence: Presence; ships: string[] }>();
  for (const [ship, p] of presences) {
    if (p.stage !== "live" || !following.has(ship)) continue;
    // the one we're in already has its bar
    if (current && debateKey(current.key) === debateKey(p.key)) continue;
    const k = debateKey(p.key);
    const entry = byDebate.get(k) ?? { presence: p, ships: [] };
    entry.ships.push(ship);
    byDebate.set(k, entry);
  }
  return [...byDebate.values()].map((e) => ({ ...e, ships: e.ships.sort() }));
}

// a debate as a shareable card, frozen as it is now; the key lets the
// card open it later
export function debateCard(d: Debate, now = Date.now()): SharedCard {
  const t = tallyOf(d);
  const votes = (n: number) => (t.known ? `${n} ${n === 1 ? "vote" : "votes"}` : "");
  const status =
    d.stage === "live"
      ? "live"
      : d.stage === "scheduled"
        ? d.start
          ? `starts ${relativeTime(d.start, now)}`
          : "upcoming"
        : "ended";
  return {
    v: 1,
    kind: "debate",
    title: d.topic,
    subtitle: `${d.key.host}'s debate · ${status}`,
    at: now,
    items: [
      { title: d.sides.a, url: null, meta: votes(t.a), pic: null },
      { title: d.sides.b, url: null, meta: votes(t.b), pic: null },
    ],
    debate: { host: d.key.host, id: d.key.id },
  };
}
