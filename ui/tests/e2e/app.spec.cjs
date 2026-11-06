const { createGroupsFixture, BASE: CHANNEL_BASE, GROUP: CHANNEL_GROUP, GENERAL, ANNOUNCEMENTS, OPTIONAL, PRIVATE: PRIVATE_CHANNEL, post: channelPost } = require("./groups-fixture.cjs");
let groupsFixture;
const { expect, test } = require("./playwright-runtime.cjs");

let dmInboxFixtureKind = "empty";
let notificationFixtureKind = "empty";
let feedFixtureKind = "empty";
let mockReconnectMs = 10;
let fixtureSnapshotsPending = true;
let walletSubscriptions = new Set();
let chatSubscriptions = new Set();
let tlonSubscriptions = new Map();
let tlonEvents = [];
let tlonActions = [];
let tlonInvitesHandled = new Set();
let tlonHistoryRequests = [];
let tlonBlocked = new Set();
let tlonMuted = new Set();
let tlonSent = new Map();
let tlonGroups = {};
let tlonUnavailable = false;
const TLON_CLUB = "0v12345";
const TLON_TIME = "170141184506204487328429881284054442000";
const tlonTime = (time) => String(time).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function tlonWrit(author, text, offset = 0) {
  const time = (BigInt(TLON_TIME) + BigInt(offset)).toString();
  return { type: "post", seal: { id: `${author}/${tlonTime(time)}`, time, seq: offset }, essay: { author, sent: 1700000000000 + offset * 1000, content: [{ inline: [text] }], kind: "/chat", meta: null, blob: null } };
}
function tlonRows() {
  const fixture = dmInboxFixture();
  const rows = new Map();
  for (const [id, dm] of Object.entries(fixture.dms)) rows.set(id, tlonWrit(id, Object.values(dm.fc.feed)[0].contents[0].paragraph[0].text));
  for (const [id, request] of Object.entries(fixture.requests)) if (!tlonInvitesHandled.has(id)) rows.set(id, tlonWrit(id, request.post.contents[0].paragraph[0].text));
  if (dmInboxFixtureKind === "group") rows.set(TLON_CLUB, tlonWrit("~nec", "group hello", 2));
  for (const [id, messages] of tlonSent) if (messages.length) rows.set(id, messages.at(-1));
  return rows;
}
async function tlonScry(route) {
  if (tlonUnavailable) return route.fulfill({ status: 404, body: "chat is not installed" });
  const path = decodeURIComponent(new URL(route.request().url()).pathname.split("/scry/chat")[1]).replace(/\.json$/, "");
  const rows = tlonRows();
  let json;
  if (path === "/v4/heads") json = [...rows].map(([whom, latest]) => ({ whom, latest, recency: latest.essay.sent }));
  else if (path === "/clubs") json = { ...(dmInboxFixtureKind === "group" ? { [TLON_CLUB]: { team: ["~zod", "~nec", "~bud"], hive: [], meta: { title: "Team chat", description: "", image: "", cover: "" }, net: "done" }, "0v999": { team: ["~nec"], hive: [], meta: { title: "Declined group" }, net: "done" } } : {}), ...tlonGroups };
  else if (path === "/dm") json = [...rows.keys()].filter((id) => id.startsWith("~") && !(dmInboxFixtureKind === "requests" && !tlonInvitesHandled.has(id)));
  else if (path === "/dm/invited") json = dmInboxFixtureKind === "requests" ? ["~litzod", "~nec"].filter((id) => !tlonInvitesHandled.has(id)) : [];
  else if (path === "/dm/archive") json = [];
  else if (path === "/blocked") json = [...new Set([...(dmInboxFixtureKind === "statuses" ? ["~bud"] : []), ...tlonBlocked])];
  else if (path === "/unreads") json = Object.fromEntries([...rows.keys()].map((id) => [id, { recency: 1700000000000, count: 12, unread: { id: rows.get(id).seal.id, time: TLON_TIME, count: 1 }, threads: {} }]));
  else if (/^\/v4\/(dm|club)\//.test(path)) {
    tlonHistoryRequests.push(path);
    const id = path.split("/")[3];
    const older = path.includes("/older/");
    const messages = older ? [tlonWrit("~bud", "older group message", 0)] : [...(rows.has(id) ? [rows.get(id)] : []), ...(tlonSent.get(id) ?? [])];
    json = { writs: Object.fromEntries(messages.map((m) => [m.seal.time, m])), older: !older && id === TLON_CLUB ? TLON_TIME : null, newer: null, total: messages.length, newest: 0 };
  } else return route.fulfill({ status: 404, body: "unexpected chat scry: " + path });
  return route.fulfill({ status: 200, json });
}
function tlonBody() {
  const events = tlonEvents.splice(0);
  return events.flatMap(({ path, json, response = "diff" }) => [...tlonSubscriptions].filter(([, watched]) => watched === path).map(([id]) => `id: ${++ackEventId}\ndata: ${JSON.stringify({ response, id, json })}\n\n`)).join("");
}
function tlonPoke(action) {
  tlonActions.push(action);
  if (nackPokes) return;
  if (action.mark === "chat-dm-rsvp") tlonInvitesHandled.add(action.json.ship);
  if (action.mark === "chat-block-ship") tlonBlocked.add(action.json.ship);
  if (action.mark === "chat-unblock-ship") tlonBlocked.delete(action.json.ship);
  if (action.mark === "activity-action-2") {
    const { source, volume } = action.json.adjust;
    if (volume) tlonMuted.add(source.dm.ship ?? source.dm.club); else tlonMuted.delete(source.dm.ship ?? source.dm.club);
  }
  if (action.mark === "chat-club-create") tlonGroups[action.json.id] = { team: ["~zod"], hive: action.json.hive, net: "done", meta: { title: "", description: "", image: "", cover: "" } };
  if (action.mark === "chat-club-action-2" && action.json.diff.delta.team) {
    const crew = tlonGroups[action.json.id];
    const { ship, ok } = action.json.diff.delta.team;
    if (crew) { crew.hive = crew.hive.filter((id) => id !== ship); if (ok) crew.team.push(ship); crew.net = "done"; }
  }
  const diff = action.mark === "chat-dm-action-2" ? action.json.diff : action.mark === "chat-club-action-2" ? action.json.diff.delta.writ : null;
  if (diff?.delta?.add) {
    const whom = action.json.ship ?? action.json.id;
    const add = { ...diff.delta.add, time: diff.id.split("/")[1].replaceAll(".", ""), seq: 10 };
    const writ = { type: "post", seal: { id: diff.id, time: add.time, seq: 10 }, essay: add.essay };
    tlonSent.set(whom, [...(tlonSent.get(whom) ?? []), writ]);
    tlonEvents.push({ path: "/v4", json: { whom, id: diff.id, response: { add } } });
  }
}
let walletPending = false;
const walletFixture = () => ({
  balance: 12060,
  mints: [{ url: "https://mint.example", balance: 12060, proofs: 3, keysets: 1 }],
  ops: [], history: [], sent: [], log: [], nostr: { sync: false, syncing: false },
  lightning: { link: "open", balance: 12000, relay: "wss://relay.example", service: "1".repeat(64), methods: ["make_invoice", "pay_invoice"], invoices: [] },
});
let mockWallet = walletFixture();
let state2Snapshot;
let state2Facts = [];
let state2Subscriptions = new Set();
let state2Initialized = new Set();

// IO.poke resolves only once the ship acks the poke over the event stream,
// so every poke PUT to the channel is recorded here and acked on the next
// stream GET (the mocked stream closes after each batch and the client
// reconnects). Advertise a short SSE retry delay so acknowledgements do not
// wait for the client's default one-second reconnect interval.
let pendingPokeAcks = [];
let ackEventId = 10_000;
// every poke's json, for asserting what the UI actually sends
let pokeLog = [];
// when set, pokes are nacked, as the ship does when the agent crashes
let nackPokes = false;
// the post served by the "zap" feed fixture
const DEFAULT_POST = { text: "A post ready for a zap", reacts: {} };
let postFixture = { ...DEFAULT_POST };
// bookmarks / mutes / reports as the agent sends them in its state
const EMPTY_LISTS = { bookmarks: [], muted: [], reported: [] };
let listsFixture = EMPTY_LISTS;

async function installUrbitMock(page) {
  pendingPokeAcks = [];
  // registered first, so every mock below wins over it: any ship endpoint a
  // test didn't mock fails here instead of reaching a real ship on whatever
  // port the dev build points at
  await page.route("**/~/**", (route) =>
    route.fulfill({ status: 404, body: "unmocked ship endpoint in e2e" }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("nostrill-welcome-shown", "true");
  });

  await page.route("**/~/host", (route) =>
    route.fulfill({ status: 200, body: "~zod" }),
  );
  await page.route("**/~/name", (route) =>
    route.fulfill({ status: 200, body: "~zod" }),
  );
  await page.route("**/~/scry/n-contacts/all.json", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route(
    "**/~/scry/settings/desk/nostrill.json",
    (route) => route.fulfill({ status: 200, json: { desk: {} } }),
  );
  await page.route(
    "**/~/scry/hark/desk/nostrill/skeins.json",
    (route) => route.fulfill({ status: 200, json: notificationFixture() }),
  );
  await page.route(
    "**/~/scry/noschat/**",
    (route) => route.fulfill({ status: 200, json: dmInboxFixture() }),
  );
  await page.route("**/~/scry/chat/**", tlonScry);
  await page.route("**/~/scry/activity/v6/volume-settings.json", (route) => route.fulfill({ status: 200, json: Object.fromEntries([...new Set([...(dmInboxFixtureKind === "statuses" ? ["~nec"] : []), ...tlonMuted])].map((id) => [`dm/${id}`, Object.fromEntries(["dm-invite", "dm-post", "dm-post-mention", "dm-reply", "dm-reply-mention", "dm-react"].map((type) => [type, { unreads: false, notify: false }]))])) }));
  await page.route("**/~/scry/storage/**", (route) =>
    route.fulfill({ status: 404, json: { error: "no storage" } }),
  );
  // keep app scries (nostr feeds, profiles...) off any live ship;
  // later registrations win, so the gwid mock below shadows this default
  await page.route("**/~/scry/nostrill/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route("**/~/scry/nostrill/j/desk.json", (route) =>
    route.fulfill({ status: 200, json: "trill" }),
  );
  await page.route("**/spider/**", (route) =>
    route.fulfill({ status: 404, json: { error: "unmocked thread" } }),
  );
  await page.route("**/~/scry/nostrill/j/gwid/**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        english: { nym: "zod", abridged: "zod", foreshortened: "zod" },
        hanzi: { nym: "", abridged: "", foreshortened: "" },
      },
    }),
  );
  await groupsFixture.install(page);
  await page.route("**/~/channel/**", handleChannel);
}

async function handleChannel(route) {
  const request = route.request();
  if (request.method() === "GET") {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: `retry: ${mockReconnectMs}\n\n` + (
        feedFixtureKind === "state2" ? state2FixtureBody()
          : fixtureSnapshotsPending && feedFixtureKind === "zap" ? zapFeedFixtureBody()
          : fixtureSnapshotsPending && dmInboxFixtureKind === "requests" ? dmRequestFixtureBody()
          : ""
      ) + walletFixtureBody() + tlonBody() + groupsFixture.body(() => ++ackEventId) + takePokeAcks() + ": heartbeat\n\n",
    });
    fixtureSnapshotsPending = false;
    return;
  }

  // PUT: a batch of channel actions; remember pokes so they get acked
  try {
    const actions = JSON.parse(request.postData() || "[]");
    for (const action of actions) {
      groupsFixture.action(action, !nackPokes);
      if (action.action === "subscribe") fixtureSnapshotsPending = true;
      if (action.action === "subscribe" && action.app === "noschat" && action.path === "/ui") chatSubscriptions.add(action.id);
      if (action.action === "subscribe" && action.app === "trill-wallet" && action.path === "/ui") {
        walletSubscriptions.add(action.id);
        walletPending = true;
      }
      if (action.action === "subscribe" && action.app === "nostrill" && action.path === "/ui") {
        state2Subscriptions.add(action.id);
        state2Initialized.delete(action.id);
      }
      if (action.action === "subscribe" && action.app === "chat") tlonSubscriptions.set(action.id, action.path);
      if (action.action === "unsubscribe") tlonSubscriptions.delete(action.subscription);
      if (action.action !== "poke") continue;
      if (action.app === "chat" || action.app === "activity") tlonPoke(action);
      if (feedFixtureKind === "state2" && action.json?.fols?.del?.nostr) {
        const key = action.json.fols.del.nostr;
        state2Snapshot.nostr.following = state2Snapshot.nostr.following.filter(id => id !== key);
        state2Facts.push({ fols: { quit: key } }, { nostr: { data: state2Snapshot.nostr } });
      }
      if (action.app === "trill-wallet" && action.json?.deposit) {
        const { mint, amount } = action.json.deposit;
        mockWallet.ops.push({ id: 1, kind: "deposit", mint, amount, step: "pending", invoice: `lnbc${amount}fixture` });
        walletPending = true;
      }
      pendingPokeAcks.push(action.id);
      pokeLog.push(action.json);
    }
  } catch {
    // not json (e.g. a delete beacon); nothing to ack
  }
  await route.fulfill({ status: 200, body: "ok" });
}

function walletFixtureBody() {
  if (!walletPending || walletSubscriptions.size === 0) return "";
  walletPending = false;
  return [...walletSubscriptions].map(id =>
    `id: ${++ackEventId}\ndata: ${JSON.stringify({ response: "diff", id, json: mockWallet })}\n\n`,
  ).join("");
}

function takePokeAcks() {
  const acks = pendingPokeAcks.map((id) => {
    const res = nackPokes ? { err: "nacked by test" } : { ok: null };
    return `id: ${++ackEventId}\ndata: ${JSON.stringify({ response: "poke", id, ...res })}\n\n`;
  });
  pendingPokeAcks = [];
  return acks.join("");
}

