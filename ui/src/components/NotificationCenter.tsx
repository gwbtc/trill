import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import useLocalState, { useStore } from "@/state/state";
import { withoutMuted } from "@/logic/lists";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import UserModal from "@/components/modals/UserModal";
import Icon, { type IconName } from "./Icon";
import Avatar from "./Avatar";
import type { Notification } from "@/types/notifications";
import type { UserProfile } from "@/types/nostrill";
import {
  displayYarn,
  withoutActor,
  filterNotifications,
  formatNotificationTimestamp,
  getNotificationKind,
  notificationPath,
  setNotificationsClearedAt,
  type NotificationFilter,
  type NotificationKind,
} from "@/logic/notifications";
import {
  getDisplayName,
  getHandleLabel,
  getUserId,
} from "@/logic/userDisplay";
import "@/styles/NotificationCenter.css";

const NOTIFICATION_FILTERS: TabItem<NotificationFilter>[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
  { key: "relays", label: "Relays" },
];

const NOTIFICATION_ICONS: Record<NotificationKind, IconName> = {
  request: "pals",
  response: "pals",
  profile: "profile",
  reply: "reply",
  quote: "quote",
  repost: "repost",
  reaction: "emoji",
  report: "flag",
  mention: "messages",
  deletion: "trash",
  relay: "radio",
  keys: "key",
};

