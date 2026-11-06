import "@/styles/Messages.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useChatStore } from "@/state/chat";
import useLocalState from "@/state/state";
import { normalizeTlonWhom } from "@/logic/tlon/client";
import { conversationPreview } from "@/logic/tlon/story";
import { patpToFallbackUID } from "@/logic/gw";
import toast from "react-hot-toast";
import DmComposer from "./Composer";
import DmConversationHeader, { openUserModal } from "./Header";
import DmInlinePanel, { buildRichDmMessages } from "./InlinePanel";
import DmThread from "./Thread";
import { useConversationName } from "./Conversation";
import type { DmPanel } from "./types";

const EMPTY_MESSAGES: import("@/logic/tlon/types").TlonMessage[] = [];
export default function DmRoute() {
  const { id = "" } = useParams<{ id?: string }>();
  let target: string;
  try {
    target = normalizeTlonWhom(decodeURIComponent(id));
  } catch {
    return (
      <div className="dm-empty-state">
        <h2>Invalid conversation address</h2>
        <a href="/apps/nostrill/dms">Back to messages</a>
      </div>
    );
  }
  return <Conversation key={target} id={target} />;
}
function Conversation({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const status = useChatStore((s) => s.status);
  const error = useChatStore((s) => s.error);
  const row = useChatStore((s) => s.conversations.get(id));
  const thread = useChatStore((s) => s.threads.get(id));
  const our = useChatStore((s) => s.our);
  const muted = useChatStore((s) => s.muted.has(id));
  const name = useConversationName(row);
  const setModal = useLocalState((s) => s.setModal);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [panel, setPanel] = useState<DmPanel>("thread");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const firstUnread = useRef(row?.firstUnreadTime);
  const messages = thread?.messages ?? EMPTY_MESSAGES;
  const rich = useMemo(
    () => buildRichDmMessages(messages, our),
    [messages, our],
  );
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (status === "ready") void useChatStore.getState().open(id);
  }, [status, id]);
  useEffect(() => {
    if (
      !thread?.loaded ||
      !row?.unread ||
      row.invited ||
      panel !== "thread" ||
      document.visibilityState !== "visible"
    )
      return;
    firstUnread.current ??= row.firstUnreadTime;
    void useChatStore
      .getState()
      .read(id)
      .catch(() => {});
  }, [id, row?.unread, row?.latest?.id, row?.invited, thread?.loaded, panel]);
  useEffect(() => {
    const readVisible = () => {
      if (
        document.visibilityState === "visible" &&
        panel === "thread" &&
        useChatStore.getState().threads.get(id)?.loaded
      ) {
        void useChatStore
          .getState()
          .read(id)
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", readVisible);
    window.addEventListener("focus", readVisible);
    return () => {
      document.removeEventListener("visibilitychange", readVisible);
      window.removeEventListener("focus", readVisible);
    };
  }, [id, panel]);
  useLayoutEffect(() => {
    if (panel !== "thread") return;
    const target = highlighted ? messageRefs.current.get(highlighted) : null;
    if (target) target.scrollIntoView({ block: "center" });
    else if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lastId, panel, highlighted]);
  useEffect(() => {
    if (!menuOpen) return;
    const pointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [menuOpen]);
  async function action(operation: () => Promise<void>) {
    setMenuOpen(false);
    try {
      await operation();
    } catch {
      toast.error("Chat action failed. Please try again.");
    }
  }
  async function respond(accept: boolean) {
    setResponding(true);
    try {
      await useChatStore.getState().respond(id, accept);
      if (!accept) navigate("/dms");
    } catch {
      toast.error("Could not update this request");
    } finally {
      setResponding(false);
    }
  }
  async function older() {
    const node = scrollRef.current;
    const before = node?.scrollHeight ?? 0;
    await useChatStore.getState().older(id);
    requestAnimationFrame(() => {
      if (node) node.scrollTop += node.scrollHeight - before;
    });
  }
  if (status === "error")
    return (
      <div className="dm-empty-state" role="alert">
        <h2>Chat unavailable</h2>
        <p>{error}</p>
        <button onClick={() => useChatStore.getState().reconnect()}>
          Retry
        </button>
      </div>
    );
  if (!row && status === "ready" && thread)
    return (
      <div className="dm-empty-state" role="alert">
        <h2>Conversation unavailable</h2>
        <p>
          {thread.error || "This conversation is no longer in your messages."}
        </p>
        <button onClick={() => navigate("/dms")}>Back to messages</button>
      </div>
    );
  if (!row || !thread)
    return (
      <div className="dm-empty-state" role="status">
        Loading conversation...
      </div>
    );
  return (
    <div
      id="screen-messages"
      className={`trill-screen messages-screen conversation-open${muted ? " conversation-muted" : ""}${row.blocked ? " conversation-blocked" : ""}`}
    >
      <div className="dm-conversation-shell">
        <DmConversationHeader
          conversation={row}
          name={name}
          id2={row.kind === "group" ? `${row.members.length} members` : id}
          muted={muted}
          blocked={row.blocked}
          menuOpen={menuOpen}
          menuRef={menuRef}
          onBack={() => navigate("/dms")}
          onOpenPeer={() =>
            row.kind === "direct"
              ? setModal(openUserModal(patpToFallbackUID(id)))
              : setMembersOpen((v) => !v)
          }
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onToggleMuted={() =>
            void action(() => useChatStore.getState().mute(id, !muted))
          }
          onToggleBlocked={() =>
            void action(() => useChatStore.getState().block(id, !row.blocked))
          }
          onOpenPanel={(next) => {
            setPanel(next);
            setMenuOpen(false);
          }}
        />
        {membersOpen && (
          <section className="dm-members" aria-label="Group members">
            {[...new Set([...row.members, ...row.invitedMembers])].map(
              (ship) => (
                <button
                  key={ship}
                  onClick={() =>
                    setModal(openUserModal(patpToFallbackUID(ship)))
                  }
                >
                  {ship}
                  {row.invitedMembers.includes(ship) ? " (invited)" : ""}
                </button>
              ),
            )}
          </section>
        )}
        {row.invited && (
          <div className="dm-request-banner">
            Message request{" "}
            <button disabled={responding} onClick={() => void respond(true)}>
              Accept
            </button>
            <button disabled={responding} onClick={() => void respond(false)}>
              Reject
            </button>
          </div>
        )}
        {thread.error && (
          <div className="dm-chat-error" role="alert">
            {thread.error}
            <button
              onClick={() =>
                void (thread.loaded
                  ? older()
                  : useChatStore.getState().open(id))
              }
            >
              Retry loading
            </button>
          </div>
        )}
        {!thread.loaded && thread.loading && (
          <div className="dm-chat-error" role="status">
            Loading messages...
          </div>
        )}
        {panel === "thread" ? (
          <DmThread
            messages={messages}
            our={our}
            group={row.kind === "group"}
            highlighted={highlighted}
            firstUnread={firstUnread.current}
            threadRef={scrollRef}
            messageRefs={messageRefs}
            older={!!thread.older}
            loading={thread.loading}
            onOlder={() => void older()}
            onRetry={(message) =>
              void action(() =>
                useChatStore
                  .getState()
                  .send(id, conversationPreview(message.content)),
              )
            }
          />
        ) : (
          <DmInlinePanel
            panel={panel}
            searchQuery={query}
            setSearchQuery={setQuery}
            richMessages={rich}
            onSearchResultClick={(messageId) => {
              setHighlighted(messageId);
              setPanel("thread");
            }}
            onClose={() => {
              setHighlighted(null);
              setPanel("thread");
            }}
          />
        )}
        {!row.invited && (
          <DmComposer
            peer={id}
            blocked={row.blocked}
            disabledReason={
              row.archived
                ? "This conversation is archived."
                : !thread.loaded
                  ? "Loading messages..."
                  : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
