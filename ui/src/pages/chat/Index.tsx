import "@/styles/Messages.css";
import { unwrap } from "@/logic/result";
import Avatar from "@/components/Avatar";
import NewDmModal from "@/components/modals/NewDmModal";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState, { useStore } from "@/state/state";
import {
  buildDmConversations,
  buildDmRequestRows,
  getDmUnreadCount,
  getPinnedDmPatps,
  mergeDmJailConversations,
  orderPinnedDmConversations,
} from "@/logic/dms";
import { Ban, BellOff, Check, Lock, MessageSquare, MessageSquarePlus, MoreHorizontal, Pin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import toast from "react-hot-toast";
import { useLocation } from "wouter";

type DmIndexTab = "inbox" | "requests" | "muted" | "blocked";

export default function ChatIndex() {
  const [, navigate] = useLocation();
  const { api, dms, dmRequests, dmJail, setDmRequests, profiles, our, setModal, uiSettings } = useLocalState((s) => ({
    api: s.api,
    dms: s.dms,
    dmRequests: s.dmRequests,
    dmJail: s.dmJail,
    setDmRequests: s.setDmRequests,
    profiles: s.profiles,
    our: s.our,
    setModal: s.setModal,
    uiSettings: s.uiSettings,
  }));
  const baseConversations = useMemo(
    () => buildDmConversations(dms, profiles, our?.patp || ""),
    [dms, profiles, our?.patp],
  );
  const conversations = useMemo(
    () => mergeDmJailConversations(baseConversations, dmJail),
    [baseConversations, dmJail],
  );
  const [pinnedPatps, setPinnedPatps] = useState(() => getPinnedDmPatps(uiSettings));
  const orderedConversations = useMemo(
    () => orderPinnedDmConversations(conversations, pinnedPatps),
    [conversations, pinnedPatps],
  );
  const inboxConversations = useMemo(
    () =>
      orderedConversations.filter(
        (conversation) => !conversation.muted && !conversation.blocked,
      ),
    [orderedConversations],
  );
  const mutedConversations = useMemo(
    () =>
      orderedConversations.filter(
        (conversation) => conversation.muted && !conversation.blocked,
      ),
    [orderedConversations],
  );
  const blockedConversations = useMemo(
    () => orderedConversations.filter((conversation) => conversation.blocked),
    [orderedConversations],
  );
  const requestRows = useMemo(() => buildDmRequestRows(dmRequests), [dmRequests]);
  const [activeTab, setActiveTab] = useState<DmIndexTab>("inbox");
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(() => new Set());
  const [openRequestMenu, setOpenRequestMenu] = useState<string | null>(null);
  const requestMenuRef = useRef<HTMLDivElement>(null);
  const didAutoSelectRequests = useRef(false);
  const unreadCount = getDmUnreadCount(dms);
  const tabs: TabItem<DmIndexTab>[] = [
    { key: "inbox", label: "Inbox" },
    {
      key: "requests",
      label: (
        <span className="dm-tab-label">
          Requests
          {requestRows.length > 0 && (
            <span className="dm-tab-count">{requestRows.length}</span>
          )}
        </span>
      ),
    },
    {
      key: "muted",
      label: (
        <span className="dm-tab-label">
          Muted
          {mutedConversations.length > 0 && (
            <span className="dm-tab-count muted">{mutedConversations.length}</span>
          )}
        </span>
      ),
    },
    {
      key: "blocked",
      label: (
        <span className="dm-tab-label">
          Blocked
          {blockedConversations.length > 0 && (
            <span className="dm-tab-count blocked">{blockedConversations.length}</span>
          )}
        </span>
      ),
    },
  ];

  useEffect(() => {
    setPinnedPatps(getPinnedDmPatps(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    if (didAutoSelectRequests.current) return;
    if (inboxConversations.length === 0 && requestRows.length > 0) {
      setActiveTab("requests");
      didAutoSelectRequests.current = true;
    }
  }, [inboxConversations.length, requestRows.length]);

  useEffect(() => {
    if (!openRequestMenu) return;
    function onPointerDown(event: PointerEvent) {
      if (!requestMenuRef.current?.contains(event.target as Node)) {
        setOpenRequestMenu(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenRequestMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openRequestMenu]);

  function openPicker() {
    setModal(<NewDmModal />);
  }

  function openConversation(id: string) {
    navigate(`/dms/${encodeURIComponent(id)}`);
  }

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openConversation(id);
  }

  async function savePinnedChats(nextPatps: string[], previousPatps: string[]) {
    if (!api) {
      toast.error("Chat settings are not ready");
      return;
    }

    setPinnedPatps(nextPatps);
    try {
      unwrap(await api.setSettings("noschat", "pinned", nextPatps));
    } catch (error) {
      setPinnedPatps(previousPatps);
      toast.error("Failed to save pinned chats");
      console.error("Pinned chat save error:", error);
    }
  }

  function togglePinnedChat(id: string) {
    const previousPatps = pinnedPatps;
    const nextPatps = previousPatps.includes(id)
      ? previousPatps.filter((patp) => patp !== id)
      : [...previousPatps, id];

    savePinnedChats(nextPatps, previousPatps);
  }

  function setRequestPending(id: string, pending: boolean) {
    setPendingRequests((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function acceptRequest(id: string) {
    if (!api) {
      toast.error("Chat requests are not ready");
      return;
    }
    const request = dmRequests[id];
    if (!request) return;
    const nextRequests = { ...dmRequests };
    delete nextRequests[id];
    setRequestPending(id, true);
    setDmRequests(nextRequests);
    try {
      const res = await api.acceptReq(id);
      if ("error" in res) throw new Error(res.error);
    } catch (error) {
      // put back just this request; other requests may have changed meanwhile
      setDmRequests({ ...useStore.getState().dmRequests, [id]: request });
      toast.error("Failed to accept message request");
      console.error("Accept DM request error:", error);
    } finally {
      setRequestPending(id, false);
    }
  }

  async function rejectRequest(id: string) {
    if (!api) {
      toast.error("Chat requests are not ready");
      return;
    }
    const request = dmRequests[id];
    if (!request) return;
    const nextRequests = { ...dmRequests };
    delete nextRequests[id];
    setRequestPending(id, true);
    setDmRequests(nextRequests);
    try {
      const res = await api.rejectReq(id);
      if ("error" in res) throw new Error(res.error);
    } catch (error) {
      // put back just this request; other requests may have changed meanwhile
      setDmRequests({ ...useStore.getState().dmRequests, [id]: request });
      toast.error("Failed to reject message request");
      console.error("Reject DM request error:", error);
    } finally {
      setRequestPending(id, false);
    }
  }

  async function muteRequest(id: string) {
    if (!api) {
      toast.error("Chat requests are not ready");
      return;
    }
    setOpenRequestMenu(null);
    const res = await api.muteChat(id);
    if ("error" in res) toast.error("Failed to mute user");
  }

  async function blockRequest(id: string) {
    if (!api) {
      toast.error("Chat requests are not ready");
      return;
    }
    setOpenRequestMenu(null);
    const res = await api.blockChat(id);
    if ("error" in res) toast.error("Failed to block user");
  }

  return (
    <div id="screen-messages" className="trill-screen messages-screen">
      <header className="trill-screen-header dm-inbox-header">
        <div className="dm-inbox-title-row">
          <h1>Messages</h1>
          <span className="dm-encrypted-pill">
            <Lock size={12} strokeWidth={2} />
            encrypted
          </span>
          <button
            type="button"
            className="dm-new-button"
            onClick={openPicker}
            aria-label="New message"
            title="New message"
          >
            <MessageSquarePlus size={20} strokeWidth={1.9} />
          </button>
        </div>
        <TabStrip
          id="dm-index-tabs"
          items={tabs}
          active={activeTab}
          onChange={setActiveTab}
          className="dm-index-tabs"
        />
      </header>

      {activeTab === "inbox" && inboxConversations.length > 0 ? (
        <div className="dm-inbox-list">
          {inboxConversations.map((conversation) => {
            const unread = conversation.unread > 0;
            const pinned = pinnedPatps.includes(conversation.id);
            return renderConversationRow(conversation, unread, pinned);
          })}
        </div>
      ) : activeTab === "inbox" ? (
        <div className="dm-empty-state">
          <span className="dm-empty-icon">
            <MessageSquare size={32} strokeWidth={1.6} />
          </span>
          <h2>No messages yet</h2>
          <p>
            Your encrypted conversations live here. Start one with any ship or key
            on the network.
          </p>
          <button type="button" onClick={openPicker}>
            <MessageSquarePlus size={17} strokeWidth={1.9} />
            New message
          </button>
        </div>
      ) : activeTab === "muted" && mutedConversations.length > 0 ? (
        <div className="dm-inbox-list">
          {mutedConversations.map((conversation) => {
            const unread = conversation.unread > 0;
            const pinned = pinnedPatps.includes(conversation.id);
            return renderConversationRow(conversation, unread, pinned);
          })}
        </div>
      ) : activeTab === "muted" ? (
        <div className="dm-empty-state">
          <span className="dm-empty-icon">
            <BellOff size={32} strokeWidth={1.6} />
          </span>
          <h2>No muted conversations</h2>
          <p>Muted conversations will appear here instead of your inbox.</p>
        </div>
      ) : activeTab === "blocked" && blockedConversations.length > 0 ? (
        <div className="dm-inbox-list">
          {blockedConversations.map((conversation) => {
            const unread = conversation.unread > 0;
            const pinned = pinnedPatps.includes(conversation.id);
            return renderConversationRow(conversation, unread, pinned);
          })}
        </div>
      ) : activeTab === "blocked" ? (
        <div className="dm-empty-state">
          <span className="dm-empty-icon blocked">
            <Ban size={32} strokeWidth={1.6} />
          </span>
          <h2>No blocked conversations</h2>
          <p>Blocked conversations are kept separate and cannot be messaged.</p>
        </div>
      ) : requestRows.length > 0 ? (
        <div className="dm-request-list">
          {requestRows.map((request) => {
            const pending = pendingRequests.has(request.id);
            return (
              <article className="dm-request-row" key={request.id}>
                <Avatar user={request.user} size={46} noClick picOnly />
                <span className="dm-request-main">
                  <span className="dm-request-top">
                    <span className="dm-row-name">{request.name}</span>
                    <span className="dm-row-id mono">{request.id2}</span>
                    <span className="dm-row-time mono">{request.time}</span>
                  </span>
                  <span className="dm-row-preview">{request.preview}</span>
                </span>
                <span className="dm-request-actions">
                  <button
                    type="button"
                    className="dm-request-action accept"
                    onClick={() => acceptRequest(request.id)}
                    disabled={pending}
                    aria-label={`Accept request from ${request.name}`}
                    title="Accept"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="dm-request-action reject"
                    onClick={() => rejectRequest(request.id)}
                    disabled={pending}
                    aria-label={`Reject request from ${request.name}`}
                    title="Reject"
                  >
                    <X size={15} />
                  </button>
                  <span
                    className="dm-request-menu"
                    ref={openRequestMenu === request.id ? requestMenuRef : undefined}
                  >
                    <button
                      type="button"
                      className="dm-request-action menu"
                      onClick={() =>
                        setOpenRequestMenu((current) =>
                          current === request.id ? null : request.id,
                        )
                      }
                      disabled={pending}
                      aria-label={`Request options for ${request.name}`}
                      aria-expanded={openRequestMenu === request.id}
                      title="Options"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openRequestMenu === request.id && (
                      <span className="dm-request-context-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => muteRequest(request.id)}
                        >
                          <BellOff size={15} />
                          Mute
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => blockRequest(request.id)}
                        >
                          <Ban size={15} />
                          Block
                        </button>
                      </span>
                    )}
                  </span>
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="dm-empty-state">
          <span className="dm-empty-icon">
            <MessageSquare size={32} strokeWidth={1.6} />
          </span>
          <h2>No message requests</h2>
          <p>New conversations from people you have not talked to will appear here.</p>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread conversations` : "No unread messages"}
        {requestRows.length > 0 ? `, ${requestRows.length} message requests` : ""}
      </span>
    </div>
  );

  function renderConversationRow(
    conversation: (typeof orderedConversations)[number],
    unread: boolean,
    pinned: boolean,
  ) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`trill-dm-row${unread ? " unread" : ""}${pinned ? " pinned" : ""}${conversation.muted ? " muted" : ""}${conversation.blocked ? " blocked" : ""}`}
        key={conversation.id}
        onClick={() => openConversation(conversation.id)}
        onKeyDown={(event) => handleRowKeyDown(event, conversation.id)}
      >
        <Avatar user={conversation.user} size={46} noClick picOnly />
        <span className="dm-row-main">
          <span className="dm-row-top">
            <span className="dm-row-name">{conversation.name}</span>
            <span className="dm-row-id mono">{conversation.id2}</span>
            {conversation.blocked && (
              <span className="dm-row-state blocked">
                <Ban size={12} />
                blocked
              </span>
            )}
            {!conversation.blocked && conversation.muted && (
              <span className="dm-row-state muted">
                <BellOff size={12} />
                muted
              </span>
            )}
            <span className="dm-row-time mono">{conversation.time}</span>
            <button
              type="button"
              className={`dm-pin-button${pinned ? " pinned" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                togglePinnedChat(conversation.id);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
              title={pinned ? "Unpin conversation" : "Pin conversation"}
            >
              <Pin size={14} strokeWidth={2} fill={pinned ? "currentColor" : "none"} />
            </button>
          </span>
          <span className="dm-row-bottom">
            <span className="dm-row-preview">
              {conversation.preview || "No messages yet"}
            </span>
            {unread && (
              <span className="dm-row-unread">
                {conversation.unread > 99 ? "99+" : conversation.unread}
              </span>
            )}
          </span>
        </span>
      </div>
    );
  }
}
