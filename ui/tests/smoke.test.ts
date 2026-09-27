import { describe, expect, test } from "bun:test";
import { getFocusWrapTarget } from "../src/logic/focusTrap";
import { getRailSearchRoute } from "../src/logic/searchRouting";
import { normalizeThreadStyle } from "../src/hooks/useThreadStyle";
import { patpToFallbackUID } from "../src/logic/gw";
import {
  addEventToFc,
  eventsToFc,
  eventToPoast,
  extractURLs,
  nostrFeedsToFcMap,
  sourcedFeedsToFc,
  stringToUser,
  userToStringSafe,
  oldestNoteTime,
} from "../src/logic/nostrill";
import { parseStateFact } from "../src/logic/stateFact";
import { getHandleLabel, getUserId } from "../src/logic/userDisplay";
import { isValidRelayUrl } from "../src/logic/relayDisplay";
import {
  buildFeedStatusSubscriptions,
  getFeedStatusSummary,
} from "../src/logic/feedStatus";
import {
  buildDmConversations,
  buildDmRequestRows,
  canCreateRawDm,
  filterDmConversationsForSearch,
  filterDmDirectory,
  getDmUnreadCount,
  getPinnedDmPatps,
  mergeDmJailConversations,
  orderPinnedDmConversations,
} from "../src/logic/dms";
import { countThreadChildren, flattenThreadChildren } from "../src/logic/threadTree";
import { isHiddenPost, parseLists, postRef, refKey, withoutMuted } from "../src/logic/lists";
import { followGraphWithProfiles, suggestFollows } from "../src/logic/suggestions";
import {
  buildDemoInvoice,
  classifyWalletInput,
  getCashuBalance,
  getZapAmountError,
  getWalletTotal,
  sanitizeSats,
} from "../src/logic/wallet";
import {
  getProfileGalaxy,
  getProfileMedia,
  getProfilePosts,
  getProfileReplies,
  getReplyTarget,
} from "../src/logic/profile";
import {
  filterNotifications,
  formatNotificationTimestamp,
  getNotificationKind,
  isSameNotificationRope,
  notificationPath,
  skeinToNote,
  displayYarn,
  withoutActor,
} from "../src/logic/notifications";
import type { DMs, UserProfile } from "../src/types/nostrill";
import type { Notification } from "../src/types/notifications";
import type { Rope, Skein } from "../src/types/hark";
import type { FC, FullNode, Poast } from "../src/types/trill";
import {
  availableTabs,
  escapeMarkdown,
  parseTrending,
  pickTopics,
  topicMeta,
  topicPostContent,
  topicPublisher,
} from "../src/logic/topics";
import { encodeSharedCard, parseSharedCard } from "../src/logic/cards";
import { linkLabel, middleTruncate } from "../src/logic/utils";
import { countHashtags, postHashtags } from "../src/logic/hashtags";
import { userFromPost } from "../src/logic/trill/helpers";
import { mentionedPubkeys, shortNote, shortNpub, splitNostrRefs } from "../src/logic/nostrRefs";

describe("right rail search routing", () => {
  test("navigates to search and remembers the previous page", () => {
    const result = getRailSearchRoute({
      currentLocation: "/sets",
      isSearchScreen: false,
      nextQuery: "relays",
      previousRoute: "/f",
    });

    expect(result).toEqual({
      nextPath: "/search?q=relays",
      previousRoute: "/sets",
    });
  });

  test("clearing search keeps the empty Search screen open", () => {
    const result = getRailSearchRoute({
      currentLocation: "/search",
      isSearchScreen: true,
      nextQuery: "",
      previousRoute: "/fols",
    });

    expect(result).toEqual({
      nextPath: "/search",
      previousRoute: "/fols",
    });
  });
});

describe("thread style persistence", () => {
  test("normalizes unknown values to nested", () => {
    expect(normalizeThreadStyle(null)).toBe("nested");
    expect(normalizeThreadStyle("compact")).toBe("nested");
  });

  test("preserves the linear preference", () => {
    expect(normalizeThreadStyle("linear")).toBe("linear");
  });
});

