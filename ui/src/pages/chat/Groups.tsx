import "@/styles/Messages.css";
import { useChannelsStore } from "@/state/channels";
import type { CSSProperties } from "react";
import { useState } from "react";
import { safeHref, seededColorPair } from "@/logic/utils";
import { channelRoute, type TlonGroup } from "@/logic/tlon/channels";
import { ChevronRight, Hash, MessageCircle, Users } from "lucide-react";
import { Link } from "wouter";

export default function Groups() {
  const status = useChannelsStore((state) => state.status);
  const error = useChannelsStore((state) => state.error);
  const groups = useChannelsStore((state) => state.groups);
  return (
    <div id="screen-groups" className="trill-screen messages-screen">
      <header className="trill-screen-header dm-inbox-header">
        <div className="dm-inbox-title-row">
          <div>
            <h1>Groups</h1>
            {status === "ready" && groups.size > 0 && (
              <p className="chat-groups-summary">
                {groups.size} {groups.size === 1 ? "group" : "groups"} ·{" "}
                {[...groups.values()].reduce(
                  (count, group) => count + group.channels.length,
                  0,
                )}{" "}
                chat channels
              </p>
            )}
          </div>
        </div>
      </header>
      {status === "error" ? (
        <div className="dm-empty-state" role="alert">
          <h2>Groups unavailable</h2>
          <p>{error}</p>
          <button onClick={() => useChannelsStore.getState().reconnect()}>
            Retry
          </button>
        </div>
      ) : status !== "ready" ? (
        <div className="dm-empty-state" role="status">
          Loading groups...
        </div>
      ) : (
        <>
          {error && (
            <div className="dm-chat-error" role="alert">
              Groups could not refresh.{" "}
              <button
                onClick={() =>
                  void useChannelsStore
                    .getState()
                    .refresh()
                    .catch(() => {})
                }
              >
                Retry
              </button>
            </div>
          )}
          {groups.size ? (
            <div className="chat-groups-list">
              {[...groups.values()].map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <div className="dm-empty-state">
              <Users size={32} />
              <h2>No groups yet</h2>
              <p>
                Groups you join in Tlon will appear here with their chat
                channels.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: TlonGroup }) {
  const colors = seededColorPair(group.id);
  const [failedImage, setFailedImage] = useState<string>();
  const [failedCover, setFailedCover] = useState<string>();
  const image = group.image ? safeHref(group.image) : undefined;
  const cover = group.cover ? safeHref(group.cover) : undefined;
  const accent = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(
    group.cover ?? "",
  )
    ? group.cover
    : colors.background;
  const initials = group.title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase();
  const unread = group.channels.reduce(
    (count, channel) => count + (channel.joined ? channel.unread : 0),
    0,
  );
  return (
    <section
      className="chat-group"
      aria-label={group.title}
      style={
        {
          "--group-accent": accent,
          "--group-avatar-background": colors.background,
          "--group-avatar-foreground": colors.foreground,
        } as CSSProperties
      }
    >
      <div className="chat-group-cover" aria-hidden="true">
        {cover && failedCover !== cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={() => setFailedCover(cover)}
          />
        )}
        <span className="chat-group-cover-orbit" />
      </div>
      <header className="chat-group-header">
        <div className="chat-group-identity">
          <span className="chat-group-avatar" aria-hidden="true">
            {image && failedImage !== image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                onError={() => setFailedImage(image)}
              />
            ) : (
              initials || <Users size={28} />
            )}
          </span>
          {unread > 0 && (
            <span className="chat-group-activity">
              <span />
              {unread} unread
            </span>
          )}
        </div>
        <h2>{group.title}</h2>
        <p className="chat-group-address mono">{group.id}</p>
        {group.description && (
          <p className="chat-group-description">{group.description}</p>
        )}
      </header>
      <div className="chat-group-channels-heading">
        <MessageCircle size={14} strokeWidth={1.5} />
        <span>Chat channels</span>
        <span className="chat-group-channel-count">
          {group.channels.length}
        </span>
      </div>
      {group.channels.length ? (
        <ul>
          {group.channels.map((channel) => {
            const hasUnread = channel.joined && channel.unread > 0;
            return (
              <li key={channel.id}>
                <Link
                  href={channelRoute(channel.id)}
                  className={`chat-channel-link${hasUnread ? " has-unread" : ""}${!channel.joined ? " not-joined" : ""}`}
                >
                  <span className="chat-channel-icon">
                    <Hash size={20} strokeWidth={hasUnread ? 2 : 1.5} />
                  </span>
                  <span className="chat-channel-copy">
                    <strong>{channel.title}</strong>
                    {channel.description && (
                      <small>{channel.description}</small>
                    )}
                  </span>
                  {!channel.joined && (
                    <small className="chat-channel-membership">
                      Not joined
                    </small>
                  )}
                  {hasUnread && (
                    <span className="dm-row-unread">
                      {channel.unread > 99 ? "99+" : channel.unread}
                    </span>
                  )}
                  <ChevronRight
                    className="chat-channel-arrow"
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="chat-no-channels">
          No accessible chat channels in this group.
        </p>
      )}
    </section>
  );
}
