import { acknowledgedPoke, watchTlon } from "./transport";
import { isValidPatp } from "urbit-ob";
import type {
  TlonConversation,
  TlonDraft,
  TlonEvent,
  TlonInbox,
  TlonMessage,
  TlonMessagePage,
  TlonStory,
  TlonWhom,
} from "./types";

// Share the application's Airlock connection. No channel, login or timer is
// created here. This structural interface also permits fixture transports.
export interface TlonTransport {
  scry(request: { app: string; path: string }): Promise<unknown>;
  poke(request: {
    app: string;
    mark: string;
    json: unknown;
    onSuccess: () => void;
    onError: (error: unknown) => void;
  }): Promise<unknown>;
  subscribe(request: {
    app: string;
    path: string;
    resubOnQuit?: boolean;
    event: (data: unknown) => void;
    err: (error: unknown, id?: string) => void;
    quit: (data?: unknown) => void;
  }): Promise<number>;
  unsubscribe(id: number): Promise<unknown>;
}

const APP = "chat";
const VERSION = "/v4";
const DM_VOLUME_TYPES = [
  "dm-invite",
  "dm-post",
  "dm-post-mention",
  "dm-reply",
  "dm-reply-mention",
  "dm-react",
];

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Tlon ${name}`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Tlon ${name}`);
  return value;
}

function ship(value: unknown): string {
  if (typeof value !== "string" || !isValidPatp(value)) {
    throw new Error("Invalid Tlon ship");
  }
  return value;
}

function ships(value: unknown): string[] {
  return array(value, "ships").map(ship);
}

export function normalizeTlonWhom(value: unknown): TlonWhom {
  if (
    typeof value === "string" &&
    /^0v[0-9a-v]+(?:\.[0-9a-v]+)*$/.test(value)
  ) {
    return `0v${groupDigits(value.slice(2).replaceAll(".", ""), 5)}`;
  }
  return ship(value);
}

const whom = normalizeTlonWhom;

function clubId(value: unknown): string {
  const id = whom(value);
  if (id.startsWith("~")) throw new Error("Expected Tlon club ID");
  return id;
}

function timeId(value: unknown): string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Invalid Tlon time cursor");
  }
  return value;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Tlon count or timestamp");
  }
  return value;
}

function messageId(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid Tlon message ID");
  const [author, time, extra] = value.split("/");
  if (extra !== undefined) throw new Error("Invalid Tlon message ID");
  ship(author);
  if (!/^\d+(?:\.\d{3})*$/.test(time ?? ""))
    throw new Error("Invalid Tlon message ID");
  return value;
}

export function parseTlonEssay(
  value: unknown,
): Pick<TlonMessage, "author" | "sent" | "content"> {
  const essay = object(value, "message essay");
  const author =
    typeof essay.author === "string"
      ? ship(essay.author)
      : ship(object(essay.author, "message author").ship);
  const content = array(essay.content, "story") as TlonStory;
  return { author, sent: count(essay.sent), content };
}

export function parseTlonMessage(value: unknown): TlonMessage | null {
  const raw = object(value, "message");
  if (raw.type === "tombstone") return null;
  if (raw.type !== "post") throw new Error("Unsupported Tlon message type");
  const seal = object(raw.seal, "message seal");
  return {
    id: messageId(seal.id),
    time: timeId(seal.time),
    sequence: count(seal.seq),
    ...parseTlonEssay(raw.essay),
  };
}

const message = parseTlonMessage;

export class TlonChatClient {
  private readonly our: string;
  private readonly transport: TlonTransport;

  constructor(transport: TlonTransport, our: string) {
    this.transport = transport;
    this.our = ship(our);
  }

