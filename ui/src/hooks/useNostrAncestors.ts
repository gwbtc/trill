import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NRelay1 } from "@nostrify/nostrify";
import { useStore } from "@/state/state";
import type { Wevent } from "@/types/nostr";
import { nostrEventInFeed } from "@/logic/nostrill";
import { nostrThreadRefs, relayHint, type NostrEventRef } from "@/logic/nostrThread";

type Context = { ancestors: Wevent[]; loading: boolean; incomplete: boolean; gapAfterRoot: boolean };
const EMPTY: Context = { ancestors: [], loading: false, incomplete: false, gapAfterRoot: false };
const MAX_ANCESTORS = 32;

function cachedEvent(id: string): Wevent | undefined {
  const state = useStore.getState();
  const feeds = new Set([state.globalFeed, state.nostrFeed, ...Object.values(state.nostrFeeds), ...state.nostrUserFeeds.values()]);
  for (const feed of feeds) {
    const event = nostrEventInFeed(feed, id);
    if (event) return event;
  }
}

export function useNostrAncestors(event: Wevent, relayUrls: string[]) {
  const client = useQueryClient();
  const [context, setContext] = useState<Context>(() => nostrThreadRefs(event).parent ? { ...EMPTY, loading: true } : EMPTY);
  const [attempt, retry] = useState(0);
  const relayKey = JSON.stringify(relayUrls);

  useEffect(() => {
    const refs = nostrThreadRefs(event);
    if (!refs.parent || event.kind !== 1) { setContext(EMPTY); return; }
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const urls = [...new Set([
      refs.root?.relay, refs.parent?.relay,
      ...(JSON.parse(relayKey) as string[]).map(relayHint),
    ].filter((url): url is string => Boolean(url)))];
    const connections = new Map<string, NRelay1>();
    const pending = new Map<string, Promise<Wevent | undefined>>();
    setContext({ ...EMPTY, loading: true });

    function load(ref: NostrEventRef): Promise<Wevent | undefined> {
      const known = client.getQueryData<Wevent>(["nostr-event", ref.id]) ?? cachedEvent(ref.id);
      if (known?.kind === 1) return Promise.resolve(known);
      const existing = pending.get(ref.id);
      if (existing) return existing;
      const candidates = [...new Set([ref.relay, ...urls, ...connections.keys()].filter((url): url is string => Boolean(url)))].slice(0, 8);
      const found = new AbortController();
      const readSignal = AbortSignal.any([signal, found.signal, AbortSignal.timeout(4000)]);
      const request = Promise.any(candidates.map(async url => {
        let relay = connections.get(url);
        if (!relay) { relay = new NRelay1(url); connections.set(url, relay); }
        for await (const message of relay.req([{ ids: [ref.id] }], { signal: readSignal })) {
          if (message[0] === "EVENT" && message[2].id === ref.id && message[2].kind === 1) {
            return { ...message[2], relays: [url] };
          }
          if (message[0] === "EOSE" || message[0] === "CLOSED") break;
        }
        throw new Error("Ancestor unavailable");
      })).then(note => {
        client.setQueryData(["nostr-event", note.id], note);
        return note;
      }).catch(() => undefined).finally(() => found.abort());
      pending.set(ref.id, request);
      return request;
    }

    (async () => {
      const chain: Wevent[] = [];
      const visited = new Set([event.id]);
      let incomplete = false;
      let cursor: NostrEventRef | undefined = refs.parent;
      const rootRequest = refs.root && refs.root.id !== event.id ? load(refs.root) : undefined;
      try {
        while (cursor) {
          if (signal.aborted || visited.has(cursor.id) || chain.length >= MAX_ANCESTORS) { incomplete = true; break; }
          visited.add(cursor.id);
          const parent = await load(cursor);
          if (!parent) { incomplete = true; break; }
          chain.push(parent);
          cursor = nostrThreadRefs(parent).parent;
        }
        chain.reverse();
        const root = await rootRequest;
        let gapAfterRoot = false;
        if (root && !chain.some(note => note.id === root.id)) {
          chain.unshift(root);
          gapAfterRoot = true;
          incomplete = true;
        } else if (refs.root && !root) incomplete = true;
        if (!controller.signal.aborted) setContext({ ancestors: chain, loading: false, incomplete, gapAfterRoot });
      } finally {
        for (const relay of connections.values()) void relay.close();
      }
    })();
    return () => {
      controller.abort();
      for (const relay of connections.values()) void relay.close();
    };
  }, [event, relayKey, attempt, client]);

  return { ...context, retry: () => retry(value => value + 1) };
}
