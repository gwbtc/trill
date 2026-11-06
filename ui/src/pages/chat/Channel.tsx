import "@/styles/Messages.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Hash, Image, Link as LinkIcon, Search } from "lucide-react";
import { channelInGroups, useChannelsStore } from "@/state/channels";
import { chatChannelId } from "@/logic/tlon/channels";
import { conversationPreview } from "@/logic/tlon/story";
import toast from "react-hot-toast";
import { MessageComposer } from "./Composer";
import DmThread from "./Thread";
import DmInlinePanel, { buildRichDmMessages } from "./InlinePanel";
import type { DmPanel } from "./types";
import type { TlonMessage } from "@/logic/tlon/types";
const EMPTY: TlonMessage[] = [];

export default function ChannelRoute() {
  const params = useParams<{ host: string; name: string }>();
  let id: string;
  try {
    id = chatChannelId(
      `chat/${decodeURIComponent(params.host ?? "")}/${decodeURIComponent(params.name ?? "")}`,
    );
  } catch {
    return (
      <div className="dm-empty-state">
        <h2>Invalid channel address</h2>
        <a href="/apps/nostrill/groups">Back to groups</a>
      </div>
    );
  }
  return <Channel key={id} id={id} />;
}
function Channel({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const status = useChannelsStore((state) => state.status);
  const error = useChannelsStore((state) => state.error);
  const channel = useChannelsStore((state) =>
    channelInGroups(state.groups, id),
  );
  const group = useChannelsStore((state) =>
    channel ? state.groups.get(channel.groupId) : undefined,
  );
  const thread = useChannelsStore((state) => state.threads.get(id));
  const our = useChannelsStore((state) => state.client?.our ?? "");
  const [panel, setPanel] = useState<DmPanel>("thread");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const firstUnread = useRef(channel?.firstUnreadTime);
  const messages = thread?.messages ?? EMPTY;
  const lastId = messages.at(-1)?.id;
  const rich = useMemo(
    () => buildRichDmMessages(messages, our),
    [messages, our],
  );
  useEffect(() => {
    if (status === "ready" && channel?.joined)
      void useChannelsStore.getState().open(id);
  }, [id, status, channel?.joined]);
  useEffect(() => {
    if (status === "ready" && channel?.joined)
      void useChannelsStore.getState().permissions(id);
  }, [id, status, channel?.roles, channel?.admin, channel?.joined]);
  useEffect(() => {
    firstUnread.current ??= channel?.firstUnreadTime;
    if (
      status === "ready" &&
      channel?.unread &&
      channel.joined &&
      thread?.loaded &&
      panel === "thread" &&
      document.visibilityState === "visible"
    )
      void useChannelsStore
        .getState()
        .read(id)
        .catch(() => {});
  }, [
    id,
    status,
    channel?.unread,
    channel?.joined,
    thread?.loaded,
    lastId,
    panel,
  ]);
  useEffect(() => {
    const read = () => {
      if (
        document.visibilityState === "visible" &&
        panel === "thread" &&
        useChannelsStore.getState().threads.get(id)?.loaded
      )
        void useChannelsStore
          .getState()
          .read(id)
          .catch(() => {});
    };
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [id, panel]);
  useLayoutEffect(() => {
    if (panel !== "thread") return;
    const message = highlighted ? messageRefs.current.get(highlighted) : null;
    if (message) message.scrollIntoView({ block: "center" });
    else if (threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [lastId, highlighted, panel]);
  async function older() {
    const node = threadRef.current;
    const before = node?.scrollHeight ?? 0;
    await useChannelsStore.getState().older(id);
    requestAnimationFrame(() => {
      if (node) node.scrollTop += node.scrollHeight - before;
    });
  }
  async function join() {
    try {
      await useChannelsStore.getState().join(id);
    } catch {
      toast.error("Could not join this channel. Please try again.");
    }
  }
  const back = (
    <button
      className="dm-icon-button"
      onClick={() => navigate("/groups")}
      aria-label="Back to groups"
    >
      <ArrowLeft size={20} />
    </button>
  );
  if (status === "error")
    return (
      <div className="dm-empty-state" role="alert">
        {back}
        <h2>Groups unavailable</h2>
        <p>{error}</p>
        <button onClick={() => useChannelsStore.getState().reconnect()}>
          Retry
        </button>
      </div>
    );
  if (status !== "ready")
    return (
      <div className="dm-empty-state" role="status">
        Loading channel...
      </div>
    );
  if (!channel || !group)
    return (
      <div className="dm-empty-state" role="alert">
        {back}
        <h2>Channel unavailable</h2>
        <p>You may no longer have access to this chat channel.</p>
      </div>
    );
  const reason = !thread?.loaded
    ? "Loading messages..."
    : thread.canWrite === null
      ? "Checking channel permissions..."
      : !thread.canWrite
        ? "You can read this channel, but cannot post here."
        : undefined;
  return (
    <div
      id="screen-channel"
      className="trill-screen messages-screen conversation-open"
    >
      <div className="dm-conversation-shell">
        <header className="trill-screen-header dm-conversation-header">
          {back}
          <Hash size={24} />
          <div className="dm-peer-copy">
            <h1 className="dm-peer-name">{channel.title}</h1>
            <span className="dm-peer-id">{group.title}</span>
          </div>
          <div className="channel-header-actions">
            {(
              [
                { key: "search", label: "Search", icon: <Search size={18} /> },
                { key: "media", label: "Media", icon: <Image size={18} /> },
                { key: "links", label: "Links", icon: <LinkIcon size={18} /> },
              ] as const
            ).map((item) => (
              <button
                className="dm-icon-button"
                key={item.key}
                aria-label={item.label}
                disabled={!thread?.loaded}
                onClick={() => setPanel(item.key)}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </header>
        {!channel.joined ? (
          <div className="dm-empty-state">
            <Hash size={32} />
            <h2>Join {channel.title}</h2>
            <p>Join this channel to read and send messages.</p>
            <button disabled={thread?.joining} onClick={() => void join()}>
              {thread?.joining ? "Joining..." : "Join channel"}
            </button>
          </div>
        ) : (
          <>
            {thread?.error && (
              <div className="dm-chat-error" role="alert">
                {thread.error}
                <button
                  onClick={() =>
                    void (thread.loaded && thread.older
                      ? older()
                      : useChannelsStore.getState().open(id, true))
                  }
                >
                  Retry loading
                </button>
              </div>
            )}
            {panel === "thread" ? (
              <DmThread
                messages={messages}
                our={our}
                group
                highlighted={highlighted}
                firstUnread={firstUnread.current}
                threadRef={threadRef}
                messageRefs={messageRefs}
                older={!!thread?.older}
                loading={thread?.loading ?? false}
                onOlder={() => void older()}
                notice={channel.description || `Chat in ${group.title}`}
                onRetry={(message) =>
                  void useChannelsStore
                    .getState()
                    .send(id, conversationPreview(message.content), message.id)
                    .catch(() => toast.error("Message could not be sent"))
                }
              />
            ) : (
              <DmInlinePanel
                panel={panel}
                searchQuery={query}
                setSearchQuery={setQuery}
                richMessages={rich}
                onSearchResultClick={(target) => {
                  setHighlighted(target);
                  setPanel("thread");
                }}
                onClose={() => {
                  setHighlighted(null);
                  setPanel("thread");
                }}
              />
            )}
            {thread?.loaded && thread.canWrite === false && (
              <div className="dm-chat-error" role="status">
                You can read this channel, but cannot post here.
              </div>
            )}
            <ChannelComposer
              id={id}
              title={channel.title}
              disabledReason={reason}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Keep keystrokes local to the composer rather than rerendering channel history.
function ChannelComposer({
  id,
  title,
  disabledReason,
}: {
  id: string;
  title: string;
  disabledReason?: string;
}) {
  const draft = useChannelsStore((state) => state.drafts[id] ?? "");
  return (
    <MessageComposer
      draft={draft}
      disabledReason={disabledReason}
      placeholder={`Message #${title}...`}
      onChange={(text) => useChannelsStore.getState().setDraft(id, text)}
      onSend={(text) => useChannelsStore.getState().send(id, text)}
    />
  );
}