  async loadInbox(): Promise<TlonInbox> {
    const [
      headsRaw,
      clubsRaw,
      dmsRaw,
      invitesRaw,
      archiveRaw,
      blockedRaw,
      unreadsRaw,
    ] = await Promise.all(
      [
        "/v4/heads",
        "/clubs",
        "/dm",
        "/dm/invited",
        "/dm/archive",
        "/blocked",
        "/unreads",
      ].map((path) => this.transport.scry({ app: APP, path })),
    );
    const clubs = object(clubsRaw, "clubs");
    const unreads = object(unreadsRaw, "unreads");
    const invited = new Set(ships(invitesRaw));
    const archived = new Set(ships(archiveRaw));
    const blocked = new Set(ships(blockedRaw));
    const conversations = new Map<TlonWhom, TlonConversation>();
    const ensure = (id: string): TlonConversation => {
      const existing = conversations.get(id);
      if (existing) return existing;
      const group = !id.startsWith("~");
      const crew = group ? object(clubs[id], "club crew") : null;
      const metadata = crew ? object(crew.meta, "club metadata") : null;
      const unread =
        unreads[id] == null ? null : object(unreads[id], "unread summary");
      // Top-level count is total messages. The nested count is unread messages.
      const point =
        unread?.unread == null ? null : object(unread.unread, "unread point");
      const result: TlonConversation = {
        id,
        kind: group ? "group" : "direct",
        title:
          metadata && typeof metadata.title === "string" ? metadata.title : id,
        members: crew ? ships(crew.team) : [...new Set([this.our, ship(id)])],
        invitedMembers: crew ? ships(crew.hive) : [],
        invited: crew
          ? typeof crew.net === "string"
            ? crew.net === "invited"
            : !ships(crew.team).includes(this.our) &&
              ships(crew.hive).includes(this.our)
          : invited.has(id),
        archived: crew ? crew.net === "archive" : archived.has(id),
        blocked: !group && blocked.has(id),
        unread: point ? count(point.count) : 0,
        recency: 0,
        latest: null,
        firstUnreadTime: point ? timeId(point.time) : undefined,
      };
      conversations.set(id, result);
      return result;
    };
    for (const id of [...ships(dmsRaw), ...invited, ...archived, ...blocked])
      ensure(whom(id));
    for (const [id, value] of Object.entries(clubs)) {
      const crew = object(value, "club crew");
      if (
        ships(crew.team).includes(this.our) ||
        ships(crew.hive).includes(this.our)
      )
        ensure(whom(id));
    }
    for (const value of array(headsRaw, "heads")) {
      const head = object(value, "conversation head");
      const id = whom(head.whom);
      if (id.startsWith("0v") && !conversations.has(id)) continue;
      const row = ensure(id);
      row.recency = count(head.recency);
      row.latest = head.latest == null ? null : message(head.latest);
    }
    return { conversations, blocked: [...blocked] };
  }

  async loadMessages(
    id: TlonWhom,
    options: { count?: number; older?: string } = {},
  ): Promise<TlonMessagePage> {
    const target = whom(id);
    const size = options.count ?? 50;
    if (!Number.isSafeInteger(size) || size < 1 || size > 100)
      throw new Error("Tlon page size must be 1–100");
    const direction =
      options.older === undefined
        ? "newest"
        : `older/${formatTlonTimeId(options.older)}`;
    const kind = target.startsWith("~") ? "dm" : "club";
    const raw = object(
      await this.transport.scry({
        app: APP,
        path: `${VERSION}/${kind}/${target}/writs/${direction}/${size}/heavy`,
      }),
      "message page",
    );
    const messages = Object.values(object(raw.writs, "writs"))
      .map(message)
      .filter((entry): entry is TlonMessage => entry !== null)
      .sort((a, b) =>
        BigInt(a.time) < BigInt(b.time)
          ? -1
          : BigInt(a.time) > BigInt(b.time)
            ? 1
            : a.id.localeCompare(b.id),
      );
    return {
      messages,
      older: raw.older == null ? null : timeId(raw.older),
      newer: raw.newer == null ? null : timeId(raw.newer),
      total: count(raw.total),
    };
  }

  private poke(mark: string, json: unknown): Promise<void> {
    return this.pokeAgent(APP, mark, json);
  }

  private pokeAgent(app: string, mark: string, json: unknown): Promise<void> {
    return acknowledgedPoke(this.transport, app, mark, json);
  }

  async loadMuted(): Promise<Set<string>> {
    const settings = object(
      await this.transport.scry({
        app: "activity",
        path: "/v6/volume-settings",
      }),
      "notification settings",
    );
    const muted = new Set<string>();
    for (const [source, raw] of Object.entries(settings)) {
      if (!source.startsWith("dm/")) continue;
      const volumes = object(raw, "notification volume");
      if (
        DM_VOLUME_TYPES.every((type) => {
          const value = volumes[type];
          if (value == null) return false;
          const rule = object(value, "notification rule");
          return rule.unreads === false && rule.notify === false;
        })
      )
        muted.add(whom(source.slice(3)));
    }
    return muted;
  }

