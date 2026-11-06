import { create } from "zustand";
import {
  TlonChannelsClient,
  parseChannelPost,
  unreadPoint,
  type ChannelEvent,
  type TlonChannel,
  type TlonGroup,
} from "@/logic/tlon/channels";
import { parseTlonEssay } from "@/logic/tlon/client";
import { record, textStory } from "@/logic/tlon/story";
import type { TlonMessage } from "@/logic/tlon/types";

export interface ChannelThread {
  messages: TlonMessage[];
  older: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  canWrite: boolean | null;
  joining: boolean;
  deleted: Set<string>;
}
interface ChannelsState {
  client: TlonChannelsClient | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  groups: Map<string, TlonGroup>;
  threads: Map<string, ChannelThread>;
  drafts: Record<string, string>;
  connect: (client: TlonChannelsClient) => void;
  disconnect: () => void;
  reconnect: () => void;
  refresh: () => Promise<void>;
  open: (id: string, reload?: boolean) => Promise<void>;
  permissions: (id: string) => Promise<void>;
  older: (id: string) => Promise<void>;
  join: (id: string) => Promise<void>;
  send: (id: string, text: string, retryId?: string) => Promise<void>;
  read: (id: string) => Promise<void>;
  setDraft: (id: string, text: string) => void;
}
const empty = (): ChannelThread => ({
  messages: [],
  older: null,
  loaded: false,
  loading: false,
  error: null,
  canWrite: null,
  joining: false,
  deleted: new Set(),
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
let generation = 0;
let cleanup: (() => void) | undefined;
let initializing = false;
let buffered: ChannelEvent[] = [];
let refreshTask: Promise<void> | null = null;
let refreshAgain = false;
let lastSent = 0;
const permissionRequests = new Map<string, number>();
function permissionKey(channel: TlonChannel | undefined) {
  return channel
    ? JSON.stringify([
        channel.groupId,
        channel.joined,
        channel.admin,
        channel.roles,
      ])
    : "";
}

export function channelInGroups(
  groups: Map<string, TlonGroup>,
  id: string,
): TlonChannel | undefined {
  for (const group of groups.values()) {
    const channel = group.channels.find((entry) => entry.id === id);
    if (channel) return channel;
  }
}
export function channelUnreadCount(groups: Map<string, TlonGroup>): number {
  return [...groups.values()].reduce(
    (sum, group) =>
      sum +
      group.channels.reduce(
        (count, channel) => count + (channel.joined ? channel.unread : 0),
        0,
      ),
    0,
  );
}
function patch(id: string, change: Partial<ChannelThread>) {
  const state = useChannelsStore.getState();
  useChannelsStore.setState({
    threads: new Map(state.threads).set(id, {
      ...(state.threads.get(id) ?? empty()),
      ...change,
    }),
  });
}
function patchChannel(id: string, change: Partial<TlonChannel>) {
  const state = useChannelsStore.getState();
  const groups = new Map(state.groups);
  for (const [key, group] of groups)
    if (group.channels.some((channel) => channel.id === id)) {
      groups.set(key, {
        ...group,
        channels: group.channels.map((channel) =>
          channel.id === id ? { ...channel, ...change } : channel,
        ),
      });
    }
  useChannelsStore.setState({ groups });
}
function merge(...pages: TlonMessage[][]): TlonMessage[] {
  const byId = new Map<string, TlonMessage>();
  for (const page of pages)
    for (const message of page) byId.set(message.id, message);
  const all = [...byId.values()];
  return all
    .filter(
      (message) =>
        !message.id.startsWith("pending/") ||
        !all.some(
          (other) =>
            !other.id.startsWith("pending/") &&
            other.author === message.author &&
            other.sent === message.sent,
        ),
    )
    .sort((a, b) =>
      BigInt(a.time) < BigInt(b.time)
        ? -1
        : BigInt(a.time) > BigInt(b.time)
          ? 1
          : a.id.localeCompare(b.id),
    );
}
function receive(event: ChannelEvent) {
  if (initializing) {
    buffered.push(event);
    return;
  }
  const state = useChannelsStore.getState();
  if (event.type === "directory") {
    void state.refresh().catch(() => {});
    return;
  }
  const { data } = event;
  const id = typeof data.nest === "string" ? data.nest : null;
  if (!id?.startsWith("chat/") || !channelInGroups(state.groups, id)) return;
  if (event.type === "unread") {
    patchChannel(id, unreadPoint(data.unread));
    return;
  }
  const response = record(data.response);
  if (!response) return;
  const post = record(response.post);
  const delta = record(post?.["r-post"]);
  if (post && delta && "set" in delta && typeof post.id === "string") {
    const thread = state.threads.get(id) ?? empty();
    const deleted = new Set(thread.deleted);
    if (delta.set === null || record(delta.set)?.type === "tombstone") {
      deleted.add(post.id);
      patch(id, {
        messages: thread.messages.filter((message) => message.id !== post.id),
        deleted,
      });
    } else {
      const message = parseChannelPost(delta.set);
      if (message) {
        deleted.delete(message.id);
        patch(id, { messages: merge(thread.messages, [message]), deleted });
      }
    }
    return;
  }
  if (post && delta?.essay && typeof post.id === "string") {
    const thread = state.threads.get(id);
    if (thread)
      patch(id, {
        messages: thread.messages.map((message) =>
          message.id === post.id
            ? { ...message, ...parseTlonEssay(delta.essay) }
            : message,
        ),
      });
  }
  if ("posts" in response) {
    const posts = record(response.posts);
    if (posts) {
      const messages = Object.values(posts)
        .map(parseChannelPost)
        .filter((message): message is TlonMessage => !!message);
      const thread = state.threads.get(id) ?? empty();
      patch(id, {
        messages: merge(thread.messages, messages).filter(
          (message) => !thread.deleted.has(message.id),
        ),
      });
    }
  }
  if ("perm" in response) {
    patch(id, { canWrite: null });
    void state.permissions(id).catch(() => {});
  }
  if ("join" in response || "leave" in response || "create" in response)
    void state.refresh().catch(() => {});
}
export const useChannelsStore = create<ChannelsState>((set, get) => ({
  client: null,
  status: "idle",
  error: null,
  groups: new Map(),
  threads: new Map(),
  drafts: {},
  connect: (client) => {
    cleanup?.();
    const token = ++generation;
    let alive = true;
    let failed = false;
    let stop: (() => Promise<void>) | undefined;
    initializing = true;
    buffered = [];
    refreshTask = null;
    set({
      client,
      status: "loading",
      error: null,
      threads: new Map(
        [...get().threads].map(([id, thread]) => [
          id,
          { ...thread, loaded: false, loading: false, canWrite: null },
        ]),
      ),
    });
    cleanup = () => {
      if (!alive) return;
      alive = false;
      if (token === generation) {
        generation++;
        initializing = false;
        buffered = [];
      }
      if (stop) void stop().catch(() => {});
    };
    void (async () => {
      try {
        stop = await client.subscribe(
          (event) => {
            if (alive && token === generation) receive(event);
          },
          (error) => {
            if (alive && token === generation) {
              failed = true;
              set({ status: "error", error: errorText(error) });
            }
          },
        );
        if (!alive || token !== generation) {
          await stop();
          return;
        }
        await get().refresh();
        if (!alive || token !== generation || failed) return;
        initializing = false;
        const events = buffered.splice(0);
        set({ status: "ready", error: null });
        events.forEach(receive);
      } catch (error) {
        if (stop) await stop().catch(() => {});
        if (alive && token === generation) {
          initializing = false;
          set({ status: "error", error: errorText(error) });
        }
      }
    })();
  },
  disconnect: () => {
    cleanup?.();
    cleanup = undefined;
    set({ status: "idle", client: null });
  },
  reconnect: () => {
    const client = get().client;
    if (client) get().connect(client);
  },
  refresh: () => {
    if (refreshTask) {
      refreshAgain = true;
      return refreshTask;
    }
    const client = get().client;
    if (!client) return Promise.reject(new Error("Groups are not connected"));
    const token = generation;
    const task = (async () => {
      do {
        refreshAgain = false;
        const before = get().groups;
        const groups = await client.loadDirectory();
        if (token !== generation) return;
        const current = get().groups;
        // Directory snapshots should retain unchanged row references and must
        // not roll back unread facts delivered while their scries were pending.
        for (const [groupId, group] of groups) {
          const previous = current.get(groupId);
          group.channels = group.channels.map((channel) => {
            const old = previous?.channels.find(
              (entry) => entry.id === channel.id,
            );
            const initial = channelInGroups(before, channel.id);
            if (
              old &&
              initial &&
              (old.unread !== initial.unread ||
                old.firstUnreadTime !== initial.firstUnreadTime)
            ) {
              channel.unread = old.unread;
              channel.firstUnreadTime = old.firstUnreadTime;
            }
            if (old && JSON.stringify(channel) === JSON.stringify(old))
              return old;
            if (
              permissionKey(old) !== permissionKey(channel) &&
              get().threads.has(channel.id)
            )
              patch(channel.id, { canWrite: null });
            return channel;
          });
          if (
            previous &&
            previous.title === group.title &&
            previous.description === group.description &&
            previous.channels.length === group.channels.length &&
            previous.channels.every(
              (channel, index) => channel === group.channels[index],
            )
          )
            groups.set(groupId, previous);
        }
        for (const [id, thread] of get().threads) {
          if (
            !channelInGroups(groups, id)?.joined &&
            (thread.loaded || thread.loading || thread.canWrite !== null)
          )
            patch(id, { loaded: false, loading: false, canWrite: null });
        }
        set({ groups, error: null });
      } while (refreshAgain && token === generation);
    })();
    refreshTask = task;
    void task.then(
      () => {
        if (refreshTask === task) refreshTask = null;
      },
      (error) => {
        if (refreshTask === task) refreshTask = null;
        if (token === generation) set({ error: errorText(error) });
      },
    );
    return task;
  },
  permissions: async (id) => {
    const { client, groups } = get();
    const channel = channelInGroups(groups, id);
    if (!client || !channel?.joined) return;
    const token = generation;
    const request = (permissionRequests.get(id) ?? 0) + 1;
    permissionRequests.set(id, request);
    const current = () =>
      token === generation &&
      request === permissionRequests.get(id) &&
      permissionKey(channelInGroups(get().groups, id)) ===
        permissionKey(channel);
    try {
      const canWrite = await client.canWrite(channel);
      if (current()) patch(id, { canWrite });
    } catch (error) {
      if (current()) patch(id, { canWrite: false, error: errorText(error) });
    }
  },
  open: async (id, reload = false) => {
    const { client, groups } = get();
    const channel = channelInGroups(groups, id);
    if (!client || !channel?.joined) return;
    const previous = get().threads.get(id);
    if (previous?.loading || (previous?.loaded && !reload)) return;
    const token = generation;
    const before = new Map(
      previous?.messages.map((message) => [message.id, message]),
    );
    patch(id, { loading: true, error: null });
    try {
      const [page] = await Promise.all([
        client.loadMessages(id),
        get().permissions(id),
      ]);
      if (token !== generation || !channelInGroups(get().groups, id)?.joined)
        return;
      const current = get().threads.get(id) ?? empty();
      patch(id, {
        messages: merge(
          page.messages,
          current.messages.filter(
            (message) =>
              message.id.startsWith("pending/") ||
              before.get(message.id) !== message,
          ),
        ).filter((message) => !current.deleted.has(message.id)),
        older: page.older,
        loaded: true,
        loading: false,
        joining: false,
      });
    } catch (error) {
      if (token === generation)
        patch(id, { loading: false, error: errorText(error) });
    }
  },
  older: async (id) => {
    const { client } = get();
    const thread = get().threads.get(id);
    if (
      !client ||
      !thread?.older ||
      thread.loading ||
      !channelInGroups(get().groups, id)?.joined
    )
      return;
    const token = generation;
    patch(id, { loading: true, error: null });
    try {
      const page = await client.loadMessages(id, thread.older);
      if (token !== generation || !channelInGroups(get().groups, id)?.joined)
        return;
      const current = get().threads.get(id) ?? empty();
      patch(id, {
        messages: merge(page.messages, current.messages).filter(
          (message) => !current.deleted.has(message.id),
        ),
        older: page.older,
        loading: false,
      });
    } catch (error) {
      if (token === generation)
        patch(id, { loading: false, error: errorText(error) });
    }
  },
  join: async (id) => {
    const channel = channelInGroups(get().groups, id);
    if (!channel || !get().client) throw new Error("Channel unavailable");
    const token = generation;
    patch(id, { joining: true, error: null });
    try {
      await get().client!.join(channel);
      if (token === generation) await get().refresh();
    } catch (error) {
      if (token === generation) patch(id, { joining: false });
      throw error;
    }
  },
  setDraft: (id, text) => set({ drafts: { ...get().drafts, [id]: text } }),
  send: async (id, text, retryId) => {
    const { client, groups } = get();
    const draftAtSend = get().drafts[id];
    const channel = channelInGroups(groups, id);
    const thread = get().threads.get(id);
    if (!client || !channel?.joined || !thread?.canWrite)
      throw new Error("This channel is read-only");
    const retry = thread.messages.find(
      (message) =>
        message.id.startsWith("pending/") &&
        message.delivery === "failed" &&
        (retryId
          ? message.id === retryId
          : message.author === client.our &&
            JSON.stringify(message.content) ===
              JSON.stringify(textStory(text))),
    );
    const sent = retry?.sent ?? Math.max(Date.now(), lastSent + 1);
    lastSent = sent;
    const message: TlonMessage = retry
      ? { ...retry, delivery: "sending" }
      : {
          id: `pending/${sent}`,
          time: (
            0x8000000cce9e0d800000000000000000n +
            (BigInt(sent) << 64n) / 1000n
          ).toString(),
          sent,
          author: client.our,
          sequence: 0,
          content: textStory(text),
          delivery: "sending",
        };
    patch(id, { messages: merge(thread.messages, [message]) });
    const token = generation;
    try {
      await client.send(id, sent, message.content);
      if (token !== generation)
        throw new Error(
          "Connection changed; check this channel before retrying",
        );
      patch(id, {
        messages: (get().threads.get(id)?.messages ?? []).map((entry) =>
          entry.id === message.id ? { ...entry, delivery: "queued" } : entry,
        ),
      });
      if (draftAtSend?.trim() === text && get().drafts[id] === draftAtSend)
        get().setDraft(id, "");
    } catch (error) {
      if (token === generation)
        patch(id, {
          messages: (get().threads.get(id)?.messages ?? []).map((entry) =>
            entry.id === message.id ? { ...entry, delivery: "failed" } : entry,
          ),
        });
      throw error;
    }
  },
  read: async (id) => {
    const channel = channelInGroups(get().groups, id);
    if (!channel?.joined || !channel.unread || !get().client) return;
    const token = generation;
    await get().client!.read(id);
    if (token === generation && channelInGroups(get().groups, id) === channel)
      patchChannel(id, { unread: 0, firstUnreadTime: undefined });
  },
}));
