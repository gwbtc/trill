import type { JSX } from "react";
import { start } from "@/logic/api";
import IO from "@/logic/requests/nostrill";
import type { ComposerData } from "@/types/ui";
import { create } from "zustand";
import type { DM, DMFact, DMJail, DMRequests, DMs, Fact, NostrFeeds, Relays, UrbitID, UserProfile } from "@/types/nostrill";
import type { Wevent } from "@/types/nostr";
import type { FC, Gate, Poast } from "@/types/trill";
import type { Notification } from "@/types/notifications";
import { useShallow } from "zustand/shallow";
import type { HarkAction, Skein } from "@/types/hark";
import {
  getNotificationsClearedAt,
  isSameNotificationRope,
  skeinToNote,
} from "@/logic/notifications";
import { defaultGate } from "@/logic/bunts";
import { eventsToFc, addEventToFc, eventToProfile, nostrFeedsToFcMap } from "@/logic/nostrill";
import { parseStateFact, emptyFC, normalizeFact, type UserTagged } from "@/logic/stateFact";
import { emptyLists, parseLists, type Lists } from "@/logic/lists";
import { SYNC_SUB_NAME } from "@/logic/constants";
import type { S3Config, UrbitContacts } from "@/types/urbit";
import { getPoint } from "@/logic/gw";
import { fixDMRequests, fixDMs, parseBigint } from "@/logic/utils";
import { pingRelays } from "@/logic/latency";
import { mentionedPubkeys } from "@/logic/nostrRefs";
// TODO handle airlock connection issues
// the SSE pipeline has a "status-update" event FWIW
// type AirlockState = "connecting" | "connected" | "failed";
export type LocalState = {
  isNew: boolean;
  api: IO | null;
  init: () => Promise<void>;
  uiSettings: Record<string, any>;
  modal: JSX.Element | null;
  setModal: (modal: JSX.Element | null) => void;
  composerData: ComposerData | null;
  setComposerData: (c: ComposerData | null) => void;
  pubkey: string;
  myFeed: FC;
  globalFeed: FC;
  setGlobal: (s: FC) => void;
  nostrFeed: FC;
  // per-sub-name merged feeds (provenance in each Wevent.relays)…
  nostrFeeds: Record<string, FC>;
  // …and the raw backend structure: per-sub, per-relay feeds + sub state
  nostrFeedsRaw: NostrFeeds;
  relays: Relays;
  // measured http round-trip per relay url; null = unreachable
  relayLatency: Record<string, number | null>;
  nostrSubs: Relays;
  profiles: Map<string, UserProfile>; // pubkey key
  setProfiles: (m: Map<string, UserProfile>) => void; // pubkey key
  addProfile: (key: string, u: UserProfile) => void;
  following: Map<string, FC>;
  timeline: FC;
  followGraph: Record<string, UserTagged[]>;
  // bookmarks, muted users, reported posts (kept by the agent)
  lists: Lists;
  followers: string[];
  // Notifications
  notifications: Notification[];
  notificationsLoaded: boolean;
  setNotifications: (n: Notification[]) => void;
  lastFact: Fact | null;
  feedPerms: Gate;
  contacts: UrbitContacts;
  s3: S3Config | null;
  lastEose: string;
  setEose: (s: string) => void;
  lastNostrEventTime: number;
  lastDroppedWs: string;
  dismissDroppedWs: () => void;
  //chat
  dms: DMs;
  dmRequests: DMRequests;
  dmJail:DMJail;
  setDmRequests: (requests: DMRequests) => void;
  lastChatFact: DM | null;
  // 
  our: UrbitID | null;
};

