// real relay latency: time an HTTP round-trip to the relay host.
// nostr relays serve a NIP-11 information document over https on
// the same address, so this measures the actual network path
// without opening extra websockets. null = unreachable/unmeasured.
export async function pingRelay(
  url: string,
  timeoutMs = 5000,
): Promise<number | null> {
  const httpUrl = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const startAt = performance.now();
  try {
    await fetch(httpUrl, {
      headers: { Accept: "application/nostr+json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    return Math.round(performance.now() - startAt);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingRelays(
  urls: string[],
): Promise<Record<string, number | null>> {
  const entries = await Promise.all(
    urls.map(async (url) => [url, await pingRelay(url)] as const),
  );
  return Object.fromEntries(entries);
}
