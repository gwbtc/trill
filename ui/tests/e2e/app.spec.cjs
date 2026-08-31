const { expect, test } = require("./playwright-runtime.cjs");

let dmInboxFixtureKind = "empty";
let notificationFixtureKind = "empty";
let feedFixtureKind = "empty";
let channelBatch = 0;

async function installUrbitMock(page) {
  await page.addInitScript(() => {
    localStorage.setItem("nostrill-welcome-shown", "true");
  });

  await page.route("http://localhost:8080/~/host", (route) =>
    route.fulfill({ status: 200, body: "~zod" }),
  );
  await page.route("http://localhost:8080/~/name", (route) =>
    route.fulfill({ status: 200, body: "~zod" }),
  );
  await page.route("http://localhost:8080/~/scry/n-contacts/all.json", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route(
    "http://localhost:8080/~/scry/settings/desk/nostrill.json",
    (route) => route.fulfill({ status: 200, json: { desk: {} } }),
  );
  await page.route(
    "http://localhost:8080/~/scry/hark/desk/nostrill/skeins.json",
    (route) => route.fulfill({ status: 200, json: notificationFixture() }),
  );
  await page.route(
    "http://localhost:8080/~/scry/noschat/**",
    (route) => route.fulfill({ status: 200, json: dmInboxFixture() }),
  );
  await page.route("http://localhost:8080/~/scry/storage/**", (route) =>
    route.fulfill({ status: 404, json: { error: "no storage" } }),
  );
  // keep app scries (nostr feeds, profiles...) off any live ship;
  // later registrations win, so the gwid mock below shadows this default
  await page.route("http://localhost:8080/~/scry/nostrill/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route("http://localhost:8080/~/scry/nostrill/j/gwid/**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        english: { nym: "zod", abridged: "zod", foreshortened: "zod" },
        hanzi: { nym: "", abridged: "", foreshortened: "" },
      },
    }),
  );
  await page.route("http://localhost:8080/~/channel/**", handleChannel);
}

async function handleChannel(route) {
  const request = route.request();
  if (request.method() === "GET") {
    channelBatch += 1;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body:
        feedFixtureKind === "zap"
          ? zapFeedFixtureBody(channelBatch)
          : dmInboxFixtureKind === "requests"
            ? dmRequestFixtureBody()
            : [
                'id: 1\ndata: {"response":"poke","id":1,"ok":null}\n\n',
                'id: 2\ndata: {"response":"poke","id":2,"ok":null}\n\n',
              ].join(""),
    });
    return;
  }

  await route.fulfill({ status: 200, body: "ok" });
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
  return [
    `id: 1\ndata: ${JSON.stringify({
      response: "diff",
      id: 1,
      json: {
        init: dmInboxFixture(),
      },
    })}\n\n`,
  ].join("");
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

function zapFeedFixtureBody(batch) {
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
    contents: [{ paragraph: [{ text: "A post ready for a zap" }] }],
    time: 1_700_000_000_000,
    children: [],
    engagement: { reacts: {}, quoted: [], shared: [] },
  };
  const feed = { start: null, end: null, feed: { [post.id]: post } };
  const state = {
    relays: {},
    feed: { start: null, end: null, feed: {} },
    nostr: {},
    profiles: { "~litzod": { name: "wicket" } },
    following: { "~litzod": feed },
    timeline: { global: {}, start: null, end: null },
    followGraph: {},
    key: "",
  };
  const outerId = batch * 100;
  return [
    `id: ${outerId + 1}\ndata: {"response":"poke","id":1,"ok":null}\n\n`,
    ...[2, 3, 4, 5, 6, 7, 8].map(
      (subscriptionId, index) =>
        `id: ${outerId + index + 2}\ndata: ${JSON.stringify({
          response: "diff",
          id: subscriptionId,
          json: { state },
        })}\n\n`,
    ),
  ].join("");
}

test.beforeEach(async ({ page }) => {
  dmInboxFixtureKind = "empty";
  notificationFixtureKind = "empty";
  feedFixtureKind = "empty";
  channelBatch = 0;
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
  await expect(page.getByRole("heading", { name: "Trending channels" })).toBeVisible();

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
  await expect(page.getByRole("tab", { name: "Channels" })).toBeVisible();

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
  await page.getByRole("button", { name: "Generate invoice" }).click();
  await expect(page.locator(".wallet-invoice-preview code")).toContainText("lnbc5000");
  await page.getByRole("button", { name: "Close wallet dialog" }).click();

  await page.getByRole("button", { name: "Wallet settings" }).click();
  await page.getByRole("switch", { name: "Hide balance" }).click();
  await page.getByRole("button", { name: "Close wallet dialog" }).click();
  await expect(page.locator(".wallet-total")).toHaveClass(/hidden/);

  await page.getByRole("button", { name: "Send" }).click();
  await page.getByLabel("Invoice or Cashu token").fill("cashuAeyJ0b2tlbiI6W10");
  await expect(page.getByText("Cashu token", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Redeem token" })).toBeEnabled();
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
  await expect(page.getByText("Amount exceeds your Lightning balance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zap 13,000 sats" })).toBeDisabled();

  await amount.fill("750");
  await page.getByLabel("Comment").fill("great post");
  await page.getByRole("button", { name: "Zap 750 sats" }).click();
  await expect(page.getByRole("button", { name: "Sending zap…" })).toBeDisabled();
  await expect(page.getByText("Zapped 750 sats")).toBeVisible();
  await expect(page.getByText("Sent to wicket via Lightning")).toBeVisible();

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
