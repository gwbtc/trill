import { create } from "zustand";
import {
  formatTlonTimeId,
  normalizeTlonWhom,
  parseTlonMessage,
  type TlonChatClient,
} from "@/logic/tlon/client";
import { record, textStory } from "@/logic/tlon/story";
import type {
  TlonConversation,
  TlonDraft,
  TlonEvent,
  TlonMessage,
} from "@/logic/tlon/types";

export interface ChatThread {
  messages: TlonMessage[];
  older: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  deleted: Set<string>;
}

interface ChatState {
  client: TlonChatClient | null;
  our: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  conversations: Map<string, TlonConversation>;
  threads: Map<string, ChatThread>;
  muted: Set<string>;
  muteError: string | null;
  drafts: Record<string, string>;
  connect: (client: TlonChatClient, our: string) => () => void;
  reconnect: () => void;
  disconnect: () => void;
  refresh: () => Promise<void>;
  open: (id: string) => Promise<void>;
  older: (id: string) => Promise<void>;
  send: (id: string, text: string) => Promise<void>;
  read: (id: string) => Promise<void>;
  respond: (id: string, accept: boolean) => Promise<void>;
  block: (id: string, blocked: boolean) => Promise<void>;
  mute: (id: string, muted: boolean) => Promise<void>;
  setDraft: (id: string, text: string) => void;
}

