import { useWebSocket } from "@/hooks/useWs";
import { useState } from "react";

type WidgetProps = {
  url: string;
  protocols?: string | string[];
};

export default function WebSocketWidget({ url, protocols }: WidgetProps) {
  const {
    status,
    retryCount,
    lastMessage,
    error,
    bufferedAmount,
    send,
    reconnectNow,
    close,
  } = useWebSocket({
    url,
    protocols,
    onMessage: (ev) => {
      // Example: auto reply to pings
      if (
        typeof ev.data === "string" &&
        // ev.data.toLowerCase().includes("ping")
        ev.data.toLowerCase().trim() == "ping"
      ) {
        try {
          send("pong");
        } catch {}
      }
    },
  });

  const [outbound, setOutbound] = useState("");

  return (
    <div className="w-full max-w-xl mx-auto p-4 grid gap-3">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">WebSocketWidget</h1>
        <span
          className="text-sm px-2 py-1 rounded-full border"
          style={{
            backgroundColor:
              status === "open"
                ? "green"
                : status === "closed"
                  ? "red"
                  : "transparent",
            color:
              status === "open"
                ? "white"
                : status === "closed"
                  ? "white"
                  : "var(--text-color)",
          }}
        >
          {status.toUpperCase()} {retryCount ? `(retry ${retryCount})` : ""}
        </span>
      </header>

      <div className="text-sm text-gray-600">
        <div>
          <b>URL:</b> {url}
        </div>
        <div>
          <b>Buffered:</b> {bufferedAmount} bytes
        </div>
        {error && (
          <div className="text-red-600">
            <b>Error:</b>{" "}
            {"message" in error
              ? (error as any).message
              : String(error.type || "error")}
          </div>
        )}
      </div>

      <div className="p-3 rounded-2xl border bg-gray-50 min-h-[4rem] font-mono text-sm break-words">
        <div className="opacity-70">Last message:</div>
        <div>
          {lastMessage
            ? typeof lastMessage.data === "string"
              ? lastMessage.data
              : "(binary)"
            : "—"}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!outbound) return;
          send(outbound);
          setOutbound("");
        }}
      >
        <input
          className="flex-1 px-3 py-2 rounded-xl border"
          placeholder="Type message…"
          value={outbound}
          onChange={(e) => setOutbound(e.target.value)}
        />
        <button type="submit" className="px-3 py-2 rounded-xl border">
          Send
        </button>
      </form>

      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={reconnectNow}>
          Reconnect
        </button>
        <button className="px-3 py-2 rounded-xl border" onClick={() => close()}>
          Close
        </button>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer">Usage</summary>
        <pre className="text-xs bg-gray-100 p-2 rounded-xl overflow-auto">
          {`import WebSocketWidget from "./WebSocketWidget";

export default function App() {
  return (
    <div className="p-6">
      <WebSocketWidget url="wss://echo.websocket.events" />
    </div>
  );
}
`}
        </pre>
      </details>
    </div>
  );
}
