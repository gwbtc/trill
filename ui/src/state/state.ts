import type { JSX } from "react";
import { start } from "@/logic/api";
import IO from "@/logic/requests/nostrill";
import type { ComposerData } from "@/types/ui";
import { create } from "zustand";
import type {
  DFollowGraph,
  Disaggregated,
  Fact,
  FollowGraph,
  NostrData,
  NostrFeeds,
  Relays,
  UrbitID,
  UserProfile,
} from "@/types/nostrill";
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
import {
  eventsToFc,
  nostrEventsInFeed,
  addEventToFc,
  eventToProfile,
  nostrFeedsToFcMap,
} from "@/logic/nostrill";
import {
  parseStateFact,
  emptyFC,
  normalizeFact,
  type UserTagged,
  updateFollowing,
} from "@/logic/stateFact";
import {
  applyNostrEvent,
  mergeSourcedFeeds,
  emptyNostrData,
  normalizeProfile,
  parseProfiles,
  parseNostrData,
  parseFollowGraph,
  projectSocial,
} from "@/logic/socialState";
import { emptyLists, parseLists, type Lists } from "@/logic/lists";
import { SYNC_SUB_NAME } from "@/logic/constants";
import type { S3Config, UrbitContacts } from "@/types/urbit";
import { getPoint } from "@/logic/gw";
import { pingRelays } from "@/logic/latency";
import { mentionedPubkeys } from "@/logic/nostrRefs";
import toast from "react-hot-toast";
import { isFailure, parseWallet, type WalletState } from "@/logic/wallet";
import {
  applyDebateUpdate,
  debateKey,
  type Debate,
  type DebatesFact,
  type Invitation,
  type Presence,
} from "@/logic/debates";
import { generateNevent } from "@/logic/nostr";
import { ensureMediaBucket, jarsConfig } from "@/logic/s3";
// TODO handle airlock connection issues
// the SSE pipeline has a "status-update" event FWIW
// type AirlockState = "connecting" | "connected" | "failed";
export type LocalState = {
  isNew: boolean;
  api: IO | null;
  init: () => Promise<void>;
  uiSettings: Record<string, any>;
  uiSettingsLoaded: boolean;
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
  profiles: Map<string, UserProfile>; // shared display view; ship or pubkey key
  addProfile: (key: string, u: UserProfile) => void;
  timeline: FC;
  nostrData: NostrData;
  urbitProfiles: Map<string, UserProfile>;
  nativeFollowGraph: FollowGraph;
  followedUsers: Set<string>;
  nostrUserFeeds: Map<string, FC>;
  following: Disaggregated<Map<string, FC>>;
  followGraph: DFollowGraph;
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
  s3Status: "loading" | "ready" | "unavailable" | "error";
  initMedia: () => Promise<void>;
  lastEose: string;
  // the /ui subscription's first state fact has landed: until then empty
  // relays, follows etc. mean "not loaded", not "none"
  stateLoaded: boolean;
  setEose: (s: string) => void;
  lastNostrEventTime: number;
  lastDroppedWs: string;
  dismissDroppedWs: () => void;
  // debates (%debates), keyed by debateKey
  debates: Map<string, Debate>;
  debateInvites: Map<string, Invitation>;
  debatesLoaded: boolean;
  // the debate we're in (one at a time), and the ones others we track are in
  currentDebate: Presence | null;
  debatePresences: Map<string, Presence>;
  // the ecash wallet (%trill-wallet); null until it answers, or if it
  // isn't running
  wallet: WalletState | null;
  //
  our: UrbitID | null;
};

