import {
  Bell,
  CreditCard,
  KeyRound,
  MessageSquare,
  MoreHorizontal,
  Search,
  Swords,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import { withoutMuted } from "@/logic/lists";
import ShipCard from "@/components/ShipCard";
import { NowInDebate } from "@/components/debates/Presence";
import { getDmUnreadCount } from "@/logic/dms";
import "./Sidebar.css";

const DISMISSED_NOTICES_KEY = "trill-dismissed-system-notices";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  badge: number;
  primary?: boolean;
};

const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const HomeIcon = () => (
  <svg {...svgProps} strokeWidth={2}>
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
  </svg>
);
const BellIcon = () => (
  <svg {...svgProps}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
  </svg>
);
const FollowsIcon = () => (
  <svg {...svgProps}>
    <circle cx="9" cy="8" r="3.4" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.5" /><path d="M20.5 20a5.5 5.5 0 0 0-3.7-5.2" />
  </svg>
);
const BookmarkIcon = () => (
  <svg {...svgProps}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);
const ProfileIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);
const SettingsIcon = () => (
  <svg {...svgProps}>
    <path d="M4 21v-6M4 11V3M12 21v-9M12 7V3M20 21v-4M20 13V3" />
    <circle cx="4" cy="13" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="20" cy="11" r="2" />
  </svg>
);

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
  const { our, notifications, profiles, setModal, dms, lists, debates, debateInvites } =
    useLocalState((s) => ({
    our: s.our,
    notifications: s.notifications,
    profiles: s.profiles,
    setModal: s.setModal,
    dms: s.dms,
    lists: s.lists,
    debates: s.debates,
    debateInvites: s.debateInvites,
  }));
  const [dismissedNotices, setDismissedNotices] = useState<DismissedNotices>(
    loadDismissedNotices,
  );

  const profile = our ? profiles.get(our.patp) : undefined;
  const hasProfileBasics = Boolean(profile?.name?.trim() && profile?.about?.trim());
  const unread = withoutMuted(notifications, lists).reduce(
    (acc, n) => (n.unread ? acc + 1 : acc),
    0,
  );
  const unreadDms = getDmUnreadCount(dms);

  function goto(to: string) { navigate(to); }

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

  // match whole path segments: a bare startsWith("/f") also matches "/fols"
  const isActive = (prefix: string) =>
    location === prefix || location.startsWith(`${prefix}/`);

  const [moreOpen, setMoreOpen] = useState(false);
  // primary items stay in the phone bottom bar; the rest go in "More"
  const navItems: NavItem[] = [
    { to: "/f", label: "Home", icon: <HomeIcon />, badge: 0, primary: true },
    { to: "/notif", label: "Notifications", icon: <BellIcon />, badge: unread, primary: true },
    {
      to: "/dms",
      label: "Messages",
      icon: <MessageSquare size={22} strokeWidth={1.9} />,
      badge: unreadDms,
      primary: true,
    },
    { to: "/wallet", label: "Wallet", icon: <CreditCard size={22} strokeWidth={1.9} />, badge: 0 },
    { to: "/fols", label: "Follows", icon: <FollowsIcon />, badge: 0 },
    { to: "/bookmarks", label: "Bookmarks", icon: <BookmarkIcon />, badge: 0 },
    {
      to: "/debates",
      label: "Debates",
      icon: <Swords size={22} strokeWidth={1.9} />,
      // invitations to debates we don't follow yet
      badge: [...debateInvites.keys()].filter((k) => !debates.has(k)).length,
    },
    { to: our ? `/u/${our.patp}` : "/f", label: "Profile", icon: <ProfileIcon />, badge: 0, primary: true },
    { to: "/sets", label: "Settings", icon: <SettingsIcon />, badge: 0 },
  ];
  // phones have no right rail, so no search box: it lives in "More"
  const searchItem: NavItem = {
    to: "/search",
    label: "Search",
    icon: <Search size={22} strokeWidth={1.9} />,
    badge: 0,
  };

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

      {/* the debate we're in, if any: under who we are, above the nav */}
      <NowInDebate />

      {/* Nav. on phones this is the bottom bar: the secondary items move
          into its "More" menu */}
      <nav id="left-nav" className="sidebar-nav">
        {navItems.map((item) => (
          <a
            key={item.label}
            href="#"
            title={item.label}
            aria-label={item.label}
            className={`sidebar-nav-item${isActive(item.to) ? " active" : ""}${item.primary ? "" : " nav-secondary"}`}
            onClick={(e) => { e.preventDefault(); goto(item.to); }}
          >
            <span className="nav-icon">
              {item.icon}
              {item.badge > 0 && (
                <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
              )}
            </span>
            <span className="nav-label">{item.label}</span>
          </a>
        ))}
        <div className="nav-more">
          <button
            type="button"
            className={`sidebar-nav-item${moreOpen ? " active" : ""}`}
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span className="nav-icon">
              <MoreHorizontal size={22} strokeWidth={1.9} />
            </span>
            <span className="nav-label">More</span>
          </button>
          {moreOpen && (
            <>
              <div className="nav-more-backdrop" onClick={() => setMoreOpen(false)} />
              <div className="nav-more-menu" role="menu">
                {[...navItems.filter((i) => !i.primary), searchItem].map((item) => (
                  <a
                    key={item.label}
                    href="#"
                    role="menuitem"
                    className={`nav-more-item${isActive(item.to) ? " active" : ""}`}
                    onClick={(e) => { e.preventDefault(); setMoreOpen(false); goto(item.to); }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>


      {/* Compose Button: a floating button on phones */}
      <button
        id="compose-button"
        className="sidebar-compose"
        onClick={openCompose}
        title="Compose"
        aria-label="Compose"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="m14.5 7.5 3 3"/>
        </svg>
        <span className="nav-label">Compose</span>
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