function makeUrbitId(patp, label) {
  return {
    patp,
    point: "1",
    gwid: {
      english: {
        nym: label,
        abridged: label,
        foreshortened: label,
      },
      hanzi: {
        nym: "",
        abridged: "",
        foreshortened: "",
      },
    },
  };
}

function makeDmRequest(patp, label, text, time) {
  return {
    peer: makeUrbitId(patp, label),
    post: {
      id: String(time),
      hash: String(time),
      host: patp,
      author: patp,
      authorFull: { host: makeUrbitId(patp, label), author: makeUrbitId(patp, label) },
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
    },
  };
}

function makeDm(patp, label, text, time, overrides = {}) {
  const peer = makeUrbitId(patp, label);
  return {
    fc: {
      start: null,
      end: null,
      feed: {
        [String(time)]: {
          id: String(time),
          hash: String(time),
          host: patp,
          author: patp,
          authorFull: { host: peer, author: peer },
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
        },
      },
    },
    lastId: String(time),
    lastTs: time,
    lastRead: null,
    unread: 0,
    peer,
    muted: false,
    blocked: false,
    delivery: {},
    ...overrides,
  };
}

function dmInboxFixture() {
  const jail = { muted: [], blocked: [] };
  if (dmInboxFixtureKind === "requests") {
    return {
      dms: {},
      requests: {
        "~litzod": makeDmRequest("~litzod", "wicket", "hello from request", 1700000000000),
        "~nec": makeDmRequest("~nec", "nec", "please accept", 1700000060000),
      },
      jail,
    };
  }
  if (dmInboxFixtureKind === "statuses") {
    return {
      dms: {
        "~litzod": makeDm("~litzod", "wicket", "regular dm", 1700000000000),
        "~nec": makeDm("~nec", "nec", "muted dm", 1700000060000, { muted: true }),
        "~bud": makeDm("~bud", "bud", "blocked dm", 1700000120000, { blocked: true }),
      },
      requests: {},
      jail,
    };
  }
  return { dms: {}, requests: {}, jail };
}

function dmRequestFixtureBody() {
  return [...chatSubscriptions].map(id =>
    `id: ${++ackEventId}\ndata: ${JSON.stringify({
      response: "diff",
      id,
      json: {
        init: dmInboxFixture(),
      },
    })}\n\n`,
  ).join("");
}

function notificationFixture() {
  if (notificationFixtureKind !== "activity") return [];

  const makeNotification = ({ id, wer, time, unread, message }) => ({
    time,
    count: 0,
    "ship-count": 0,
    unread,
    top: {
      id,
      rope: { group: null, channel: null, desk: "nostrill", thread: id },
      time,
      con: message,
      wer,
      but: null,
    },
  });

  return [
    makeNotification({
      id: "profile-1",
      wer: "/prof/~bud",
      time: 1_700_000_000_000,
      unread: false,
      message: [{ ship: "~bud" }, " updated their profile"],
    }),
    makeNotification({
      id: "mention-1",
      wer: "/post/mention/~nec/~zod/mention-post",
      time: 1_700_000_060_000,
      unread: false,
      message: [{ ship: "~nec" }, " mentioned you"],
    }),
    makeNotification({
      id: "reply-1",
      wer: "/post/reply/~litzod/~zod/root-post/reply-post",
      time: 1_700_000_120_000,
      unread: true,
      message: [{ ship: "~litzod" }, " replied to your post"],
    }),
    makeNotification({
      id: "relay-1",
      wer: "/nostr/relay-down/wss-relay-test",
      time: 1_700_000_180_000,
      unread: true,
      message: ["Relay disconnected"],
    }),
  ];
}

function zapFeedFixtureBody() {
  const user = makeUrbitId("~litzod", "wicket");
  const post = {
    id: "zap-post",
    hash: "zap-post-hash",
    host: "~litzod",
    author: "~litzod",
    authorFull: { host: user, author: user },
    thread: null,
    parent: null,
    perms: {
      read: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
      write: { lock: { open: null }, manual: false, begs: {}, mute: { open: null }, backlog: 0 },
    },
    tags: [],
    contents: postFixture.contents || [{ paragraph: [{ text: postFixture.text }] }],
    time: 1_700_000_000_000,
    children: [],
    engagement: { reacts: postFixture.reacts, quoted: [], shared: [] },
  };
  const feed = { start: null, end: null, feed: { [post.id]: post } };
  const state = {
    relays: {},
    feed: { start: null, end: null, feed: {} },
    nostr: {},
    profiles: { "~litzod": { name: "wicket", pubkey: "a".repeat(64) } },
    following: { "~litzod": feed },
    timeline: { global: {}, start: null, end: null },
    followGraph: {},
    key: "",
    lists: listsFixture,
  };
  return [...state2Subscriptions].map(id =>
    `id: ${++ackEventId}\ndata: ${JSON.stringify({ response: "diff", id, json: { state } })}\n\n`,
  ).join("");
}

test.beforeEach(async ({ page }) => {
  tlonSubscriptions = new Map(); tlonEvents = []; tlonActions = []; tlonInvitesHandled = new Set(); tlonHistoryRequests = []; tlonBlocked = new Set(); tlonMuted = new Set(); tlonSent = new Map(); tlonGroups = {}; tlonUnavailable = false;
  groupsFixture = createGroupsFixture();
  dmInboxFixtureKind = "empty";
  notificationFixtureKind = "empty";
  feedFixtureKind = "empty";
  fixtureSnapshotsPending = true;
  walletSubscriptions = new Set();
  chatSubscriptions = new Set();
  walletPending = false;
  mockWallet = walletFixture();
  state2Facts = [];
  state2Subscriptions = new Set();
  state2Initialized = new Set();
  pokeLog = [];
  nackPokes = false;
  postFixture = { ...DEFAULT_POST };
  listsFixture = EMPTY_LISTS;
  await installUrbitMock(page);
});

test("shell loads and right-rail search supports its keyboard flow", async ({
  page,
}) => {
  await page.goto("f");

  await expect(page.locator("#trill-shell")).toBeVisible();
  await expect(page.locator("#left-nav")).toBeVisible();
  await expect(page.locator("#right-rail-search-box")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search Trill" });
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/apps\/nostrill\/search$/);
  await expect(search).toBeFocused();
  await expect(page.getByRole("heading", { name: "Search", exact: true })).toBeVisible();
  await expect(page.locator(".search-empty")).toBeVisible();

  await search.fill("relays");
  await expect(page).toHaveURL(/\/apps\/nostrill\/search\?q=relays$/);
  await expect(page.locator("#screen-search")).toBeVisible();
  await expect(page.getByRole("heading", { name: "relays", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Top" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "People" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Posts" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Hashtags" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/apps\/nostrill\/search$/);
  await expect(search).toHaveValue("");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/apps\/nostrill\/f$/);
});

test("settings persists the thread layout preference", async ({ page }) => {
  await page.goto("sets");

  await expect(page.locator("#screen-settings")).toBeVisible();
  await page.getByRole("button", { name: /Linear/i }).click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("trill-thread-style")))
    .toBe("linear");
});

test("compose modal opens and closes with Escape", async ({ page }) => {
  await page.goto("f");

  await page.getByRole("button", { name: "Compose" }).click();
  await expect(page.locator("#compose-modal")).toBeVisible();
  await expect(page.locator("#modal")).toHaveAttribute("aria-modal", "true");

  await page.keyboard.press("Escape");
  await expect(page.locator("#compose-modal")).toBeHidden();
});

test("feed status modal opens from the home header", async ({ page }) => {
  await page.goto("f");

  await page.getByRole("button", { name: /Feed status:/ }).click();
  await expect(page.locator("#feed-status-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feed status" })).toBeVisible();
  await expect(page.getByText("No active subscriptions")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("#feed-status-modal")).toBeHidden();
});

test("notification filters, actor modal, navigation, and read actions work", async ({
  page,
}) => {
  notificationFixtureKind = "activity";
  await page.goto("notif");

  await expect(page.locator("#screen-notifications")).toBeVisible();
  await expect(page.getByLabel("2 unread notifications")).toBeVisible();
  await expect(page.locator(".notification-item")).toHaveCount(4);
  await expect(page.locator(".notification-item").first()).toContainText(
    "Relay disconnected",
  );
  await page.getByRole("tab", { name: "Mentions" }).click();
  await expect(page.locator(".notification-item")).toHaveCount(2);
  await expect(page.getByText("replied to your post")).toBeVisible();
  await expect(page.getByText("mentioned you")).toBeVisible();

  await page.getByRole("tab", { name: "Relays" }).click();
  await expect(page.locator(".notification-item")).toHaveCount(1);
  await expect(page.getByText("Relay disconnected")).toBeVisible();

  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("button", { name: "Open ~litzod's profile" }).click();
  await expect(page.locator("#user-modal")).toBeVisible();
  await expect(page.getByLabel("1 unread notifications")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page
    .getByRole("button", { name: "Open notification from ~litzod" })
    .click();
  await expect(page).toHaveURL(/\/apps\/nostrill\/t\/u\/~zod\/root-post$/);
  await page.goBack();
  await expect(page.locator("#screen-notifications")).toBeVisible();

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByLabel(/unread notifications/)).toBeHidden();
  await page.getByRole("tab", { name: "Unread" }).click();
  await expect(page.getByText("You're all caught up")).toBeVisible();

  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("No notifications", { exact: true })).toBeVisible();
});

test("profile tabs and connections modal are functional", async ({ page }) => {
  await page.goto("u/~zod");

  await expect(page.locator("#screen-profile")).toBeVisible();
  await expect(page.getByText("galaxy")).toBeVisible();

  await page.getByRole("tab", { name: "Replies" }).click();
  await expect(page.getByRole("heading", { name: "No replies yet" })).toBeVisible();

  await page.getByRole("tab", { name: "Media" }).click();
  await expect(page.getByRole("heading", { name: "No media yet" })).toBeVisible();

  await page.getByRole("button", { name: "0 Following" }).click();
  await expect(page.locator("#connections-modal")).toBeVisible();
  await expect(page.getByRole("tab", { name: "0 Following" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "0 Followers" }).click();
  await expect(page.getByRole("tab", { name: "0 Followers" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No followers to show.")).toBeVisible();
});

test("wallet actions and settings follow the handoff flow", async ({ page }) => {
  await page.goto("wallet");

  await expect(page.locator("#screen-wallet")).toBeVisible();
  await expect(page.locator("#left-nav").getByText("Wallet", { exact: true })).toBeVisible();
  await expect(page.locator(".wallet-total")).toContainText("24,060");

  await page.getByRole("button", { name: "Receive" }).click();
  await expect(page.locator("#wallet-modal")).toBeVisible();
  await page.getByLabel("Amount (sats)").fill("5000");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByText("lnbc5000fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close wallet dialog" }).click();

  await page.getByRole("button", { name: "Wallet settings" }).click();
  await page.getByRole("switch", { name: "Hide balance" }).click();
  await page.getByRole("button", { name: "Close wallet dialog" }).click();
  await expect(page.locator(".wallet-total")).toHaveClass(/hidden/);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Lightning invoice", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ecash token", exact: true }).click();
  await page.getByLabel("Amount (sats)").fill("21");
  await expect(page.getByRole("button", { name: "Make token", exact: true })).toBeEnabled();
});

test("Zap sheet validates, submits, succeeds, and updates the post", async ({
  page,
}) => {
  feedFixtureKind = "zap";
  await page.goto("f/following");

  await expect(page.getByText("A post ready for a zap")).toBeVisible();
  const zapAction = page.getByRole("button", { name: "Zap post" });
  await zapAction.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#zap-sheet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zap wicket" })).toBeVisible();
  await expect(page.getByRole("button", { name: /21,000 sats, unavailable/ })).toBeDisabled();

  const amount = page.getByLabel("Custom amount");
  await amount.fill("13000");
  await expect(page.getByText("More than your ecash balance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zap 13,000 sats" })).toBeDisabled();

  await amount.fill("750");
  await page.getByLabel("Comment").fill("great post");
  await page.getByRole("button", { name: "Zap 750 sats" }).click();
  await expect(page.getByText("Nutzapping 750 sats")).toBeVisible();
  await expect(page.getByText("On its way to wicket as Cashu ecash")).toBeVisible();

  await expect(page.locator("#zap-sheet")).toBeHidden({ timeout: 4_000 });
  await expect(page.getByRole("button", { name: "Zap post, 1 sent" })).toContainText("1");
});