describe("notification helpers", () => {
  const rope = (thread: string): Rope => ({
    group: null,
    channel: null,
    desk: "nostrill",
    thread,
  });
  const note = (
    id: string,
    timestamp: number,
    type: Notification["type"],
    unread = true,
  ): Notification => ({
    id,
    timestamp,
    type,
    unread,
    message: [],
    rope: rope(id),
  });

  test("filters each notification tab and keeps newest activity first", () => {
    const notifications = [
      note("reply", 100, {
        post: {
          reply: {
            user: "~litzod",
            parent: { ship: "~zod", id: "root" },
            id: "reply",
          },
        },
      }),
      note("relay", 300, { nostr: { relayDown: "wss://relay.test" } }),
      note("mention", 200, {
        post: { mention: { user: "~nec", post: { ship: "~zod", id: "post" } } },
      }, false),
    ];

    expect(filterNotifications(notifications, "all").map(({ id }) => id)).toEqual([
      "relay",
      "mention",
      "reply",
    ]);
    expect(filterNotifications(notifications, "unread").map(({ id }) => id)).toEqual([
      "relay",
      "reply",
    ]);
    expect(filterNotifications(notifications, "mentions").map(({ id }) => id)).toEqual([
      "mention",
      "reply",
    ]);
    expect(filterNotifications(notifications, "relays").map(({ id }) => id)).toEqual([
      "relay",
    ]);
  });

  test("derives icons and routes from the real notification variants", () => {
    const reply = note("reply", 100, {
      post: {
        reply: {
          user: "~litzod",
          parent: { ship: "~zod", id: "root" },
          id: "reply",
        },
      },
    });
    const nostrPost = {
      ...note("nostr", 100, { prof: "~zod" }),
      from: { nostr: "ab".repeat(32) },
      postId: "event-id",
    } satisfies Notification;

    expect(getNotificationKind(reply.type)).toBe("reply");
    expect(notificationPath(reply)).toBe("/t/u/~zod/root");
    expect(notificationPath(nostrPost)).toBe("/t/n/event-id");
  });

  test("parses repost and deletion variants without collapsing their types", () => {
    const makeSkein = (wer: string): Skein => ({
      time: 1_700_000_000_000,
      count: 0,
      "ship-count": 0,
      unread: true,
      top: {
        id: wer,
        rope: rope(wer),
        time: 1_700_000_000_000,
        con: [],
        wer,
        but: null,
      },
    });
    const repost = skeinToNote(
      makeSkein("/post/rp/~litzod/urbit/~zod/1.234/5.678/~2026.9.26"),
    );
    const deletion = skeinToNote(
      makeSkein("/post/del-reply/~litzod/urbit/~zod/1.234/5.678/~2026.9.26"),
    );

    expect("ok" in repost && getNotificationKind(repost.ok.type)).toBe("repost");
    expect("ok" in repost && notificationPath(repost.ok)).toBe("/t/u/~zod/1234");
    expect("ok" in deletion && getNotificationKind(deletion.ok.type)).toBe("deletion");
    expect("ok" in deletion && notificationPath(deletion.ok)).toBe("/t/u/~zod/1234");
    expect("ok" in repost && repost.ok.rope?.thread).toBe(
      "/post/rp/~litzod/urbit/~zod/1.234/5.678/~2026.9.26",
    );
  });

  test("parses every post path layout emitted by backend/lib/hark.hoon", () => {
    const makeSkein = (wer: string, con: Skein["top"]["con"] = []): Skein => ({
      time: 1_700_000_000_000,
      count: 0,
      "ship-count": 0,
      unread: true,
      top: { id: wer, rope: rope(wer), time: 1_700_000_000_000, con, wer, but: null },
    });
    const path = (wer: string, con?: Skein["top"]["con"]) => {
      const n = skeinToNote(makeSkein(wer, con), "~sampel");
      if (!("ok" in n)) throw new Error(`failed to parse ${wer}`);
      return notificationPath(n.ok);
    };
    const da = "~2026.9.26..12.00.00";

    expect(path(`/post/mention/~bus/~bus/1.234/${da}`)).toBe("/t/u/~bus/1234");
    expect(path(`/post/reply/~bus/~sampel/1.234/5.678/${da}`)).toBe("/t/u/~sampel/1234");
    expect(path(`/post/quote/~bus/1.234/~bus/5.678/${da}`)).toBe("/t/u/~sampel/1234");
    expect(path(`/post/react/~bus/urbit/~sampel/1.234/${da}`)).toBe("/t/u/~sampel/1234");
    // current layout, and the older one with the parent pid spat into a knot
    expect(path(`/post/del-quote/~bus/urbit/~sampel/1.234/5.678/${da}`)).toBe(
      "/t/u/~sampel/1234",
    );
    expect(
      path(`/post/del-quote/~bus//urbit/~sampel/1.234/urbit/~sampel/1.234/5.678/${da}`),
    ).toBe("/t/u/~sampel/1234");

    const react = skeinToNote(
      makeSkein(`/post/react/~bus/urbit/~sampel/1.234/${da}`, [
        { ship: "~bus" },
        "Reacted to post:",
        "/urbit/~sampel/1.234",
        "🫡",
      ]),
    );
    expect("ok" in react && "post" in react.ok.type && react.ok.type.post).toEqual({
      reaction: { user: "~bus", post: { ship: "~sampel", id: "1234" }, reaction: "🫡" },
    });

    // current: url only in the yarn text
    const relay = skeinToNote(
      makeSkein(`/nostr/relay-down/${da}`, [
        "The relay: ",
        "wss://relay.damus.io",
        "closed the websockets connection.",
      ]),
    );
    expect("ok" in relay && relay.ok.type).toEqual({
      nostr: { relayDown: "wss://relay.damus.io" },
    });
    // older: url in the path
    const oldRelay = skeinToNote(makeSkein(`/nostr/new-relay/wss://nos.lol/${da}`));
    expect("ok" in oldRelay && oldRelay.ok.type).toEqual({
      nostr: { newRelay: "wss://nos.lol" },
    });
  });

  test("handles Hark second timestamps and exact rope identity", () => {
    expect(formatNotificationTimestamp(1_700_000_000, 1_700_000_120_000)).toBe("2m ago");
    expect(isSameNotificationRope(rope("one"), rope("one"))).toBe(true);
    expect(isSameNotificationRope(rope("one"), rope("two"))).toBe(false);
  });
});

