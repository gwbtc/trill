import "@/styles/Messages.css";
import NewDmModal from "@/components/modals/NewDmModal";
import TabStrip from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { useChatStore, chatUnreadCount } from "@/state/chat";
import { conversationPreview } from "@/logic/tlon/story";
import type { TlonConversation } from "@/logic/tlon/types";
import { unwrap } from "@/logic/result";
import {
  Ban,
  BellOff,
  Check,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pin,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "wouter";
import { ConversationAvatar, useConversationName } from "./Conversation";

type Tab = "inbox" | "requests" | "muted" | "blocked" | "archived";
export default function ChatIndex() {
  const [, navigate] = useLocation();
  const { api, setModal, uiSettings } = useLocalState((s) => ({
    api: s.api,
    setModal: s.setModal,
    uiSettings: s.uiSettings,
  }));
  const conversations = useChatStore((s) => s.conversations);
  const muted = useChatStore((s) => s.muted);
  const status = useChatStore((s) => s.status);
  const error = useChatStore((s) => s.error);
  const muteError = useChatStore((s) => s.muteError);
  const [tab, setTab] = useState<Tab>("inbox");
  const [pins, setPins] = useState<string[]>([]);
  const [savingPins, setSavingPins] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const autoSelected = useRef(false);
  useEffect(() => {
    const value =
      uiSettings?.["trill-chat"]?.pinned ?? uiSettings?.noschat?.pinned;
    setPins(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [],
    );
  }, [uiSettings]);
  const all = [...conversations.values()].sort(
    (a, b) =>
      Number(pins.includes(b.id)) - Number(pins.includes(a.id)) ||
      b.recency - a.recency,
  );
  function category(row: TlonConversation): Tab {
    return row.blocked
      ? "blocked"
      : row.invited
        ? "requests"
        : row.archived
          ? "archived"
          : muted.has(row.id)
            ? "muted"
            : "inbox";
  }
  const requests = all.filter((row) => category(row) === "requests");
  const inbox = all.filter((row) => category(row) === "inbox");
  useEffect(() => {
    if (status !== "ready" || autoSelected.current) return;
    autoSelected.current = true;
    if (!inbox.length && requests.length) setTab("requests");
  }, [status, inbox.length, requests.length]);
  async function pin(id: string) {
    if (!api || savingPins || !uiSettings) return;
    const next = pins.includes(id)
      ? pins.filter((value) => value !== id)
      : [...pins, id];
    setSavingPins(true);
    try {
      unwrap(await api.setSettings("trill-chat", "pinned", next));
      setPins(next);
    } catch {
      toast.error("Failed to save pinned chats");
    } finally {
      setSavingPins(false);
    }
  }
  async function action(id: string, operation: () => Promise<void>) {
    setPending((current) => new Set(current).add(id));
    try {
      await operation();
    } catch {
      toast.error("Chat action failed. Please try again.");
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }
  const shown = all.filter((row) => category(row) === tab);
  return (
    <div id="screen-messages" className="trill-screen messages-screen">
      <header className="trill-screen-header dm-inbox-header">
        <div className="dm-inbox-title-row">
          <h1>Messages</h1>
          <span className="dm-encrypted-pill">
            <Lock size={12} />
            encrypted
          </span>
          <button
            type="button"
            className="dm-new-button"
            aria-label="New message"
            onClick={() => setModal(<NewDmModal />)}
            disabled={status !== "ready"}
          >
            <MessageSquarePlus size={20} />
          </button>
        </div>
        <TabStrip
          id="dm-index-tabs"
          className="dm-index-tabs"
          active={tab}
          onChange={setTab}
          items={(
            ["inbox", "requests", "muted", "blocked", "archived"] as const
          ).map((key) => ({
            key,
            label: (
              <span className="dm-tab-label">
                {key[0].toUpperCase() + key.slice(1)}
                {key !== "inbox" &&
                  all.some((row) => category(row) === key) && (
                    <span className="dm-tab-count">
                      {all.filter((row) => category(row) === key).length}
                    </span>
                  )}
              </span>
            ),
          }))}
        />
      </header>
      {status === "error" ? (
        <div className="dm-empty-state" role="alert">
          <h2>Chat unavailable</h2>
          <p>{error}</p>
          <button onClick={() => useChatStore.getState().reconnect()}>
            Retry
          </button>
        </div>
      ) : status !== "ready" ? (
        <div className="dm-empty-state" role="status">
          Loading messages...
        </div>
      ) : (
        <>
          {muteError && (
            <div className="dm-chat-error" role="status">
              Notification settings are unavailable.{" "}
              <button onClick={() => useChatStore.getState().reconnect()}>
                Retry
              </button>
            </div>
          )}
          {shown.length ? (
            <div
              className={
                tab === "requests" ? "dm-request-list" : "dm-inbox-list"
              }
            >
              {shown.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  muted={muted.has(row.id)}
                  pinned={pins.includes(row.id)}
                  pending={pending.has(row.id)}
                  pinDisabled={savingPins || !uiSettings}
                  onOpen={() => navigate(`/dms/${encodeURIComponent(row.id)}`)}
                  onPin={() => void pin(row.id)}
                  onAccept={() =>
                    void action(row.id, () =>
                      useChatStore.getState().respond(row.id, true),
                    )
                  }
                  onReject={() =>
                    void action(row.id, () =>
                      useChatStore.getState().respond(row.id, false),
                    )
                  }
                  onMute={() =>
                    void action(row.id, () =>
                      useChatStore.getState().mute(row.id, !muted.has(row.id)),
                    )
                  }
                  onBlock={() =>
                    void action(row.id, () =>
                      useChatStore.getState().block(row.id, !row.blocked),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="dm-empty-state">
              <span className="dm-empty-icon">
                <MessageSquare size={32} />
              </span>
              <h2>
                {tab === "inbox"
                  ? "No messages yet"
                  : `No ${tab === "requests" ? "message requests" : `${tab} conversations`}`}
              </h2>
              <p>
                {tab === "inbox"
                  ? "Start a private conversation with one person or several."
                  : "Conversations in this category will appear here."}
              </p>
              {tab === "inbox" && (
                <button onClick={() => setModal(<NewDmModal />)}>
                  New message
                </button>
              )}
            </div>
          )}
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {chatUnreadCount(conversations, muted)} unread messages
      </span>
    </div>
  );
}
function Row({
  row,
  muted,
  pinned,
  pending,
  pinDisabled,
  onOpen,
  onPin,
  onAccept,
  onReject,
  onMute,
  onBlock,
}: {
  row: TlonConversation;
  muted: boolean;
  pinned: boolean;
  pending: boolean;
  pinDisabled: boolean;
  onOpen: () => void;
  onPin: () => void;
  onAccept: () => void;
  onReject: () => void;
  onMute: () => void;
  onBlock: () => void;
}) {
  const name = useConversationName(row);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  return (
    <article
      className={
        row.invited
          ? "dm-request-row"
          : `trill-dm-row${row.unread ? " unread" : ""}${pinned ? " pinned" : ""}${muted ? " muted" : ""}${row.blocked ? " blocked" : ""}`
      }
    >
      <button
        type="button"
        className="dm-open-conversation"
        onClick={onOpen}
        aria-label={`Open conversation with ${name}`}
      >
        <ConversationAvatar conversation={row} size={46} />
        <span className="dm-row-main">
          <span className="dm-row-top">
            <span className="dm-row-name">{name}</span>
            <span className="dm-row-id mono">
              {row.kind === "group" ? `${row.members.length} members` : row.id}
            </span>
            {muted && <BellOff size={12} />}
            {row.blocked && <Ban size={12} />}
            <span className="dm-row-time mono">
              {row.recency ? new Date(row.recency).toLocaleDateString() : ""}
            </span>
          </span>
          <span className="dm-row-bottom">
            <span className="dm-row-preview">
              {row.latest
                ? conversationPreview(row.latest.content)
                : "No messages yet"}
            </span>
            {row.unread > 0 && (
              <span className="dm-row-unread">{row.unread}</span>
            )}
          </span>
        </span>
      </button>
      {row.invited ? (
        <span className="dm-request-actions">
          <button
            type="button"
            className="dm-request-action accept"
            disabled={pending}
            onClick={onAccept}
            aria-label={`Accept request from ${name}`}
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            className="dm-request-action reject"
            disabled={pending}
            onClick={onReject}
            aria-label={`Reject request from ${name}`}
          >
            <X size={15} />
          </button>
          <span className="dm-request-menu" ref={menuRef}>
            <button
              className="dm-request-action menu"
              disabled={pending}
              aria-label={`Request options for ${name}`}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menu && (
              <span className="dm-request-context-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onMute();
                  }}
                >
                  {muted ? "Unmute" : "Mute"}
                </button>
                {row.kind === "direct" && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onBlock();
                    }}
                  >
                    Block
                  </button>
                )}
              </span>
            )}
          </span>
        </span>
      ) : (
        <button
          type="button"
          className={`dm-pin-button${pinned ? " pinned" : ""}`}
          disabled={pinDisabled}
          onClick={onPin}
          aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
        >
          <Pin size={14} fill={pinned ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}
