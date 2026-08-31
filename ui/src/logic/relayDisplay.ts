import type { RelayStats } from "@/types/nostrill";

export interface RelayDisplayModel {
  url: string;
  wid: number | null;
  start: number;
  reqs: number;
  latency: number | null;
  connected: boolean;
  color: string;
  short: string;
  status: string;
  barWidth: number;
}

export function shortRelayUrl(url: string) {
  return url.replace(/^wss?:\/\//, "");
}

export function isValidRelayUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "wss:" || url.protocol === "ws:";
  } catch {
    return false;
  }
}

export function buildRelayModels(
  relays: Record<string, RelayStats>,
  latencies: Record<string, number | null> = {},
) {
  return Object.entries(relays).map(([url, stats]) =>
    buildRelayModel(url, stats, latencies[url] ?? null),
  );
}

export function buildRelayModel(
  url: string,
  stats: RelayStats,
  // measured http round-trip (logic/latency.ts); null = unmeasured
  latency: number | null = null,
): RelayDisplayModel {
  const reqs = Object.keys(stats.reqs || {}).length;
  // a live socket means connected; dormant/reconnecting entries stay listed
  const connected = stats.wid != null;
  const color = relayLatencyColor(connected, latency);

  return {
    url,
    wid: stats.wid,
    start: stats.start,
    reqs,
    latency,
    connected,
    color,
    short: shortRelayUrl(url),
    status: !connected ? "offline" : latency == null ? "—" : `${latency}ms`,
    barWidth:
      connected && latency != null
        ? Math.max(10, Math.round((1 - Math.min(latency, 800) / 800) * 100))
        : 4,
  };
}

export function relayLatencyColor(connected: boolean, latency: number | null) {
  if (!connected) return "var(--color-text-muted, #cbd0d6)";
  if (latency == null) return "var(--color-primary, #5b46e5)";
  if (latency < 150) return "var(--color-success, #16a34a)";
  if (latency < 400) return "var(--color-primary, #5b46e5)";
  return "var(--color-warning, #d97706)";
}

export function formatRelayUptime(startTimestamp: number) {
  if (!startTimestamp) return "Unknown";
  const diff = Date.now() - startTimestamp * 1000;
  if (diff < 0) return "Just started";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
