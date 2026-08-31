import { Bell, CreditCard, KeyRound, MessageSquare, UserRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import ShipCard from "@/components/ShipCard";
import { getDmUnreadCount } from "@/logic/dms";
import "./Sidebar.css";

const DISMISSED_NOTICES_KEY = "trill-dismissed-system-notices";

type DismissedNotices = Record<string, boolean>;
type SystemNotice = {
  id: string;
  tone: "primary" | "warning";
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
  onAct: () => void;
};

function loadDismissedNotices(): DismissedNotices {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDismissedNotices(notices: DismissedNotices) {
  localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(notices));
}

function SlidingMenu() {
  const [location, navigate] = useLocation();
  const { our, notifications, profiles, setModal, dms } =
    useLocalState((s) => ({
    our: s.our,
    notifications: s.notifications,
    profiles: s.profiles,
    setModal: s.setModal,
    dms: s.dms,
  }));
  const [dismissedNotices, setDismissedNotices] = useState<DismissedNotices>(
    loadDismissedNotices,
  );

  const profile = our ? profiles.get(our.patp) : undefined;
  const hasProfileBasics = Boolean(profile?.name?.trim() && profile?.about?.trim());
  const unread = notifications.reduce((acc, n) => (n.unread ? acc + 1 : acc), 0);
  const unreadDms = getDmUnreadCount(dms);

  function goto(to: string) { navigate(to); }

  function openRelayDash() {
    import("@/components/RelayDashboard").then(({ default: RelayDashboard }) => {
      setModal(<RelayDashboard />);
    });
  }

  function openCompose() {
    import("@/components/modals/ComposerModal").then(({ default: ComposerModal }) => {
      setModal(<ComposerModal />);
    });
  }

  function openProfileEditor() {
    if (!our) return;
    import("@/components/profile/Editor").then(({ default: ProfileEditor }) => {
      setModal(
        <ProfileEditor
          user={{ urbit: our }}
          userString={our.patp}
          profile={profile}
          onSave={() => dismissNotice("profile")}
        />,
      );
    });
  }

  function dismissNotice(id: string) {
    setDismissedNotices((current) => {
      const next = { ...current, [id]: true };
      saveDismissedNotices(next);
      return next;
    });
  }

  const notices = useMemo<SystemNotice[]>(() => {
    const next: SystemNotice[] = [];
    if (our && !hasProfileBasics) {
      next.push({
        id: "profile",
        tone: "primary",
        icon: <UserRound size={14} strokeWidth={1.9} />,
        title: "Set up your profile",
        body: "You haven't added a display name or bio yet. Make your ship feel like home.",
        cta: "Edit profile",
        onAct: openProfileEditor,
      });
    }
    next.push({
      id: "backup",
      tone: "warning",
      icon: <KeyRound size={14} strokeWidth={1.9} />,
      title: "Back up your keys",
      body: "Export your Nostr keypair so you never lose access to your identity.",
      cta: "Open settings",
      onAct: () => goto("/sets"),
    });
    return next.filter((notice) => !dismissedNotices[notice.id]);
  }, [dismissedNotices, hasProfileBasics, our, profile, setModal]);

  const isActive = (prefix: string) => location.startsWith(prefix);

  return (
    <aside id="left-rail" className="left-rail">
      {/* Logo */}
      <a
        href="#"
        className="sidebar-logo"
        onClick={(e) => { e.preventDefault(); goto("/f"); }}
      >
        <span className="sidebar-logo-icon">
          <svg width="21" height="17" viewBox="0 0 640 512" fill="currentColor">
            <path d="M544 32h-16.36C513.04 12.68 490.09 0 464 0c-44.18 0-80 35.82-80 80v20.98L12.09 393.57A30.216 30.216 0 0 0 0 417.74c0 22.46 23.64 37.07 43.73 27.03L165.27 384h96.49l44.41 120.1c2.27 6.23 9.15 9.44 15.38 7.17l22.55-8.21c6.23-2.27 9.44-9.15 7.17-15.38L312.94 384H352c1.91 0 3.76-.23 5.66-.29l44.51 120.38c2.27 6.23 9.15 9.44 15.38 7.17l22.55-8.21c6.23-2.27 9.44-9.15 7.17-15.38l-41.24-111.53C485.74 352.8 544 279.26 544 192v-80l96-16c0-35.35-42.98-64-96-64zm-80 72c-13.25 0-24-10.75-24-24c0-13.26 10.75-24 24-24s24 10.74 24 24c0 13.25-10.75 24-24 24z" />
          </svg>
        </span>
        <span className="sidebar-logo-text">Trill</span>
      </a>

      {/* Ship Card */}
      {our && (
        <ShipCard our={our} goto={goto}/>
      )}

      {/* Nav */}
      <nav id="left-nav" className="sidebar-nav">
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/f") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/f"); }}
        >
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>
            </svg>
          </span>
          Home
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/notif") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/notif"); }}
        >
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8.5a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>
            </svg>
            {unread > 0 && <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>}
          </span>
          Notifications
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/dms") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/dms"); }}
        >
          <span className="nav-icon">
            <MessageSquare size={22} strokeWidth={1.9} />
            {unreadDms > 0 && (
              <span className="nav-badge">
                {unreadDms > 99 ? "99+" : unreadDms}
              </span>
            )}
          </span>
          Messages
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/wallet") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/wallet"); }}
        >
          <span className="nav-icon">
            <CreditCard size={22} strokeWidth={1.9} />
          </span>
          Wallet
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/fols") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/fols"); }}
        >
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.4"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.5"/><path d="M20.5 20a5.5 5.5 0 0 0-3.7-5.2"/>
            </svg>
          </span>
          Follows
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${our && isActive(`/u/${our.patp}`) ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); if (our) goto(`/u/${our.patp}`); }}
        >
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>
            </svg>
          </span>
          Profile
        </a>
        <a
          href="#"
          className={`sidebar-nav-item${isActive("/sets") ? " active" : ""}`}
          onClick={(e) => { e.preventDefault(); goto("/sets"); }}
        >
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 21v-6M4 11V3M12 21v-9M12 7V3M20 21v-4M20 13V3"/>
              <circle cx="4" cy="13" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="20" cy="11" r="2"/>
            </svg>
          </span>
          Settings
        </a>
      </nav>

      {/* Compose Button */}
      <button id="compose-button" className="sidebar-compose" onClick={openCompose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="m14.5 7.5 3 3"/>
        </svg>
        Compose
      </button>

      {notices.length > 0 && (
        <section id="system-notices" className="system-notices" aria-label="For you">
          <div className="system-notices-title">
            <Bell size={13} strokeWidth={2} />
            <span>For you</span>
          </div>
          <div className="system-notices-list">
            {notices.map((notice) => (
              <article
                key={notice.id}
                className={`system-notice ${notice.tone}`}
                onClick={notice.onAct}
              >
                <div className="system-notice-head">
                  <span className="system-notice-icon">{notice.icon}</span>
                  <span className="system-notice-name">{notice.title}</span>
                  <button
                    type="button"
                    className="system-notice-dismiss"
                    aria-label={`Dismiss ${notice.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissNotice(notice.id);
                    }}
                  >
                    <X size={13} strokeWidth={2.2} />
                  </button>
                </div>
                <p>{notice.body}</p>
                <div className="system-notice-cta">{notice.cta} →</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
export default SlidingMenu;