export default function NotificationCenter() {
  const {
    api,
    allNotifications,
    lists,
    notificationsLoaded,
    profiles,
    setNotifications,
    setModal,
  } = useLocalState((state) => ({
    api: state.api,
    allNotifications: state.notifications,
    lists: state.lists,
    notificationsLoaded: state.notificationsLoaded,
    profiles: state.profiles,
    setNotifications: state.setNotifications,
    setModal: state.setModal,
  }));
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [isUpdating, setIsUpdating] = useState(false);
  // notifications from muted users stay on the ship but aren't shown
  const notifications = useMemo(
    () => withoutMuted(allNotifications, lists),
    [allNotifications, lists],
  );

  const filteredNotifications = filterNotifications(notifications, filter);
  const unreadCount = notifications.reduce(
    (count, notification) => count + (notification.unread ? 1 : 0),
    0,
  );

  // read the store at update time, not this render's snapshot: a
  // notification arriving while a request is in flight would be dropped
  const current = () => useStore.getState().notifications;

  function setNotificationRead(id: string) {
    setNotifications(
      current().map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    );
  }

  function markNotificationRead(notification: Notification) {
    if (!notification.unread) return;
    setNotificationRead(notification.id);
    if (!api || !notification.rope) return;

    void api.dismissNotification(notification.rope).then((result) => {
      if ("error" in result) toast.error("Could not mark notification as read");
    });
  }

  function handleNotificationClick(notification: Notification) {
    markNotificationRead(notification);
    const path = notificationPath(notification);
    if (path) navigate(path);
  }

  async function markAllNotificationsRead() {
    const wereUnread = new Set(current().filter((n) => n.unread).map((n) => n.id));
    setIsUpdating(true);
    setNotifications(current().map((n) => ({ ...n, unread: false })));
    if (!api) {
      setIsUpdating(false);
      return;
    }

    const result = await api.dismissAllNotifications();
    if ("error" in result) {
      setNotifications(
        current().map((n) => (wereUnread.has(n.id) ? { ...n, unread: true } : n)),
      );
      toast.error("Could not mark notifications as read");
    }
    setIsUpdating(false);
  }

  // see setNotificationsClearedAt: marks all read on the ship and hides
  // everything shown so far, persistently, on this browser
  async function dismissAll() {
    if (!api) return;
    const cleared = current();
    setIsUpdating(true);
    const result = await api.dismissAllNotifications();
    if ("error" in result) {
      toast.error("Could not clear notifications");
    } else {
      setNotificationsClearedAt(Math.max(0, ...cleared.map((n) => n.timestamp)));
      const ids = new Set(cleared.map((n) => n.id));
      setNotifications(current().filter((n) => !ids.has(n.id)));
    }
    setIsUpdating(false);
  }

  function openUser(notification: Notification) {
    if (!notification.from) return;
    markNotificationRead(notification);
    setModal(<UserModal user={notification.from} />);
  }

  const empty = getEmptyCopy(filter);

  return (
    <div id="screen-notifications" className="notification-center trill-screen">
      <header className="notification-header trill-screen-header">
        <div className="notification-title-row">
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <span
              className="notification-unread-badge"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="notification-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="mark-all-read-btn"
              onClick={markAllNotificationsRead}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating…" : "Mark all as read"}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              className="clear-all-btn"
              onClick={dismissAll}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating…" : "Clear"}
            </button>
          )}
        </div>
      </header>

      <TabStrip
        id="notif-tabs"
        items={NOTIFICATION_FILTERS}
        active={filter}
        onChange={setFilter}
        className="notification-filters"
        buttonClassName="filter-btn"
        itemRole="tab"
      />

      <div id="notifications-list" className="notification-list" aria-live="polite">
        {!notificationsLoaded ? (
          <NotificationLoading />
        ) : filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <Icon name="bell" size={42} color="textMuted" />
            <strong>{empty.title}</strong>
            <p>{empty.sub}</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              profile={
                notification.from
                  ? profiles.get(getUserId(notification.from))
                  : undefined
              }
              onOpen={() => handleNotificationClick(notification)}
              onOpenUser={() => openUser(notification)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  notification,
  profile,
  onOpen,
  onOpenUser,
}: {
  notification: Notification;
  profile?: UserProfile;
  onOpen: () => void;
  onOpenUser: () => void;
}) {
  const kind = getNotificationKind(notification.type);
  const actorId = notification.from ? getUserId(notification.from) : "";
  const actorName = notification.from
    ? getDisplayName(
        notification.from,
        profile,
        getHandleLabel(notification.from, actorId),
      )
    : "Notification";
  const actorHandle = notification.from
    ? getHandleLabel(notification.from, actorId)
    : "";
  const message = notification.from
    ? withoutActor(displayYarn(notification.message), actorId)
    : displayYarn(notification.message);

  return (
    <article
      className={`notification-item notification-${kind}${notification.unread ? " unread" : ""}`}
    >
      <button
        type="button"
        className="notification-open"
        onClick={onOpen}
        aria-label={`${notification.unread ? "Unread: " : ""}Open notification from ${actorName}`}
      />

      {notification.unread && <span className="unread-indicator" aria-hidden="true" />}

      <div className="notification-icon" aria-hidden="true">
        <Icon
          name={NOTIFICATION_ICONS[kind]}
          className="notification-type-icon"
          size={19}
        />
      </div>

      {notification.from && (
        <button
          type="button"
          className="notification-actor"
          onClick={onOpenUser}
          aria-label={`Open ${actorName}'s profile`}
        >
          <Avatar
            user={notification.from}
            profile={profile}
            size={36}
            picOnly
            noClick
          />
          <span className="notification-actor-copy">
            <strong>{actorName}</strong>
            {actorHandle !== actorName && <span className="mono">{actorHandle}</span>}
          </span>
        </button>
      )}

      <div className="notification-content">
        <p className="notification-message">
          {message.map((part, index) =>
            typeof part === "string" ? (
              <span key={`${part}-${index}`}>
                {index > 0 ? " " : ""}
                {part}
              </span>
            ) : "ship" in part ? (
              <span className="ship mono" key={`${part.ship}-${index}`}>
                {part.ship}
              </span>
            ) : (
              <strong key={`${part.emph}-${index}`}>{part.emph}</strong>
            ),
          )}
        </p>
        <time className="notification-time">
          {formatNotificationTimestamp(notification.timestamp)}
        </time>
      </div>
    </article>
  );
}

function NotificationLoading() {
  return (
    <div className="notification-loading" role="status" aria-label="Loading notifications">
      {[0, 1, 2].map((item) => (
        <div className="notification-loading-row" key={item} aria-hidden="true">
          <span className="trill-skeleton notification-loading-icon" />
          <span className="trill-skeleton notification-loading-avatar" />
          <span className="notification-loading-copy">
            <span className="trill-skeleton" />
            <span className="trill-skeleton" />
          </span>
        </div>
      ))}
    </div>
  );
}

function getEmptyCopy(filter: NotificationFilter) {
  if (filter === "unread") {
    return { title: "You're all caught up", sub: "No unread notifications." };
  }
  if (filter === "mentions") {
    return { title: "No mentions yet", sub: "Mentions and replies will show here." };
  }
  if (filter === "relays") {
    return { title: "No relay activity", sub: "Relay connect/drop events show here." };
  }
  return { title: "No notifications", sub: "Activity from the fleet will appear here." };
}
