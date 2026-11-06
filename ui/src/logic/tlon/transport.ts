import type { TlonTransport } from "./client";

export function acknowledgedPoke(
  transport: TlonTransport,
  app: string,
  mark: string,
  json: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transport
      .poke({
        app,
        mark,
        json,
        onSuccess: resolve,
        onError: (error) => reject(new Error(String(error))),
      })
      .catch(reject);
  });
}

// One owner for setup, kick handling and cleanup across Tlon agents. A late
// subscription result is closed even if a companion watch already failed.
export async function watchTlon(
  transport: TlonTransport,
  watches: Array<{ app: string; path: string; event: (data: unknown) => void }>,
  onError: (error: unknown) => void,
): Promise<() => Promise<void>> {
  let active = true;
  const ids: number[] = [];
  const stop = async () => {
    active = false;
    await Promise.all(ids.splice(0).map((id) => transport.unsubscribe(id)));
  };
  const terminate = (error: unknown) => {
    if (!active) return;
    try {
      onError(error);
    } finally {
      void stop().catch(onError);
    }
  };
  try {
    for (const { app, path, event } of watches) {
      const id = await transport.subscribe({
        app,
        path,
        resubOnQuit: false,
        event: (data) => {
          if (active) {
            try {
              event(data);
            } catch (error) {
              terminate(error);
            }
          }
        },
        err: terminate,
        quit: () =>
          terminate(new Error(`Tlon subscription ended: ${app}${path}`)),
      });
      if (!active) {
        await transport.unsubscribe(id);
        throw new Error(`Tlon subscription ended during setup: ${path}`);
      }
      ids.push(id);
    }
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}