test("messages inbox, picker, and composer work", async ({ page }) => {
  await page.goto("dms");

  await expect(page.locator("#screen-messages")).toBeVisible();
  await expect(page.getByText("No messages yet")).toBeVisible();

  await page.locator(".dm-new-button").click();
  await expect(page.locator("#new-dm-modal")).toBeVisible();
  await page.getByPlaceholder("Search people or paste a ~ship...").fill("~litzod");
  await page.getByRole("button", { name: /Message this address/ }).click();
  await expect(page).toHaveURL(/\/apps\/nostrill\/dms\/~litzod$/);
  await expect(page.locator("#dm-thread")).toBeVisible();

  await page.getByRole("button", { name: "Conversation options" }).click();
  await expect(page.getByRole("menuitem", { name: "Mute" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Block" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Search" }).click();
  await expect(page.getByPlaceholder("Search this conversation")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator("#dm-thread")).toBeVisible();

  const composer = page.locator(".dm-composer textarea");
  await composer.fill("hello from e2e");
  await expect(composer).toHaveValue("hello from e2e");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(composer).toHaveValue("");
});

test("message requests can be accepted and rejected", async ({ page }) => {
  dmInboxFixtureKind = "requests";

  await page.goto("dms");

  await expect(page.locator("#screen-messages")).toBeVisible();
  await expect(page.getByRole("button", { name: /Requests\s*2/ })).toBeVisible();
  await expect(page.getByText("hello from request")).toBeVisible();
  await expect(page.getByText("please accept")).toBeVisible();

  const necRow = page.locator(".dm-request-row", { hasText: "please accept" });
  await necRow.getByRole("button", { name: /Request options/ }).click();
  await expect(page.getByRole("menuitem", { name: "Mute" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Block" })).toBeVisible();
  await page.keyboard.press("Escape");
  await necRow.getByRole("button", { name: /Reject request/ }).click();
  await expect(page.getByText("please accept")).toBeHidden();

  const litzodRow = page.locator(".dm-request-row", { hasText: "hello from request" });
  await litzodRow.getByRole("button", { name: /Accept request/ }).click();
  await expect(page.getByText("hello from request")).toBeHidden();
  await expect(page).toHaveURL(/\/apps\/nostrill\/dms$/);
});

test("muted and blocked conversations are separated from inbox", async ({ page }) => {
  dmInboxFixtureKind = "statuses";

  await page.goto("dms");

  await expect(page.getByText("regular dm")).toBeVisible();
  await expect(page.getByText("muted dm")).toBeHidden();
  await expect(page.getByText("blocked dm")).toBeHidden();

  await page.getByRole("button", { name: /Muted\s*1/ }).click();
  await expect(page.getByText("muted dm")).toBeVisible();
  await expect(page.getByText("regular dm")).toBeHidden();

  await page.getByRole("button", { name: /Blocked\s*1/ }).click();
  await expect(page.getByText("blocked dm")).toBeVisible();
  await expect(page.getByText("muted dm")).toBeHidden();
});

// --- regressions for the UI review fixes ---------------------------------

const REACT_POKE = (reaction) => ({
  post: { reaction: { reaction, id: "zap-post", host: "~litzod" } },
});

test("reacting sends a ~ship user and the remove button only shows once reacted", async ({
  page,
}) => {
  feedFixtureKind = "zap";
  await page.goto("f/following");
  const post = page.locator("article.trill-post", { hasText: "A post ready for a zap" });
  await expect(post).toBeVisible();

  await post.locator(".reaction-action").click();
  await expect(page.locator("#react-list")).toBeVisible();
  await expect(page.locator("#react-list .react-remove")).toHaveCount(0);
  await page.locator("#react-list span", { hasText: "🫡" }).first().dispatchEvent("mouseup");
  await expect(page.locator("#react-list")).toBeHidden();
  // Native engagement uses the host ship string, as decoded by json/nostrill.
  await expect.poll(() => pokeLog).toContainEqual(REACT_POKE("🫡"));
});

test("an existing reaction can be removed from the reaction picker", async ({ page }) => {
  feedFixtureKind = "zap";
  postFixture = { ...DEFAULT_POST, reacts: { "~zod": "🔥" } };
  await page.goto("f/following");
  const post = page.locator("article.trill-post", { hasText: "A post ready for a zap" });
  await expect(post).toBeVisible();

  await post.locator(".reaction-action").click();
  await page.getByRole("button", { name: "Remove your reaction" }).click();
  await expect(page.locator("#react-list")).toBeHidden();
  await expect
    .poll(() => pokeLog)
    .toContainEqual({
      post: { "del-reaction": { host: "~litzod", id: "zap-post" } },
    });
});

test("a rejected post keeps the draft and says it failed", async ({ page }) => {
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const editor = page.locator("#compose-modal .input-editor");
  await editor.click();
  await editor.pressSequentially("this should not vanish");
  // the ship nacks: the agent crashed on the poke
  nackPokes = true;
  await page.getByRole("button", { name: "Broadcast" }).click();

  await expect(page.getByText("Failed to post")).toBeVisible();
  await expect(page.locator("#compose-modal")).toBeVisible();
  await expect(editor).toHaveText("this should not vanish");
});

test("links inside a post don't open its thread; the post itself does", async ({ page }) => {
  feedFixtureKind = "zap";
  postFixture = { ...DEFAULT_POST, text: "see https://example.com/a now" };
  await page.goto("f/following");
  const post = page.locator("article.trill-post", { hasText: "see" });
  await expect(post).toBeVisible();
  // spaces around the link survive tokenising
  await expect(post.locator(".trill-post-body")).toContainText("see https://example.com/a now");

  // keep the browser on the app when the link is followed
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (e) => {
        if (e.target instanceof Element && e.target.closest('a[href^="http"]'))
          e.preventDefault();
      },
      true,
    ),
  );
  await post.getByRole("link", { name: "https://example.com/a" }).click();
  await expect(page).toHaveURL(/\/f\/following$/);

  await post.getByText("now").click();
  await expect(page).toHaveURL(/\/t\/u\/~litzod\/zap-post$/);
});

test("unknown routes show the 404 page", async ({ page }) => {
  await page.goto("definitely-not-a-page");
  await expect(page.locator("main .error-title")).toHaveText("404");
});

const ZAP_REF = { urbit: { host: "~litzod", id: "zap-post" } };

async function openPostMenu(page) {
  feedFixtureKind = "zap";
  await page.goto("f/following");
  const post = page.locator("article.trill-post", { hasText: "A post ready for a zap" });
  await expect(post).toBeVisible();
  await post.getByRole("button", { name: "More post actions" }).click();
  return post;
}

test("bookmark, mute and report go to the agent", async ({ page }) => {
  await openPostMenu(page);
  await page.getByRole("menuitem", { name: "Bookmark" }).click();
  await expect.poll(() => pokeLog).toContainEqual({ lists: { bookmark: { add: true, ref: ZAP_REF } } });

  const post = page.locator("article.trill-post", { hasText: "A post ready for a zap" });
  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Mute author" }).click();
  await expect
    .poll(() => pokeLog)
    .toContainEqual({ lists: { mute: { add: true, user: { urbit: "~litzod" } } } });

  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Report post" }).click();
  await expect(page.getByText("~litzod will be notified")).toBeVisible();
  await page.getByLabel("Harassment").check();
  await page.getByPlaceholder("Add details (optional)").fill("rude");
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect
    .poll(() => pokeLog)
    .toContainEqual({ lists: { report: { ref: ZAP_REF, reason: "Harassment: rude" } } });
});

test("muted authors and reported posts are hidden from feeds", async ({ page }) => {
  feedFixtureKind = "zap";
  listsFixture = { ...EMPTY_LISTS, muted: [{ urbit: "~litzod" }] };
  await page.goto("f/following");
  await expect(page.getByText("No relays configured", { exact: true })).toBeVisible();
  await expect(page.getByText("A post ready for a zap")).toHaveCount(0);

  listsFixture = { ...EMPTY_LISTS, reported: [ZAP_REF] };
  await page.reload();
  await expect(page.getByText("No relays configured", { exact: true })).toBeVisible();
  await expect(page.getByText("A post ready for a zap")).toHaveCount(0);
});

test("bookmarks page lists saved posts and settings lists muted accounts", async ({ page }) => {
  feedFixtureKind = "zap";
  listsFixture = {
    bookmarks: [{ ref: ZAP_REF, at: 1_700_000_000_000 }],
    muted: [{ urbit: "~bus" }],
    reported: [],
  };
  await page.goto("bookmarks");
  await expect(page.getByRole("heading", { name: "Bookmarks", exact: true })).toBeVisible();
  await expect(page.getByText("A post ready for a zap")).toBeVisible();
  await expect(page.locator("#screen-bookmarks article.trill-post header .name")).toHaveText("wicket");

  await page.goto("sets");
  const muted = page.locator("#settings-muted");
  await expect(muted.getByText("~bus").first()).toBeVisible();
  await muted.getByRole("button", { name: "Unmute ~bus" }).click();
  await expect
    .poll(() => pokeLog)
    .toContainEqual({ lists: { mute: { add: false, user: { urbit: "~bus" } } } });
});


// These fixtures mirror the state-2 Hoon encoders, including nullable values.
const STATE2_KEY = "a".repeat(64);
const STATE2_UNKNOWN = "b".repeat(64);
const STATE2_KNOWN = "c".repeat(64);
function state2Fixture() {
  const event = (id, content) => ({ id: id.repeat(64), pubkey: STATE2_KEY, created_at: 1700000000, kind: 1, content, tags: [], sig: "0".repeat(128) });
  const notes = [event("d", "First same-second note"), event("e", "Second same-second note")];
  const sub = { name: "timeline", eventsReceived: 2, filters: [], ongoing: true };
  return {
    key: "f".repeat(64), relays: { "wss://one.example": { wid: 1, start: 1700000000000, reqs: {} } }, lists: EMPTY_LISTS,
    feed: { feed: {}, start: null, end: null },
    following: { "~nec": { feed: {}, start: null, end: null } },
    followGraph: { "~zod": [{ urbit: "~nec" }], "~nec": [{ urbit: "~bud" }] },
    profiles: { "~nec": { name: "Native friend", picture: "", about: "", following: [{ urbit: "~bud" }], followers: [], followingCount: 1, followerCount: 0, urbitID: makeUrbitId("~nec", "nec") } },
    timeline: { global: {}, start: null, end: null },
    nostr: {
      feeds: { timeline: { "wss://one.example": { feed: notes, sub }, "wss://two.example": { feed: [notes[0]], sub } } },
      following: [STATE2_KEY, STATE2_UNKNOWN],
      "user-map": {
        [STATE2_KEY]: { id: { pubkey: STATE2_KEY, npub: "" }, feed: notes, profile: { name: "Nostr friend", picture: "", about: "Nostr profile" }, following: [], other: [] },
        [STATE2_KNOWN]: { id: { pubkey: STATE2_KNOWN, npub: "" }, feed: [], profile: { name: "Unfollowed author", picture: "", about: "" }, following: null, other: [] },
      },
    },
  };
}
function state2FixtureBody() {
  let body = "";
  const emit = (id, json) => { body += `id: ${++ackEventId}\ndata: ${JSON.stringify({ response: "diff", id, json })}\n\n`; };
  for (const id of state2Subscriptions) {
    if (!state2Initialized.has(id)) {
      emit(id, { state: state2Snapshot });
      state2Initialized.add(id);
    }
    for (const fact of state2Facts) emit(id, { fact });
  }
  if (state2Subscriptions.size) state2Facts = [];
  return body || ": heartbeat\n\n";
}

test("state-2 snapshot separates selected follows from known authors", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  await page.goto("fols");
  await expect(page.locator(".follow-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Native friend", exact: true })).toBeVisible();
  await page.locator("#follows-filter").getByRole("button", { name: "Nostr", exact: true }).click();
  await expect(page.locator(".follow-card")).toHaveCount(2);
  await expect(page.getByText("Unfollowed author", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nostr friend", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("state2-follows.png"), fullPage: true });
  await page.getByRole("heading", { name: "Nostr friend", exact: true }).click();
  await expect(page.locator("#user-modal")).toBeVisible();
  await page.locator("#user-modal").getByRole("button", { name: "Following", exact: true }).click();
  await expect(page.locator("#user-modal").getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  const followButton = page.locator("#user-modal .user-modal-follow");
  await expect.poll(() => followButton.evaluate(button => {
    const rect = button.getBoundingClientRect();
    return [3, rect.height / 2, rect.height - 3].every(offset =>
      button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + offset)),
    );
  })).toBe(true);
  await page.locator("#user-modal").screenshot({ path: testInfo.outputPath("state2-user-modal.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator(".follow-card")).toHaveCount(1);
  await page.locator("#follows-filter").getByRole("button", { name: "Urbit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Native friend", exact: true })).toBeVisible();
});

test("state-2 feeds keep same-second notes and apply Nostr data facts", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  await page.goto("f");
  await expect(page.getByText("First same-second note", { exact: true })).toBeVisible();
  await expect(page.getByText("Second same-second note", { exact: true })).toBeVisible();
  await expect(page.locator("#home-feed .trill-post")).toHaveCount(2);
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile.name = "Updated Nostr friend";
  state2Facts.push({ nostr: { data: state2Snapshot.nostr } });
  await expect(page.locator("#home-feed").getByText("Updated Nostr friend", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("state2-feed.png"), fullPage: true });
  await page.goto(`u/${STATE2_KEY}`);
  await expect(page.locator("#screen-profile")).toBeVisible();
  await expect(page.getByText("First same-second note", { exact: true })).toBeVisible();
});

test("state-2 native follow facts and live Nostr events update shared views", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  await page.goto("fols");
  await expect(page.locator(".follow-card")).toHaveCount(3);
  state2Facts.push({ fols: { "new-urbit": {
    user: { urbit: "~bud" }, ts: 1700000000000,
    data: { msg: "", data: { feed: { feed: {}, start: null, end: null }, profile: { name: "New native friend", following: [], followers: [] } } },
  } } });
  await expect(page.getByRole("heading", { name: "New native friend", exact: true })).toBeVisible();
  await expect(page.locator(".follow-card")).toHaveCount(4);
  state2Facts.push({ fols: { quit: "~bud" } });
  await expect(page.locator(".follow-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "New native friend", exact: true })).toHaveCount(0);
  const hostedPost = Object.values(makeDm("~bud", "Bud", "A guest post on a followed host", 1700000000123).fc.feed)[0];
  hostedPost.host = "~nec";
  state2Facts.push({ post: { add: { post: hostedPost } } });
  const nativeCard = page.locator(".follow-card").filter({ has: page.getByRole("heading", { name: "Native friend", exact: true }) });
  await expect(nativeCard.locator(".stat-value").first()).toHaveText("1");
  await expect(page.locator(".follow-card")).toHaveCount(3);
  state2Facts.push({ post: { del: { post: hostedPost } } });
  await expect(nativeCard.locator(".stat-value").first()).toHaveText("0");
  await page.locator("#left-nav").getByRole("link", { name: "Home", exact: true }).click();
  state2Facts.push({ nostr: { event: { id: "9".repeat(64), pubkey: STATE2_KEY, created_at: 1700000000, kind: 1, content: "Live same-second note", tags: [], sig: "0".repeat(128) } } });
  await expect(page.getByText("Live same-second note", { exact: true })).toBeVisible();
  await expect(page.locator("#home-feed .trill-post")).toHaveCount(3);
  state2Facts.push({ nostr: { event: { id: "8".repeat(64), pubkey: STATE2_KEY, created_at: 1700000001, kind: 0, content: JSON.stringify({ name: "Live metadata" }), tags: [], sig: "0".repeat(128) } } });
  await expect(page.locator("#home-feed").getByText("Live metadata", { exact: true })).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("state2-live.png"), fullPage: true });
});

test("state-2 authoritative data survives an older EOSE scry", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  let requested = false;
  let completed = false;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/~/scry/nostrill/j/nostr.json", async route => {
    requested = true;
    await pending;
    await route.fulfill({ json: {} });
    completed = true;
  });
  await page.goto("f");
  await expect(page.getByText("First same-second note", { exact: true })).toBeVisible();
  state2Facts.push({ nostr: { eose: "fixture-old-sub" } });
  await expect.poll(() => requested).toBe(true);
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile.name = "Authoritative metadata";
  state2Facts.push({ nostr: { data: state2Snapshot.nostr } });
  await expect(page.locator("#home-feed").getByText("Authoritative metadata", { exact: true })).toHaveCount(2);
  release();
  await expect.poll(() => completed).toBe(true);
  await expect(page.getByText("First same-second note", { exact: true })).toBeVisible();
  await expect(page.locator("#home-feed .trill-post")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("state2-eose-race.png"), fullPage: true });
});


