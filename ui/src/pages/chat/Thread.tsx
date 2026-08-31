import Contents from "@/components/post/Contents";
import type { DmMessageView } from "@/logic/dms";
import { Lock, RefreshCw } from "lucide-react";
import type { MutableRefObject, RefObject } from "react";

export default function DmThread({
  messages,
  live,
  lastRead,
  peerName,
  pendingApproval,
  highlightedMessageId,
  threadRef,
  threadBottomRef,
  messageRefs,
  onRetryMessage,
}: {
  messages: DmMessageView[];
  live: boolean;
  lastRead: bigint | null;
  peerName: string;
  pendingApproval: boolean;
  highlightedMessageId: string | null;
  threadRef: RefObject<HTMLDivElement | null>;
  threadBottomRef: RefObject<HTMLDivElement | null>;
  messageRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onRetryMessage: (message: DmMessageView) => void;
}) {
  return (
    <div className="dm-thread-scroll" ref={threadRef}>
      <div className="dm-encryption-note">
        <Lock size={13} strokeWidth={2} />
        <span>Messages are end-to-end encrypted</span>
      </div>
      {pendingApproval && (
        <div className="dm-pending-approval-note" role="status">
          <Lock size={14} strokeWidth={2} />
          <span>This chat request is waiting for {peerName} to approve it.</span>
        </div>
      )}
      <div id="dm-thread">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const startsUnread = previous?.id === lastRead;
          const highlighted = highlightedMessageId === message.id.toString();

          return (
            <div className="dm-message-block" key={`${message.id}-${index}`}>
              {message.day && <div className="dm-day-break">{message.day}</div>}
              {!live && startsUnread && (
                <div className="dm-unread-break">
                  <span>Unread</span>
                </div>
              )}
              <div
                ref={(node) => {
                  const id = message.id.toString();
                  if (node) messageRefs.current.set(id, node);
                  else messageRefs.current.delete(id);
                }}
                tabIndex={highlighted ? -1 : undefined}
                className={`dm-message-row ${message.mine ? "mine" : "theirs"}${message.unread ? " unread" : ""}${highlighted ? " highlighted" : ""}${message.delivery ? ` delivery-${message.delivery}` : ""}`}
              >
                <div className="dm-bubble">
                  <div className="dm-bubble-text">
                    <Contents contents={message.post.contents} />
                  </div>
                  {message.delivery && message.delivery !== "pending" && (
                    <div className={`dm-delivery-status ${message.delivery}`}>
                      <span>{message.delivery === "sending" ? "Sending..." : "Failed to send"}</span>
                      {message.delivery === "failed" && (
                        <button
                          type="button"
                          onClick={() => onRetryMessage(message)}
                          aria-label="Retry failed message"
                          title="Retry"
                        >
                          <RefreshCw size={12} strokeWidth={2} />
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  <div className="dm-bubble-time mono">{message.time}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={threadBottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
