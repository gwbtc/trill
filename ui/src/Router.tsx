import Sidebar from "@/components/layout/Sidebar";
import RightRail from "@/components/layout/RightRail";
import useLocalState from "@/state/state";
import { Switch, Router, Redirect, Route } from "wouter";
import { P404 } from "./pages/Error";
import { lazy, Suspense, useEffect } from "react";
import Modal from "./components/modals/Modal";
import toast from "react-hot-toast";

const WELCOME_SHOWN_KEY = "nostrill-welcome-shown";
const Feed = lazy(() => import("@/pages/Feed"));
const User = lazy(() => import("@/pages/User"));
const Settings = lazy(() => import("@/pages/Settings"));
const Follows = lazy(() => import("@/pages/Follows"));
const Search = lazy(() => import("@/pages/Search"));
const DMIndex = lazy(() => import("@/pages/chat/Index"));
const DMShow = lazy(() => import("@/pages/chat/User"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const NotificationCenter = lazy(() => import("@/components/NotificationCenter"));
const Thread = lazy(() => import("@/pages/Thread"));
const NostrThreadLoader = lazy(() =>
  import("@/pages/Thread").then((module) => ({
    default: module.NostrThreadLoader,
  })),
);
const WelcomeModal = lazy(() => import("@/components/modals/WelcomeModal"));
const RelayDroppedDialog = lazy(() => import("@/components/modals/RelayDropped"));

export default function r() {
  const { nostrFeeds,nostrFeedsRaw, modal, setModal, dropped, dismiss, profiles, relays } = useLocalState((s) => ({
    modal: s.modal,
    setModal: s.setModal,
    dropped: s.lastDroppedWs,
    dismiss: s.dismissDroppedWs,
    profiles: s.profiles,
    relays: s.relays,
    nostrFeeds: s.nostrFeeds,
    nostrFeedsRaw: s.nostrFeedsRaw,
  }));

  console.log({ profiles, relays, nostrFeeds,nostrFeedsRaw })

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome) {
      setModal(<WelcomeModal />);
      localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    }
  }, []);

  useEffect(() => {
    if (!dropped) return;
    setModal(<RelayDroppedDialog url={dropped} />);
  }, [dropped]);
  return (
    <Switch>
      <Router base="/apps/nostrill">
        <div id="trill-app">
          <div id="trill-shell" className="app-shell">
            <Sidebar />
            <main id="main-column">
              <Suspense fallback={<RouteLoading />}>
                <Route path="/" component={toMain} />
                <Route path="/sets" component={Settings} />
                <Route path="/fols" component={Follows} />
                <Route path="/notif" component={NotificationCenter} />
                <Route path="/dms" component={DMIndex} />
                <Route path="/dms/:id" component={DMShow} />
                <Route path="/wallet" component={Wallet} />
                <Route path="/search" component={Search} />
                <Route path="/f" component={Feed} />
                <Route path="/f/:taip" component={Feed} />
                <Route path="/u/:user" component={User} />
                <Route path="/t/u/:host/:id" component={Thread} />
                <Route path="/t/n/:id" component={NostrThreadLoader} />
              </Suspense>
            </main>
            <RightRail />
          </div>
        </div>
        {modal && (
          <Modal close={() => setModal(null)}>
            <Suspense fallback={<div className="route-loading">Loading...</div>}>
              {modal}
            </Suspense>
          </Modal>
        )}
      </Router>
      <Route component={P404} />
    </Switch>
  );
}
function toMain() {
  return <Redirect to="/f" />;
}

function RouteLoading() {
  return <div className="route-loading">Loading...</div>;
}