test("post images open full-size without navigating and support dismissal", async ({ page }, testInfo) => {
  feedFixtureKind = "zap";
  const src = "https://images.example.com/post.png";
  postFixture = { ...DEFAULT_POST, contents: [
    { paragraph: [{ text: "Images to inspect" }, { link: { href: src, show: "Photo" } }] },
    { paragraph: [{ text: src }] },
    { media: { images: [src, src] } },
  ] };
  await page.route("https://images.example.com/**", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#184e77"/><circle cx="800" cy="600" r="300" fill="#76c893"/></svg>',
  }));
  await page.goto("f/following");
  const triggers = page.locator("article.trill-post .post-image-trigger");
  await expect(triggers).toHaveCount(4);
  const initialUrl = page.url();
  await triggers.first().focus();
  await page.keyboard.press("Enter");
  const viewer = page.locator("#image-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("img")).toHaveAttribute("src", src);
  await expect(viewer.getByRole("link", { name: "Open original" })).toHaveAttribute("href", src);
  await expect(page).toHaveURL(initialUrl);
  await expect(viewer.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("link", { name: "Open original" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("button", { name: "Close" })).toBeFocused();
  await viewer.screenshot({ path: testInfo.outputPath("post-image-desktop.png") });
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(triggers.first()).toBeFocused();
  for (let i = 1; i < 4; i++) {
    await triggers.nth(i).click();
    await expect(viewer).toBeVisible();
    await viewer.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(initialUrl);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await triggers.first().focus();
  await page.keyboard.press("Space");
  await expect(viewer).toBeVisible();
  await expect.poll(() => viewer.getByRole("img").evaluate(img => img.complete && img.naturalWidth === 1600)).toBe(true);
  const bounds = await viewer.getByRole("img").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  expect(bounds.width / bounds.height).toBeCloseTo(4 / 3, 1);
  await page.screenshot({ path: testInfo.outputPath("post-image-mobile.png") });
  await page.locator("#modal-background").click({ position: { x: 3, y: 3 } });
  await expect(viewer).toHaveCount(0);
  await expect(page).toHaveURL(initialUrl);
});


test("rejected relay events show the relay reason without generating a link", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const links = [];
  page.on("console", message => {
    if (message.type() === "log" && message.text().startsWith("nevent ")) links.push(message.text());
  });
  await page.goto("fols");
  await expect(page.locator(".follow-card")).toHaveCount(3);
  const response = { relay: "wss://nos.lol/", accepted: false, msg: "invalid: signature verification failed", id: { pubkey: "6baea8bc90fab545f78f8af69d74fc36be9b592688ffb9ff6de0733da0d0efb5", npub: "" } };
  state2Facts.push({ nostr: { "sent-res": response } });
  await expect(page.getByText("wss://nos.lol/: invalid: signature verification failed", { exact: true })).toBeVisible();
  expect(links).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("relay-rejection.png") });
  state2Facts.push({ nostr: { "sent-res": { ...response, accepted: true, msg: "" } } });
  await expect.poll(() => links.length).toBe(1);
});

test("a Nostr thread does not reparse its post for unrelated profile updates", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const target = state2Snapshot.nostr["user-map"][STATE2_KEY].feed[0];
  target.content = "Thread parsing regression target";
  await page.addInitScript(() => {
    window.__threadParses = 0;
    window.__threadFacts = 0;
    const matchAll = String.prototype.matchAll;
    String.prototype.matchAll = function (...args) {
      if (String(this) === "Thread parsing regression target" && new Error().stack.includes("eventToPoast")) window.__threadParses++;
      return matchAll.apply(this, args);
    };
    const parse = JSON.parse;
    JSON.parse = (...args) => {
      const result = parse(...args);
      if (result?.response === "diff" && result?.json?.fact) window.__threadFacts++;
      return result;
    };
  });
  await page.goto(`t/n/${target.id}`);
  await expect(page.getByText(target.content, { exact: true })).toBeVisible();
  const before = await page.evaluate(() => window.__threadParses);
  for (let i = 0; i < 3; i++) {
    state2Facts.push({ prof: { "~nec": { name: `Unrelated profile ${i}`, following: [], followers: [] } } });
    await page.waitForFunction(n => window.__threadFacts >= n, i + 1);
  }
  expect(await page.evaluate(() => window.__threadParses)).toBe(before);
  state2Facts.push({ nostr: { event: { ...target, kind: 0, content: JSON.stringify({ name: "Updated thread author" }) } } });
  await expect(page.getByText("Updated thread author", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__threadParses)).toBe(before);
  const updated = { ...target, content: "Updated thread contents" };
  state2Facts.push({ nostr: { feed: { name: "timeline", feed: [updated] } } });
  await expect(page.getByText(updated.content, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("thread-updates.png") });
});

test("Nostr parsing scales with new events rather than cached feed size", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const notes = Array.from({ length: 200 }, (_, i) => ({ id: (i + 1).toString(16).padStart(64, "0"), pubkey: STATE2_KEY, created_at: 1700000000 + i, kind: 1, content: `PERF ${i}`, tags: [], sig: "0".repeat(128) }));
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = notes;
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = notes;
  state2Snapshot.nostr["user-map"][STATE2_KEY].feed = notes;
  await page.addInitScript(() => {
    window.__parses = 0;
    const matchAll = String.prototype.matchAll;
    String.prototype.matchAll = function (...args) {
      if (String(this).startsWith("PERF ") && new Error().stack.includes("eventToPoast")) window.__parses++;
      return matchAll.apply(this, args);
    };
    const parse = JSON.parse;
    JSON.parse = (...args) => {
      const result = parse(...args);
      if (result?.response === "diff" && result?.json?.fact) window.__lastFact = result.json.fact;
      return result;
    };
  });
  await page.goto(`t/n/${notes[0].id}`);
  await expect(page.getByText("PERF 0", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__parses)).toBe(1);
  for (let i = 0; i < 10; i++) {
    const event = { ...notes[0], id: (201 + i).toString(16).padStart(64, "0"), content: `PERF live ${i}`, created_at: 1700000200 + i };
    state2Facts.push({ nostr: { event } });
    await page.waitForFunction(id => window.__lastFact?.nostr?.event?.id === id, event.id);
    expect(await page.evaluate(() => window.__parses)).toBe(1);
  }
  // Repeated snapshots must reuse parsed bodies, including provenance changes.
  state2Facts.push({ nostr: { data: state2Snapshot.nostr } });
  await page.waitForFunction(() => Boolean(window.__lastFact?.nostr?.data));
  expect(await page.evaluate(() => window.__parses)).toBe(1);
  await page.locator("#left-nav").getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Nostr", exact: true }).click();
  await expect(page.getByText("PERF 199", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__parses)).toBe(200);
  await page.screenshot({ path: testInfo.outputPath("linear-nostr-parsing.png") });
});

function ancestorFixture() {
  const { finalizeEvent } = require("nostr-tools");
  // Public fixture key, used only to sign mocked browser relay responses.
  const key = new Uint8Array(32); key[31] = 1;
  const note = (content, tags = []) => finalizeEvent({ kind: 1, content, tags, created_at: 1700000000 }, key);
  const root = note("Conversation root");
  const parent = note("Immediate parent", [["e", root.id, "wss://context.example/", "root", root.pubkey]]);
  const mention = note("This mention is not an ancestor");
  const selected = note("Selected nested reply", [["e", root.id, "wss://context.example/", "root", root.pubkey], ["e", parent.id, "", "reply", parent.pubkey], ["e", mention.id, "", "mention"], ["q", mention.id]]);
  return { root, parent, mention, selected };
}

test("a cached Nostr reply loads its ancestors and keeps the selected post focused", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const { root, parent, mention, selected } = ancestorFixture();
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [selected];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [];
  const requests = [];
  await page.routeWebSocket(/wss:\/\/(one|context)\.example/, ws => {
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw));
      if (msg[0] !== "REQ") return;
      for (const id of msg[2].ids || []) {
        requests.push(id);
        const event = id === root.id ? root : id === parent.id ? parent : null;
        if (event && ws.url().includes("context.example")) ws.send(JSON.stringify(["EVENT", msg[1], event]));
      }
      ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  await page.goto(`t/n/${selected.id}`);
  await expect(page.getByText(root.content, { exact: true })).toBeVisible();
  await expect(page.getByText(parent.content, { exact: true })).toBeVisible();
  const focus = page.getByRole("region", { name: "Selected post", exact: true });
  await expect(focus).toContainText(selected.content);
  await expect(focus).toBeFocused();
  const ids = await page.locator("[data-thread-event]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-thread-event")));
  expect(ids).toEqual([root.id, parent.id, selected.id]);
  expect(requests).not.toContain(mention.id);
  const bounds = await focus.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(bounds.y + bounds.height / 2 - page.viewportSize().height / 2)).toBeLessThanOrEqual(2);
  await focus.locator("#thread-reply-composer").click();
  await expect(page.locator("#compose-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("nostr-ancestor-chain.png") });
});

test("legacy Nostr ancestry keeps an available root when the immediate parent is missing", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const { finalizeEvent } = require("nostr-tools");
  const { root, parent, mention } = ancestorFixture();
  const key = new Uint8Array(32); key[31] = 1;
  const selected = finalizeEvent({ kind: 1, content: "Legacy selected reply", created_at: 1700000001, tags: [["e", root.id], ["e", mention.id, "", "mention"], ["e", parent.id]] }, key);
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [selected];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [];
  await page.routeWebSocket(/wss:\/\/one\.example/, ws => ws.onMessage(raw => {
    const msg = JSON.parse(String(raw));
    if (msg[0] !== "REQ") return;
    if (msg[2].ids?.includes(root.id)) ws.send(JSON.stringify(["EVENT", msg[1], root]));
    ws.send(JSON.stringify(["EOSE", msg[1]]));
  }));
  await page.goto(`t/n/${selected.id}`);
  await expect(page.getByText(root.content, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected post" })).toContainText(selected.content);
  await expect(page.getByText("Some earlier posts couldn’t be loaded.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry earlier posts" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("nostr-missing-parent-mobile.png") });
});

function replyFixture() {
  const { finalizeEvent } = require("nostr-tools");
  const { root } = ancestorFixture();
  const key = new Uint8Array(32); key[31] = 1;
  const note = (content, tags, time = 1700000001) => finalizeEvent({ kind: 1, content, tags, created_at: time }, key);
  const direct = note("Direct reply from source relay", [["e", root.id, "", "root", root.pubkey]]);
  const legacy = note("Legacy direct reply", [["e", root.id]]);
  const nested = note("Not a direct reply", [["e", root.id, "", "root"], ["e", direct.id, "", "reply"]]);
  const mention = note("Mention, not a reply", [["e", root.id, "", "mention"]]);
  const live = note("Live reply after EOSE", [["e", root.id, "", "root"]], 1700000002);
  return { root, direct, legacy, nested, mention, live };
}

test("Nostr replies stream directly from the source relay and exclude mentions and descendants", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const { root, direct, legacy, nested, mention, live } = replyFixture();
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [root];
  const requests = [];
  let stream;
  let closes = 0;
  await page.routeWebSocket(/wss:\/\/(one|two)\.example/, ws => {
    ws.onClose(() => { closes++; });
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw));
      if (msg[0] !== "REQ") return;
      requests.push({ url: ws.url(), filters: msg.slice(2) });
      if (msg[2]["#e"]?.includes(root.id)) {
        stream = { ws, id: msg[1] };
        for (const event of [direct, legacy, nested, mention, direct]) ws.send(JSON.stringify(["EVENT", msg[1], event]));
      }
      ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  await page.goto(`t/n/${root.id}`);
  const replies = page.getByRole("region", { name: "Replies", exact: true });
  await expect(replies.getByText(direct.content, { exact: true })).toBeVisible();
  await expect(replies.getByText(legacy.content, { exact: true })).toBeVisible();
  await expect(replies.locator("article.trill-post")).toHaveCount(2);
  await expect(replies.getByText(nested.content, { exact: true })).toHaveCount(0);
  await expect(replies.getByText(mention.content, { exact: true })).toHaveCount(0);
  expect(requests).toEqual([{ url: "wss://two.example/", filters: [{ kinds: [1], "#e": [root.id], limit: 100 }] }]);
  stream.ws.send(JSON.stringify(["EVENT", stream.id, live]));
  await expect(replies.getByText(live.content, { exact: true })).toBeVisible();
  await expect(replies.locator("article.trill-post")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("nostr-live-replies.png") });
  // Following a reply uses its cached raw event, retaining the source relay.
  await replies.getByText(direct.content, { exact: true }).click();
  await expect(page.getByRole("region", { name: "Selected post", exact: true })).toContainText(direct.content);
  await expect.poll(() => closes).toBeGreaterThanOrEqual(1);
  expect(requests.every(request => request.url === "wss://two.example/")).toBe(true);
  expect(requests.some(request => request.filters.some(filter => filter.ids?.includes(direct.id)))).toBe(false);
});