  setMuted(id: string, muted: boolean): Promise<void> {
    const volume = muted
      ? Object.fromEntries(
          DM_VOLUME_TYPES.map((type) => [
            type,
            { unreads: false, notify: false },
          ]),
        )
      : null;
    return this.pokeAgent("activity", "activity-action-2", {
      adjust: {
        source: {
          dm: id.startsWith("~") ? { ship: whom(id) } : { club: whom(id) },
        },
        volume,
      },
    });
  }

  markRead(id: TlonWhom): Promise<void> {
    return this.poke("chat-remark-action", {
      whom: whom(id),
      diff: { read: null },
    });
  }

  respondToInvite(
    id: TlonWhom,
    accept: boolean,
    actionId?: string,
  ): Promise<void> {
    const target = whom(id);
    if (target.startsWith("~"))
      return this.poke("chat-dm-rsvp", { ship: target, ok: accept });
    return this.poke("chat-club-action-2", {
      id: target,
      diff: {
        uid: clubId(actionId ?? newTlonActionId()),
        delta: { team: { ship: this.our, ok: accept } },
      },
    });
  }

  setBlocked(peer: string, blocked: boolean): Promise<void> {
    return this.poke(blocked ? "chat-block-ship" : "chat-unblock-ship", {
      ship: ship(peer),
    });
  }

  createGroup(id: string, members: string[]): Promise<void> {
    const target = clubId(id);
    const hive = [...new Set(members.map(ship))].filter(
      (member) => member !== this.our,
    );
    if (hive.length < 2)
      throw new Error("A group DM needs at least two other participants");
    return this.poke("chat-club-create", { id: target, hive });
  }

  sendMessage(
    id: TlonWhom,
    draft: TlonDraft,
    actionId?: string,
  ): Promise<void> {
    const target = whom(id);
    const validated = messageId(draft.id);
    const [sender, timestamp] = validated.split("/");
    const postId = `${sender}/${groupDigits(timestamp.replaceAll(".", ""), 3)}`;
    if (!postId.startsWith(`${this.our}/`))
      throw new Error("Cannot send as another ship");
    if (!draft.content.length) throw new Error("Cannot send an empty story");
    const diff = {
      id: postId,
      delta: {
        add: {
          essay: {
            author: this.our,
            sent: count(draft.sent),
            content: draft.content,
            kind: "/chat",
            meta: null,
            blob: null,
          },
          time: null,
        },
      },
    };
    return target.startsWith("~")
      ? this.poke("chat-dm-action-2", { ship: target, diff })
      : this.poke("chat-club-action-2", {
          id: target,
          diff: {
            uid: clubId(actionId ?? newTlonActionId()),
            delta: { writ: diff },
          },
        });
  }

  async subscribe(
    handler: (event: TlonEvent) => void,
    onError: (error: unknown) => void = () => {},
  ): Promise<() => Promise<void>> {
    return watchTlon(
      this.transport,
      (
        [
          [VERSION, "chat"],
          ["/unreads", "unread"],
          ["/dm/invited", "invites"],
        ] as const
      ).map(([path, type]) => ({
        app: APP,
        path,
        event: (data: unknown) =>
          handler(
            type === "invites"
              ? { type, ships: ships(data) }
              : { type, data: object(data, `${type} event`) },
          ),
      })),
      onError,
    );
  }
}

export function newTlonActionId(): string {
  const words = crypto.getRandomValues(new Uint32Array(4));
  let value = 0n;
  for (const word of words) value = (value << 32n) | BigInt(word);
  return `0v${groupDigits(value.toString(32), 5)}`;
}

// These are Hoon aura renderings, not locale-dependent number formatting.
function groupDigits(value: string, size: number): string {
  const first = value.length % size || size;
  const groups = [value.slice(0, first)];
  for (let offset = first; offset < value.length; offset += size)
    groups.push(value.slice(offset, offset + size));
  return groups.join(".");
}

export function formatTlonTimeId(value: string): string {
  return groupDigits(timeId(value), 3);
}