describe("wallet helpers", () => {
  const mints = [
    { id: "one", name: "One", url: "https://one.test", balance: 800, online: true },
    { id: "two", name: "Two", url: "https://two.test", balance: 200, online: false },
  ];

  test("derives the displayed balances from connected mints", () => {
    expect(getCashuBalance(mints)).toBe(1_000);
    expect(getWalletTotal(mints)).toBe(13_500);
  });

  test("sanitizes amounts and detects supported payment input", () => {
    expect(sanitizeSats("21,000 sats")).toBe("21000");
    expect(classifyWalletInput("cashuAeyJ0b2tlbiI6W10")).toBe("cashu");
    expect(classifyWalletInput("lnbc21000n1example")).toBe("lightning");
    expect(classifyWalletInput("short")).toBeNull();
  });

  test("builds a deterministic invoice-looking value for the UI preview", () => {
    expect(buildDemoInvoice(5_000)).toBe(buildDemoInvoice(5_000));
    expect(buildDemoInvoice(5_000)).toStartWith("lnbc5000");
  });

  test("rejects empty and over-balance Zap amounts", () => {
    expect(getZapAmountError(0, 12_500)).toBe("Enter at least 1 sat");
    expect(getZapAmountError(12_501, 12_500)).toBe(
      "Amount exceeds your Lightning balance",
    );
    expect(getZapAmountError(12_500, 12_500)).toBeNull();
  });
});

describe("profile helpers", () => {
  const uid = patpToFallbackUID("~sorreg-namtyv");
  const post = (
    id: string,
    time: number,
    parent: string | null,
    contents: Poast["contents"],
  ) => ({
    id,
    hash: id,
    host: "~litzod",
    author: uid.patp,
    authorFull: { host: uid, author: uid },
    thread: parent ? "root" : null,
    parent,
    perms: {
      read: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
      write: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
    },
    tags: [],
    contents,
    time,
    children: [],
    engagement: { reacts: {}, quoted: [], shared: [] },
  }) as Poast;
  const feed: FC = {
    start: null,
    end: null,
    feed: {
      root: post("root", 100, null, [{ paragraph: [{ text: "root" }] }]),
      reply: post("reply", 200, "parent", [
        { paragraph: [{ text: "reply" }] },
        { media: { images: ["https://cdn.test/photos/one.png", "https://cdn.test/two.jpg"] } },
      ]),
    },
  };

  test("separates root posts and replies while preserving newest-first order", () => {
    expect(getProfilePosts(feed, uid.patp).map((item) => item.id)).toEqual(["root"]);
    expect(getProfileReplies(feed, uid.patp).map((item) => item.id)).toEqual(["reply"]);
    expect(getReplyTarget(feed.feed.reply)).toBe("~litzod");
  });

  test("extracts real image tiles with filenames and carousel state", () => {
    expect(getProfileMedia(feed, uid.patp).map(({ label, multi }) => ({ label, multi }))).toEqual([
      { label: "one.png", multi: true },
      { label: "two.jpg", multi: true },
    ]);
  });

  test("derives the Urbit galaxy without inventing metadata for Nostr users", () => {
    expect(getProfileGalaxy({ urbit: uid })).toBe("~zod");
    expect(getProfileGalaxy({ nostr: "aa".repeat(32) })).toBeNull();
  });
});

describe("modal focus wrapping", () => {
  test("wraps Shift+Tab from the first control to the last", () => {
    expect(getFocusWrapTarget(0, 4, true)).toBe(3);
  });

  test("wraps Tab from the last control to the first", () => {
    expect(getFocusWrapTarget(3, 4, false)).toBe(0);
  });

  test("does not wrap when focus is inside the list", () => {
    expect(getFocusWrapTarget(1, 4, false)).toBeNull();
    expect(getFocusWrapTarget(2, 4, true)).toBeNull();
  });
});

describe("identity helpers", () => {
  test("keeps Urbit users rich while exposing stable string keys", () => {
    const uid = patpToFallbackUID("~zod");
    const user = { urbit: uid };

    expect(getUserId(user)).toBe("~zod");
    expect(userToStringSafe(user)).toBe("~zod");
    expect(getHandleLabel(user)).toBe("~zod");
  });

  test("parses patps into full Urbit identities", () => {
    const result = stringToUser("~zod");

    expect("ok" in result).toBe(true);
    if ("ok" in result && "urbit" in result.ok) {
      expect(result.ok.urbit.patp).toBe("~zod");
      expect(typeof result.ok.urbit.point).toBe("bigint");
    }
  });
});

describe("relay helpers", () => {
  test("validates relay URLs by websocket protocol", () => {
    expect(isValidRelayUrl("wss://relay.example")).toBe(true);
    expect(isValidRelayUrl("ws://localhost:8080")).toBe(true);
    expect(isValidRelayUrl("https://relay.example")).toBe(false);
    expect(isValidRelayUrl("not a url")).toBe(false);
  });
});

describe("feed status helpers", () => {
  const relays = {
    "wss://relay.one": {
      start: 100,
      wid: 1,
      reqs: {
        home: {
          eventsReceived: 3,
          filters: [{ kinds: [1], limit: 20 }],
          name: "Home timeline",
          ongoing: true,
        },
      },
    },
    "wss://relay.two": {
      start: 100,
      wid: 2,
      reqs: {
        home: {
          eventsReceived: 5,
          filters: [{ kinds: [1], limit: 20 }],
          name: "Home timeline",
          ongoing: true,
        },
      },
    },
  };

  test("groups matching relay request ids into one subscription", () => {
    const [subscription] = buildFeedStatusSubscriptions(relays);

    expect(subscription.label).toBe("Home timeline");
    expect(subscription.relayCount).toBe(2);
    expect(subscription.totalEvents).toBe(8);
    expect(subscription.state).toBe("live");
    expect(subscription.filter).toContain('"kinds"');
  });

  test("summarizes syncing before live state", () => {
    expect(getFeedStatusSummary(relays).label).toBe("live · 1 req");
    expect(getFeedStatusSummary(relays, {}, true)).toEqual({
      state: "syncing",
      label: "syncing...",
      requestCount: 1,
    });
  });
});