test("Nostr reply subscription failures preserve the selected post and can be retried", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const { root } = replyFixture();
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [root];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [];
  let attempts = 0;
  await page.routeWebSocket(/wss:\/\/one\.example/, ws => ws.onMessage(raw => {
    const msg = JSON.parse(String(raw));
    if (msg[0] !== "REQ") return;
    attempts++;
    ws.send(JSON.stringify(attempts === 1 ? ["CLOSED", msg[1], "restricted: fixture"] : ["EOSE", msg[1]]));
  }));
  await page.goto(`t/n/${root.id}`);
  await expect(page.getByRole("region", { name: "Selected post", exact: true })).toContainText(root.content);
  await expect(page.getByRole("button", { name: "Retry replies" })).toBeVisible();
  await page.getByRole("button", { name: "Retry replies" }).click();
  await expect(page.getByText("No direct replies returned by this relay.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry replies" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("nostr-empty-replies-mobile.png") });
});

test("Nostr composer snippets retain profiles and receive metadata updates", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const picture = "https://avatars.example/nostr-friend.svg";
  const updatedPicture = "https://avatars.example/nostr-friend-updated.svg";
  await page.route("https://avatars.example/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="purple"/></svg>' }));
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile.picture = picture;
  await page.goto("f");
  const note = page.locator("#home-feed article.trill-post").filter({ hasText: "First same-second note" });
  await expect(note.locator("header .name")).toHaveText("Nostr friend");
  await note.locator(".reply-action").click();
  const reply = page.locator("#composer .reply-snippet");
  await expect(reply.locator("header .name")).toHaveText("Nostr friend");
  await expect(reply.locator("img").first()).toHaveAttribute("src", picture);
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile = { name: "Updated friend", picture: updatedPicture, about: "Updated profile" };
  state2Facts.push({ nostr: { data: state2Snapshot.nostr } });
  await expect(reply.locator("header .name")).toHaveText("Updated friend");
  await expect(reply.locator("img").first()).toHaveAttribute("src", updatedPicture);
  await page.screenshot({ path: testInfo.outputPath("nostr-reply-profile.png") });
  await page.locator("#composer .clear-context").click();
  await note.locator(".quote-action").click();
  const quote = page.locator("#composer .composer-snippet");
  await expect(quote.locator("header .name")).toHaveText("Updated friend");
  await expect(quote.locator("img").first()).toHaveAttribute("src", updatedPicture);
  await page.locator("#composer .clear-context").click();
  await page.routeWebSocket(/wss:\/\/one\.example/, ws => ws.onMessage(raw => {
    const msg = JSON.parse(String(raw));
    if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
  }));
  await page.goto(`t/n/${"d".repeat(64)}`);
  await page.locator("#thread-reply-composer").click();
  const modalReply = page.locator("#compose-modal .reply-snippet");
  await expect(modalReply.locator("header .name")).toHaveText("Updated friend");
  await expect(modalReply.locator("img").first()).toHaveAttribute("src", updatedPicture);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("nostr-reply-profile-mobile.png") });
});

test("bookmarked Nostr posts show cached profiles and update metadata", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const id = "d".repeat(64);
  const picture = "https://avatars.example/bookmarked-author.svg";
  const updatedPicture = "https://avatars.example/bookmarked-author-updated.svg";
  await page.route("https://avatars.example/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="purple"/></svg>' }));
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile.picture = picture;
  state2Snapshot.lists.bookmarks = [{ ref: { nostr: id }, at: 1700000000000 }];
  await page.goto("bookmarks");
  const post = page.locator("#screen-bookmarks article.trill-post");
  await expect(post).toHaveCount(1);
  await expect(post).toContainText("First same-second note");
  await expect(post.locator("header .name")).toHaveText("Nostr friend");
  await expect(post.locator("img").first()).toHaveAttribute("src", picture);
  state2Snapshot.nostr["user-map"][STATE2_KEY].profile = { name: "Updated bookmarked author", picture: updatedPicture, about: "Updated profile" };
  state2Facts.push({ nostr: { data: state2Snapshot.nostr } });
  await expect(post.locator("header .name")).toHaveText("Updated bookmarked author");
  await expect(post.locator("img").first()).toHaveAttribute("src", updatedPicture);
  await page.screenshot({ path: testInfo.outputPath("bookmark-author-profile.png") });
});

test("our Nostr notes use our local profile in bookmarks, threads and reply snippets", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  state2Snapshot.key = STATE2_KEY;
  const picture = "https://avatars.example/our-profile.svg";
  await page.route("https://avatars.example/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="purple"/></svg>' }));
  state2Snapshot.profiles["~zod"] = { name: "Our Trill profile", picture, about: "Our profile", following: [], followers: [], urbitID: makeUrbitId("~zod", "zod") };
  state2Snapshot.lists.bookmarks = [{ ref: { nostr: "d".repeat(64) }, at: 1700000000000 }];
  await page.goto("bookmarks");
  const bookmark = page.locator("#screen-bookmarks article.trill-post");
  await expect(bookmark.locator("header .name")).toHaveText("Our Trill profile");
  await expect(bookmark.locator("img").first()).toHaveAttribute("src", picture);
  await page.routeWebSocket(/wss:\/\/one\.example/, ws => ws.onMessage(raw => {
    const msg = JSON.parse(String(raw));
    if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
  }));
  await page.goto(`t/n/${"d".repeat(64)}`);
  const selected = page.getByRole("region", { name: "Selected post", exact: true });
  await expect(selected).toContainText("Our Trill profile");
  await expect(selected.locator("img").first()).toHaveAttribute("src", picture);
  await selected.locator("#thread-reply-composer").click();
  const snippet = page.locator("#compose-modal .reply-snippet");
  await expect(snippet.locator("header .name")).toHaveText("Our Trill profile");
  await expect(snippet.locator("img").first()).toHaveAttribute("src", picture);
  state2Facts.push({ prof: { "~zod": { ...state2Snapshot.profiles["~zod"], name: "Our updated profile" } } });
  await expect(snippet.locator("header .name")).toHaveText("Our updated profile");
  await expect(selected).toContainText("Our updated profile");
  await page.screenshot({ path: testInfo.outputPath("own-nostr-profile.png") });
});

test("our live Nostr replies use our ship identity even without cached profile metadata", async ({ page }, testInfo) => {
  feedFixtureKind = "state2";
  state2Snapshot = state2Fixture();
  const { root, direct } = replyFixture();
  state2Snapshot.key = direct.pubkey;
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [root];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [];
  // No own entry in profiles or nostr user-map, as with a default local profile.
  await page.routeWebSocket(/wss:\/\/one\.example/, ws => ws.onMessage(raw => {
    const msg = JSON.parse(String(raw));
    if (msg[0] !== "REQ") return;
    if (msg[2]["#e"]?.includes(root.id)) ws.send(JSON.stringify(["EVENT", msg[1], direct]));
    ws.send(JSON.stringify(["EOSE", msg[1]]));
  }));
  await page.goto(`t/n/${root.id}`);
  const reply = page.getByRole("region", { name: "Replies", exact: true }).locator("article.trill-post");
  await expect(reply.locator("header .name")).toHaveText("zod");
  await expect(reply.locator(".sigil svg")).toBeVisible();
  await reply.locator(".reply-action").click();
  const snippet = page.locator("#compose-modal .reply-snippet");
  await expect(snippet).toContainText(direct.content);
  await expect(snippet.locator("header .name")).toHaveText("zod");
  await page.screenshot({ path: testInfo.outputPath("own-live-reply-ship-identity.png") });
});

test("global-feed sharing defaults on and is configured in Settings instead of the composer", async ({ page }, testInfo) => {
  let saved = {};
  await page.route("**/~/scry/settings/desk/nostrill.json", route => route.fulfill({ status: 200, json: { desk: saved } }));
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  await expect(modal.getByTitle("global", { exact: true })).toHaveCount(0);
  await modal.locator(".input-editor").fill("Shared by default");
  await modal.getByRole("button", { name: "Broadcast", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ post: { add: { content: "Shared by default", global: true, anon: false, reply: "everyone" } } });
  await page.goto("sets");
  const toggle = page.getByRole("checkbox", { name: "Share new posts to the global feed", exact: true });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(() => pokeLog).toContainEqual({ "put-entry": { desk: "nostrill", "bucket-key": "posting", "entry-key": "global", value: false } });
  await expect(toggle).not.toBeChecked();
  saved = { posting: { global: false } };
  await page.screenshot({ path: testInfo.outputPath("global-sharing-settings.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#settings-publishing").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("global-sharing-settings-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await modal.locator(".input-editor").fill("Opted out after reload");
  await modal.getByRole("button", { name: "Broadcast", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ post: { add: { content: "Opted out after reload", global: false, anon: false, reply: "everyone" } } });
  await page.goto("sets");
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  saved = { posting: { global: true } };
  await page.goto("f");
  const inline = page.locator("#composer");
  await expect(inline.getByTitle("global", { exact: true })).toHaveCount(0);
  await inline.locator(".input-editor").fill("Sharing enabled again");
  await inline.getByRole("button", { name: "Post", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ post: { add: { content: "Sharing enabled again", global: true, anon: false, reply: "everyone" } } });
});

test("a rejected global-sharing setting keeps the saved preference", async ({ page }) => {
  await page.goto("sets");
  const toggle = page.getByRole("checkbox", { name: "Share new posts to the global feed", exact: true });
  await expect(toggle).toBeEnabled();
  nackPokes = true;
  await toggle.uncheck();
  await expect(page.getByText("Failed to save setting", { exact: true })).toBeVisible();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
});

test("posting waits for a saved global-feed opt-out instead of using the default", async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route("**/~/scry/settings/desk/nostrill.json", async route => {
    await ready;
    await route.fulfill({ status: 200, json: { desk: { posting: { global: false } } } });
  });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  await modal.locator(".input-editor").fill("Respect the opt-out");
  await modal.getByRole("button", { name: "Broadcast", exact: true }).click();
  expect(pokeLog.some(poke => poke.post?.add)).toBe(false);
  release();
  await expect.poll(() => pokeLog).toContainEqual({ post: { add: { content: "Respect the opt-out", global: false, anon: false, reply: "everyone" } } });
});

// Public fixture credentials only. Never use or record real Jars credentials.
async function installJarsMock(page, { exists = false, headStatus, createStatus = 200 } = {}) {
  const calls = [];
  let present = exists;
  let failUpload = false;
  const uploadedKeys = new Set();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII=", "base64");
  await page.route("**/~/scry/s3-server/config.json", route => route.fulfill({ status: 200, json: { region: "us-east-1", accessKeyId: "~zod", secretAccessKey: "public-jars-test-fixture" } }));
  await page.route(/\/jars\/trill(?:\/.*)?(?:\?.*)?$/, async route => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const bucket = /^\/jars\/trill\/?$/.test(url.pathname.replace(/^\/apps\/nostrill/, ""));
    const headers = { "access-control-allow-origin": "http://localhost:5173, *", "access-control-allow-headers": "*", "access-control-allow-methods": "HEAD, GET, PUT, OPTIONS" };
    if (method === "OPTIONS") return route.fulfill({ status: 200, headers });
    calls.push({ method, path: url.pathname.replace(/^\/apps\/nostrill/, ""), proxied: url.pathname.startsWith("/apps/nostrill/jars/"), signed: url.searchParams.has("X-Amz-Signature"), type: request.headers()["content-type"] });
    if (method === "HEAD" && bucket) return route.fulfill({ status: headStatus ?? (present ? 200 : 404), headers });
    if (method === "PUT" && bucket) {
      if (createStatus === 200) present = true;
      return route.fulfill({ status: createStatus, headers, body: createStatus === 200 ? "" : '<Error><Code>AccessDenied</Code><Message>Bucket creation denied</Message></Error>' });
    }
    if (method === "GET" && bucket) return route.fulfill({ status: 200, headers: { ...headers, "content-type": "application/xml" }, body: '<?xml version="1.0"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>trill</Name><IsTruncated>false</IsTruncated><Contents><Key>folder/photo #1?.png</Key><Size>68</Size></Contents>' + [...uploadedKeys].map(key => `<Contents><Key>${key}</Key><Size>68</Size></Contents>`).join("") + '</ListBucketResult>' });
    if (method === "PUT") {
      if (!failUpload) uploadedKeys.add(url.pathname.split("/").at(-1));
      return route.fulfill({ status: failUpload ? 500 : 200, headers, body: failUpload ? '<Error><Code>InternalError</Code><Message>Fixture upload failed</Message></Error>' : "" });
    }
    return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/png" }, body: png });
  });
  return { calls, failUploads: () => { failUpload = true; }, allowUploads: () => { failUpload = false; } };
}

async function pasteJarsImage(page, editor) {
  await editor.focus();
  await editor.evaluate(element => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII="), c => c.charCodeAt(0));
    transfer.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await page.locator(".confirmation-dialog").getByRole("button", { name: "Yes", exact: true }).click();
}

test("Jars creates the Trill bucket and supports browsing and pasted uploads without storage", async ({ page }, testInfo) => {
  const jars = await installJarsMock(page);
  const storageReads = [];
  page.on("request", request => { if (request.url().includes("/~/scry/storage/")) storageReads.push(request.url()); });
  await page.goto("f");
  await expect.poll(() => jars.calls.filter(call => call.method === "PUT").length).toBe(1);
  expect(jars.calls.slice(0, 2).map(call => call.method)).toEqual(["HEAD", "PUT"]);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  await modal.getByTitle("Add image", { exact: true }).click();
  const browser = page.locator("#s3-browser");
  const existing = browser.getByRole("button", { name: "Choose folder/photo #1?.png", exact: true });
  await expect(existing).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("jars-media-browser.png") });
  await existing.click();
  const editor = modal.locator(".input-editor");
  await expect(modal.locator(".composer-attachments img")).toHaveAttribute("src", "http://localhost:8900/jars/trill/folder/photo%20%231%3F.png");
  await modal.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await editor.fill("");
  await pasteJarsImage(page, editor);
  await expect(modal.locator(".composer-attachments img")).toHaveAttribute("src", /\/jars\/trill\/.+\.png$/);
  await expect(modal.locator(".composer-attachments img")).not.toHaveAttribute("src", /^blob:/);
  await expect(modal.getByRole("button", { name: "Broadcast", exact: true })).toBeEnabled();
  expect(jars.calls.filter(call => call.method === "PUT" && call.path.endsWith(".png"))).toHaveLength(1);
  expect(jars.calls.filter(call => call.method !== "GET" || /^\/jars\/trill\/?$/.test(call.path)).every(call => call.signed)).toBe(true);
  expect(jars.calls.find(call => call.method === "PUT" && call.path.endsWith(".png")).type).toBe("image/png");
  expect(jars.calls.filter(call => call.signed).every(call => call.proxied)).toBe(true);
  expect(storageReads).toEqual([]);
  expect(await modal.locator(".composer-attachments img").getAttribute("src")).not.toContain("X-Amz-");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("jars-upload-mobile.png") });
  jars.failUploads();
  await pasteJarsImage(page, editor);
  await expect(page.getByText(/Upload failed:/)).toBeVisible();
  await expect(modal.locator(".composer-attachments img")).toHaveCount(1);
  const uploadedUrl = await modal.locator(".composer-attachments img").getAttribute("src");
  await modal.getByRole("button", { name: "Broadcast", exact: true }).click();
  await expect.poll(() => pokeLog.find(poke => poke.post?.add)?.post.add.content).toContain(uploadedUrl);
  expect(pokeLog.find(poke => poke.post?.add).post.add.content).not.toContain("blob:");
});