const emptyThread = (): ChatThread => ({
  messages: [],
  older: null,
  loaded: false,
  loading: false,
  error: null,
  deleted: new Set(),
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
let generation = 0;
let dispose: (() => void) | null = null;
let initializing = false;
let refreshing: Promise<void> | null = null;
let refreshAgain = false;
let buffered: TlonEvent[] = [];
const reading = new Set<string>();
let lastTime = 0n;
const failed = new Map<
  string,
  { whom: string; draft: TlonDraft; text: string }
>();

function freshConversation(id: string, our: string): TlonConversation {
  return {
    id,
    kind: id.startsWith("~") ? "direct" : "group",
    title: id,
    members: id.startsWith("~") ? [...new Set([our, id])] : [],
    invitedMembers: [],
    invited: false,
    archived: false,
    blocked: false,
    unread: 0,
    recency: 0,
    latest: null,
  };
}

function mergeMessages(...pages: TlonMessage[][]): TlonMessage[] {
  const unique = new Map<string, TlonMessage>();
  for (const page of pages)
    for (const message of page) unique.set(message.id, message);
  return [...unique.values()].sort((a, b) =>
    BigInt(a.time) < BigInt(b.time)
      ? -1
      : BigInt(a.time) > BigInt(b.time)
        ? 1
        : a.id.localeCompare(b.id),
  );
}

function patchConversation(id: string, change: Partial<TlonConversation>) {
  const state = useChatStore.getState();
  const row = state.conversations.get(id) ?? freshConversation(id, state.our);
  useChatStore.setState({
    conversations: new Map(state.conversations).set(id, { ...row, ...change }),
  });
}

function patchThread(id: string, change: Partial<ChatThread>) {
  const state = useChatStore.getState();
  useChatStore.setState({
    threads: new Map(state.threads).set(id, {
      ...(state.threads.get(id) ?? emptyThread()),
      ...change,
    }),
  });
}

function receive(event: TlonEvent) {
  if (initializing) {
    buffered.push(event);
    return;
  }
  const state = useChatStore.getState();
  if (event.type === "invites") {
    void state.refresh().catch(() => {});
    return;
  }
  const data = event.data;
  if (event.type === "unread") {
    if (typeof data.whom !== "string") return;
    const summary = record(data.unread);
    const point = record(summary?.unread);
    patchConversation(data.whom, {
      unread: typeof point?.count === "number" ? point.count : 0,
      firstUnreadTime: typeof point?.time === "string" ? point.time : undefined,
    });
    return;
  }
  // API v4 has independent lifecycle facts, including locally started DMs.
  if (typeof data.ship === "string" && "net" in data) {
    if (data.net === null) {
      const conversations = new Map(state.conversations);
      conversations.delete(data.ship);
      useChatStore.setState({ conversations });
    } else
      patchConversation(data.ship, {
        invited: data.net === "invited",
        archived: data.net === "archive",
      });
    return;
  }
  let target = typeof data.whom === "string" ? data.whom : null;
  let id = typeof data.id === "string" ? data.id : null;
  let response = record(data.response);
  // Club membership/metadata changes need a small inbox resynchronization.
  if (!target && id?.startsWith("0v")) {
    const delta = record(record(data.diff)?.delta);
    const writ = record(delta?.writ);
    if (writ) {
      target = id;
      id = typeof writ.id === "string" ? writ.id : null;
      response = record(writ.delta);
    } else {
      void state.refresh().catch(() => {});
      return;
    }
  }
  if (!target || !id || !response) {
    void state.refresh().catch(() => {});
    return;
  }
  const thread = state.threads.get(target) ?? emptyThread();
  if ("del" in response) {
    const deleted = new Set(thread.deleted).add(id);
    const messages = thread.messages.filter((message) => message.id !== id);
    patchThread(target, { messages, deleted });
    if (state.conversations.get(target)?.latest?.id === id) {
      patchConversation(target, { latest: messages.at(-1) ?? null });
      void state.refresh().catch(() => {});
    }
    return;
  }
  const add = record(response.add);
  if (!add) return; // reaction/reply deltas do not replace the top-level post
  const existing = thread.messages.find((message) => message.id === id);
  try {
    const message = parseTlonMessage({
      type: "post",
      seal: {
        id,
        time: add.time ?? existing?.time,
        seq: add.seq ?? existing?.sequence ?? 0,
      },
      essay: add.essay,
    });
    if (!message) return;
    failed.delete(id);
    const deleted = new Set(thread.deleted);
    deleted.delete(id);
    patchThread(target, {
      messages: mergeMessages(thread.messages, [message]),
      deleted,
    });
    const current = state.conversations.get(target);
    if (
      !current?.latest ||
      BigInt(message.time) >= BigInt(current.latest.time)
    ) {
      patchConversation(target, {
        latest: message,
        recency: message.sent,
        unread: current?.unread ?? 0,
      });
    }
  } catch {
    // A delta with missing context must be resynchronized, not guessed.
    if (thread.loaded) {
      patchThread(target, { loaded: false });
      void state.open(target);
    }
    void state.refresh().catch(() => {});
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  client: null,
  our: "",
  status: "idle",
  error: null,
  conversations: new Map(),
  threads: new Map(),
  muted: new Set(),
  muteError: null,
  drafts: {},
  connect: (client, our) => {
    dispose?.();
    const token = ++generation;
    let stop: (() => Promise<void>) | null = null;
    let alive = true;
    let watchFailed = false;
    initializing = true;
    buffered = [];
    refreshing = null;
    set({
      client,
      our,
      status: "loading",
      error: null,
      threads: new Map(
        [...get().threads].map(([id, thread]) => [
          id,
          { ...thread, loaded: false, loading: false },
        ]),
      ),
    });
    const cleanup = () => {
      if (!alive) return;
      alive = false;
      if (generation === token) {
        generation++;
        initializing = false;
        buffered = [];
      }
      if (stop) void stop().catch(() => {});
    };
    dispose = cleanup;
    void (async () => {
      try {
        stop = await client.subscribe(
          (event) => {
            if (alive && token === generation) receive(event);
          },
          (error) => {
            if (alive && token === generation) {
              watchFailed = true;
              set({ status: "error", error: errorText(error) });
            }
          },
        );
        if (!alive || token !== generation) {
          await stop();
          return;
        }
        await get().refresh();
        if (!alive || token !== generation || watchFailed) return;
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
    void client
      .loadMuted()
      .then((muted) => {
        if (alive && token === generation) set({ muted, muteError: null });
      })
      .catch((error) => {
        if (alive && token === generation) set({ muteError: errorText(error) });
      });
    return cleanup;
  },
  disconnect: () => {
    dispose?.();
    dispose = null;
    set({ client: null, status: "idle" });
  },
  reconnect: () => {
    const { client, our } = get();
    if (client) get().connect(client, our);
  },
  refresh: () => {
    if (refreshing) {
      refreshAgain = true;
      return refreshing;
    }
    const client = get().client;
    if (!client) return Promise.reject(new Error("Chat is not connected"));
    const token = generation;
    const task = (async () => {
      do {
        refreshAgain = false;
        const before = get().conversations;
        const inbox = await client.loadInbox();
        if (token !== generation) return;
        // Preserve posts received while the independent scries were in flight.
        const current = get().conversations;
        for (const [id, row] of inbox.conversations) {
          const latest = current.get(id)?.latest;
          if (
            latest &&
            (latest !== before.get(id)?.latest || latest.delivery)
          ) {
            if (!row.latest || BigInt(latest.time) >= BigInt(row.latest.time)) {
              row.latest = latest;
              row.recency = latest.sent;
            }
          }
          if (row.latest && get().threads.get(id)?.deleted.has(row.latest.id))
            row.latest = null;
        }
        for (const [id, row] of current) {
          if (!before.has(id) && !inbox.conversations.has(id))
            inbox.conversations.set(id, row);
        }
        set({ conversations: inbox.conversations, error: null });
      } while (refreshAgain && token === generation);
    })();
    refreshing = task;
    // Clear before callers resume and replay buffered facts: a replay may
    // legitimately request another snapshot immediately.
    void task.then(
      () => {
        if (refreshing === task) refreshing = null;
      },
      (error) => {
        if (token === generation) set({ error: errorText(error) });
        if (refreshing === task) refreshing = null;
      },
    );
    return task;
  },
  open: async (rawId) => {
    const id = normalizeTlonWhom(rawId);
    const { client, our } = get();
    if (!client) return;
    const previous = get().threads.get(id);
    if (previous?.loading || previous?.loaded) return;
    const token = generation;
    const known = get().conversations.has(id);
    if (!known && id.startsWith("~")) {
      patchConversation(id, freshConversation(id, our));
      patchThread(id, { loaded: true });
      return;
    }
    patchThread(id, { loading: true, error: null });
    const before = new Map(
      previous?.messages.map((message) => [message.id, message]),
    );
    try {
      const page = await client.loadMessages(id);
      if (token !== generation) return;
      const current = get().threads.get(id) ?? emptyThread();
      patchThread(id, {
        // The fetched page replaces stale cache; only later live edits and
        // unacknowledged sends take precedence over the server snapshot.
        messages: mergeMessages(
          page.messages,
          current.messages.filter(
            (message) => message.delivery || before.get(message.id) !== message,
          ),
        ).filter((message) => !current.deleted.has(message.id)),
        older: page.older,
        loaded: true,
        loading: false,
      });
    } catch (error) {
      if (token === generation)
        patchThread(id, { loading: false, error: errorText(error) });
    }
  },
  older: async (id) => {
    const { client } = get();
    const thread = get().threads.get(id);
    if (!client || !thread?.older || thread.loading) return;
    const token = generation;
    patchThread(id, { loading: true, error: null });
    try {
      const page = await client.loadMessages(id, { older: thread.older });
      if (token !== generation) return;
      const current = get().threads.get(id) ?? emptyThread();
      patchThread(id, {
        messages: mergeMessages(page.messages, current.messages).filter(
          (message) => !current.deleted.has(message.id),
        ),
        older: page.older,
        loading: false,
      });
    } catch (error) {
      if (token === generation)
        patchThread(id, { loading: false, error: errorText(error) });
    }
  },
  setDraft: (id, text) => set({ drafts: { ...get().drafts, [id]: text } }),
  send: async (rawId, text) => {
    const id = normalizeTlonWhom(rawId);
    const { client, our } = get();
    if (!client) throw new Error("Chat is not connected");
    if (get().conversations.get(id)?.blocked)
      throw new Error("Unblock this person before sending");
    const retry = [...failed.values()].find(
      (entry) => entry.whom === id && entry.text === text,
    );
    const sent = Date.now();
    const now =
      0x8000000cce9e0d800000000000000000n + (BigInt(sent) << 64n) / 1000n;
    lastTime = now > lastTime ? now : lastTime + 1n;
    const draft = retry?.draft ?? {
      id: `${our}/${formatTlonTimeId(lastTime.toString())}`,
      sent,
      content: textStory(text),
    };
    const thread = get().threads.get(id) ?? emptyThread();
    const optimistic: TlonMessage = {
      ...draft,
      time: draft.id.split("/")[1].replaceAll(".", ""),
      sequence: 0,
      author: our,
      delivery: "sending",
    };
    patchThread(id, {
      messages: mergeMessages(thread.messages, [optimistic]),
      loaded: true,
    });
    patchConversation(id, { latest: optimistic, recency: draft.sent });
    const token = generation;
    try {
      await client.sendMessage(id, draft);
      if (token !== generation)
        throw new Error(
          "Chat connection changed; check the conversation before retrying",
        );
      failed.delete(draft.id);
      const messages = get().threads.get(id)?.messages ?? [];
      patchThread(id, {
        messages: messages.map((message) =>
          message.id === draft.id
            ? { ...message, delivery: undefined }
            : message,
        ),
      });
    } catch (error) {
      if (token === generation) {
        failed.set(draft.id, { whom: id, draft, text });
        patchThread(id, {
          messages: (get().threads.get(id)?.messages ?? []).map((message) =>
            message.id === draft.id
              ? { ...message, delivery: "failed" }
              : message,
          ),
        });
      }
      throw error;
    }
  },
  read: async (id) => {
    const row = get().conversations.get(id);
    if (!row?.unread || row.invited || !get().client || reading.has(id)) return;
    const latest = row.latest?.id;
    const token = generation;
    reading.add(id);
    try {
      await get().client!.markRead(id);
      if (
        token === generation &&
        get().conversations.get(id)?.latest?.id === latest
      )
        patchConversation(id, { unread: 0, firstUnreadTime: undefined });
    } finally {
      reading.delete(id);
    }
  },
  respond: async (id, accept) => {
    const token = generation;
    await get().client!.respondToInvite(id, accept);
    if (token !== generation) return;
    // Keep the row until acknowledged. A failed request remains actionable.
    if (accept) patchConversation(id, { invited: false, archived: false });
    else {
      const conversations = new Map(get().conversations);
      conversations.delete(id);
      set({ conversations });
    }
    await get().refresh();
  },
  block: async (id, blocked) => {
    const token = generation;
    await get().client!.setBlocked(id, blocked);
    if (token !== generation) return;
    patchConversation(id, { blocked });
  },
  mute: async (id, muted) => {
    const token = generation;
    await get().client!.setMuted(id, muted);
    if (token !== generation) return;
    const values = new Set(get().muted);
    if (muted) values.add(id);
    else values.delete(id);
    set({ muted: values, muteError: null });
  },
}));

export function chatUnreadCount(
  conversations: Map<string, TlonConversation>,
  muted: Set<string>,
): number {
  return [...conversations.values()].reduce(
    (total, row) =>
      total +
      (row.invited || row.archived || row.blocked || muted.has(row.id)
        ? 0
        : row.unread),
    0,
  );
}