describe("dm helpers", () => {
  const litzod = {
    ...patpToFallbackUID("~litzod"),
    gwid: {
      english: {
        nym: "wicket bright",
        abridged: "wicket",
        foreshortened: "wit",
      },
      hanzi: {
        nym: "",
        abridged: "",
        foreshortened: "",
      },
    },
  };
  const dmPost = (id: string, author: string, text: string, time: number): Poast =>
    ({
      id,
      hash: id,
      host: "~zod",
      author,
      authorFull: { host: patpToFallbackUID("~zod"), author: patpToFallbackUID("~zod") },
      thread: null,
      parent: null,
      perms: {
        read: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
        write: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
      },
      tags: [],
      contents: [{ paragraph: [{ text }] }],
      time,
      children: [],
      engagement: { reacts: {}, quoted: [], shared: [] },
    }) as Poast;
  const fc: FC = {
    start: null,
    end: null,
    feed: {
      "1": dmPost("1", "~litzod", "hello", 1_700_000_000_000),
      "2": dmPost("2", "~zod", "reply", 1_700_000_060_000),
    },
  };
  const dms: DMs = {
    "~litzod": {
      peer: litzod,
      unread: 2,
      lastId: 2n,
      lastTs: 1_700_000_060_000,
      lastRead: 0n,
      muted: true,
      blocked: false,
      delivery: {},
      fc,
    },
  };
  const profiles = new Map<string, UserProfile>([
    ["~litzod", { name: "profile name", picture: "", about: "", other: {}, pubkey: "", following: [], followingCount: 0, followers: [], followerCount: 0, urbitID: litzod }],
  ]);

  test("counts unread conversations instead of raw unread messages", () => {
    expect(getDmUnreadCount(dms)).toBe(1);
    expect(getDmUnreadCount({ "~litzod": { ...dms["~litzod"], unread: 0 } })).toBe(0);
  });

  test("filters known people and detects raw addresses", () => {
    const results = filterDmDirectory("wick", dms, profiles);

    expect(results[0]).toMatchObject({
      id2: "~litzod",
      label: "wicket",
      existing: true,
    });
    expect(canCreateRawDm("~zod")).toBe(true);
    expect(canCreateRawDm("not-an-address")).toBe(false);
  });

  test("builds display conversations from backend FC data", () => {
    const [conversation] = buildDmConversations(dms, profiles, "~zod");

    expect(conversation.name).toBe("wicket");
    expect(conversation.id2).toBe("~litzod");
    expect(conversation.muted).toBe(true);
    expect(conversation.blocked).toBe(false);
    expect(conversation.preview).toBe("you: reply");
    expect(conversation.messages.map((message) => message.mine)).toEqual([false, true]);
  });

  test("attaches DM delivery status to messages by post id", () => {
    const [conversation] = buildDmConversations(
      {
        "~litzod": {
          ...dms["~litzod"],
          delivery: {
            "1": "pending",
            "2": "failed",
          },
        },
      },
      profiles,
      "~zod",
    );

    expect(conversation.messages.map((message) => message.delivery)).toEqual([
      "pending",
      "failed",
    ]);
  });

  test("marks messages newer than lastRead as unread", () => {
    const [conversation] = buildDmConversations(
      {
        "~litzod": {
          ...dms["~litzod"],
          lastRead: 1n,
        },
      },
      profiles,
      "~zod",
    );

    expect(conversation.messages.map((message) => message.unread)).toEqual([
      false,
      true,
    ]);
  });

  test("reads pinned DM patps from settings", () => {
    expect(getPinnedDmPatps({ noschat: { pinned: ["~nec", 7, "~litzod", ""] } })).toEqual([
      "~nec",
      "~litzod",
    ]);
    expect(getPinnedDmPatps({ relay: { pinned: ["~nec"] } })).toEqual([]);
  });

  test("orders pinned conversations before the rest", () => {
    const conversations = [
      { id: "~zod", label: "newest" },
      { id: "~nec", label: "older" },
      { id: "~litzod", label: "oldest" },
    ];

    expect(
      orderPinnedDmConversations(conversations, ["~litzod", "~missing", "~nec"])
        .map((conversation) => conversation.id),
    ).toEqual(["~litzod", "~nec", "~zod"]);
  });

  test("adds jailed peers without open DM history", () => {
    const nec = patpToFallbackUID("~nec");
    const conversations = mergeDmJailConversations(
      buildDmConversations(dms, profiles, "~zod"),
      {
        muted: [nec],
        blocked: [],
      },
    );

    const jailed = conversations.find((conversation) => conversation.id === "~nec");
    expect(jailed).toMatchObject({
      id2: "~nec",
      muted: true,
      blocked: false,
      unread: 0,
      messages: [],
    });
  });

  test("applies jail status to existing conversations", () => {
    const conversations = mergeDmJailConversations(
      buildDmConversations({
        "~litzod": {
          ...dms["~litzod"],
          muted: false,
        },
      }, profiles, "~zod"),
      {
        muted: [],
        blocked: [litzod],
      },
    );

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      id: "~litzod",
      muted: false,
      blocked: true,
    });
  });

  test("searches DM peers and message contents", () => {
    const conversations = buildDmConversations(dms, profiles, "~zod");

    expect(
      filterDmConversationsForSearch(conversations, "wicket", "wicket")
        .map((conversation) => conversation.id),
    ).toEqual(["~litzod"]);
    expect(
      filterDmConversationsForSearch(conversations, "hello", "hello")
        .map((conversation) => conversation.id),
    ).toEqual(["~litzod"]);
  });

  test("builds request rows newest first", () => {
    const nec = patpToFallbackUID("~nec");
    const rows = buildDmRequestRows({
      "~litzod": {
        peer: litzod,
        post: dmPost("1", "~litzod", "older request", 1_700_000_000_000),
      },
      "~nec": {
        peer: nec,
        post: dmPost("2", "~nec", "newer request", 1_700_000_060_000),
      },
    });

    expect(rows.map((row) => row.id)).toEqual(["~nec", "~litzod"]);
    expect(rows[1]).toMatchObject({
      name: "wicket",
      id2: "~litzod",
      preview: "older request",
    });
  });
});