let initPromise: Promise<void> | null = null;
const creator = create<LocalState>();
export const useStore = creator((set, get) => ({
  isNew: false,
  contacts: {},
  s3: null,
  api: null,
  // memoized: the subscriptions and timers below must only be set up once,
  // and a second caller (StrictMode, HMR) should wait for the same setup
  init: () => (initPromise ??= (async () => {
    const airlock = await start();
    const api = new IO(airlock);
    const patp = api.airlock.our!;


    api.scryGwid(patp).then(gwid => {
      if ("error" in gwid) {
        console.error(gwid, "error in gwid")
        return;
      }
      const point = getPoint(patp);
      const our: UrbitID = { gwid: gwid.ok, patp, point }
      set({ our: our })
    });
    // api.addRelay(GLOBAL_RELAY_URL);
    api.scryContacts().then((r) => {
      // set({ contacts: contactsSample });
      // if ("ok" in r) {
      //   set({ contacts: r.ok });
      // }
    });
    api.scrySettings().then((r) => {
      if ("error" in r) {
        console.error("error scrying settings", r);
        return;
      }
      const uiSettings = r.ok.desk;
      set({ uiSettings });
    });
    api.scryStorage().then((r) => {
      if ("ok" in r) {
        set({ s3: r.ok });
      }
    });

    api.scryHark().then((r) => {
      const clearedAt = getNotificationsClearedAt();
      if ("ok" in r) {
        const notifications = r.ok.reduce((acc: Notification[], sk) => {
          const note = skeinToNote(sk, api.airlock.our ?? undefined);
          if ("ok" in note && note.ok.timestamp > clearedAt) return [...acc, note.ok];
          else return acc;
        }, []).sort((a, b) => b.timestamp - a.timestamp);
        set((state) => ({
          notifications: [
            ...state.notifications,
            ...notifications.filter(
              (note) => !state.notifications.some((current) => current.id === note.id),
            ),
          ].sort((a, b) => b.timestamp - a.timestamp),
          notificationsLoaded: true,
        }));
      } else {
        set({ notificationsLoaded: true });
      }
    });
    api.subscribeHark((data: HarkAction) => {
      if ("add-yarn" in data) {
        if (data["add-yarn"].yarn.rope.desk !== "nostrill") return;
        const nots = get().notifications;
        const yarn = data["add-yarn"].yarn;
        const skein: Skein = {
          top: yarn,
          time: yarn.time,
          "ship-count": 0,
          unread: true,
          count: 0,
        };
        const note = skeinToNote(skein, api.airlock.our ?? undefined);
        if ("error" in note) return;
        const notifications = [note.ok, ...nots.filter((item) => item.id !== note.ok.id)];
        set({ notifications, notificationsLoaded: true });
      } else if ("saw-seam" in data) {
        if (!("desk" in data["saw-seam"]) || data["saw-seam"].desk !== "nostrill") {
          return;
        }
        set({ notifications: get().notifications.map((note) => ({ ...note, unread: false })) });
      } else if ("saw-rope" in data) {
        set({
          notifications: get().notifications.map((note) =>
            isSameNotificationRope(note.rope, data["saw-rope"])
              ? { ...note, unread: false }
              : note,
          ),
        });
      }
    });
    // eose fires once per relay per sub, and each one used to start its own
    // /j/nostr scry whose responses could land out of order. run one at a
    // time, and once more afterwards if any eose came in meanwhile
    let nostrScrying = false;
    let nostrRescry = false;
    // people mentioned in notes (nostr:npub…) aren't their authors, so no
    // sub fetched their profiles. ask the relays for those we lack, each
    // at most once a session: one missing from every relay stays missing
    const askedProfiles = new Set<string>();
    const fetchMentionedProfiles = (feeds: Record<string, FC>) => {
      const { profiles, relays } = get();
      const texts = Object.values(feeds).flatMap((fc) =>
        Object.values(fc.feed).map((p) => p.event?.content ?? ""),
      );
      const missing = mentionedPubkeys(texts)
        .filter((pk) => !profiles.has(pk) && !askedProfiles.has(pk))
        .slice(0, 100);
      const wids = Object.values(relays)
        .map((r) => r.wid)
        .filter((w): w is number => w != null);
      if (missing.length === 0 || wids.length === 0) return;
      missing.forEach((pk) => askedProfiles.add(pk));
      api.nostrProfiles(wids, missing);
    };
    const refreshNostrFeeds = () => {
      if (nostrScrying) {
        nostrRescry = true;
        return;
      }
      nostrScrying = true;
      api.scryNostr()
        .then((r) => {
          if ("error" in r) {
            console.error("error scrying nostr feeds", r);
            return;
          }
          const nostrFeedsRaw = r.ok;
          const nostrFeeds = nostrFeedsToFcMap(nostrFeedsRaw);
          set({
            nostrFeedsRaw,
            nostrFeeds,
            nostrFeed: nostrFeeds[SYNC_SUB_NAME] ?? emptyFC(),
          });
          fetchMentionedProfiles(nostrFeeds);
        })
        .finally(() => {
          nostrScrying = false;
          if (nostrRescry) {
            nostrRescry = false;
            refreshNostrFeeds();
          }
        });
    };
    api.subscribeNostrill((data) => {
      if ("state" in data) {
        set(parseStateFact(data.state));
      } else if ("fact" in data) {
        const fact: Fact = normalizeFact(data.fact);
        set({ lastFact: fact });
        // store updates must produce new Map/object references, or
        // useShallow selectors see no change and nothing re-renders
        if ("fols" in fact) {
          if ("new-urbit" in fact.fols) {
            const { user, data } = fact.fols["new-urbit"];
            if (data.data === "maybe") return;
            if (data.data) {
              const { feed, profile } = data.data;
              const following = new Map(get().following).set(user, feed);
              if (profile) {
                const profiles = new Map(get().profiles).set(user, profile);
                set({ following, profiles });
              } else set({ following });
            }
          }
          if ("quit" in fact.fols) {
            const following = new Map(get().following);
            following.delete(fact.fols.quit);
            set({ following });
          }
        }
        if ("post" in fact) {
          // upd (e.g. a parent whose children changed) replaces the post like add
          if ("add" in fact.post || "upd" in fact.post) {
            const post: Poast =
              "add" in fact.post ? fact.post.add.post : fact.post.upd.post;
            const { api, following, myFeed } = get();
            const our = api?.airlock?.our;
            if (post.author === our) {
              set({ myFeed: { ...myFeed, feed: { ...myFeed.feed, [post.id]: post } } });
            } else {
              const curr = following.get(post.author);
              const fc = curr ? curr : { feed: {}, start: null, end: null };
              const nf = { ...fc, feed: { ...fc.feed, [post.id]: post } };
              set({ following: new Map(following).set(post.author, nf) });
            }
          }
          if ("del" in fact.post) {
            const post: Poast = fact.post.del.post;
            const { api, following, myFeed } = get();
            // our own posts live in myFeed, mirroring the "add" branch
            if (post.author === api?.airlock?.our) {
              if (myFeed.feed[post.id]) {
                const feed = { ...myFeed.feed };
                delete feed[post.id];
                set({ myFeed: { ...myFeed, feed } });
              }
            } else {
              const curr = following.get(post.author);
              if (curr && curr.feed[post.id]) {
                const feed = { ...curr.feed };
                delete feed[post.id];
                set({
                  following: new Map(following).set(post.author, { ...curr, feed }),
                });
              }
            }
          }
        }
        if ("nostr" in fact) {
          set({ lastNostrEventTime: Date.now() });
          if ("feed" in fact.nostr || "user" in fact.nostr) {
            const { name, feed } =
              "feed" in fact.nostr ? fact.nostr.feed : fact.nostr.user;
            const nostrFeeds = { ...get().nostrFeeds, [name]: eventsToFc(feed) };
            set(
              name === SYNC_SUB_NAME
                ? { nostrFeeds, nostrFeed: nostrFeeds[name] }
                : { nostrFeeds },
            );
          }
          if ("relays" in fact.nostr) set({ relays: fact.nostr.relays });
          if ("eose" in fact.nostr) {
            set({ lastEose: fact.nostr.eose });
            // author-filtered subs (incl. %sync) emit no %feed fact at eose;
            // the backlog is only readable through the /x/j/nostr scry
            refreshNostrFeeds();
          }
          if ("drop" in fact.nostr) set({ lastDroppedWs: fact.nostr.drop });
          if ("event" in fact.nostr) {
            // console.log("san event", fact.nostr.event);
            const event: Wevent = fact.nostr.event;
            if (event.kind === 1) {
              // %event facts carry no sub name; only ongoing subs stream
              // past eose, and the sync sub is the only one we keep ongoing
              const { nostrFeed, nostrFeeds } = get();
              const nf = addEventToFc(event, nostrFeed);
              set({
                nostrFeed: nf,
                nostrFeeds: { ...nostrFeeds, [SYNC_SUB_NAME]: nf },
              });
            }
            if (event.kind === 0) {
              const prof = eventToProfile(event);
              if (!prof) return;
              set({ profiles: new Map(get().profiles).set(event.pubkey, prof) });
            }
          }
          // if ("thread" in data.fact.nostr)
        }
        if ("prof" in fact) {
          const profiles = new Map(get().profiles);
          for (const [user, prof] of Object.entries(fact.prof))
            profiles.set(user, prof);
          set({ profiles });
        }
        if ("keys" in fact) set({ pubkey: fact.keys });
        if ("lists" in fact) set({ lists: parseLists(fact.lists) });
      }
    });
    api.scryDMs().then((r) => {
      if ("error" in r) {
        console.error("error scrying dms", r);
        return;
      }
      set({
        dms: fixDMs(r.ok.dms),
        dmRequests: fixDMRequests(r.ok.requests),
        dmJail: r.ok.jail,
      });
    });
    api.subscribeDMs((data: DMFact) => {
      if ("init" in data) {
        const dms = fixDMs(data.init.dms)
        const dmRequests = fixDMRequests(data.init.requests)
        const dmJail = data.init.jail;
        set({ dms, dmRequests, dmJail })
      };
      if ("peer" in data) {
        const cooked = parseBigint(data.peer);
        const dms = { ...get().dms, [data.peer.peer.patp]: cooked }
        const dmRequests = { ...get().dmRequests };
        delete dmRequests[data.peer.peer.patp];
        set({ dms, dmRequests, lastChatFact: cooked });
      }
      if ("requests" in data) {
        set({ dmRequests: fixDMRequests(data.requests) })
      }
      if ("error" in data) {
        console.error(data.error, "error in chat fact")
      }

    });
    // measure real relay latency now and periodically
    const measureLatency = async () => {
      const urls = Object.keys(get().relays);
      if (urls.length === 0) return;
      set({ relayLatency: await pingRelays(urls) });
    };
    setTimeout(measureLatency, 3000);
    setInterval(measureLatency, 60_000);
    set({ api });
  })()),
  pubkey: "",
  profiles: new Map(),
  addProfile: (key, profile) => {
    set({ profiles: new Map(get().profiles).set(key, profile) });
  },
  setProfiles: (profiles) => set({ profiles }),
  lastFact: null,
  relays: {},
  relayLatency: {},
  nostrSubs: {},
  myFeed: { feed: {}, start: null, end: null },
  globalFeed: { feed: {}, start: null, end: null },
  setGlobal: (s) => set({ globalFeed: s }),
  nostrFeed: { feed: {}, start: null, end: null },
  nostrFeeds: {},
  nostrFeedsRaw: {},
  following: new Map(),
  followers: [],
  timeline: { feed: {}, start: null, end: null },
  followGraph: {},
  lists: emptyLists(),
  uiSettings: {},
  modal: null,
  setModal: (modal) => set({ modal }),
  // composer data
  composerData: null,
  setComposerData: (composerData) => set({ composerData }),
  // Notifications
  notifications: [],
  notificationsLoaded: false,
  setNotifications: (notifications) => {
    set({ notifications, notificationsLoaded: true });
  },
  feedPerms: defaultGate,
  lastEose: "",
  setEose: (lastEose) => set({ lastEose }),
  lastNostrEventTime: 0,
  lastDroppedWs: "",
  dismissDroppedWs: () => set({ lastDroppedWs: "" }),
  // dms
  dms: {},
  dmRequests: {},
  dmJail: {muted: [], blocked: []},
  setDmRequests: (dmRequests) => set({ dmRequests }),
  lastChatFact: null,
  our: null,
}));

const useShallowStore = <T extends (state: LocalState) => any>(
  selector: T,
): ReturnType<T> => useStore(useShallow(selector));

export default useShallowStore;
