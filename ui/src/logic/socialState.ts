import type { Wevent } from "@/types/nostr";
import type {
  BasicProfile, DFollowGraph, Disaggregated, FollowGraph, NostrData,
  NostrFeeds, NostrUserData, UrbitID, UserProfile, UserType,
} from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { patpToFallbackUID } from "./gw";
import { eventsToFc } from "./nostrill";

export const isRecord = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const emptyNostrData = (): NostrData => ({ feeds: {}, following: new Set(), users: new Map() });

export function parseUser(value: unknown): UserType | null {
  if (!isRecord(value)) return null;
  if (typeof value.nostr === "string") return { nostr: value.nostr };
  const raw = value.urbit;
  const patp = typeof raw === "string" ? raw : isRecord(raw) ? raw.patp : null;
  if (typeof patp !== "string") return null;
  try {
    const fallback = patpToFallbackUID(patp);
    const identity: UrbitID = isRecord(raw)
      ? { ...fallback, ...raw, point: BigInt(raw.point ?? fallback.point) }
      : fallback;
    return { urbit: identity };
  } catch {
    return null;
  }
}

function userList(value: unknown): UserType[] {
  return Array.isArray(value) ? value.flatMap(raw => {
    const user = parseUser(raw);
    return user ? [user] : [];
  }) : [];
}

export function normalizeProfile(raw: unknown): UserProfile {
  const p = isRecord(raw) ? raw : {};
  const identity = p.urbitID ? parseUser({ urbit: p.urbitID }) : null;
  return {
    name: typeof p.name === "string" ? p.name : "",
    about: typeof p.about === "string" ? p.about : "",
    picture: typeof p.picture === "string" ? p.picture : "",
    other: {
      ...Object.fromEntries(Object.entries(p).filter(([key]) => ![
        "name", "about", "picture", "pubkey", "following", "followers", "followingCount", "followerCount",
        "followingKnown", "followersKnown", "urbitID", "gwid", "other",
      ].includes(key))),
      ...(isRecord(p.other) ? p.other : {}),
    },
    pubkey: typeof p.pubkey === "string" ? p.pubkey : "",
    following: userList(p.following), followers: userList(p.followers),
    followingCount: typeof p.followingCount === "number" ? p.followingCount : userList(p.following).length,
    followerCount: typeof p.followerCount === "number" ? p.followerCount : userList(p.followers).length,
    followingKnown: p.followingKnown ?? Array.isArray(p.following),
    followersKnown: p.followersKnown ?? Array.isArray(p.followers),
    urbitID: identity && "urbit" in identity ? identity.urbit : null,
    ...(p.gwid ? { gwid: p.gwid } : {}),
  };
}

export function parseProfiles(raw: unknown): Map<string, UserProfile> {
  return new Map(Object.entries(isRecord(raw) ? raw : {}).map(([id, profile]) => [id, normalizeProfile(profile)]));
}

export function parseFollowGraph(raw: unknown): FollowGraph {
  const graph: FollowGraph = {};
  for (const [id, users] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!Array.isArray(users)) continue;
    graph[id] = userList(users).map(user => "urbit" in user ? { urbit: user.urbit.patp } : user);
  }
  return graph;
}

export function parseNostrData(raw: unknown): NostrData {
  const data = isRecord(raw) ? raw : {};
  const users = new Map<string, NostrUserData>();
  for (const [key, value] of Object.entries(isRecord(data["user-map"]) ? data["user-map"] : {})) {
    if (!isRecord(value)) continue;
    users.set(key, {
      id: { pubkey: key, npub: typeof value.id?.npub === "string" ? value.id.npub : "" },
      feed: Array.isArray(value.feed) ? value.feed : [],
      following: Array.isArray(value.following) ? value.following.filter((id: unknown) => typeof id === "string") : null,
      profile: isRecord(value.profile) ? {
        name: value.profile.name ?? "", about: value.profile.about ?? "", picture: value.profile.picture ?? "",
        other: Object.fromEntries(Object.entries(value.profile).filter(([key]) => !["name", "about", "picture"].includes(key))),
      } : null,
      other: Array.isArray(value.other) ? value.other : [],
    });
  }
  const parsed: NostrData = {
    feeds: {},
    following: new Set(Array.isArray(data.following) ? data.following.filter((id: unknown): id is string => typeof id === "string") : []),
    users,
  };
  return mergeSourcedFeeds(parsed, isRecord(data.feeds) ? data.feeds as NostrFeeds : {});
}