describe("thread tree helpers", () => {
  const uid = patpToFallbackUID("~zod");
  const node = (id: string, children: Record<string, FullNode> = {}): FullNode => ({
    id,
    hash: id,
    host: "~zod",
    author: "~zod",
    authorFull: { host: uid, author: uid },
    thread: null,
    parent: null,
    perms: {
      read: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
      write: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
    },
    tags: [],
    contents: [],
    time: Number(id),
    engagement: { reacts: {}, quoted: [], shared: [] },
    children,
  });

  test("counts and flattens nested replies", () => {
    const root = node("3", {
      "2": node("2", { "1": node("1") }),
      "4": node("4"),
    });

    expect(countThreadChildren(root)).toBe(3);
    expect(flattenThreadChildren(root).map((item) => item.node.id)).toEqual([
      "4",
      "2",
      "1",
    ]);
  });
});

describe("nostr feed provenance helpers", () => {
  const ev = (id: string, createdAt: number) => ({
    id,
    pubkey: "aa".repeat(32),
    sig: "",
    created_at: createdAt,
    kind: 1,
    tags: [],
    content: `hello ${id}`,
  });
  const sub = {
    name: "timeline",
    eventsReceived: 2,
    filters: [{ kinds: [1] }],
    ongoing: true as const,
  };
  const sources = {
    "wss://relay.one": { feed: [ev("e1", 1000), ev("e2", 2000)], sub },
    "wss://relay.two": { feed: [ev("e1", 1000)], sub },
  };

  test("merges relays, dedupes by event id, accumulates provenance", () => {
    const fc = sourcedFeedsToFc(sources);
    const posts = Object.values(fc.feed);
    expect(posts.length).toBe(2);
    const p1 = posts.find((p) => p.hash === "e1")!;
    expect(p1.event?.relays?.sort()).toEqual([
      "wss://relay.one",
      "wss://relay.two",
    ]);
    const p2 = posts.find((p) => p.hash === "e2")!;
    expect(p2.event?.relays).toEqual(["wss://relay.one"]);
  });

  test("keys merged feeds by sub name", () => {
    const map = nostrFeedsToFcMap({ timeline: sources });
    expect(Object.keys(map)).toEqual(["timeline"]);
    expect(Object.keys(map.timeline.feed).length).toBe(2);
  });

  test("state fact maps timeline global key and nested nostr feeds", () => {
    const slices = parseStateFact({
      key: "ff".repeat(32),
      relays: {},
      profiles: {},
      feed: { feed: {}, start: null, end: null },
      following: {},
      followGraph: { "~zod": [{ urbit: "~nec" }] },
      timeline: { global: { "123": { id: "123" } }, start: "123", end: "123" },
      nostr: { timeline: sources },
    });
    expect(slices.pubkey).toBe("ff".repeat(32));
    expect(slices.timeline.feed["123"]).toBeDefined();
    expect(slices.timeline.start).toBe("123");
    expect(Object.keys(slices.nostrFeeds)).toEqual(["timeline"]);
    // the sync sub feed doubles as the default nostr feed
    expect(Object.keys(slices.nostrFeed.feed).length).toBe(2);
    expect(slices.followGraph["~zod"]).toEqual([{ urbit: "~nec" }]);
  });

  test("state fact parse never throws on missing or odd keys", () => {
    for (const input of [{}, null, undefined, { nostr: [], timeline: 42 }]) {
      const slices = parseStateFact(input);
      expect(slices.nostrFeed.feed).toEqual({});
      expect(slices.timeline).toEqual({ feed: {}, start: null, end: null });
      expect(slices.pubkey).toBe("");
    }
  });
});

