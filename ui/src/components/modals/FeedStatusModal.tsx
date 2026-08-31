import "@/styles/feedstatusmodal.css";
import { Activity, Info, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildFeedStatusSubscriptions } from "@/logic/feedStatus";
import { useRelayActions } from "@/hooks/useRelayActions";
import useLocalState from "@/state/state";

export default function FeedStatusModal() {
  const { relays, relayLatency, setModal } = useLocalState((s) => ({
    relays: s.relays,
    relayLatency: s.relayLatency,
    setModal: s.setModal,
  }));
  const { syncRelays, isSyncingRelays } = useRelayActions();
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const subscriptions = useMemo(
    () => buildFeedStatusSubscriptions(relays, {}, isSyncingRelays, relayLatency),
    [relays, isSyncingRelays, relayLatency],
  );

  function close() {
    setModal(null);
  }

  async function refresh(key: string) {
    setRefreshing((current) => ({ ...current, [key]: true }));
    try {
      await syncRelays();
    } finally {
      window.setTimeout(() => {
        setRefreshing((current) => ({ ...current, [key]: false }));
      }, 450);
    }
  }

  return (
    <section
      id="feed-status-modal"
      aria-labelledby="feed-status-title"
    >
      <header className="feed-status-modal-header">
        <span className="feed-status-modal-icon" aria-hidden="true">
          <Activity size={20} strokeWidth={1.9} />
        </span>
        <div className="feed-status-modal-heading">
          <h2 id="feed-status-title">Feed status</h2>
          <p>Live subscriptions feeding this view</p>
        </div>
        <button
          type="button"
          className="feed-status-close"
          onClick={close}
          aria-label="Close feed status"
        >
          <X size={19} strokeWidth={2} />
        </button>
      </header>

      <div className="feed-status-modal-body">
        {subscriptions.length === 0 ? (
          <div className="feed-status-empty">
            <Activity size={24} strokeWidth={1.8} />
            <h3>No active subscriptions</h3>
            <p>Feed requests will appear here once a relay subscription opens.</p>
          </div>
        ) : (
          subscriptions.map((subscription) => {
            const isRefreshing = Boolean(refreshing[subscription.key]) || isSyncingRelays;

            return (
              <article className="feed-status-card" key={subscription.key}>
                <div className="feed-status-sub-header">
                  <span
                    className={`feed-status-dot ${subscription.state}`}
                    aria-hidden="true"
                  />
                  <div className="feed-status-sub-title">
                    <h3>{subscription.label}</h3>
                    <p>
                      {subscription.stateLabel} · sub{" "}
                      <span className="mono">{subscription.subId}</span>
                    </p>
                  </div>
                  <span className="feed-status-rate mono">{subscription.rate}</span>
                </div>

                <div className="feed-status-filter">
                  <div className="feed-status-filter-label">Request filter</div>
                  <code className="mono">{subscription.filter}</code>
                </div>

                <div className="feed-status-relays" aria-label="Relay breakdown">
                  {subscription.relays.map((relay) => (
                    <div className="feed-status-relay" key={relay.url}>
                      <span
                        className="feed-status-relay-dot"
                        style={{ background: relay.color }}
                        aria-hidden="true"
                      />
                      <span className="feed-status-relay-url mono" title={relay.url}>
                        {relay.url}
                      </span>
                      <span className="feed-status-relay-events">
                        <b>{relay.events}</b> ev
                      </span>
                      <span className="feed-status-relay-last mono">{relay.last}</span>
                    </div>
                  ))}
                </div>

                <footer className="feed-status-card-footer">
                  <span>
                    <b>{subscription.totalEvents}</b> events
                  </span>
                  <span>
                    <b>{subscription.relayCount}</b> relays
                  </span>
                  <div className="feed-status-actions">
                    <button
                      type="button"
                      className="feed-status-action"
                      onClick={() => refresh(subscription.key)}
                      disabled={isRefreshing}
                      title="Re-request"
                    >
                      <RefreshCw
                        size={13}
                        strokeWidth={2}
                        className={isRefreshing ? "is-spinning" : undefined}
                      />
                      Refresh
                    </button>
                  </div>
                </footer>
              </article>
            );
          })
        )}

        <aside className="feed-status-note">
          <Info size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>
            Each feed opens a relay subscription with a filter. Refresh
            re-requests relay data.
          </span>
        </aside>
      </div>
    </section>
  );
}
