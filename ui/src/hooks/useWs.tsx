import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// --- Hook: useWebSocket ------------------------------------------------------
// Handles: connect, open, message, error, close, reconnect (exp backoff + jitter),
// heartbeat, offline/online, tab visibility, send queue, clean teardown.

export type WsStatus = "idle" | "connecting" | "open" | "closing" | "closed";

export interface UseWebSocketOptions {
  url: string;
  protocols?: string | string[];
  autoReconnect?: boolean; // default: true
  maxRetries?: number; // default: Infinity
  backoffInitialMs?: number; // default: 500
  backoffMaxMs?: number; // default: 10_000
  heartbeatIntervalMs?: number; // default: 25_000 (typical ALB/NGINX timeouts ~60s)
  heartbeatMessage?:
    | string
    | ArrayBuffer
    | Blob
    | (() => string | ArrayBuffer | Blob);
  // If provided, decides whether to reconnect on close (e.g., avoid on 1000 normal close)
  shouldReconnectOnClose?: (ev: CloseEvent) => boolean;
  // Optional passive listeners
  onOpen?: (ev: Event) => void;
  onMessage?: (ev: MessageEvent) => void;
  onError?: (ev: Event) => void;
  onClose?: (ev: CloseEvent) => void;
}

export interface UseWebSocketApi {
  status: WsStatus;
  retryCount: number;
  error: Event | CloseEvent | null;
  bufferedAmount: number; // bytes currently queued in the socket buffer
  lastMessage: MessageEvent | null;
  // Sends immediately if OPEN, otherwise enqueues to flush on open
  send: (data: string | ArrayBuffer | Blob) => boolean; // returns true if sent now
  // attempt an immediate reconnect (resets backoff)
  reconnectNow: () => void;
  // graceful close (optionally with code & reason)
  close: (code?: number, reason?: string) => void;
}

function jitter(ms: number) {
  const spread = ms * 0.2; // ±20%
  return ms + (Math.random() * 2 - 1) * spread;
}

export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketApi {
  const {
    url,
    protocols,
    autoReconnect = true,
    maxRetries = Number.POSITIVE_INFINITY,
    backoffInitialMs = 500,
    backoffMaxMs = 10_000,
    heartbeatIntervalMs = 25_000,
    heartbeatMessage = () => (typeof window !== "undefined" ? "ping" : "ping"),
    shouldReconnectOnClose = (ev) =>
      ev.code !== 1000 && ev.code !== 1001 && ev.code !== 1005,
    onOpen,
    onMessage,
    onError,
    onClose,
  } = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const pendingQueueRef = useRef<(string | ArrayBuffer | Blob)[]>([]);
  const retryCountRef = useRef(0);
  const manualCloseRef = useRef(false); // track if close() was user-intended

  const [status, setStatus] = useState<WsStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<Event | CloseEvent | null>(null);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [bufferedAmount, setBufferedAmount] = useState(0);

  // --- Internal helpers ------------------------------------------------------
  const clearHeartbeat = () => {
    if (heartbeatTimer.current) {
      window.clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const flushQueue = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const q = pendingQueueRef.current;
    while (q.length) {
      const item = q.shift()!;
      ws.send(item);
    }
    setBufferedAmount(ws.bufferedAmount);
  };

  const scheduleReconnect = (_dueTo: "close" | "error") => {
    if (!autoReconnect) return;
    if (manualCloseRef.current) return; // user requested close -> do not reconnect
    if (retryCountRef.current >= maxRetries) return;

    const attempt = retryCountRef.current + 1;
    const backoff = Math.min(
      backoffMaxMs,
      backoffInitialMs * Math.pow(2, attempt - 1),
    );
    const delay = Math.max(250, jitter(backoff));

    clearReconnect();
    reconnectTimer.current = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const startHeartbeat = () => {
    clearHeartbeat();
    if (!heartbeatIntervalMs) return;
    heartbeatTimer.current = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        const msg =
          typeof heartbeatMessage === "function"
            ? heartbeatMessage()
            : heartbeatMessage;
        ws.send(msg);
      } catch {}
    }, heartbeatIntervalMs);
  };

  const bindSocketEvents = (ws: WebSocket) => {
    ws.addEventListener("open", (ev) => {
      setStatus("open");
      setError(null);
      retryCountRef.current = 0;
      setRetryCount(0);
      startHeartbeat();
      flushQueue();
      onOpen?.(ev);
    });

    ws.addEventListener("message", (ev) => {
      setLastMessage(ev);
      setBufferedAmount(ws.bufferedAmount);
      onMessage?.(ev);
    });

    ws.addEventListener("error", (ev) => {
      setError(ev);
      setStatus(ws.readyState === WebSocket.CLOSED ? "closed" : "connecting");
      onError?.(ev);
      scheduleReconnect("error");
    });

    ws.addEventListener("close", (ev) => {
      setStatus("closed");
      setError(ev);
      clearHeartbeat();
      onClose?.(ev);
      if (!manualCloseRef.current && shouldReconnectOnClose(ev)) {
        retryCountRef.current += 1;
        setRetryCount(retryCountRef.current);
        scheduleReconnect("close");
      }
    });
  };

  const connect = useCallback(() => {
    try {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return; // already connected/connecting
      }
      manualCloseRef.current = false;
      setStatus("connecting");
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;
      bindSocketEvents(ws);
    } catch (e) {
      setError(e as Event);
      scheduleReconnect("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(protocols)]);

  // Maintain connection on mount & url changes
  useEffect(() => {
    connect();
    return () => {
      // teardown
      clearReconnect();
      clearHeartbeat();
      const ws = wsRef.current;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING)
      ) {
        try {
          ws.close(1000, "component unmount");
        } catch {}
      }
      wsRef.current = null;
    };
  }, [connect]);

  // Reconnect when browser regains connectivity
  useEffect(() => {
    const onOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
        connect();
    };
    const onOffline = () => {
      // proactively close to reset state; will reconnect when back online
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1011, "offline");
        } catch {}
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [connect]);

  // Reconnect when tab becomes visible (helps with long-sleeped mobile tabs)
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) connect();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [connect]);

  const send: UseWebSocketApi["send"] = useCallback((data) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      setBufferedAmount(ws.bufferedAmount);
      return true;
    }
    pendingQueueRef.current.push(data);
    return false;
  }, []);

  const reconnectNow = useCallback(() => {
    retryCountRef.current = 0;
    setRetryCount(0);
    clearReconnect();
    const ws = wsRef.current;
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      try {
        ws.close(1012, "manual reconnect");
      } catch {}
    } else {
      connect();
    }
  }, [connect]);

  const close: UseWebSocketApi["close"] = useCallback(
    (code = 1000, reason = "client close") => {
      manualCloseRef.current = true;
      clearReconnect();
      clearHeartbeat();
      const ws = wsRef.current;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING)
      ) {
        try {
          ws.close(code, reason);
          setStatus("closing");
        } catch (e) {
          //
        }
      }
    },
    [],
  );

  return useMemo(
    () => ({
      status,
      retryCount,
      error,
      bufferedAmount,
      lastMessage,
      send,
      reconnectNow,
      close,
    }),
    [
      status,
      retryCount,
      error,
      bufferedAmount,
      lastMessage,
      send,
      reconnectNow,
      close,
    ],
  );
}
