const { expect, test } = require("./playwright-runtime.cjs");

let dmInboxFixtureKind = "empty";
let notificationFixtureKind = "empty";
let feedFixtureKind = "empty";
let mockReconnectMs = 10;
let fixtureSnapshotsPending = true;
let walletSubscriptions = new Set();
let chatSubscriptions = new Set();
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
  await page.route("**/~/scry/storage/**", (route) =>
    route.fulfill({ status: 404, json: { error: "no storage" } }),
  );
  // keep app scries (nostr feeds, profiles...) off any live ship;
  // later registrations win, so the gwid mock below shadows this default
  await page.route("**/~/scry/nostrill/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
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
      ) + walletFixtureBody() + takePokeAcks() + ": heartbeat\n\n",
    });
    fixtureSnapshotsPending = false;
    return;
  }

  // PUT: a batch of channel actions; remember pokes so they get acked
  try {
    const actions = JSON.parse(request.postData() || "[]");
    for (const action of actions) {
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
      if (action.action !== "poke") continue;
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
  await page.getByPlaceholder("Search people or paste a ~ship / npub...").fill("~litzod");
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
  post: { reaction: { reaction, id: "zap-post", host: { urbit: "~litzod" } } },
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
  // users go over the wire as { urbit: "~ship" }: the backend drops the
  // full UrbitID object the UI works with
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
      post: { "del-reaction": { host: { urbit: "~litzod" }, id: "zap-post" } },
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
  await expect(page.getByRole("heading", { name: "Bookmarks" })).toBeVisible();
  await expect(page.getByText("A post ready for a zap")).toBeVisible();

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
