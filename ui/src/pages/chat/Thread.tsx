import type { TlonMessage } from "@/logic/tlon/types";
import { Lock, RefreshCw } from "lucide-react";
import type { RefObject } from "react";
import Story from "./Story";

export default function DmThread({
  messages,
  our,
  group,
  highlighted,
  firstUnread,
  threadRef,
  messageRefs,
  older,
  loading,
  onOlder,
  onRetry,
}: {
  messages: TlonMessage[];
  our: string;
  group: boolean;
  highlighted: string | null;
  firstUnread?: string;
  threadRef: RefObject<HTMLDivElement | null>;
  messageRefs: RefObject<Map<string, HTMLDivElement>>;
  older: boolean;
  loading: boolean;
  onOlder: () => void;
  onRetry: (message: TlonMessage) => void;
}) {
  return (
    <div className="dm-thread-scroll" ref={threadRef}>
      <div className="dm-encryption-note">
        <Lock size={13} />
        <span>Messages are end-to-end encrypted</span>
      </div>
      {older && (
        <button
          type="button"
          className="dm-load-older"
          onClick={onOlder}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load older messages"}
        </button>
      )}
      <div id="dm-thread">
        {messages.map((message, index) => {
          const day = new Date(message.sent).toLocaleDateString();
          const previous = messages[index - 1];
          const mine = message.author === our;
          return (
            <div className="dm-message-block" key={message.id}>
              {(!previous ||
                new Date(previous.sent).toLocaleDateString() !== day) && (
                <div className="dm-day-break">{day}</div>
              )}
              {firstUnread === message.time && (
                <div className="dm-unread-break">
                  <span>Unread</span>
                </div>
              )}
              <div
                ref={(node) => {
                  if (node) messageRefs.current.set(message.id, node);
                  else messageRefs.current.delete(message.id);
                }}
                tabIndex={highlighted === message.id ? -1 : undefined}
                className={`dm-message-row ${mine ? "mine" : "theirs"}${highlighted === message.id ? " highlighted" : ""}${message.delivery ? ` delivery-${message.delivery}` : ""}`}
              >
                <div className="dm-bubble">
                  {group && !mine && (
                    <div className="dm-message-author mono">
                      {message.author}
                    </div>
                  )}
                  <div className="dm-bubble-text">
                    <Story content={message.content} />
                  </div>
                  {message.delivery && (
                    <div className={`dm-delivery-status ${message.delivery}`}>
                      <span>
                        {message.delivery === "sending"
                          ? "Sending..."
                          : "Failed to send"}
                      </span>
                      {message.delivery === "failed" && (
                        <button
                          type="button"
                          onClick={() => onRetry(message)}
                          aria-label="Retry failed message"
                        >
                          <RefreshCw size={12} />
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  <div className="dm-bubble-time mono">
                    {new Date(message.sent).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