let initPromise: Promise<void> | null = null;
let mediaInitPromise: Promise<void> | null = null;
const creator = create<LocalState>();
export const useStore = creator((set, get) => ({
  isNew: false,
  contacts: {},
  s3: null,
  s3Status: "loading",
  initMedia: () => {
    if (mediaInitPromise) return mediaInitPromise;
    const api = get().api;
    if (!api) return Promise.resolve();
    mediaInitPromise = (async () => {
      set({ s3: null, s3Status: "loading" });
      const result = await api.scryS3Server();
      if ("error" in result) {
        set({ s3Status: "unavailable" });
        return;
      }
      try {
        const s3 = jarsConfig(result.ok);
        await ensureMediaBucket(s3);
        set({ s3, s3Status: "ready" });
      } catch {
        // Do not log config or credential-bearing S3 request errors.
        set({ s3Status: "error" });
      }
    })().finally(() => { mediaInitPromise = null; });
    return mediaInitPromise;
  },
  api: null,
  // memoized: the subscriptions and timers below must only be set up once,
  // and a second caller (StrictMode, HMR) should wait for the same setup
  init: () =>
    (initPromise ??= (async () => {
      const airlock = await start();
      const api = new IO(airlock);
      const patp = api.airlock.our!;
      const updateSocial = (
        patch: Partial<
          Pick<LocalState, "urbitProfiles" | "nativeFollowGraph" | "nostrData">
        > & { nativeFeeds?: Map<string, FC> },
      ) => {
        const current = get();
        const { nativeFeeds, ...values } = patch;
        if (nativeFeeds && Object.keys(values).length === 0) {
          const followedUsers = new Set([
            ...nativeFeeds.keys(),
            ...current.nostrData.following,
          ]);
          for (const ref of current.nativeFollowGraph[patp] ?? [])
            if ("urbit" in ref) followedUsers.add(ref.urbit);
          followedUsers.delete(patp);
          set({
            following: { ...current.following, urbit: nativeFeeds },
            followedUsers,
          });
          return;
        }
        const urbitProfiles = values.urbitProfiles ?? current.urbitProfiles;
        const nativeFollowGraph =
          values.nativeFollowGraph ?? current.nativeFollowGraph;
        const nostrData = values.nostrData ?? current.nostrData;
        set({
          ...values,
          ...projectSocial(
            nativeFeeds ?? current.following.urbit,
            nativeFollowGraph,
            urbitProfiles,
            nostrData,
            patp,
            current,
          ),
        });
      };

      api.scryGwid(patp).then((gwid) => {
        if ("error" in gwid) {
          console.error(gwid, "error in gwid");
          return;
        }
        const point = getPoint(patp);
        const our: UrbitID = { gwid: gwid.ok, patp, point };
        set({ our: our });
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
        set({ uiSettings, uiSettingsLoaded: true });
      });
      api.scryHark().then((r) => {
        const clearedAt = getNotificationsClearedAt();
        if ("ok" in r) {
          const notifications = r.ok
            .reduce((acc: Notification[], sk) => {
              const note = skeinToNote(sk, api.airlock.our ?? undefined);
              if ("ok" in note && note.ok.timestamp > clearedAt)
                return [...acc, note.ok];
              else return acc;
            }, [])
            .sort((a, b) => b.timestamp - a.timestamp);
          set((state) => ({
            notifications: [
              ...state.notifications,
              ...notifications.filter(
                (note) =>
                  !state.notifications.some(
                    (current) => current.id === note.id,
                  ),
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
          const notifications = [
            note.ok,
            ...nots.filter((item) => item.id !== note.ok.id),
          ];
          set({ notifications, notificationsLoaded: true });
        } else if ("saw-seam" in data) {
          if (
            !("desk" in data["saw-seam"]) ||
            data["saw-seam"].desk !== "nostrill"
          ) {
            return;
          }
          set({
            notifications: get().notifications.map((note) => ({
              ...note,
              unread: false,
            })),
          });
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
      let nostrDataRevision = 0;
      let nostrScrying = false;
      let nostrRescry = false;
      // people mentioned in notes (nostr:npub…) aren't their authors, so no
      // sub fetched their profiles. ask the relays for those we lack, each
      // at most once a session: one missing from every relay stays missing
      const askedProfiles = new Set<string>();
      const fetchMentionedProfiles = (feeds: Record<string, FC>) => {
        const { profiles, relays } = get();
        const texts = Object.values(feeds).flatMap((fc) =>
          [...nostrEventsInFeed(fc)].map((event) => event.content),
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
        const revision = nostrDataRevision;
        api
          .scryNostr()
          .then((r) => {
            if ("error" in r) {
              console.error("error scrying nostr feeds", r);
              return;
            }
            if (revision !== nostrDataRevision) return;
            const nostrFeedsRaw = r.ok;
            const nostrFeeds = nostrFeedsToFcMap(nostrFeedsRaw);
            updateSocial({
              nostrData: mergeSourcedFeeds(get().nostrData, nostrFeedsRaw),
            });
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
      // the wallet: all of it, whenever it changes
      api.subscribeWallet((data: unknown) => {
        const wallet = parseWallet(data);
        if (!wallet) return;
        // what finished since (deposits, nutzaps: they take a while), told
        // wherever we are. not on the first load
        const before = get().wallet;
        if (before) {
          const seen = new Set(before.log.map((l) => `${l.at}|${l.what}`));
          for (const l of wallet.log
            .filter((l) => !seen.has(`${l.at}|${l.what}`))
            .reverse()) {
            const text = l.what.charAt(0).toUpperCase() + l.what.slice(1);
            if (isFailure(l.what)) toast.error(text);
            else toast.success(text);
          }
        }
        set({ wallet });
      });
      // debates: everything we host or follow, kept current by the agent
      const ourPatp = (() => {
        const o = api.airlock.our ?? "";
        return o.startsWith("~") ? o : `~${o}`;
      })();
      api.subscribeDebates((data: DebatesFact) => {
        if ("all" in data) {
          set({
            debates: new Map(
              data.all.debates.map((d) => [debateKey(d.key), d]),
            ),
            debateInvites: new Map(
              data.all.invites.map((i) => [debateKey(i.key), i]),
            ),
            currentDebate: data.all.current,
            debatePresences: new Map(Object.entries(data.all.presences)),
            debatesLoaded: true,
          });
        } else if ("current" in data) {
          set({ currentDebate: data.current });
        } else if ("presence" in data) {
          const next = new Map(get().debatePresences);
          const { ship, presence } = data.presence;
          if (presence) next.set(ship, presence);
          else next.delete(ship);
          set({ debatePresences: next });
        } else if ("update" in data) {
          const { key, update } = data.update;
          set({
            debates: applyDebateUpdate(get().debates, key, update, ourPatp),
          });
        } else if ("invited" in data) {
          const i = data.invited;
          set({
            debateInvites: new Map(get().debateInvites).set(
              debateKey(i.key),
              i,
            ),
          });
        } else if ("dismissed" in data) {
          const next = new Map(get().debateInvites);
          next.delete(debateKey(data.dismissed));
          set({ debateInvites: next });
        } else if ("error" in data) {
          toast.error(data.error.msg);
        }
      });
      api.subscribeNostrill((data) => {
        if ("state" in data) {
          nostrDataRevision++;
          set({ ...parseStateFact(data.state, patp), stateLoaded: true });
        } else if ("fact" in data) {
          const fact: Fact = normalizeFact(data.fact);
          set({ lastFact: fact });
          // store updates must produce new Map/object references, or
          // useShallow selectors see no change and nothing re-renders
          if ("fols" in fact) {
            if ("graph" in fact.fols) {
              updateSocial({
                nativeFollowGraph: parseFollowGraph(fact.fols.graph),
              });
            }
            if ("new-urbit" in fact.fols) {
              const { user, data } = fact.fols["new-urbit"];
              if (data.data === "maybe") return;
              if (data.data) {
                const { feed, profile } = data.data;
                const nativeFeeds = new Map(get().following.urbit).set(
                  user,
                  feed,
                );
                const urbitProfiles = profile
                  ? new Map(get().urbitProfiles).set(
                      user,
                      normalizeProfile(profile),
                    )
                  : get().urbitProfiles;
                updateSocial({ nativeFeeds, urbitProfiles });
              }
            }
            if ("quit" in fact.fols) {
              const id = fact.fols.quit;
              if (id.startsWith("~")) {
                const nativeFeeds = new Map(get().following.urbit);
                nativeFeeds.delete(id);
                const nativeFollowGraph = { ...get().nativeFollowGraph };
                delete nativeFollowGraph[id];
                if (nativeFollowGraph[patp])
                  nativeFollowGraph[patp] = nativeFollowGraph[patp].filter(
                    (ref) => !("urbit" in ref) || ref.urbit !== id,
                  );
                updateSocial({ nativeFeeds, nativeFollowGraph });
              } else {
                const following = new Set(get().nostrData.following);
                following.delete(id);
                updateSocial({ nostrData: { ...get().nostrData, following } });
              }
            }
          }
          if ("post" in fact) {
            // upd (e.g. a parent whose children changed) replaces the post like add
            if ("add" in fact.post || "upd" in fact.post) {
              const post: Poast =
                "add" in fact.post ? fact.post.add.post : fact.post.upd.post;
              const { api, following, myFeed } = get();
              const our = api?.airlock?.our;
              if (post.host === our) {
                set({
                  myFeed: {
                    ...myFeed,
                    feed: { ...myFeed.feed, [post.id]: post },
                  },
                });
              } else {
                updateSocial({
                  nativeFeeds: updateFollowing(following.urbit, post, "add"),
                });
              }
            }
            if ("del" in fact.post) {
              const post: Poast = fact.post.del.post;
              const { api, following, myFeed } = get();
              // Feeds belong to the host, including replies by other authors.
              if (post.host === api?.airlock?.our) {
                if (myFeed.feed[post.id]) {
                  const feed = { ...myFeed.feed };
                  delete feed[post.id];
                  set({ myFeed: { ...myFeed, feed } });
                }
              } else {
                updateSocial({
                  nativeFeeds: updateFollowing(following.urbit, post, "del"),
                });
              }
            }
          }
          if ("nostr" in fact) {
            set({ lastNostrEventTime: Date.now() });
            if ("data" in fact.nostr) {
              nostrDataRevision++;
              const nostrData = parseNostrData(fact.nostr.data);
              const nostrFeeds = nostrFeedsToFcMap(nostrData.feeds);
              updateSocial({ nostrData });
              set({
                nostrFeedsRaw: nostrData.feeds,
                nostrFeeds,
                nostrFeed: nostrFeeds[SYNC_SUB_NAME] ?? emptyFC(),
              });
              fetchMentionedProfiles(nostrFeeds);
            }
            if ("feed" in fact.nostr || "user" in fact.nostr) {
              const { name, feed } =
                "feed" in fact.nostr ? fact.nostr.feed : fact.nostr.user;
              const nostrFeeds = {
                ...get().nostrFeeds,
                [name]: eventsToFc(feed),
              };
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
            if ("sent-event" in fact.nostr) {
              const publication = fact.nostr["sent-event"];
              if (import.meta.env.DEV && "reply" in publication.type) {
                // Keep the exact signed event available for hash/signature
                // checks; an OK acknowledgement alone does not prove read-back.
                console.info("nostr:reply-event", JSON.stringify(publication.event));
              }
            }
            if ("sent-res" in fact.nostr) {
              const response = fact.nostr["sent-res"];
              if (!response.accepted) {
                toast.error(`${response.relay}: ${response.msg || "Relay rejected the event"}`);
                console.warn("Relay rejected event", response);
              } else {
                const nevent = generateNevent(response.id.pubkey, get().pubkey, 1);
                console.log("nevent", nevent);
              }
            }
            if ("event" in fact.nostr) {
              // console.log("san event", fact.nostr.event);
              const event: Wevent = fact.nostr.event;
              nostrDataRevision++;
              updateSocial({
                nostrData: applyNostrEvent(get().nostrData, event),
              });
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
            }
            // if ("thread" in data.fact.nostr)
          }
          if ("prof" in fact) {
            const urbitProfiles = new Map(get().urbitProfiles);
            for (const [id, profile] of parseProfiles(fact.prof))
              urbitProfiles.set(id, profile);
            updateSocial({ urbitProfiles });
          }
          if ("keys" in fact) set({ pubkey: fact.keys });
          if ("lists" in fact) set({ lists: parseLists(fact.lists) });
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
      void get().initMedia();
    })()),
  pubkey: "",
  profiles: new Map(),
  addProfile: (key, profile) => {
    const normalized = normalizeProfile(profile);
    const urbitProfiles = new Map(get().urbitProfiles).set(key, normalized);
    set({
      urbitProfiles,
      profiles: new Map(get().profiles).set(key, normalized),
    });
  },
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
  nostrData: emptyNostrData(),
  urbitProfiles: new Map(),
  nativeFollowGraph: {},
  followedUsers: new Set(),
  nostrUserFeeds: new Map(),
  following: { urbit: new Map(), nostr: new Map() },
  followers: [],
  timeline: { feed: {}, start: null, end: null },
  followGraph: { urbit: [], nostr: [] },
  lists: emptyLists(),
  uiSettings: {},
  uiSettingsLoaded: false,
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
  stateLoaded: false,
  setEose: (lastEose) => set({ lastEose }),
  lastNostrEventTime: 0,
  lastDroppedWs: "",
  dismissDroppedWs: () => set({ lastDroppedWs: "" }),
  // debates
  debates: new Map(),
  debateInvites: new Map(),
  debatesLoaded: false,
  currentDebate: null,
  debatePresences: new Map(),
  wallet: null,
  our: null,
}));

const useShallowStore = <T extends (state: LocalState) => any>(
  selector: T,
): ReturnType<T> => useStore(useShallow(selector));

export default useShallowStore;
