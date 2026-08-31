import type { NostrFilter } from "@nostrify/nostrify";
import type { Relays, RelayRequest } from "../types/nostrill";
import { relayLatencyColor, shortRelayUrl } from "./relayDisplay";

export type FeedStatusState = "live" | "paused" | "idle" | "syncing";

export interface FeedStatusRelayRow {
  url: string;
  color: string;
  events: number;
  last: string;
}

export interface FeedStatusSubscription {
  key: string;
  subId: string;
  label: string;
  state: FeedStatusState;
  stateLabel: string;
  rate: string;
  filter: string;
  relays: FeedStatusRelayRow[];
  totalEvents: number;
  relayCount: number;
}

export interface FeedStatusSummary {
  state: FeedStatusState;
  label: string;
  requestCount: number;
}

type RequestGroup = {
  key: string;
  subId: string;
  request: RelayRequest;
  relays: FeedStatusRelayRow[];
};

export function buildFeedStatusSubscriptions(
  relays: Relays,
  paused: Record<string, boolean> = {},
  syncing = false,
  latencies: Record<string, number | null> = {},
): FeedStatusSubscription[] {
  const groups = new Map<string, RequestGroup>();

  Object.entries(relays).forEach(([url, stats]) => {
    Object.entries(stats.reqs || {}).forEach(([subId, request], requestIndex) => {
      const key = subId || `${request.name || "subscription"}-${requestIndex}`;
      const group =
        groups.get(key) ??
        ({
          key,
          subId: subId || String(requestIndex + 1),
          request,
          relays: [],
        } satisfies RequestGroup);

      const connected = stats.wid != null;
      const latency = latencies[url] ?? null;
      const locallyPaused = paused[key] === true;
      group.relays.push({
        url: shortRelayUrl(url),
        color: locallyPaused
          ? "var(--color-text-muted, #cbd0d6)"
          : relayLatencyColor(connected, latency),
        events: request.eventsReceived ?? 0,
        last: formatRequestLastSeen(request, locallyPaused),
      });
      groups.set(key, group);
    });
  });

  return Array.from(groups.values())
    .map((group) => {
      const locallyPaused = paused[group.key] === true;
      const live = group.relays.length > 0 && group.request.ongoing === true;
      const totalEvents = group.relays.reduce((total, relay) => total + relay.events, 0);
      const state = getSubscriptionState(live, locallyPaused, syncing);

      return {
        key: group.key,
        subId: group.subId,
        label: group.request.name || "Relay subscription",
        state,
        stateLabel: stateLabel(state),
        rate: formatSubscriptionRate(totalEvents, state),
        filter: formatFeedStatusFilters(group.request.filters),
        relays: group.relays,
        totalEvents,
        relayCount: group.relays.length,
      } satisfies FeedStatusSubscription;
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.subId.localeCompare(b.subId));
}

export function getFeedStatusSummary(
  relays: Relays,
  paused: Record<string, boolean> = {},
  syncing = false,
): FeedStatusSummary {
  const subscriptions = buildFeedStatusSubscriptions(relays, paused, syncing);
  const liveCount = subscriptions.filter((sub) => sub.state === "live").length;

  if (syncing) {
    return { state: "syncing", label: "syncing...", requestCount: subscriptions.length };
  }
  if (subscriptions.length === 0) {
    return { state: "idle", label: "idle", requestCount: 0 };
  }
  if (liveCount === 0) {
    return { state: "paused", label: "paused", requestCount: subscriptions.length };
  }

  return {
    state: "live",
    label: `live · ${liveCount} req${liveCount === 1 ? "" : "s"}`,
    requestCount: subscriptions.length,
  };
}

export function formatFeedStatusFilters(filters: NostrFilter[] = []) {
  if (filters.length === 0) return "{}";
  return JSON.stringify(filters.length === 1 ? filters[0] : filters, null, 2);
}

function getSubscriptionState(
  live: boolean,
  locallyPaused: boolean,
  syncing: boolean,
): FeedStatusState {
  if (syncing) return "syncing";
  if (locallyPaused) return "paused";
  return live ? "live" : "idle";
}

function stateLabel(state: FeedStatusState) {
  if (state === "syncing") return "Syncing";
  if (state === "live") return "Active";
  if (state === "paused") return "Paused";
  return "Idle";
}

function formatSubscriptionRate(totalEvents: number, state: FeedStatusState) {
  if (state === "paused") return "closed";
  if (state === "syncing") return "syncing";
  if (totalEvents === 0) return "idle";
  return `${totalEvents} ev`;
}

function formatRequestLastSeen(request: RelayRequest, locallyPaused: boolean) {
  if (locallyPaused) return "-";
  if (request.eventsReceived > 0) return "now";
  if (request.ongoing === true) return "live";
  return "idle";
}