describe("nostr event parsing", () => {
  const ev = (id: string, created_at: number, content = "hi") => ({
    id,
    pubkey: "ab".repeat(32),
    sig: "",
    created_at,
    kind: 1,
    tags: [],
    content,
  });

  test("keeps text around links and handles www and adjacent urls", () => {
    expect(extractURLs("see https://www.x.com/a now").text).toEqual([
      { text: "see " },
      { link: { href: "https://www.x.com/a", show: "https://www.x.com/a" } },
      { text: " now" },
    ]);
    const two = extractURLs("https://verylongdomain.com/abc https://b.io");
    expect(two.text.filter((t) => "link" in t)).toHaveLength(2);
    // repeated calls must not depend on regex lastIndex state
    expect(extractURLs("https://b.io").text).toHaveLength(1);
    expect(extractURLs("https://b.io/pic.png").pics).toEqual(["https://b.io/pic.png"]);
  });

  test("events from the same second don't overwrite each other", () => {
    const fc = eventsToFc([ev("a", 100), ev("b", 100), ev("c", 99)]);
    expect(Object.values(fc.feed).map((p) => p.hash).sort()).toEqual(["a", "b", "c"]);
    expect(fc.start).toBe("99000");
    expect(fc.end).toBe("100001");

    // re-adding a known event keeps its slot; a new same-second one gets a new id
    const again = addEventToFc(ev("b", 100), fc);
    expect(Object.keys(again.feed)).toHaveLength(3);
    const more = addEventToFc(ev("d", 100), again);
    expect(Object.keys(more.feed)).toHaveLength(4);
    expect(Object.keys(fc.feed)).toHaveLength(3); // input untouched
  });
});

describe("lists and suggestions", () => {
  const post = (over: Record<string, unknown> = {}) =>
    ({ id: "1", host: "~nec", author: "~nec", ...over }) as any;

  test("parses the agent's lists and hides reported posts and muted authors", () => {
    const lists = parseLists({
      bookmarks: [{ ref: { urbit: { host: "~nec", id: "1" } }, at: 5 }],
      muted: [{ urbit: "~bus" }, { nostr: "ab" }],
      reported: [{ urbit: { host: "~nec", id: "2" } }],
    });
    expect(lists.bookmarks.has(refKey(postRef(post())))).toBe(true);
    expect(isHiddenPost(post({ id: "2" }), lists)).toBe(true);
    expect(isHiddenPost(post({ author: "~bus" }), lists)).toBe(true);
    // a muted author's posts still show where asked (their profile)
    expect(isHiddenPost(post({ author: "~bus" }), lists, true)).toBe(false);
    expect(isHiddenPost(post(), lists)).toBe(false);
    // nostr posts are keyed by event id and pubkey
    expect(isHiddenPost(post({ event: { id: "ev", pubkey: "ab" } }), lists)).toBe(true);
    expect(
      withoutMuted([{ from: { urbit: { patp: "~bus" } } }, { from: { nostr: "cd" } }], lists),
    ).toHaveLength(1);
  });

  test("suggests follows-of-follows, never existing follows, self or muted", () => {
    const lists = parseLists({ muted: [{ urbit: "~muted" }] });
    const following = new Set(["~nec", "~bus"]);
    const graph = {
      "~nec": [{ urbit: "~wes" }, { urbit: "~bus" }, { urbit: "~zod" }, { urbit: "~muted" }],
      "~bus": [{ urbit: "~wes" }, { nostr: "ab" }],
      // not followed by us: ignored
      "~sev": [{ urbit: "~per" }],
    };
    expect(suggestFollows(graph, following, lists, ["~zod"])).toEqual([
      { id: "~wes", followedBy: 2 },
      { id: "ab", followedBy: 1 },
    ]);
  });

  test("takes follows-of-follows from followed users' profiles", () => {
    const graph = followGraphWithProfiles(
      { "~zod": [{ urbit: "~nec" }], "~nec": [{ urbit: "~wes" }] },
      new Map<string, { following?: unknown }>([
        ["~nec", { following: [{ urbit: "~wes" }, { urbit: "~bus" }] }],
        ["ab", { following: undefined }],
      ]),
    );
    expect(graph["~nec"]).toEqual([{ urbit: "~wes" }, { urbit: "~bus" }]);
    expect(suggestFollows(graph, new Set(["~nec"]), parseLists({}), ["~zod"])).toEqual([
      { id: "~bus", followedBy: 1 },
      { id: "~wes", followedBy: 1 },
    ]);
  });
});

describe("notification text", () => {
  test("drops post paths from the yarn", () => {
    expect(
      displayYarn([{ ship: "~nec" }, "Reported your post:", "/urbit/~zod/170.141", "spam"]),
    ).toEqual([{ ship: "~nec" }, "Reported your post:", "spam"]);
  });
});

