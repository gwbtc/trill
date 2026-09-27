import type {
  Notification,
  Req,
  Post,
  ReqStatus,
  NotificationType,
} from "../types/notifications";
import type { Result } from "../types/ui";
import type { Skein, YarnContent } from "../types/hark";
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
  | "report"
  | "mention"
  | "deletion"
  | "relay"
  | "keys"
  | "debate";

export function getNotificationKind(type: NotificationType): NotificationKind {
  if ("req" in type) return "request";
  if ("res" in type) return "response";
  if ("prof" in type) return "profile";
  if ("nostr" in type) return "keys" in type.nostr ? "keys" : "relay";
  if ("debate" in type) return "debate";

  const post = type.post;
  if ("reply" in post) return "reply";
  if ("quote" in post) return "quote";
  if ("rp" in post) return "repost";
  if ("reaction" in post) return "reaction";
  if ("report" in post) return "report";
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
  if ("debate" in notification.type) {
    const { host, id } = notification.type.debate.invite;
    return `/debates/${host}/${id}`;
  }
  if ("post" in notification.type) {
    const post = notification.type.post;
    if ("reply" in post) return `/t/u/${post.reply.parent.ship}/${post.reply.parent.id}`;
    if ("quote" in post) return `/t/u/${post.quote.src.ship}/${post.quote.src.id}`;
    if ("rp" in post) return `/t/u/${post.rp.src.ship}/${post.rp.src.id}`;
    if ("reaction" in post) return `/t/u/${post.reaction.post.ship}/${post.reaction.post.id}`;
    if ("report" in post) return `/t/u/${post.report.post.ship}/${post.report.post.id}`;
    if ("mention" in post) return `/t/u/${post.mention.post.ship}/${post.mention.post.id}`;
    if ("delReply" in post) return `/t/u/${post.delReply.parent.ship}/${post.delReply.parent.id}`;
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

// the parts of a yarn worth showing: post paths like /urbit/~zod/170.141...
// are for machines (the row links to the post), so they're dropped
export function displayYarn(con: YarnContent[]): YarnContent[] {
  return con.filter((part) => !(typeof part === "string" && part.startsWith("/")));
}

// the yarn without its actor, who's shown as the row's name. some yarns are
// sentences about the actor ("~nec accepted your…"): what's left then
// starts lowercase, so it's capitalized
export function withoutActor(con: YarnContent[], actorId: string): YarnContent[] {
  const rest = con.filter(
    (part) => !(typeof part !== "string" && "ship" in part && part.ship === actorId),
  );
  const [first, ...more] = rest;
  if (typeof first !== "string" || rest.length === con.length) return rest;
  const t = first.trimStart();
  return [t.charAt(0).toUpperCase() + t.slice(1), ...more];
}

// `our` fills in the host of quote notifications, which is always us and
// so is left out of the path
export function skeinToNote(skein: Skein, our?: string): Result<Notification> {
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
    // the url is in the yarn text (it's not a valid path knot). older
    // notifications carried it in the path, split across segments by its
    // own slashes: rebuild it from those between the tipe and the /@da
    const urlInText = skein.top.con.find(
      (c): c is string => typeof c === "string" && /^wss?:\/\//.test(c),
    );
    const url = urlInText ?? skein.top.wer.split("/").slice(3, -1).join("/");
    if (tipe === "relay-down") {
      type = { nostr: { relayDown: url } };
    } else if (tipe === "new-relay") {
      type = { nostr: { newRelay: url } };
    } else if (tipe === "keys") {
      const ship = path[2];
      const pubkey = path[3];
      type = { nostr: { keys: { user: ship, pubkey } } };
    }
  }
  // %debates invitations: /debates/invite/<host>/<dotted @ud id>
  if (key === "debates" && path[1] === "invite" && path[2] && path[3]) {
    from = { urbit: patpToFallbackUID(path[2]) };
    type = { debate: { invite: { host: path[2], id: path[3].replaceAll(".", "") } } };
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
  // layouts mirror ++to-hark in backend/lib/hark.hoon; every wer ends in
  // a /@da. [kind] is the %urbit/%nostr head of ++user-to-path
  //   /post/mention/~ship/~host/id
  //   /post/reply/~ship/~host/parent/id
  //   /post/quote/~ship/src/~host/id          (src is our post)
  //   /post/rp/~ship/[kind]/host/src/id
  //   /post/react/~ship/[kind]/host/id
  //   /post/report/~ship/[kind]/host/id       (reason in the yarn text)
  //   /post/del-reply/~ship/[kind]/host/parent/id
  //   /post/del-quote/~ship/[kind]/host/src/id    (older: [kind]/host/src twice)
  function post(path: string[]): Result<Post> {
    const tipe = path[1];
    const ship = path[2];
    if (!tipe || !ship) return { error: "bad skein" };
    from = { urbit: patpToFallbackUID(ship) };
    // hark paths carry dotted @ud ids; routes and scries want plain digits
    const ud = (s: string | undefined) => (s ?? "").replaceAll(".", "");
    if (tipe === "mention") {
      const post = { ship: path[3], id: ud(path[4]) };
      return { ok: { mention: { user: ship, post } } };
    } else if (tipe === "reply") {
      const parent = { ship: path[3], id: ud(path[4]) };
      return { ok: { reply: { user: ship, parent, id: ud(path[5]) } } };
    } else if (tipe === "quote") {
      const src = { ship: our ?? "", id: ud(path[3]) };
      const target = { ship: path[4], id: ud(path[5]) };
      return { ok: { quote: { user: ship, src, target } } };
    } else if (tipe === "rp") {
      const src = { ship: path[4], id: ud(path[5]) };
      const target = { ship, id: ud(path[6]) };
      return { ok: { rp: { user: ship, src, target } } };
    } else if (tipe === "react") {
      const post = { ship: path[4], id: ud(path[5]) };
      // the emoji isn't in the path, only in the yarn's text
      const last = skein.top.con[skein.top.con.length - 1];
      const reaction = typeof last === "string" ? last : "";
      return { ok: { reaction: { user: ship, post, reaction } } };
    } else if (tipe === "report") {
      const post = { ship: path[4], id: ud(path[5]) };
      // yarn text: [ship, 'Reported your post:', pid, reason]
      const last = skein.top.con[skein.top.con.length - 1];
      const reason = typeof last === "string" ? last : "";
      return { ok: { report: { user: ship, post, reason } } };
    } else if (tipe === "del-reply") {
      const parent = { ship: path[4], id: ud(path[5]) };
      return { ok: { delReply: { user: ship, parent, id: ud(path[6]) } } };
    } else if (tipe === "del-quote") {
      // the src pid appears twice; read from the end, before the /@da
      const parent = { ship: path.at(-4)!, id: ud(path.at(-3)) };
      return { ok: { delQuote: { user: ship, parent, id: ud(path.at(-2)) } } };
    } else return { error: "bad skein" };
  }
}

// hark has no delete action, so "clear" can't remove anything on the ship:
// it marks everything read there and hides notifications up to the newest
// cleared timestamp here, remembered across reloads
const CLEARED_KEY = "nostrill-notifications-cleared-at";
export function getNotificationsClearedAt(): number {
  try {
    return Number(localStorage.getItem(CLEARED_KEY)) || 0;
  } catch {
    return 0;
  }
}
export function setNotificationsClearedAt(timestamp: number) {
  try {
    localStorage.setItem(CLEARED_KEY, String(timestamp));
  } catch {
    // storage unavailable: the clear just won't survive a reload
  }
}
