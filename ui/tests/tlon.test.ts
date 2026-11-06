// Contract failures enumerated before implementation:
// - confusing %groups desk with %chat agent, or mixing protocol versions;
// - dropping empty/invited/archived clubs absent from heads;
// - interpreting total messages as unread count;
// - rounding Urbit time/message IDs through Number;
// - rendering tombstones as messages or losing rich story content;
// - using a member's ship as a group conversation ID;
// - resolving mutations on HTTP completion instead of Gall acknowledgement;
// - leaking subscriptions after partial setup, cleanup, or a kick;
// - treating missing/malformed backend data as a successfully empty inbox.
import { describe, expect, test } from "bun:test";
import { TlonChatClient, type TlonTransport } from "../src/logic/tlon/client";

const time = "170141184508244403760301876757575761920";
const hoonTime = "170.141.184.508.244.403.760.301.876.757.575.761.920";
const messageId = `~nec/${hoonTime}`;
const story = [{ inline: ["hello ", { bold: ["world"] }] }];
const writ = {
  type: "post",
  seal: { id: messageId, time, seq: 1, reacts: {}, replies: {}, meta: {} },
  essay: { author: "~nec", sent: 1793930000000, content: story, kind: "/chat", meta: null, blob: null },
};

function fixture(overrides: Record<string, unknown> = {}) {
  const reads: Record<string, unknown> = {
    "/v4/heads": [{ whom: "~nec", recency: 1793930000000, latest: writ }],
    "/clubs": { "0vabc": { team: ["~zod", "~nec"], hive: ["~bud"], meta: { title: "Our plans", description: "", image: "", cover: "" }, net: "invited" } },
    "/dm": ["~nec", "~bud"],
    "/dm/invited": ["~litzod"],
    "/dm/archive": ["~bud"],
    "/blocked": ["~litzod"],
    "/unreads": { "~nec": { count: 50, unread: { id: messageId, time, count: 2 }, threads: {} } },
    [`/v4/dm/~nec/writs/newest/50/heavy`]: { writs: { [time]: writ, "170141184508244403760301876757575761921": { type: "tombstone", id: "~nec/2" } }, older: time, newer: null, newest: 2, total: 2 },
    ...overrides,
  };
  const pokes: any[] = [];
  const subscriptions: any[] = [];
  const removed: number[] = [];
  let failSubscription = 0;
  const transport: TlonTransport = {
    scry: async ({ app, path }) => {
      expect(app).toBe("chat");
      if (!(path in reads)) throw new Error(`missing fixture ${path}`);
      return reads[path];
    },
    poke: async (request) => { pokes.push(request); return pokes.length; },
    subscribe: async (request) => {
      subscriptions.push(request);
      if (subscriptions.length === failSubscription) throw new Error("watch rejected");
      return subscriptions.length;
    },
    unsubscribe: async (id) => { removed.push(id); },
  };
  return { client: new TlonChatClient(transport, "~zod"), pokes, subscriptions, removed, failAt: (n: number) => { failSubscription = n; } };
}

