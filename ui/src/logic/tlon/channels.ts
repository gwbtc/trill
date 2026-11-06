import { clan, isValidPatp } from "urbit-ob";
import { parseTlonEssay, formatTlonTimeId, type TlonTransport } from "./client";
import { record } from "./story";
import { acknowledgedPoke, watchTlon } from "./transport";
import type { TlonMessage, TlonMessagePage, TlonStory } from "./types";

export interface TlonGroup {
  id: string;
  title: string;
  description: string;
  channels: TlonChannel[];
}
export interface TlonChannel {
  id: string;
  groupId: string;
  title: string;
  description: string;
  section: string;
  joined: boolean;
  roles: string[];
  admin: boolean;
  unread: number;
  firstUnreadTime?: string;
}
export type ChannelEvent = {
  type: "directory" | "channel" | "unread";
  data: Record<string, unknown>;
};
function object(value: unknown, name: string): Record<string, unknown> {
  const result = record(value);
  if (!result) throw new Error(`Invalid Tlon ${name}`);
  return result;
}
function strings(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string")
  )
    throw new Error("Invalid Tlon string list");
  return value;
}
export function groupId(value: string): string {
  const [ship, name, extra] = value.split("/");
  if (
    !isValidPatp(ship) ||
    !/^[a-z][a-z0-9-]*$/.test(name ?? "") ||
    extra !== undefined
  )
    throw new Error("Invalid group address");
  return value;
}
export function chatChannelId(value: string): string {
  if (!value.startsWith("chat/"))
    throw new Error("Only chat channels are supported");
  groupId(value.slice(5));
  return value;
}
export function channelRoute(id: string): string {
  const [, host, name] = chatChannelId(id).split("/");
  return `/groups/chat/${encodeURIComponent(host)}/${encodeURIComponent(name)}`;
}
function decimal(value: unknown): string {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw new Error("Invalid channel post ID");
  return value;
}
export function parseChannelPost(value: unknown): TlonMessage | null {
  if (value === null) return null;
  const raw = object(value, "channel post");
  if (raw.type === "tombstone") return null;
  if (raw.type !== "post") throw new Error("Unsupported channel post");
  const seal = object(raw.seal, "channel seal");
  const id = decimal(seal.id);
  if (!Number.isSafeInteger(seal.seq) || (seal.seq as number) < 0)
    throw new Error("Invalid channel sequence");
  return {
    id,
    time: id,
    sequence: seal.seq as number,
    ...parseTlonEssay(raw.essay),
  };
}
export function unreadPoint(value: unknown): {
  unread: number;
  firstUnreadTime?: string;
} {
  const summary = object(value, "channel unread summary");
  const point =
    summary.unread == null
      ? null
      : object(summary.unread, "channel unread point");
  if (
    point &&
    (!Number.isSafeInteger(point.count) || (point.count as number) < 0)
  )
    throw new Error("Invalid channel unread count");
  return {
    unread: point ? (point.count as number) : 0,
    firstUnreadTime: point ? decimal(point.id) : undefined,
  };
}
export class TlonChannelsClient {
  private transport: TlonTransport;
  readonly our: string;
  constructor(transport: TlonTransport, our: string) {
    this.transport = transport;
    this.our = our;
  }
  async loadDirectory(): Promise<Map<string, TlonGroup>> {
    const [raw, rawUnreads] = await Promise.all([
      this.transport.scry({ app: "groups", path: "/v3/groups" }),
      this.transport.scry({ app: "channels", path: "/unreads" }),
    ]);
    const unreads = object(rawUnreads, "channel unreads");
    const groups = new Map<string, TlonGroup>();
    for (const [id, value] of Object.entries(object(raw, "groups"))) {
      groupId(id);
      const group = object(value, "group");
      const meta = object(group.meta, "group metadata");
      const seats = object(group.seats, "group seats");
      const seat = record(seats[this.our]);
      const roles = seat ? strings(seat.roles) : [];
      const admins = strings(group.admins);
      const admin =
        id.split("/")[0] === this.our ||
        roles.some((role) => admins.includes(role));
      const admissions = object(group.admissions, "group admissions");
      const banned = object(admissions.banned, "group bans");
      if (
        strings(banned.ships).includes(this.our) ||
        strings(banned.ranks).includes(clan(this.our)) ||
        (!seat && !admin)
      )
        continue;
      const active = new Set(strings(group["active-channels"]));
      const channels: TlonChannel[] = [];
      for (const [nest, data] of Object.entries(
        object(group.channels, "group channels"),
      )) {
        if (!nest.startsWith("chat/")) continue;
        chatChannelId(nest);
        const channel = object(data, "group channel");
        const readers = strings(channel.readers);
        if (
          !admin &&
          readers.length &&
          !roles.some((role) => readers.includes(role))
        )
          continue;
        const info = object(channel.meta, "channel metadata");
        channels.push({
          id: nest,
          groupId: id,
          title:
            typeof info.title === "string" && info.title
              ? info.title
              : nest.split("/")[2],
          description:
            typeof info.description === "string" ? info.description : "",
          section: typeof channel.section === "string" ? channel.section : "",
          joined: active.has(nest),
          roles,
          admin,
          ...(unreads[nest] ? unreadPoint(unreads[nest]) : { unread: 0 }),
        });
      }
      const sections = object(group.sections, "group sections");
      const ordered = strings(group["section-order"]).flatMap((key) =>
        strings(object(sections[key], "group section").order),
      );
      channels.sort((a, b) => {
        const ai = ordered.indexOf(a.id),
          bi = ordered.indexOf(b.id);
        return (
          (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) ||
          a.title.localeCompare(b.title)
        );
      });
      groups.set(id, {
        id,
        title: typeof meta.title === "string" && meta.title ? meta.title : id,
        description:
          typeof meta.description === "string" ? meta.description : "",
        channels,
      });
    }
    return groups;
  }
  async loadMessages(id: string, older?: string): Promise<TlonMessagePage> {
    const direction =
      older === undefined ? "newest" : `older/${formatTlonTimeId(older)}`;
    const raw = object(
      await this.transport.scry({
        app: "channels",
        path: `/v5/${chatChannelId(id)}/posts/${direction}/50/post`,
      }),
      "channel history",
    );
    const messages = Object.values(object(raw.posts, "channel posts"))
      .map(parseChannelPost)
      .filter((entry): entry is TlonMessage => !!entry);
    return {
      messages,
      older: raw.older == null ? null : decimal(raw.older),
      newer: raw.newer == null ? null : decimal(raw.newer),
      total: typeof raw.total === "number" ? raw.total : 0,
    };
  }
  async canWrite(channel: TlonChannel): Promise<boolean> {
    const perm = object(
      await this.transport.scry({
        app: "channels",
        path: `/${chatChannelId(channel.id)}/perm`,
      }),
      "channel permissions",
    );
    if (perm.group !== channel.groupId)
      throw new Error("Channel belongs to a different group");
    const writers = strings(perm.writers);
    return (
      channel.id.split("/")[1] === this.our ||
      channel.admin ||
      !writers.length ||
      writers.some((role) => channel.roles.includes(role))
    );
  }
  private action(id: string, action: unknown): Promise<void> {
    return acknowledgedPoke(this.transport, "channels", "channel-action-2", {
      channel: { nest: chatChannelId(id), action },
    });
  }
  send(id: string, sent: number, content: TlonStory): Promise<void> {
    return this.action(id, {
      post: {
        add: {
          author: this.our,
          sent,
          content,
          kind: "/chat",
          meta: null,
          blob: null,
        },
      },
    });
  }
  join(channel: TlonChannel): Promise<void> {
    return this.action(channel.id, { join: groupId(channel.groupId) });
  }
  read(id: string): Promise<void> {
    return this.action(id, { read: null });
  }
  subscribe(
    handler: (event: ChannelEvent) => void,
    onError: (error: unknown) => void,
  ): Promise<() => Promise<void>> {
    return watchTlon(
      this.transport,
      [
        { app: "groups", path: "/v3/groups", type: "directory" },
        { app: "channels", path: "/v4", type: "channel" },
        { app: "channels", path: "/unreads", type: "unread" },
      ].map(({ app, path, type }) => ({
        app,
        path,
        event: (data) =>
          handler({
            type: type as ChannelEvent["type"],
            data: object(data, "channel update"),
          }),
      })),
      onError,
    );
  }
}