test("Jars preserves an existing bucket and reports setup failure with retry", async ({ page }) => {
  let jars = await installJarsMock(page, { headStatus: 403 });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.locator("#compose-modal").getByTitle("Add image", { exact: true }).click();
  const browser = page.locator("#s3-browser");
  await expect(browser.getByText(/Couldn’t prepare media storage/)).toBeVisible();
  expect(jars.calls.some(call => call.method === "PUT")).toBe(false);
  jars = await installJarsMock(page, { exists: true });
  await browser.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(browser.getByRole("button", { name: "Choose folder/photo #1?.png", exact: true })).toBeVisible();
  expect(jars.calls.some(call => call.method === "PUT")).toBe(false);
});

test("missing Jars leaves the composer usable and explains unavailable media", async ({ page }, testInfo) => {
  const jarRequests = [];
  page.on("request", request => { if (request.url().includes("/jars/")) jarRequests.push(request.url()); });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.locator("#compose-modal").getByTitle("Add image", { exact: true }).click();
  await expect(page.locator("#s3-browser").getByText("Media storage is unavailable on this ship.", { exact: true })).toBeVisible();
  await expect(page.locator("#s3-browser").getByRole("button", { name: "Upload image", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("jars-unavailable.png") });
  expect(jarRequests).toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator("#compose-modal .input-editor").fill("Text posts still work");
  await expect(page.locator("#compose-modal").getByRole("button", { name: "Broadcast", exact: true })).toBeEnabled();
});

test("Jars bucket creation and invalid configuration failures do not enable uploads", async ({ page }) => {
  const jars = await installJarsMock(page, { createStatus: 403 });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.locator("#compose-modal").getByTitle("Add image", { exact: true }).click();
  const browser = page.locator("#s3-browser");
  await expect(browser.getByText("Couldn’t prepare media storage.", { exact: true })).toBeVisible();
  expect(jars.calls.map(call => call.method)).toEqual(["HEAD", "PUT"]);
  const before = jars.calls.length;
  await page.route("**/~/scry/s3-server/config.json", route => route.fulfill({ status: 200, json: {} }));
  await browser.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(browser.getByText("Couldn’t prepare media storage.", { exact: true })).toBeVisible();
  expect(jars.calls).toHaveLength(before);
});

test("the media picker uploads an image file and inserts it into the composer", async ({ page }, testInfo) => {
  const jars = await installJarsMock(page, { exists: true });
  let release;
  const uploadReady = new Promise(resolve => { release = resolve; });
  await page.route(/\/jars\/trill\/[^/?]+\.png\?/, async route => {
    if (route.request().method() === "PUT") await uploadReady;
    await route.fallback();
  });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  await modal.getByTitle("Add image", { exact: true }).click();
  const browser = page.locator("#s3-browser");
  const upload = browser.getByRole("button", { name: "Upload image", exact: true });
  await expect(upload).toBeEnabled();
  const chooserEvent = page.waitForEvent("filechooser");
  await upload.click();
  const chooser = await chooserEvent;
  await chooser.setFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII=", "base64") });
  await expect(browser.getByRole("status")).toContainText("Uploading photo.png…");
  await expect(upload).toBeDisabled();
  await expect(browser.getByRole("button", { name: "Choose folder/photo #1?.png", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("image-file-upload-progress.png") });
  release();
  await expect(browser).toHaveCount(0);
  const image = modal.locator(".composer-attachments img");
  await expect(image).toHaveAttribute("src", /^http:\/\/localhost:8900\/jars\/trill\/.+\.png$/);
  await expect(modal.getByRole("button", { name: "Broadcast", exact: true })).toBeEnabled();
  const url = await image.getAttribute("src");
  expect(jars.calls.filter(call => call.method === "PUT")).toHaveLength(1);
  await modal.getByTitle("Add image", { exact: true }).click();
  await expect(browser.getByRole("button", { name: `Choose ${url.split("/").at(-1)}`, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("image-file-upload-picker-mobile.png") });
});

test("file uploads reject non-images, preserve drafts on failure and allow retrying the same file", async ({ page }) => {
  const jars = await installJarsMock(page, { exists: true });
  jars.failUploads();
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  const editor = modal.locator(".input-editor");
  await editor.fill("Keep this draft");
  await modal.getByTitle("Add image", { exact: true }).click();
  const browser = page.locator("#s3-browser");
  const input = browser.locator('input[type="file"]');
  await expect(browser.getByRole("button", { name: "Upload image", exact: true })).toBeEnabled();
  await input.setInputFiles({ name: "text.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await expect(browser.getByRole("alert")).toHaveText("Choose an image file.");
  expect(jars.calls.filter(call => call.method === "PUT")).toHaveLength(0);
  const file = { name: "same-photo.png", mimeType: "image/png", buffer: Buffer.from("fixture image") };
  await input.setInputFiles(file);
  await expect(browser.getByRole("alert")).toHaveText("Couldn’t upload same-photo.png. Try again.");
  await expect(editor).toHaveText("Keep this draft");
  await expect(modal.locator(".composer-attachments img")).toHaveCount(0);
  jars.allowUploads();
  await input.setInputFiles(file);
  await expect(browser).toHaveCount(0);
  await expect(editor).toContainText("Keep this draft");
  await expect(modal.locator(".composer-attachments img")).toHaveCount(1);
});

test("composer attachments stay below editable text and survive failed publication", async ({ page }, testInfo) => {
  await installJarsMock(page, { exists: true });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  const editor = modal.locator(".input-editor");
  await editor.fill("Text before pictures");
  await editor.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); range.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(range);
  });
  await modal.getByTitle("Add image", { exact: true }).click();
  await page.getByRole("button", { name: "Choose folder/photo #1?.png", exact: true }).click();
  await expect(editor).toHaveText("Text before pictures");
  await expect(editor.locator("img")).toHaveCount(0);
  const attachments = modal.getByRole("group", { name: "Attached images", exact: true });
  await expect(attachments.locator("img")).toHaveCount(1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const inputBounds = await editor.boundingBox();
    const imageBounds = await attachments.boundingBox();
    expect(imageBounds.y).toBeGreaterThanOrEqual(inputBounds.y + inputBounds.height);
    expect(imageBounds.x + imageBounds.width).toBeLessThanOrEqual(width);
    const submitBounds = await modal.getByRole("button", { name: "Broadcast", exact: true }).boundingBox();
    expect(submitBounds.x + submitBounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`composer-attachments-${width}.png`) });
  }
  await editor.press("Control+End");
  await editor.pressSequentially(" and more text");
  await expect(editor).toHaveText("Text before pictures and more text");
  nackPokes = true;
  await modal.getByRole("button", { name: "Broadcast", exact: true }).click();
  await expect(page.getByText("Failed to post", { exact: true })).toBeVisible();
  await expect(attachments.locator("img")).toHaveCount(1);
  await expect(editor).toHaveText("Text before pictures and more text");
  const submitted = pokeLog.find(poke => poke.post?.add).post.add.content;
  expect(submitted).toBe("Text before pictures and more text\n\n![](http://localhost:8900/jars/trill/folder/photo%20%231%3F.png)");
  await attachments.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await expect(attachments).toHaveCount(0);
  await expect(editor).toHaveText("Text before pictures and more text");
  await page.goto("f");
  const inline = page.locator("#composer");
  await inline.getByTitle("Add image", { exact: true }).click();
  await page.getByRole("button", { name: "Choose folder/photo #1?.png", exact: true }).click();
  const inlineEditor = await inline.locator(".input-editor").boundingBox();
  const inlineImages = await inline.locator(".composer-attachments").boundingBox();
  expect(inlineImages.y).toBeGreaterThanOrEqual(inlineEditor.y + inlineEditor.height);
  await expect(inline.getByRole("button", { name: "Post", exact: true })).toBeEnabled();
  await inline.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await expect(inline.getByRole("button", { name: "Post", exact: true })).toBeDisabled();
});