describe("Tlon DM transport", () => {
  test("combines heads, empty DMs, invites and club metadata", async () => {
    const { client } = fixture();
    const inbox = await client.loadInbox();
    expect(inbox.conversations.get("~nec")?.unread).toBe(2);
    expect(inbox.conversations.get("~bud")?.archived).toBe(true);
    expect(inbox.conversations.get("~litzod")?.invited).toBe(true);
    expect(inbox.conversations.get("~litzod")?.blocked).toBe(true);
    expect(inbox.conversations.get("0vabc")).toMatchObject({ kind: "group", title: "Our plans", invited: true, members: ["~zod", "~nec"], invitedMembers: ["~bud"] });
    expect(inbox.conversations.get("~nec")?.latest?.id).toBe(messageId);
  });

  test("preserves exact cursors and content while skipping deleted posts", async () => {
    const { client } = fixture();
    const page = await client.loadMessages("~nec");
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]).toMatchObject({ id: messageId, time, author: "~nec", content: story });
    expect(page.older).toBe(time);
  });

  test("uses club routes and validates cursor/page limits", async () => {
    const { client } = fixture({ [`/v4/club/0vabc/writs/older/${hoonTime}/25/heavy`]: { writs: {}, older: null, newer: null, newest: 0, total: 0 } });
    expect((await client.loadMessages("0vabc", { older: time, count: 25 })).messages).toEqual([]);
    await expect(client.loadMessages("~nec/../../other")).rejects.toThrow();
    await expect(client.loadMessages("~nec", { count: 10000 })).rejects.toThrow();
    await expect(client.loadMessages("~nec", { older: "1.234" })).rejects.toThrow();
  });

  test("does not turn malformed or unavailable snapshots into an empty success", async () => {
    await expect(fixture({ "/v4/heads": {} }).client.loadInbox()).rejects.toThrow();
    await expect(fixture({ "/clubs": null }).client.loadInbox()).rejects.toThrow();
  });

  test("normalizes rich authors without rewriting IDs", async () => {
    const { client } = fixture({ "/v4/heads": [{ whom: "~nec", recency: 1, latest: { ...writ, essay: { ...writ.essay, author: { ship: "~nec", nickname: "Friend", avatar: null } } } }] });
    expect((await client.loadInbox()).conversations.get("~nec")?.latest?.author).toBe("~nec");
  });

  test("waits for ack and surfaces nacks", async () => {
    const { client, pokes } = fixture();
    let settled = false;
    const request = client.markRead("0vabc").then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(pokes[0]).toMatchObject({ app: "chat", mark: "chat-remark-action", json: { whom: "0vabc", diff: { read: null } } });
    pokes[0].onSuccess();
    await request;
    const rejected = client.respondToInvite("~nec", false);
    pokes[1].onError("denied");
    await expect(rejected).rejects.toThrow("denied");
  });

  test("encodes direct and group messages through distinct action marks", async () => {
    const { client, pokes } = fixture();
    const draft = { id: `~zod/${time}`, sent: 1793930000000, content: story };
    const direct = client.sendMessage("~nec", draft);
    expect(pokes[0]).toMatchObject({ mark: "chat-dm-action-2", json: { ship: "~nec", diff: { id: `~zod/${hoonTime}`, delta: { add: { time: null, essay: { author: "~zod", content: story, kind: "/chat", meta: null, blob: null } } } } } });
    pokes[0].onSuccess();
    await direct;
    const group = client.sendMessage("0vabc", draft, "0v123");
    expect(pokes[1]).toMatchObject({ mark: "chat-club-action-2", json: { id: "0vabc", diff: { uid: "0v123", delta: { writ: { id: `~zod/${hoonTime}` } } } } });
    pokes[1].onSuccess();
    await group;
  });

  test("creates groups without inviting ourselves twice", async () => {
    const { client, pokes } = fixture();
    const creating = client.createGroup("0vabc", ["~zod", "~nec", "~nec", "~bud"]);
    expect(pokes[0]).toMatchObject({ mark: "chat-club-create", json: { id: "0vabc", hive: ["~nec", "~bud"] } });
    pokes[0].onSuccess();
    await creating;
  });

  test("cleans up partial subscriptions and ignores late events", async () => {
    const failed = fixture();
    failed.failAt(2);
    await expect(failed.client.subscribe(() => {})).rejects.toThrow();
    expect(failed.removed).toEqual([1]);
    const { client, subscriptions, removed } = fixture();
    const events: unknown[] = [];
    const stop = await client.subscribe((event) => { events.push(event); });
    subscriptions[0].event({ ship: "~nec", net: "done" });
    expect(events).toEqual([{ type: "chat", data: { ship: "~nec", net: "done" } }]);
    await stop();
    await stop();
    expect(removed).toEqual([1, 2, 3]);
    subscriptions[0].event({ ship: "~nec", net: null });
    expect(events).toHaveLength(1);
  });
});