// /j/nostr returns sourced feeds only. Retain selections and metadata while
// making author caches available to profiles, including paginated requests.
export function mergeSourcedFeeds(data: NostrData, feeds: NostrFeeds): NostrData {
  const grouped = new Map<string, Map<string, Wevent>>();
  for (const sources of Object.values(feeds)) {
    if (!isRecord(sources)) continue;
    for (const [url, source] of Object.entries(sources)) {
      if (!Array.isArray(source?.feed)) continue;
      for (const event of source.feed) {
        if (event.kind !== 1 && event.kind !== 667) continue;
        let notes = grouped.get(event.pubkey);
        if (!notes) {
          notes = new Map(data.users.get(event.pubkey)?.feed.map(note => [note.id, note]) ?? []);
          grouped.set(event.pubkey, notes);
        }
        const old = notes.get(event.id);
        notes.set(event.id, { ...event, relays: [...new Set([...(old?.relays ?? []), ...(event.relays ?? []), url])] });
      }
    }
  }
  const users = new Map(data.users);
  for (const [id, notes] of grouped) {
    const prev = users.get(id) ?? { id: { pubkey: id, npub: "" }, following: null, profile: null, other: [] };
    users.set(id, { ...prev, feed: [...notes.values()] });
  }
  return { ...data, feeds, users };
}

const userViews = new WeakMap<NostrUserData, { profile?: UserProfile; feed: FC }>();
function projectNostrUser(data: NostrUserData) {
  const cached = userViews.get(data);
  if (cached) return cached;
  const profile: UserProfile | undefined = data.profile || data.following !== null ? {
    name: "", about: "", picture: "", other: {}, ...data.profile,
    pubkey: data.id.pubkey, urbitID: null,
    following: (data.following ?? []).map(nostr => ({ nostr })),
    followingCount: data.following?.length ?? 0, followingKnown: data.following !== null,
    followers: [], followerCount: 0, followersKnown: false,
  } : undefined;
  const view = { profile, feed: eventsToFc(data.feed) };
  userViews.set(data, view);
  return view;
}

// These shared rendering views are derived once per social-state update.
// The raw Nostr subtree remains separate and preserves unknown values.
export function projectSocial(
  nativeFeeds: Map<string, FC>, nativeGraph: FollowGraph,
  nativeProfiles: Map<string, UserProfile>, nostr: NostrData, our = "",
) {
  const profiles = new Map(nativeProfiles);
  const nostrUserFeeds = new Map<string, FC>();
  const graph: DFollowGraph = { urbit: [], nostr: [] };
  for (const [id, data] of nostr.users) {
    const view = projectNostrUser(data);
    if (view.profile) profiles.set(id, view.profile);
    nostrUserFeeds.set(id, view.feed);
    if (data.following !== null)
      graph.nostr.push([data.id, data.following.map(pubkey => ({ pubkey, npub: "" }))]);
  }
  for (const [id, targets] of Object.entries(nativeGraph)) {
    const user = parseUser({ urbit: nativeProfiles.get(id)?.urbitID ?? id });
    if (!user || !("urbit" in user)) continue;
    graph.urbit.push([user.urbit, targets.flatMap(target => {
      const parsed = parseUser(target);
      if (!parsed) return [];
      return ["urbit" in parsed ? parsed : { nostr: { pubkey: parsed.nostr, npub: "" } }];
    })]);
  }
  const followedUsers = new Set([...nativeFeeds.keys(), ...nostr.following]);
  for (const ref of nativeGraph[our] ?? [])
    if ("urbit" in ref) followedUsers.add(ref.urbit);
  followedUsers.delete(our);
  const following: Disaggregated<Map<string, FC>> = {
    urbit: nativeFeeds,
    nostr: new Map([...nostrUserFeeds].filter(([id]) => nostr.following.has(id))),
  };
  return { profiles, following, followGraph: graph, followedUsers, nostrUserFeeds };
}

export function applyNostrEvent(data: NostrData, event: Wevent): NostrData {
  const prev = data.users.get(event.pubkey) ?? {
    id: { pubkey: event.pubkey, npub: "" }, feed: [], following: null, profile: null, other: [],
  };
  let user = { ...prev };
  if (event.kind === 1 || event.kind === 667) {
    const feed = new Map(prev.feed.map(note => [note.id, note]));
    const old = feed.get(event.id);
    feed.set(event.id, { ...event, relays: [...new Set([...(old?.relays ?? []), ...(event.relays ?? [])])] });
    user.feed = [...feed.values()];
  } else if (event.kind === 0) {
    try {
      const raw = JSON.parse(event.content);
      if (!isRecord(raw)) return data;
      const { name = "", about = "", picture = "", ...other } = raw;
      user.profile = { name, about, picture, other };
    } catch { return data; }
  } else if (event.kind === 3) {
    user.following = [...new Set(event.tags.filter(tag => tag[0] === "p" && tag[1]).map(tag => tag[1]))];
  } else return data;
  return { ...data, users: new Map(data.users).set(event.pubkey, user) };
}