test("pasted attachments show upload progress below text and prevent premature publication", async ({ page }) => {
  await installJarsMock(page, { exists: true });
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route(/\/jars\/trill\/[^/?]+\.png\?/, async route => {
    if (route.request().method() === "PUT") await ready;
    await route.fallback();
  });
  await page.goto("f");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const modal = page.locator("#compose-modal");
  const editor = modal.locator(".input-editor");
  await editor.fill("Caption");
  await pasteJarsImage(page, editor);
  const attachments = modal.getByRole("group", { name: "Attached images", exact: true });
  await expect(attachments.getByRole("status")).toHaveText("Uploading…");
  await expect(editor.locator("img")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Broadcast", exact: true })).toBeDisabled();
  await editor.press("Control+Enter");
  expect(pokeLog.some(poke => poke.post?.add)).toBe(false);
  release();
  await expect(attachments.getByRole("status")).toHaveCount(0);
  await expect(attachments.locator("img")).not.toHaveAttribute("src", /^blob:/);
  await expect(modal.getByRole("button", { name: "Broadcast", exact: true })).toBeEnabled();
});

// Tlon browser scenarios mock real Airlock endpoints and stream facts.
test("Tlon group history, live messages and pagination keep exact IDs", async ({ page }, testInfo) => {
  dmInboxFixtureKind = "group";
  await page.goto("dms");
  await expect(page.getByText("Team chat")).toBeVisible();
  await expect(page.getByText("Declined group")).toHaveCount(0);
  await page.getByRole("button", { name: "Open conversation with Team chat" }).click();
  await expect(page.locator("#dm-thread")).toContainText("group hello");
  await expect(page.locator(".dm-message-author")).toHaveText("~nec");
  await page.getByRole("button", { name: "Load older messages" }).click();
  await expect(page.locator("#dm-thread")).toContainText("older group message");
  expect(tlonHistoryRequests).toContain(`/v4/club/${TLON_CLUB}/writs/older/${tlonTime(TLON_TIME)}/50/heavy`);
  await page.getByRole("button", { name: "Conversation options" }).click();
  await expect(page.getByRole("menuitem", { name: "Block", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Mute", exact: true }).click();
  await expect.poll(() => tlonActions.find((action) => action.mark === "activity-action-2")?.json.adjust.source).toEqual({ dm: { club: TLON_CLUB } });
  await page.locator(".dm-peer-button").click();
  await expect(page.getByRole("region", { name: "Group members" })).toContainText("~bud");
  const editor = page.locator(".dm-composer textarea");
  await editor.fill("group outgoing");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(editor).toHaveValue("");
  await expect(page.locator("#dm-thread").getByText("group outgoing", { exact: true })).toHaveCount(1);
  const action = tlonActions.find((action) => action.mark === "chat-club-action-2");
  expect(action.app).toBe("chat"); expect(action.json.id).toBe(TLON_CLUB);
  expect(action.json.diff.delta.writ.id).toMatch(/^~zod\/\d{1,3}(\.\d{3})+$/);
  expect(action.json.diff.delta.writ.delta.add.essay.content).toEqual([{ inline: ["group outgoing"] }]);
  const incoming = tlonWrit("~bud", "live from another member", 3);
  tlonEvents.push({ path: "/v4", json: { whom: TLON_CLUB, id: incoming.seal.id, response: { add: { essay: incoming.essay, time: incoming.seal.time, seq: 3 } } } });
  await expect(page.locator("#dm-thread")).toContainText("live from another member");
  await page.screenshot({ path: testInfo.outputPath("tlon-group-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor).toBeVisible();
  const editorBounds = await editor.boundingBox();
  const navBounds = await page.locator(".left-rail").boundingBox();
  expect(editorBounds.y + editorBounds.height).toBeLessThanOrEqual(navBounds.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tlon-group-mobile.png"), fullPage: true });
});

test("Tlon rejected sends retain drafts and retry the same message ID", async ({ page }, testInfo) => {
  await page.goto("dms/~nec");
  const editor = page.locator(".dm-composer textarea");
  await expect(editor).toBeEnabled();
  nackPokes = true;
  await editor.fill("do not lose me");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".dm-delivery-status.failed")).toBeVisible();
  await expect(editor).toHaveValue("do not lose me");
  const first = tlonActions.find((action) => action.mark === "chat-dm-action-2");
  nackPokes = false;
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(editor).toHaveValue("");
  await expect(page.locator("#dm-thread").getByText("do not lose me", { exact: true })).toHaveCount(1);
  const sends = tlonActions.filter((action) => action.mark === "chat-dm-action-2");
  expect(sends).toHaveLength(2); expect(sends[1].json.diff.id).toBe(first.json.diff.id);
  await expect(page.locator(".dm-delivery-status.failed")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("tlon-direct-retry.png"), fullPage: true });
});

test("Tlon multi-person creation uses club IDs and member invitations", async ({ page }) => {
  await page.goto("dms");
  await page.getByRole("button", { name: "New message", exact: true }).first().click();
  await page.getByLabel("Message several people").check();
  const search = page.getByPlaceholder("Search people or paste a ~ship...");
  await search.fill("~nec"); await page.getByRole("button", { name: /Add this person/ }).click();
  await expect(page.getByRole("button", { name: "Create group" })).toBeDisabled();
  await search.fill("~bud"); await page.getByRole("button", { name: /Add this person/ }).click();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/dms\/0v/);
  const create = tlonActions.find((action) => action.mark === "chat-club-create");
  expect(create.json.hive).toEqual(["~nec", "~bud"]);
  expect(create.json.id).toMatch(/^0v[0-9a-v]+(?:\.[0-9a-v]{5})*$/);
  await expect(page.locator("#dm-thread")).toBeVisible();
  await page.locator(".dm-composer textarea").fill("new group hello");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => tlonActions.find((action) => action.mark === "chat-club-action-2")?.json.id).toBe(create.json.id);
});

test("Tlon drafts stay in their conversation across route changes", async ({ page }) => {
  await page.goto("dms/~nec");
  await page.locator(".dm-composer textarea").fill("nec draft");
  await page.getByRole("button", { name: "Back to messages" }).click();
  await page.getByRole("button", { name: "New message", exact: true }).first().click();
  await page.getByPlaceholder("Search people or paste a ~ship...").fill("~bud");
  await page.getByRole("button", { name: /Message this address/ }).click();
  await expect(page.locator(".dm-composer textarea")).toHaveValue("");
  await page.locator(".dm-composer textarea").fill("bud draft");
  await page.getByRole("button", { name: "Back to messages" }).click();
  await page.getByRole("button", { name: /Open conversation with .*nec/ }).click();
  await expect(page.locator(".dm-composer textarea")).toHaveValue("nec draft");
  expect(tlonActions.filter((action) => action.mark === "chat-dm-action-2")).toHaveLength(0);
});

test("Tlon unavailable errors do not block Trill startup and can reconnect", async ({ page }, testInfo) => {
  tlonUnavailable = true;
  await page.goto("dms");
  await expect(page.getByRole("heading", { name: "Chat unavailable" })).toBeVisible();
  await expect(page.locator("#left-nav")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tlon-unavailable.png"), fullPage: true });
  tlonUnavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("No messages yet")).toBeVisible();
  await expect.poll(() => [...tlonSubscriptions.values()].sort()).toEqual(["/dm/invited", "/unreads", "/v4"]);
});

test("Tlon rich stories render safely and search finds loaded messages", async ({ page }) => {
  dmInboxFixtureKind = "statuses";
  const message = tlonWrit("~litzod", "", 4);
  message.essay.content = [{ inline: ["rich ", { bold: ["message"] }, { link: { href: "javascript:alert(1)", content: "unsafe" } }] }, { block: { code: { code: "<script>alert(1)</script>", lang: "html" } } }];
  tlonSent.set("~litzod", [message]);
  await page.goto("dms/~litzod");
  await expect(page.locator("#dm-thread strong")).toHaveText("message");
  await expect(page.locator("#dm-thread a[href^='javascript:']")).toHaveCount(0);
  await expect(page.locator("#dm-thread code")).toHaveText("<script>alert(1)</script>");
  await page.getByRole("button", { name: "Conversation options" }).click();
  await page.getByRole("menuitem", { name: "Search", exact: true }).click();
  await page.getByPlaceholder("Search this conversation").fill("rich message");
  await expect(page.locator(".dm-search-result")).toHaveCount(1);
  await page.locator(".dm-search-result").click();
  await expect(page.locator(".dm-message-row.highlighted")).toContainText("rich message");
});

test("Tlon live edits and deletes win over an in-flight history snapshot", async ({ page }) => {
  dmInboxFixtureKind = "statuses";
  const original = tlonWrit("~litzod", "old cached text");
  let release;
  let entered = false;
  await page.route("**/~/scry/chat/v4/dm/~litzod/writs/newest/50/heavy.json", async (route) => {
    entered = true;
    await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ status: 200, json: { writs: { [original.seal.time]: original }, older: null, newer: null, total: 1, newest: 0 } });
  });
  await page.goto("dms/~litzod");
  await expect.poll(() => entered).toBe(true);
  const edited = tlonWrit("~litzod", "edited while loading");
  tlonEvents.push({ path: "/v4", json: { whom: "~litzod", id: edited.seal.id, response: { add: { essay: edited.essay, time: edited.seal.time, seq: 1 } } } });
  await expect(page.locator("#dm-thread")).toContainText("edited while loading");
  release();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
  await expect(page.locator("#dm-thread")).not.toContainText("old cached text");
  tlonEvents.push({ path: "/v4", json: { whom: "~litzod", id: edited.seal.id, response: { del: null } } });
  await expect(page.locator("#dm-thread")).not.toContainText("edited while loading");
});

test("Tlon subscription kicks close companion watches and reconnect cleanly", async ({ page }) => {
  await page.goto("dms");
  await expect(page.getByText("No messages yet")).toBeVisible();
  tlonEvents.push({ path: "/v4", response: "quit", json: null });
  await expect(page.getByRole("heading", { name: "Chat unavailable" })).toBeVisible();
  await expect.poll(() => tlonSubscriptions.size).toBe(0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("No messages yet")).toBeVisible();
  await expect.poll(() => [...tlonSubscriptions.values()].sort()).toEqual(["/dm/invited", "/unreads", "/v4"]);
});

test("Tlon rejected invitations remain actionable", async ({ page }) => {
  dmInboxFixtureKind = "requests";
  await page.goto("dms");
  const row = page.locator(".dm-request-row", { hasText: "please accept" });
  await expect(row).toBeVisible();
  nackPokes = true;
  await row.getByRole("button", { name: /Accept request/ }).click();
  await expect(page.getByText("Chat action failed. Please try again.")).toBeVisible();
  await expect(row.getByRole("button", { name: /Accept request/ })).toBeEnabled();
  nackPokes = false;
  await row.getByRole("button", { name: /Accept request/ }).click();
  await expect(row).toBeHidden();
});

test("Tlon group invitations accept through membership actions", async ({ page }) => {
  tlonGroups["0vabc"] = { team: ["~nec", "~bud"], hive: ["~zod"], net: "invited", meta: { title: "Group invitation", description: "", image: "", cover: "" } };
  await page.goto("dms");
  const row = page.locator(".dm-request-row", { hasText: "Group invitation" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Accept request/ }).click();
  await expect(row).toBeHidden();
  const action = tlonActions.find((action) => action.mark === "chat-club-action-2");
  expect(action.json.id).toBe("0vabc");
  expect(action.json.diff.delta.team).toEqual({ ship: "~zod", ok: true });
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("button", { name: "Open conversation with Group invitation" }).click();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
});

test("Tlon channels directory shows chat channels with real unread counts", async ({ page }, testInfo) => {
  groupsFixture.enabled = true;
  await page.goto("groups");
  await expect(page.getByRole("heading", { name: "Garden", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /General/ })).toContainText("2");
  await expect(page.getByRole("link", { name: /Announcements/ })).toContainText("3");
  await expect(page.getByText("Notebook", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Links collection")).toHaveCount(0);
  await expect(page.getByText("Staff chat")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("channels-directory.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("channels-directory-mobile.png"), fullPage: true });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Garden", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("channels-directory-mobile-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: testInfo.outputPath("channels-directory-dark.png"), fullPage: true });
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Garden", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /General/ }).click();
  await expect(page.locator("#dm-thread")).toContainText("hello garden");
  await expect(page.locator("#screen-channel .dm-message-author")).toHaveText("~nec");
  await expect.poll(() => groupsFixture.actions.some((action) => action.json.channel.action.read === null)).toBe(true);
  await page.getByRole("button", { name: "Load older messages" }).click();
  await expect(page.locator("#dm-thread")).toContainText("older garden message");
  const cursor = (BigInt(CHANNEL_BASE) - 1n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  expect(groupsFixture.requests).toContain(`/v5/${GENERAL}/posts/older/${cursor}/50/post`);
  await page.locator(".dm-composer textarea").fill("hello from Trill channel");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".dm-composer textarea")).toHaveValue("");
  await expect(page.locator("#dm-thread").getByText("hello from Trill channel", { exact: true })).toHaveCount(1);
  const sent = groupsFixture.actions.find((action) => action.json.channel.action.post);
  expect(sent.mark).toBe("channel-action-2");
  expect(sent.json.channel.nest).toBe(GENERAL);
  expect(sent.json.channel.action.post.add).toMatchObject({ author: "~zod", content: [{ inline: ["hello from Trill channel"] }], kind: "/chat", meta: null, blob: null });
  await page.screenshot({ path: testInfo.outputPath("channel-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = await page.locator(".dm-composer textarea").boundingBox();
  const nav = await page.locator(".left-rail").boundingBox();
  expect(composer.y + composer.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("channel-mobile.png"), fullPage: true });
});

test("Tlon channels reject sends safely and deduplicate the host echo", async ({ page }) => {
  groupsFixture.enabled = true;
  await page.goto("groups/chat/~nec/general");
  const editor = page.locator(".dm-composer textarea");
  await expect(editor).toBeEnabled();
  nackPokes = true;
  await editor.fill("keep this channel draft");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(editor).toHaveValue("keep this channel draft");
  await expect(page.locator(".dm-delivery-status.failed")).toBeVisible();
  const first = groupsFixture.actions.find((action) => action.json.channel.action.post).json.channel.action.post.add;
  nackPokes = false;
  groupsFixture.pendingEcho = false;
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(editor).toHaveValue("");
  await expect(page.getByText("Waiting for channel host...")).toBeVisible();
  const sends = groupsFixture.actions.filter((action) => action.json.channel.action.post);
  expect(sends[1].json.channel.action.post.add.sent).toBe(first.sent);
  const message = groupsFixture.posts.get(GENERAL).at(-1);
  groupsFixture.events.push({ json: { nest: GENERAL, response: { post: { id: message.seal.id, "r-post": { set: message } } } } });
  await expect(page.getByText("Waiting for channel host...")).toHaveCount(0);
  await expect(page.locator("#dm-thread").getByText("keep this channel draft", { exact: true })).toHaveCount(1);
});

test("Tlon channels require joining and honor writer permissions", async ({ page }) => {
  groupsFixture.enabled = true;
  await page.goto("groups/chat/~nec/announcements");
  await expect(page.locator("#dm-thread")).toContainText("read-only news");
  await expect(page.locator(".dm-composer textarea")).toBeDisabled();
  await expect(page.getByText("You can read this channel, but cannot post here.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: /Optional/ }).click();
  await expect(page.getByRole("button", { name: "Join channel", exact: true })).toBeVisible();
  expect(groupsFixture.requests.some((path) => path.includes(`${OPTIONAL}/posts`))).toBe(false);
  nackPokes = true;
  await page.getByRole("button", { name: "Join channel", exact: true }).click();
  await expect(page.getByText("Could not join this channel. Please try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join channel", exact: true })).toBeEnabled();
  nackPokes = false;
  await page.getByRole("button", { name: "Join channel", exact: true }).click();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
  expect(groupsFixture.actions.find((action) => "join" in action.json.channel.action).json.channel).toEqual({ nest: OPTIONAL, action: { join: CHANNEL_GROUP } });
});

test("Tlon channels apply live edits, tombstones and lost access", async ({ page }) => {
  groupsFixture.enabled = true;
  await page.goto("groups/chat/~nec/general");
  await expect(page.locator("#dm-thread")).toContainText("hello garden");
  const edited = channelPost(CHANNEL_BASE, "garden edited");
  groupsFixture.events.push({ json: { nest: GENERAL, response: { post: { id: CHANNEL_BASE, "r-post": { set: edited } } } } });
  await expect(page.locator("#dm-thread")).toContainText("garden edited");
  groupsFixture.events.push({ json: { nest: GENERAL, response: { post: { id: CHANNEL_BASE, "r-post": { set: { type: "tombstone", id: CHANNEL_BASE, author: "~nec", seq: 1, "deleted-at": 1793945640000 } } } } } });
  await expect(page.locator("#dm-thread")).not.toContainText("garden edited");
  groupsFixture.groups[CHANNEL_GROUP].channels[GENERAL].readers = ["staff"];
  groupsFixture.events.push({ app: "groups", path: "/v3/groups", json: { flag: CHANNEL_GROUP, "r-group": { channel: { nest: GENERAL, "r-channel": { readers: ["staff"] } } } } });
  await expect(page.getByRole("heading", { name: "Channel unavailable" })).toBeVisible();
  await expect(page.locator(".dm-composer textarea")).toHaveCount(0);
});

test("Tlon channels retain drafts and use one set of watches across routes", async ({ page }) => {
  groupsFixture.enabled = true;
  await page.goto("groups/chat/~nec/general");
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
  await page.locator(".dm-composer textarea").fill("garden draft");
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: /Announcements/ }).click();
  await expect(page.locator(".dm-composer textarea")).toHaveValue("");
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: /General/ }).click();
  await expect(page.locator(".dm-composer textarea")).toHaveValue("garden draft");
  expect(groupsFixture.subscriptions.size).toBe(3);
});

test("Tlon channels failure and kicks leave direct messages usable", async ({ page }) => {
  groupsFixture.unavailable = true;
  await page.goto("groups");
  await expect(page.getByRole("heading", { name: "Groups unavailable" })).toBeVisible();
  groupsFixture.unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No groups yet" })).toBeVisible();
  await expect.poll(() => groupsFixture.subscriptions.size).toBe(3);
  groupsFixture.events.push({ response: "quit", json: null });
  await expect(page.getByRole("heading", { name: "Groups unavailable" })).toBeVisible();
  await expect.poll(() => groupsFixture.subscriptions.size).toBe(0);
  await page.locator("#left-nav").getByRole("link", { name: "Messages", exact: true }).click();
  await expect(page.getByText("No messages yet")).toBeVisible();
  expect([...tlonSubscriptions.values()].sort()).toEqual(["/dm/invited", "/unreads", "/v4"]);
});

test("Tlon channels permission reads survive unrelated unread updates", async ({ page }) => {
  groupsFixture.enabled = true;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered = false;
  await page.route("**/~/scry/channels/chat/~nec/general/perm.json", async (route) => {
    entered = true; await gate;
    await route.fulfill({ status: 200, json: { group: CHANNEL_GROUP, writers: [] } });
  });
  await page.goto("groups/chat/~nec/general");
  await expect.poll(() => entered).toBe(true);
  await expect(page.locator(".dm-composer textarea")).toBeDisabled();
  groupsFixture.events.push({ path: "/unreads", json: { nest: GENERAL, unread: { count: 900, unread: { id: CHANNEL_BASE, count: 4 }, threads: {}, recency: 1 } } });
  await expect(page.getByRole("link", { name: /Groups/ }).first()).toContainText("7");
  release();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
});

test("Tlon channels live edits and deletions win over stale history reads", async ({ page }) => {
  groupsFixture.enabled = true;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered = false;
  await page.route("**/~/scry/channels/v5/chat/~nec/general/posts/newest/50/post.json", async (route) => {
    entered = true; await gate;
    await route.fulfill({ status: 200, json: { posts: { [CHANNEL_BASE]: channelPost(CHANNEL_BASE, "stale garden text") }, older: null, newer: null, total: 1, newest: 1 } });
  });
  await page.goto("groups/chat/~nec/general");
  await expect.poll(() => entered).toBe(true);
  const edited = channelPost(CHANNEL_BASE, "newest garden edit");
  groupsFixture.events.push({ json: { nest: GENERAL, response: { post: { id: CHANNEL_BASE, "r-post": { set: edited } } } } });
  await expect(page.locator("#dm-thread")).toContainText("newest garden edit");
  groupsFixture.events.push({ json: { nest: GENERAL, response: { post: { id: CHANNEL_BASE, "r-post": { set: { type: "tombstone", id: CHANNEL_BASE } } } } } });
  await expect(page.locator("#dm-thread")).not.toContainText("newest garden edit");
  release();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
  await expect(page.locator("#dm-thread")).not.toContainText("stale garden text");
});

test("Tlon channels allow group admins into restricted chats", async ({ page }) => {
  groupsFixture.enabled = true;
  groupsFixture.groups[CHANNEL_GROUP].seats["~zod"].roles = ["admin"];
  groupsFixture.groups[CHANNEL_GROUP]["active-channels"].push(PRIVATE_CHANNEL);
  await page.goto("groups");
  await page.getByRole("link", { name: "Staff chat", exact: true }).click();
  await expect(page.locator(".dm-composer textarea")).toBeEnabled();
  expect(groupsFixture.requests).toContain(`/${PRIVATE_CHANNEL}/perm`);
});

test("Tlon channels late acknowledgements preserve edits made after navigation", async ({ page }) => {
  groupsFixture.enabled = true;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let captured = false;
  await page.route("**/~/channel/**", async (route) => {
    if (route.request().method() === "GET") {
      const held = pendingPokeAcks.filter((id) => groupsFixture.actions.some((action) => action.id === id && action.json.channel.action.post));
      if (held.length && !captured) { captured = true; await gate; }
    }
    return route.fallback();
  });
  await page.goto("groups/chat/~nec/general");
  await page.locator(".dm-composer textarea").fill("first draft");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => captured).toBe(true);
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: /General/ }).click();
  await page.locator(".dm-composer textarea").fill("a new draft while the old message is pending");
  release();
  await expect(page.locator("#dm-thread").getByText("first draft", { exact: true })).toHaveCount(1);
  await expect(page.locator(".dm-composer textarea")).toHaveValue("a new draft while the old message is pending");
});

test("Tlon group identity updates show imagery and fall back after image errors", async ({ page }, testInfo) => {
  groupsFixture.enabled = true;
  await page.route("https://images.example/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><rect width="600" height="160" fill="#165c4d"/><circle cx="440" cy="60" r="120" fill="#2d8a68"/></svg>' }));
  await page.goto("groups");
  await expect(page.getByRole("heading", { name: "Garden", exact: true })).toBeVisible();
  const meta = groupsFixture.groups[CHANNEL_GROUP].meta;
  meta.description = "A gathering place for people who grow things.";
  meta.image = "https://images.example/avatar.svg";
  meta.cover = "https://images.example/cover.svg";
  groupsFixture.events.push({ app: "groups", path: "/v3/groups", json: { flag: CHANNEL_GROUP, "r-group": { meta } } });
  await expect(page.locator(".chat-group-avatar img")).toHaveAttribute("src", meta.image);
  await expect(page.locator(".chat-group-cover > img")).toHaveAttribute("src", meta.cover);
  await expect(page.getByText(meta.description)).toBeVisible();
  await page.getByRole("link", { name: /General/ }).focus();
  await expect(page.getByRole("link", { name: /General/ })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("groups-custom-imagery-focus.png"), fullPage: true });
  await page.route("https://images.example/broken/**", (route) => route.fulfill({ status: 404, body: "missing image" }));
  meta.image = "https://images.example/broken/avatar.png";
  meta.cover = "https://images.example/broken/cover.png";
  groupsFixture.events.push({ app: "groups", path: "/v3/groups", json: { flag: CHANNEL_GROUP, "r-group": { meta } } });
  await expect(page.locator(".chat-group-avatar img")).toHaveCount(0);
  await expect(page.locator(".chat-group-cover > img")).toHaveCount(0);
  await expect(page.locator(".chat-group-avatar")).toHaveText("G");
  await expect(page.getByRole("link", { name: /General/ })).toBeVisible();
});

// The public fixture key signs relay frames; all events and ship endpoints
// below stay inside the mocked browser boundary.
function globalTrillFixture() {
  const { finalizeEvent } = require("nostr-tools");
  const key = new Uint8Array(32); key[31] = 2;
  const nativeId = "170141184508244624088857107891174244352";
  const make = (content, tags, kind = 667) => finalizeEvent({ kind, content, tags, created_at: 1793945640 }, key);
  const native = make("A Trill post from the discovery relay", [["patp", "~nec"], ["trill", nativeId]]);
  const legacy = make("An older Trill post", [["patp", "~bud"]]);
  return { nativeId, native, legacy, make };
}
async function mockGlobalRelay(page, events) {
  const frames = [];
  const sockets = [];
  let closed = 0;
  await page.routeWebSocket(/wss:\/\/nostr\.sortug\.com/, (ws) => {
    sockets.push(ws);
    ws.onClose(() => { closed++; });
    ws.onMessage((raw) => {
      const frame = JSON.parse(String(raw)); frames.push(frame);
      if (frame[0] !== "REQ") return;
      for (const event of events) ws.send(JSON.stringify(["EVENT", frame[1], event]));
      ws.send(JSON.stringify(["EOSE", frame[1]]));
    });
  });
  return { frames, sockets, get closed() { return closed; } };
}

test("global Trill posts use ship profiles and exact native references", async ({ page }, testInfo) => {
  feedFixtureKind = "state2"; state2Snapshot = state2Fixture();
  const { nativeId, native, legacy } = globalTrillFixture();
  const relay = await mockGlobalRelay(page, [native, legacy]);
  const peerReads = [];
  const node = { ...makeDmRequest("~nec", "Native friend", "Original native thread", 1793945640000).post, id: nativeId, hash: nativeId, children: {} };
  await page.route("**/spider/trill/json/beg/json.json", (route) => {
    peerReads.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, json: { thread: { id: nativeId, data: { msg: "", data: { node, thread: [node] } } } } });
  });
  await page.goto("f/global");
  const post = page.locator("#home-feed article.trill-post", { hasText: native.content });
  await expect(post).toBeVisible();
  await expect(post.locator("header .name")).toHaveText("Native friend");
  const old = page.locator("#home-feed article.trill-post", { hasText: legacy.content });
  await expect(old.locator("header .name")).toHaveText("~bud");
  expect(relay.frames.filter((frame) => frame[0] === "REQ")[0].slice(2)).toEqual([{ kinds: [667] }]);
  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "See details" }).click();
  await expect(page.locator(".post-details-modal")).toContainText(native.id);
  await expect(page.locator(".post-details-modal")).toContainText("wss://nostr.sortug.com");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Bookmark", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ lists: { bookmark: { add: true, ref: { urbit: { host: "~nec", id: nativeId } } } } });
  await post.locator(".reply-action").click();
  const editor = page.locator("#home-composer-prompt .input-editor");
  await editor.fill("A native reply from discovery");
  await page.locator("#home-composer-prompt").getByRole("button", { name: "Post", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ post: { reply: { content: "A native reply from discovery", host: "~nec", id: nativeId, thread: nativeId } } });
  await post.locator(".reaction-action").click();
  await page.locator("#react-list span", { hasText: "🫡" }).first().dispatchEvent("mouseup");
  await expect.poll(() => pokeLog).toContainEqual({ post: { reaction: { host: "~nec", id: nativeId, reaction: "🫡" } } });
  await expect(page.locator("#react-list")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("global-trill-identities.png"), fullPage: true });
  await post.getByText(native.content, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/t/u/~nec/${nativeId}$`));
  await expect(page.locator("#thread-root-post")).toContainText("Original native thread");
  expect(peerReads).toEqual([{ begs: { thread: { host: "~nec", id: nativeId } } }]);
  await page.screenshot({ path: testInfo.outputPath("global-trill-native-thread.png"), fullPage: true });
});

test("global Trill posts reject malformed identity tags and preserve same-second events", async ({ page }) => {
  const { native, legacy, make } = globalTrillFixture();
  const bad = [make("no ship tag", []), make("invalid ship tag", [["patp", "~not-a-ship"]]), make("conflicting ships", [["patp", "~nec"], ["patp", "~bud"]])];
  const relay = await mockGlobalRelay(page, [native, legacy, native, ...bad]);
  await page.goto("f/global");
  await expect(page.locator("#home-feed article.trill-post")).toHaveCount(2);
  await expect(page.getByText(native.content, { exact: true })).toBeVisible();
  await expect(page.getByText(legacy.content, { exact: true })).toBeVisible();
  await page.locator("#left-nav").getByRole("link", { name: "Wallet", exact: true }).click();
  await expect.poll(() => relay.closed).toBe(1);
});

test("ordinary Nostr notes cannot acquire Trill identities through patp tags", async ({ page }) => {
  feedFixtureKind = "state2"; state2Snapshot = state2Fixture();
  const { make } = globalTrillFixture();
  const note = make("A regular note with a ship claim", [["patp", "~nec"], ["trill", "170141184508244624088857107891174244352"]], 1);
  state2Snapshot.nostr.feeds.timeline["wss://one.example"].feed = [note];
  state2Snapshot.nostr.feeds.timeline["wss://two.example"].feed = [];
  await page.goto("f/nostr");
  const post = page.locator("#home-feed article.trill-post", { hasText: note.content });
  await expect(post).toBeVisible();
  await expect(post.locator("header .name")).not.toHaveText("Native friend");
  await expect(post.locator(".avatar svg.sigil")).toHaveCount(0);
  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Bookmark", exact: true }).click();
  await expect.poll(() => pokeLog).toContainEqual({ lists: { bookmark: { add: true, ref: { nostr: note.id } } } });
});

test("legacy global posts retain ship identity on relay-backed thread pages", async ({ page }) => {
  const { legacy } = globalTrillFixture();
  await mockGlobalRelay(page, [legacy]);
  await page.goto("f/global");
  const post = page.locator("#home-feed article.trill-post", { hasText: legacy.content });
  await expect(post.locator("header .name")).toHaveText("~bud");
  await post.getByText(legacy.content, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/t/n/${legacy.id}$`));
  await expect(page.locator("#thread-root-post")).toContainText("~bud");
});