describe("trending topics", () => {
  const t = (
    source: string,
    title: string,
    categories: string[] = [],
    score: number | null = null,
  ) => ({ source, title, url: null, pic: null, score, date: 0, categories });
  const prefs = { country: "MX", lang: "es-419", categories: ["world", "sports"] };
  const parsed = parseTrending({
    prefs,
    sources: {
      "gnews-world": {
        fetched: 1,
        topics: [t("gnews-world", "W1", ["world"]), t("gnews-world", "W2", ["world"])],
      },
      "gnews-sports": { fetched: 1, topics: [t("gnews-sports", "S1", ["sports"])] },
      // a region missing from SOURCE_ORDER still takes google trends' turn
      "gtrends-mx": {
        fetched: 1,
        topics: [t("gtrends-mx", "T1", ["sports"]), t("gtrends-mx", "w1")],
      },
      hn: { fetched: 1, topics: [t("hn", "H1", ["technology"]), { title: "" }] },
    },
  })!;
  const data = parsed.sources;

  test("reads the prefs, and keeps only web links and pictures", () => {
    expect(parsed.prefs).toEqual(prefs);
    const odd = parseTrending({
      sources: {
        x: {
          topics: [
            { title: "a", url: "javascript:alert(1)", pic: "https://i.example/a.jpg" },
            { title: "b", url: "https://b.example", pic: "data:image/png;base64,AAAA" },
          ],
        },
      },
    })!;
    expect(odd.prefs).toBeNull();
    expect(odd.sources.x.topics.map((x) => [x.url, x.pic])).toEqual([
      [null, "https://i.example/a.jpg"],
      ["https://b.example", null],
    ]);
  });

  test("interleaves kinds of source, then sources within a kind", () => {
    expect(pickTopics(data, "all", 4).map((x) => x.title)).toEqual(["W1", "T1", "H1", "S1"]);
    // "w1" repeats "W1"; once other kinds run dry, google news keeps its turns
    expect(pickTopics(data, "all", 10).map((x) => x.title)).toEqual(["W1", "T1", "H1", "S1", "W2"]);
  });

  test("filters by category and only offers tabs with topics", () => {
    expect(pickTopics(data, "sports").map((x) => x.title)).toEqual(["S1", "T1"]);
    expect(availableTabs(data).map((x) => x.id)).toEqual(["all", "world", "technology", "sports"]);
  });

  test("describes each source's score", () => {
    expect(topicMeta(t("hn", "x", [], 312))).toBe("Hacker News · 312 points");
    expect(topicMeta(t("gtrends-us", "x", [], 2000))).toBe("Google Trends US · 2K+ searches");
    expect(topicMeta(t("gnews-world", "x", [], 1))).toBe("Google News · 1 article");
    expect(topicMeta(t("gnews-world", "x"))).toBe("Google News");
  });

  test("rejects anything but a source map", () => {
    expect(parseTrending(null)).toBeNull();
    expect(parseTrending([])).toBeNull();
    expect(parseTrending({ prefs })).toBeNull();
  });
});

describe("shared cards", () => {
  const card = {
    v: 1 as const,
    kind: "trending",
    title: "Trending topics",
    subtitle: "",
    at: 5,
    items: [{ title: "A", url: "https://a.example", meta: "m", pic: "https://a.example/p.jpg" }],
  };

  test("round-trips", () => {
    expect(parseSharedCard(encodeSharedCard(card))).toEqual(card);
  });

  test("drops non-web links and rejects junk from other ships", () => {
    const evil = { ...card, items: [{ title: "A", url: "javascript:alert(1)", meta: "" }] };
    expect(parseSharedCard(JSON.stringify(evil))!.items[0].url).toBeNull();
    expect(parseSharedCard("not json")).toBeNull();
    expect(parseSharedCard(JSON.stringify({ ...card, v: 2 }))).toBeNull();
    expect(parseSharedCard(JSON.stringify({ ...card, items: [] }))).toBeNull();
  });
});

describe("post authors", () => {
  test("our own nostr notes are ours; other notes' patp tags aren't trusted", () => {
    const our = patpToFallbackUID("~zod");
    const note = (pubkey: string) =>
      eventToPoast({
        id: "e",
        pubkey,
        created_at: 1,
        kind: 667,
        content: "hi",
        sig: "",
        tags: [["patp", "~zod"]],
      } as any)!;
    expect(userFromPost(note("aa"), { pubkey: "aa", our })).toEqual({ urbit: our });
    expect(userFromPost(note("bb"), { pubkey: "aa", our })).toEqual({ nostr: "bb" });
    expect(userFromPost(note("bb"))).toEqual({ nostr: "bb" });
  });
});

describe("hashtags", () => {
  test("counts each post's tags once, case-insensitively, from text and t tags", () => {
    expect(
      countHashtags([
        { text: "gm #Nostr #nostr and #urbit" },
        { text: "more #nostr", tTags: ["nostr", "Photography"] },
        { text: "no tags, a url https://x.org/#frag and an issue #42" },
        { text: "", tTags: ["#Photography"] },
      ]),
    ).toEqual([
      { tag: "nostr", count: 2 },
      { tag: "photography", count: 2 },
      { tag: "urbit", count: 1 },
    ]);
  });

  test("reads tags in other scripts, skips html entities and anchors", () => {
    expect([...postHashtags("#日本語 &#39; a/#b")]).toEqual(["日本語"]);
  });
});

describe("notification rows", () => {
  test("drop the actor, and capitalize what was a sentence about them", () => {
    expect(withoutActor([{ ship: "~nec" }, " accepted your follow request."], "~nec")).toEqual([
      "Accepted your follow request.",
    ]);
    // already written for the row: unchanged
    expect(withoutActor([{ ship: "~nec" }, "Reacted to post:", "🔥"], "~nec")).toEqual([
      "Reacted to post:",
      "🔥",
    ]);
    // someone else named: kept, nothing capitalized
    expect(withoutActor(["see ", { ship: "~bus" }], "~nec")).toEqual(["see ", { ship: "~bus" }]);
  });
});

describe("nostr notes", () => {
  test("r tags don't repeat urls already in the text", () => {
    const pic = "https://x.org/a.jpg";
    const other = "https://y.org/page";
    const poast = eventToPoast({
      id: "e1",
      pubkey: "ab",
      created_at: 1,
      kind: 1,
      content: `${pic}\n#tag`,
      sig: "",
      tags: [
        ["r", pic],
        ["r", other],
      ],
    } as any)!;
    const links = poast.contents.flatMap((b: any) =>
      "paragraph" in b ? b.paragraph.filter((i: any) => "link" in i).map((i: any) => i.link.href) : [],
    );
    const pics = poast.contents.flatMap((b: any) => ("media" in b ? (b.media.images ?? []) : []));
    expect(pics).toEqual([pic]);
    // the image once, as media; only the url the text doesn't have as a link
    expect(links).toEqual([other]);
  });
});

