import type {
  Notification,
  Req,
  Post,
  ReqStatus,
  NotificationType,
} from "../types/notifications";
import type { Result } from "../types/ui";
import type { Skein } from "../types/hark";
import type { UserType } from "../types/nostrill";
import { patpToFallbackUID } from "./gw";

export type NotificationFilter = "all" | "unread" | "mentions" | "relays";
export type NotificationKind =
  | "request"
  | "response"
  | "profile"
  | "reply"
  | "quote"
  | "repost"
  | "reaction"
  | "mention"
  | "deletion"
  | "relay"
  | "keys";

export function getNotificationKind(type: NotificationType): NotificationKind {
  if ("req" in type) return "request";
  if ("res" in type) return "response";
  if ("prof" in type) return "profile";
  if ("nostr" in type) return "keys" in type.nostr ? "keys" : "relay";

  const post = type.post;
  if ("reply" in post) return "reply";
  if ("quote" in post) return "quote";
  if ("rp" in post) return "repost";
  if ("reaction" in post) return "reaction";
  if ("mention" in post) return "mention";
  return "deletion";
}

export function filterNotifications(
  notifications: Notification[],
  filter: NotificationFilter,
) {
  return notifications
    .filter((notification) => {
      if (filter === "unread") return notification.unread;
      if (filter === "mentions") {
        return (
          "post" in notification.type &&
          ("mention" in notification.type.post || "reply" in notification.type.post)
        );
      }
      if (filter === "relays") return "nostr" in notification.type;
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function notificationPath(notification: Notification) {
  if (notification.postId) {
    if (notification.from && "nostr" in notification.from) {
      return `/t/n/${notification.postId}`;
    }
    if (notification.from && "urbit" in notification.from) {
      return `/t/u/${notification.from.urbit.patp}/${notification.postId}`;
    }
  }
  if ("post" in notification.type) {
    const post = notification.type.post;
    if ("reply" in post) return `/t/u/${post.reply.parent.ship}/${post.reply.parent.id}`;
    if ("quote" in post) return `/t/u/${post.quote.src.ship}/${post.quote.src.id}`;
    if ("rp" in post) return `/t/u/${post.rp.src.ship}/${post.rp.src.id}`;
    if ("reaction" in post) return `/t/u/${post.reaction.post.ship}/${post.reaction.post.id}`;
    if ("mention" in post) return `/t/u/${post.mention.post.ship}/${post.mention.post.id}`;
    if ("delReply" in post) return `/t/u/${post.delReply.parent.ship}/${post.delReply.parent.id}`;
    if ("delParent" in post) return `/t/u/${post.delParent.parent.ship}/${post.delParent.parent.id}`;
    if ("delQuote" in post) return `/t/u/${post.delQuote.parent.ship}/${post.delQuote.parent.id}`;
  }
  if (notification.from) {
    const id =
      "urbit" in notification.from
        ? notification.from.urbit.patp
        : notification.from.nostr;
    return `/u/${id}`;
  }
  return "";
}

export function formatNotificationTimestamp(timestamp: number, now = Date.now()) {
  const normalizedTimestamp = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const diff = Math.max(0, now - normalizedTimestamp);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(normalizedTimestamp).toLocaleDateString();
}

export function isSameNotificationRope(
  first: Notification["rope"],
  second: Notification["rope"],
) {
  return Boolean(
    first &&
      second &&
      first.group === second.group &&
      first.channel === second.channel &&
      first.desk === second.desk &&
      first.thread === second.thread,
  );
}

export function skeinToNote(skein: Skein): Result<Notification> {
  const path = skein.top.wer.split("/").filter((s) => !!s);
  // console.log("skein path", path);
  const key = path[0];
  if (!key) return { error: "no path" };
  let type: NotificationType | null = null;
  let from: UserType | null = null;
  if (key === "req") {
    const mtype = req(path);
    if ("ok" in mtype) type = mtype.ok;
  } else if (key === "res") {
    const mtype = req(path);
    if ("ok" in mtype) type = { res: mtype.ok.req };
  } else if (key === "prof") {
    const ship = path[1];
    from = { urbit: patpToFallbackUID(ship) };
    type = { prof: ship };
  } else if (key === "post") {
    const mtype = post(path);
    if ("ok" in mtype) type = { post: mtype.ok };
  } else if (key === "nostr") {
    const tipe = path[1];
    if (tipe === "relay-down") {
      const url = path[2];
      type = { nostr: { relayDown: url } };
    } else if (tipe === "new-relay") {
      const url = path[2];
      type = { nostr: { newRelay: url } };
    } else if (tipe === "keys") {
      const ship = path[2];
      const pubkey = path[3];
      type = { nostr: { keys: { user: ship, pubkey } } };
    }
  }
  if (!type) return { error: "bad skein" };

  const n: Notification = {
    id: skein.top.id,
    type,
    timestamp: skein.time,
    unread: skein.unread,
    message: skein.top.con,
    rope: skein.top.rope,
  };
  const nn = from ? { ...n, from } : n;
  return { ok: nn };

  //
  function req(path: string[]): Result<{ req: Req }> {
    const tipe = path[1];
    if (!tipe) return { error: "" };
    if (tipe === "fols") {
      const ship = path[2];
      from = { urbit: patpToFallbackUID(ship) };
      const statu = path[3];
      const status = statu as ReqStatus;
      return { ok: { req: { fols: ship, status } } };
    }
    if (tipe === "begs") {
      const subt = path[2];
      if (subt === "feed") {
        const ship = path[3];
        from = { urbit: patpToFallbackUID(ship) };
        const statu = path[4];
        const status = statu as ReqStatus;
        return { ok: { req: { status, begs: { feed: null } } } };
      } else if (subt === "thread") {
        const ship = path[3];
        from = { urbit: patpToFallbackUID(ship) };
        const id = path[4];
        const statu = path[5];
        const status = statu as ReqStatus;
        return { ok: { req: { status, begs: { thread: id } } } };
      } else return { error: "bad skein" };
    } else return { error: "bad skein" };
  }
  function post(path: string[]): Result<Post> {
    const tipe = path[1];
    const ship = path[2];
    from = { urbit: patpToFallbackUID(ship) };
    if (!tipe) return { error: "" };
    if (tipe === "reply") {
      const host = path[3];
      const parId = path[4];
      const parent = { ship: host, id: parId };
      const id = path[5];
      return { ok: { reply: { user: ship, parent, id } } };
    } else if (tipe === "quote") {
      const host = path[3];
      const parId = path[4];
      const src = { ship: host, id: parId };
      const id = path[5];
      const target = { ship: ship, id };
      return { ok: { quote: { user: ship, src, target } } };
    } else if (tipe === "rp") {
      const host = path[3];
      const parId = path[4];
      const src = { ship: host, id: parId };
      const id = path[5];
      const target = { ship: ship, id };
      return { ok: { rp: { user: ship, src, target } } };
    } else if (tipe === "reaction") {
      const host = path[3];
      const parId = path[4];
      const post = { ship: host, id: parId };
      const reaction = path[5];
      return { ok: { reaction: { user: ship, post, reaction } } };
    } else if (tipe === "mention") {
      const host = path[3];
      const id = path[4];
      const pid = { ship: host, id };
      return { ok: { mention: { user: ship, post: pid } } };
    } else if (tipe === "delReply") {
      const host = path[3];
      const parId = path[4];
      const parent = { ship: host, id: parId };
      const id = path[5];
      return { ok: { delReply: { user: ship, parent, id } } };
    } else if (tipe === "delParent") {
      const host = path[3];
      const parId = path[4];
      const parent = { ship: host, id: parId };
      const id = path[5];
      return { ok: { delParent: { user: ship, parent, id } } };
    } else if (tipe === "delQuote") {
      const host = path[3];
      const parId = path[4];
      const parent = { ship: host, id: parId };
      const id = path[5];
      return { ok: { delQuote: { user: ship, parent, id } } };
    } else return { error: "bad skein" };
  }
}
