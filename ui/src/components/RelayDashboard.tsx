import { useState, type CSSProperties } from "react";
import useLocalState from "@/state/state";
import { buildRelayModels, formatRelayUptime } from "@/logic/relayDisplay";
import { Plus, Radio, RefreshCw, Trash2, X } from "lucide-react";
import "./RelayDashboard.css";
import { useRelayActions } from "@/hooks/useRelayActions";

export default function RelayDashboard() {
  const { relays, relayLatency, setModal } = useLocalState((s) => ({
    relays: s.relays,
    relayLatency: s.relayLatency,
    setModal: s.setModal,
  }));

  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const {
    addRelay,
    deleteRelay,
    syncRelays,
    isAddingRelay,
    isDeletingRelay,
    isSyncingRelays,
  } = useRelayActions();

  const relayModels = buildRelayModels(relays, relayLatency);
  const relayCount = relayModels.length;
  const onlineCount = relayModels.filter((relay) => relay.connected).length;
  const requestTotal = relayModels.reduce((sum, relay) => sum + relay.reqs, 0);
  // average over relays with a real measurement only
  const measured = relayModels.filter(
    (relay) => relay.connected && relay.latency != null,
  );
  const avgLatency = measured.length
    ? Math.round(
        measured.reduce((sum, relay) => sum + (relay.latency ?? 0), 0) /
          measured.length,
      )
    : null;

  const handleAddRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    const added = await addRelay(newRelayUrl);
    if (added) {
      setNewRelayUrl("");
      setShowAddForm(false);
    }
  };

  const handleDeleteRelay = async (url: string) => {
    if (!relays[url]) return;
    await deleteRelay(url);
  };

  const handleSyncAll = async () => {
    await syncRelays();
  };

  return (
    <div id="relay-dashboard-modal" className="relay-dashboard">
      <header className="relay-dashboard-header">
        <span className="relay-dashboard-icon">
          <Radio size={20} />
        </span>
        <div className="relay-dashboard-copy">
          <h2>Relay connections</h2>
          <div>
            {onlineCount} of {relayCount} online
            {avgLatency != null ? ` · avg ${avgLatency}ms` : ""}
          </div>
        </div>
        <button
          className="relay-close-btn"
          onClick={() => setModal(null)}
          aria-label="Close"
        >
          <X size={19} />
        </button>
      </header>

      <div className="relay-dashboard-stats">
        <div>
          <strong>
            {onlineCount}
            <span>/{relayCount}</span>
          </strong>
          <small>Online</small>
        </div>
        <div>
          <strong>
            {avgLatency ?? "—"}
            {avgLatency != null && <span>ms</span>}
          </strong>
          <small>Avg latency</small>
        </div>
        <div>
          <strong>{requestTotal}</strong>
          <small>Requests</small>
        </div>
      </div>

      <div className="relay-dashboard-actions">
        <button
          className="relay-action-btn"
          onClick={handleSyncAll}
          disabled={isSyncingRelays || relayCount === 0}
        >
          <RefreshCw size={15} className={isSyncingRelays ? "spinning" : ""} />
          {isSyncingRelays ? "Syncing" : "Sync all"}
        </button>
        <button
          className="relay-action-btn primary"
          onClick={() => setShowAddForm((showing) => !showing)}
        >
          <Plus size={15} />
          Add relay
        </button>
      </div>

      {showAddForm && (
        <form className="relay-add-form" onSubmit={handleAddRelay}>
          <input
            type="text"
            placeholder="wss://relay.example.com"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            disabled={isAddingRelay}
            className="mono"
            autoFocus
          />
          <button type="submit" disabled={isAddingRelay || !newRelayUrl.trim()}>
            {isAddingRelay ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      <div className="relay-dashboard-list">
        {relayCount === 0 ? (
          <div className="relay-empty">
            <Radio size={36} strokeWidth={1.5} />
            <div>No relays configured</div>
            <span>Add a relay to connect to the network.</span>
          </div>
        ) : (
          relayModels.map((relay) => {
            return (
              <div key={relay.url} className="relay-dashboard-item">
                <div className="relay-dashboard-item-head">
                  <span
                    className="relay-dashboard-status-indicator"
                    style={
                      {
                        "--relay-color": relay.color,
                      } as CSSProperties
                    }
                  />
                  <span className="relay-dashboard-url mono">{relay.short}</span>
                  <span className="relay-dashboard-status mono" style={{ color: relay.color }}>
                    {relay.status}
                  </span>
                  <button
                    className="relay-dashboard-delete-btn"
                    onClick={() => handleDeleteRelay(relay.url)}
                    disabled={isDeletingRelay}
                    title="Remove relay"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="relay-dashboard-latency-bar">
                  <span
                    style={{ width: `${relay.barWidth}%`, background: relay.color }}
                  />
                </div>
                <div className="relay-dashboard-meta">
                  <span>
                    Uptime <b>{formatRelayUptime(relay.start)}</b>
                  </span>
                  <span>
                    Requests <b>{relay.reqs}</b>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