describe("nostr references (NIP-27)", () => {
  const pk = "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93";
  const npub = "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc";
  const nprofile =
    "nprofile1qyxhwumn8ghj7mn0wvhxcmmvqqsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycq59rkf";
  const note = "note1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsx09lcs";
  const nevent = "nevent1qqsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycnw94hx";

  test("splits people and notes out of the text", () => {
    expect(splitNostrRefs(`hi nostr:${npub}, see nostr:${note}!`)).toEqual([
      { text: "hi " },
      { profile: pk, raw: `nostr:${npub}` },
      { text: ", see " },
      { event: pk, raw: `nostr:${note}` },
      { text: "!" },
    ]);
    expect(splitNostrRefs(`nostr:${nprofile} nostr:${nevent}`)).toEqual([
      { profile: pk, raw: `nostr:${nprofile}` },
      { text: " " },
      { event: pk, raw: `nostr:${nevent}` },
    ]);
  });

  test("leaves plain text and broken references alone", () => {
    expect(splitNostrRefs("no refs here")).toEqual([{ text: "no refs here" }]);
    // bad checksum, and a bare npub without the nostr: scheme
    const bad = `nostr:${npub.slice(0, -1)}q and ${npub}`;
    expect(splitNostrRefs(bad)).toEqual([{ text: bad }]);
  });

  test("collects everyone mentioned, once", () => {
    expect(
      mentionedPubkeys([`a nostr:${npub} b`, `nostr:${nprofile} and nostr:${note}`, "nothing"]),
    ).toEqual([pk]);
  });

  test("shortens what it can't name", () => {
    expect(shortNpub(pk)).toBe("npub1dergg…xzpc");
    expect(shortNote(pk)).toBe("note1derg…9lcs");
  });
});

describe("nostr profile pages", () => {
  test("pages back from the oldest note", () => {
    const fc = eventsToFc([
      { id: "a", pubkey: "p", created_at: 300, kind: 1, content: "x", tags: [], sig: "" },
      { id: "b", pubkey: "p", created_at: 100, kind: 1, content: "y", tags: [], sig: "" },
      { id: "c", pubkey: "p", created_at: 200, kind: 1, content: "z", tags: [], sig: "" },
    ] as any);
    expect(oldestNoteTime(fc)).toBe(100);
    expect(oldestNoteTime(undefined)).toBeNull();
  });

  test("truncates long ids in the middle", () => {
    const npub = "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc";
    expect(middleTruncate(npub, 14, 8)).toBe("npub1dergggklk…fsh9xzpc");
    expect(middleTruncate("short", 14, 8)).toBe("short");
  });
});

describe("link labels", () => {
  test("cuts bare urls to 30 characters, leaves other link text alone", () => {
    const long = "https://www.usatoday.com/story/sports/high-school/football";
    expect(linkLabel(long)).toBe("https://www.usatoday.com/story…");
    expect(linkLabel("https://short.example/a")).toBe("https://short.example/a");
    expect(linkLabel("www.example.com/a/very/long/path/indeed/yes")).toBe(
      "www.example.com/a/very/long/pa…",
    );
    const label = "a long custom label that someone wrote for their link";
    expect(linkLabel(label)).toBe(label);
  });
});

describe("posting about a topic", () => {
  test("escapes what the backend's markdown would eat", () => {
    expect(escapeMarkdown("A *big* [deal] (really)! AT&T_x \\ `code`\n  more")).toBe(
      "A \\*big\\* \\[deal\\] \\(really\\)\\! AT\\&T\\_x \\\\ 'code' more",
    );
  });

  test("quotes the headline after the text, then the link", () => {
    expect(topicPostContent(" wow ", { title: "Big *news*", url: "https://x.example/a" })).toBe(
      "wow\n\n> Big \\*news\\*\n\nhttps://x.example/a",
    );
    // no text, no url
    expect(topicPostContent("", { title: "Just this", url: null })).toBe("> Just this");
  });

  test("names the link's publisher, not google's redirect host", () => {
    const links = [
      { title: "a", url: "https://news.google.com/rss/articles/x", publisher: "TechCrunch", pic: null },
    ];
    expect(topicPublisher({ url: "https://news.google.com/rss/articles/x", links })).toBe("TechCrunch");
    expect(topicPublisher({ url: "https://www.example.com/p", links })).toBe("example.com");
    expect(topicPublisher({ url: null, links })).toBe("");
  });

  test("keeps related links on the web", () => {
    const parsed = parseTrending({
      sources: {
        x: {
          topics: [
            {
              title: "t",
              content: "term",
              links: [
                { title: "ok", url: "https://a.example", publisher: "A", pic: null },
                { title: "bad", url: "javascript:x", publisher: "B" },
                { url: "https://c.example" },
              ],
            },
          ],
        },
      },
    })!;
    const topic = parsed.sources.x.topics[0];
    expect(topic.content).toBe("term");
    expect(topic.links).toEqual([{ title: "ok", url: "https://a.example", publisher: "A", pic: null }]);
  });
});
