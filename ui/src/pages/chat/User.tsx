import "@/styles/Messages.css";
import { PatpAvatar } from "@/components/Avatar";
import useLocalState from "@/state/state";
import { ArrowLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { abbreviatePatp, parseBigint } from "@/logic/utils";
import type { FC } from "@/types/trill";
import spinner from "@/assets/triangles.svg";
import { fcToMessages, getDmDeliveryMap, type DmMessageView } from "@/logic/dms";
import { patpToFallbackUID } from "@/logic/gw";
import { ProfiledRender, useDmProfileToggle, useRenderCount } from "@/logic/renderProfile";
import DmComposer from "./Composer";
import DmConversationHeader, { openUserModal } from "./Header";
import DmInlinePanel, { buildRichDmMessages } from "./InlinePanel";
import DmThread from "./Thread";
import type { ChatData, DmPanel } from "./types";

const EMPTY_DM_FEED: FC = {
  start: null,
  end: null,
  feed: {},
};

function emptyDm(peer: string): ChatData | null {
  if (!peer.startsWith("~")) return null;
  try {
    return {
      live: false,
      fc: EMPTY_DM_FEED,
      lastId: null,
      lastTs: null,
      lastRead: null,
      unread: 0,
      peer: patpToFallbackUID(peer),
      muted: false,
      blocked: false,
      delivery: {},
    };
  } catch {
    return null;
  }
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function DmRoute() {
  const params = useParams<{ id?: string }>();
  const activePeer = params.id ? safeDecode(params.id) : "";
  // keyed by peer: going from one conversation to another remounts, so
  // the old peer's messages, draft and menus never carry over
  return <Loader key={activePeer} activePeer={activePeer} />;
}

function Loader({ activePeer }: { activePeer: string }) {
  const [, navigate] = useLocation();
  const { api, lastChatFact } = useLocalState((s) => ({
    api: s.api,
    lastChatFact: s.lastChatFact,
  }));
  const [data, setData] = useState<ChatData>();

  function closeConversation() {
    navigate("/dms");
  }

  useEffect(() => {
    if (!api || !activePeer) return;
    api.scryDM(activePeer)
      .then((res) => {
        if ("ok" in res) {
          const cooked = parseBigint(res.ok);
          setData({ ...cooked, live: false });
          return;
        }
        const fallback = emptyDm(activePeer);
        if (fallback) setData(fallback);
      })
      .catch(() => {
        const fallback = emptyDm(activePeer);
        if (fallback) setData(fallback);
      });
  }, [api, activePeer]);

  useEffect(() => {
    if (!lastChatFact) return;
    setData((prev) =>
      prev && lastChatFact.peer.patp === prev.peer.patp
        ? { ...lastChatFact, live: true }
        : prev,
    );
  }, [lastChatFact]);

  if (!data) {
    return (
      <div id="screen-messages" className="trill-screen messages-screen">
        <div className="dm-conversation-shell">
          <header className="trill-screen-header dm-conversation-header">
            <button
              type="button"
              className="dm-icon-button"
              onClick={closeConversation}
              aria-label="Back to messages"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <button type="button" className="dm-peer-button">
              <PatpAvatar patp={activePeer} size={38} />
              <span className="dm-peer-copy">
                <span className="dm-peer-name">{activePeer}</span>
                <span className="dm-peer-id mono" />
              </span>
            </button>
          </header>

          <div className="y-center">
            <h2 className="x-center">Fetching...</h2>
            <div className="loading-container">
              <img src={spinner} alt="Loading" className="x-center" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ChatUser data={data} navigate={navigate} />;
}

function ChatUser({ data, navigate }: { data: ChatData; navigate: (s: string) => void }) {
  useDmProfileToggle();
  const { api, our, setModal } = useLocalState((s) => ({
    api: s.api,
    our: s.our,
    setModal: s.setModal,
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<DmPanel>("thread");
  const [searchQuery, setSearchQuery] = useState("");
  const [muted, setMuted] = useState(data.muted);
  const [blocked, setBlocked] = useState(data.blocked);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingScrollMessageId = useRef<string | null>(null);
  const initialScrolledPeer = useRef("");

  const lastId = data.lastId ? data.lastId.toString() : "";
  const name = data.peer.gwid.english.abridged || data.peer.patp;
  const id2 = abbreviatePatp(data.peer.patp);
  const messages = useMemo(
    () => fcToMessages(data.fc, our?.patp || "", data.lastRead, getDmDeliveryMap(data)),
    [data.fc, data.delivery, our?.patp, data.lastRead],
  );
  const pendingApproval = messages.length === 1 && messages[0]?.delivery === "pending";
  const richMessages = useMemo(
    () => buildRichDmMessages(data.fc, our?.patp || ""),
    [data.fc, our?.patp],
  );

  useRenderCount("ChatUser", () => ({
    peer: data.peer.patp,
    panel,
    messageCount: messages.length,
    searchQueryLength: searchQuery.length,
  }));

  function closeConversation() {
    navigate("/dms");
  }

  function openPeer() {
    setModal(openUserModal(data.peer));
  }

  async function toggleMuted() {
    if (!api) return;
    const next = !muted;
    setMuted(next);
    setMenuOpen(false);
    const res = next
      ? await api.muteChat(data.peer.patp)
      : await api.unmuteChat(data.peer.patp);
    if ("error" in res) setMuted(!next);
  }

  async function toggleBlocked() {
    if (!api) return;
    const next = !blocked;
    setBlocked(next);
    setMenuOpen(false);
    const res = next
      ? await api.blockChat(data.peer.patp)
      : await api.unblockChat(data.peer.patp);
    if ("error" in res) setBlocked(!next);
  }

  function openPanel(next: DmPanel) {
    setPanel(next);
    setMenuOpen(false);
  }

  function jumpToMessage(messageId: string) {
    pendingScrollMessageId.current = messageId;
    setHighlightedMessageId(messageId);
    setPanel("thread");
  }

  async function retryMessage(message: DmMessageView) {
    if (!api || !message.text.trim()) return;
    const res = await api.addChat(data.peer.patp, message.text);
    if ("error" in res) console.error("Failed to retry DM:", res.error);
  }

  useEffect(() => {
    if (!api || !data.lastId) return;
    if (data.lastRead !== data.lastId) void api.markChatRead(data);
  }, [api, data]);

  useEffect(() => {
    setMuted(data.muted);
    setBlocked(data.blocked);
  }, [data.peer.patp, data.muted, data.blocked]);

  useLayoutEffect(() => {
    if (panel !== "thread") return;
    if (pendingScrollMessageId.current) return;
    const thread = threadRef.current;
    if (!thread) return;

    const isInitialScroll = initialScrolledPeer.current !== lastId;
    const scrollToBottom = () => {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior: isInitialScroll ? "auto" : "smooth",
      });
      threadBottomRef.current?.scrollIntoView({
        block: "end",
        behavior: isInitialScroll ? "auto" : "smooth",
      });
      initialScrolledPeer.current = lastId;
    };

    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [data.lastId, data.fc.feed, panel, lastId]);

  useLayoutEffect(() => {
    if (panel !== "thread") return;
    const messageId = pendingScrollMessageId.current;
    if (!messageId) return;

    const target = messageRefs.current.get(messageId);
    if (!target) return;

    target.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    pendingScrollMessageId.current = null;
  }, [panel, highlightedMessageId]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timeout = window.setTimeout(() => {
      setHighlightedMessageId((current) => current === highlightedMessageId ? null : current);
    }, 4800);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <ProfiledRender id="DM ChatUser">
      <div
        id="screen-messages"
        className={`trill-screen messages-screen conversation-open${muted ? " conversation-muted" : ""}${blocked ? " conversation-blocked" : ""}`}
      >
        <div className="dm-conversation-shell">
          <DmConversationHeader
            peer={data.peer}
            name={name}
            id2={id2}
            muted={muted}
            blocked={blocked}
            menuOpen={menuOpen}
            menuRef={menuRef}
            onBack={closeConversation}
            onOpenPeer={openPeer}
            onToggleMenu={() => setMenuOpen((open) => !open)}
            onToggleMuted={toggleMuted}
            onToggleBlocked={toggleBlocked}
            onOpenPanel={openPanel}
          />

          {panel === "thread" ? (
            <ProfiledRender id="DM Thread">
              <DmThread
                messages={messages}
                live={data.live}
                lastRead={data.lastRead}
                peerName={name}
                pendingApproval={pendingApproval}
                highlightedMessageId={highlightedMessageId}
                threadRef={threadRef}
                threadBottomRef={threadBottomRef}
                messageRefs={messageRefs}
                onRetryMessage={retryMessage}
              />
            </ProfiledRender>
          ) : (
            <ProfiledRender id="DM InlinePanel">
              <DmInlinePanel
                panel={panel}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                richMessages={richMessages}
                onSearchResultClick={jumpToMessage}
                onClose={() => openPanel("thread")}
              />
            </ProfiledRender>
          )}

          <ProfiledRender id="DM Composer">
            <DmComposer api={api} peer={data.peer.patp} blocked={blocked} />
          </ProfiledRender>
        </div>
      </div>
    </ProfiledRender>
  );
}
