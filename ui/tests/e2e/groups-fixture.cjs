// Mocked %groups/%channels boundary. Deliberately includes unsupported kinds,
// restricted and read-only channels, unjoined channels and large exact IDs.
const BASE = "170141184508244624088857107891174244352";
const HOST = "~nec";
const GROUP = "~nec/garden";
const GENERAL = "chat/~nec/general";
const ANNOUNCEMENTS = "chat/~nec/announcements";
const OPTIONAL = "chat/~nec/optional";
const PRIVATE = "chat/~nec/private";
function post(id, text, author = HOST, sent = 1793945640000) {
  return { type: "post", revision: "0", seal: { id, seq: 1, "mod-at": id, replies: {}, reacts: {}, meta: { replyCount: 0, lastReply: null, lastRepliers: [] } }, essay: { content: [{ inline: [text] }], author, sent, kind: "/chat", meta: null, blob: null } };
}
function meta(title) { return { title, description: "", image: "", cover: "" }; }
function createGroupsFixture() {
  const group = {
    meta: meta("Garden"), seats: { "~zod": { joined: 1, roles: [] }, "~nec": { joined: 1, roles: ["admin"] } }, admins: ["admin"],
    admissions: { banned: { ships: [], ranks: [] }, privacy: "private", invited: {}, pending: {}, requests: {}, tokens: {} }, roles: { admin: meta("Admin"), staff: meta("Staff") },
    channels: Object.fromEntries([[GENERAL, "General", []], [ANNOUNCEMENTS, "Announcements", []], [OPTIONAL, "Optional", []], [PRIVATE, "Staff chat", ["staff"]], ["diary/~nec/notebook", "Notebook", []], ["heap/~nec/links", "Links collection", []]].map(([id, title, readers]) => [id, { added: 1, readers, join: false, section: "main", meta: meta(title) }])),
    "active-channels": [GENERAL, ANNOUNCEMENTS], sections: { main: { meta: meta("Chat"), order: [GENERAL, ANNOUNCEMENTS, OPTIONAL, PRIVATE, "diary/~nec/notebook"] } }, "section-order": ["main"], "flagged-content": {}, blob: null,
  };
  const fixture = {
    enabled: false, unavailable: false, groups: { [GROUP]: group }, events: [], subscriptions: new Map(), actions: [], requests: [], posts: new Map([[GENERAL, [post(BASE, "hello garden")]], [ANNOUNCEMENTS, [post(BASE, "read-only news")]], [OPTIONAL, []]]),
    pendingEcho: true, eventId: 800000,
    async install(page) {
      await page.route("**/~/scry/groups/**", async (route) => {
        fixture.requests.push(new URL(route.request().url()).pathname);
        if (fixture.unavailable) return route.fulfill({ status: 404, body: "groups unavailable" });
        return route.fulfill({ status: 200, json: fixture.enabled ? fixture.groups : {} });
      });
      await page.route("**/~/scry/channels/**", async (route) => {
        const path = decodeURIComponent(new URL(route.request().url()).pathname.split("/scry/channels")[1]).replace(/\.json$/, "");
        fixture.requests.push(path);
        if (fixture.unavailable) return route.fulfill({ status: 404, body: "channels unavailable" });
        if (path === "/unreads") return route.fulfill({ status: 200, json: fixture.enabled ? { [GENERAL]: { count: 200, unread: { id: BASE, count: 2 }, recency: 1, threads: {} }, [ANNOUNCEMENTS]: { count: 400, unread: { id: BASE, count: 3 }, recency: 1, threads: {} } } : {} });
        if (path.endsWith("/perm")) {
          const id = path.slice(1, -5);
          return route.fulfill({ status: 200, json: { group: GROUP, writers: id === ANNOUNCEMENTS ? ["staff"] : [] } });
        }
        const match = path.match(/^\/v5\/(chat\/[^/]+\/[^/]+)\/posts\/(newest|older\/[^/]+)\/50\/post$/);
        if (!match) return route.fulfill({ status: 404, body: "Unexpected channel read: " + path });
        const [, id, direction] = match;
        const older = direction.startsWith("older");
        const messages = older ? [post((BigInt(BASE) - 1n).toString(), "older garden message")] : fixture.posts.get(id) ?? [];
        return route.fulfill({ status: 200, json: { posts: Object.fromEntries(messages.map((message) => [message.seal.id, message])), total: messages.length, newest: messages.length, older: id === GENERAL && !older ? (BigInt(BASE) - 1n).toString() : null, newer: null } });
      });
    },
    body(nextId) {
      return fixture.events.splice(0).flatMap(({ app = "channels", path = "/v4", json, response = "diff" }) => [...fixture.subscriptions].filter(([, sub]) => sub.app === app && sub.path === path).map(([id]) => `id: ${nextId()}\ndata: ${JSON.stringify({ response, id, json })}\n\n`)).join("");
    },
    action(action, accepted) {
      if (action.action === "subscribe" && ["channels", "groups"].includes(action.app)) fixture.subscriptions.set(action.id, { app: action.app, path: action.path });
      if (action.action === "unsubscribe") fixture.subscriptions.delete(action.subscription);
      if (action.action !== "poke" || action.app !== "channels") return;
      fixture.actions.push(action);
      if (!accepted) return;
      const request = action.json.channel;
      if (!request) return;
      const { nest, action: delta } = request;
      if ("join" in delta) {
        if (!group["active-channels"].includes(nest)) group["active-channels"].push(nest);
        fixture.events.push({ app: "groups", path: "/v3/groups", json: { flag: GROUP, "r-group": { "active-channel": { nest, joined: true } } } });
      }
      if ("read" in delta) fixture.events.push({ path: "/unreads", json: { nest, unread: { count: 200, unread: null, threads: {}, recency: 1 } } });
      if (delta.post?.add) {
        const essay = delta.post.add;
        const id = (0x8000000cce9e0d800000000000000000n + ((BigInt(essay.sent) + 1n) << 64n) / 1000n).toString();
        const message = { ...post(id, "", "~zod", essay.sent), essay };
        fixture.posts.set(nest, [...(fixture.posts.get(nest) ?? []), message]);
        if (fixture.pendingEcho) fixture.events.push({ json: { nest, response: { post: { id, "r-post": { set: message } } } } });
      }
    },
  };
  return fixture;
}
module.exports = { createGroupsFixture, BASE, GROUP, GENERAL, ANNOUNCEMENTS, OPTIONAL, PRIVATE, post };