for (const [label, data] of [["pending", "maybe"], ["denied", null]]) {
  test(`discovered native thread preserves ${label} access results`, async ({ page }, testInfo) => {
    const { native, nativeId } = globalTrillFixture();
    await mockGlobalRelay(page, [native]);
    await page.route("**/spider/trill/json/beg/json.json", (route) => route.fulfill({ status: 200, json: { thread: { id: nativeId, data: { msg: "Host policy", data } } } }));
    await page.goto("f/global");
    await page.getByText(native.content, { exact: true }).click();
    await expect(page.locator("#feed-proper")).toContainText(label === "pending" ? "reviewed manually" : "was denied");
    await expect(page.locator("#feed-proper .input-editor")).toHaveCount(0);
    await expect(page.locator("#feed-proper")).not.toContainText("Loading replies");
    await page.screenshot({ path: testInfo.outputPath(`global-thread-${label}.png`), fullPage: true });
  });
}

test("invalid native references keep Trill identity without guessing native IDs", async ({ page }) => {
  const { make } = globalTrillFixture();
  const event = make("Invalid native reference", [["patp", "~nec"], ["trill", "340282366920938463463374607431768211456"]]);
  await mockGlobalRelay(page, [event]);
  await page.goto("f/global");
  const post = page.locator("#home-feed article.trill-post", { hasText: event.content });
  await expect(post.locator("header .name")).toHaveText("~nec");
  await post.getByText(event.content, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/t/n/${event.id}$`));
});
