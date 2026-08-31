import useLocalState from "@/state/state";
import { useState } from "react";
import toast from "react-hot-toast";
import "@/styles/Settings.css";
import { WS_URL } from "@/logic/api";
import PageHeader from "@/components/layout/PageHeader";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import { useTheme } from "@/styles/ThemeProvider";
import { themeSwatches } from "@/styles/themeMetadata";
import { useRelayActions } from "@/hooks/useRelayActions";
import {
  persistThreadStyle,
  type ThreadStyle,
} from "@/hooks/useThreadStyle";
import {
  Check,
  Clock3,
  KeyRound,
  MessageCircle,
  Palette,
  Radio,
  RefreshCw,
  X,
} from "lucide-react";

type BacklogUnit = "hours" | "days";

const BACKLOG_UNITS: TabItem<BacklogUnit>[] = [
  { key: "hours", label: "Hours" },
  { key: "days", label: "Days" },
];

function Settings() {
  const { key, relays, relayLatency, api, sets } = useLocalState((s) => ({
    key: s.pubkey,
    relays: s.relays,
    relayLatency: s.relayLatency,
    api: s.api,
    sets: s.uiSettings,
  }));
  const [newRelay, setNewRelay] = useState("");
  const [isCyclingKey, setIsCyclingKey] = useState(false);
  const [backlogSize, setBacklogSize] = useState<number>(
    sets?.relay?.["backlog-size"] || 24,
  );
  const [backlogUnit, setBacklogUnit] = useState<BacklogUnit>("hours");
  const [threadStyle, setThreadStyleState] = useState<ThreadStyle>(
    () =>
      localStorage.getItem("trill-thread-style") === "linear"
        ? "linear"
        : "nested",
  );
  const { themeName, setTheme } = useTheme();
  const { addRelay, deleteRelay, isAddingRelay } = useRelayActions();

  async function addNewRelay() {
    if (!newRelay.trim()) {
      toast.error("Please enter a relay URL");
      return;
    }

    const added = await addRelay(newRelay);
    if (added) {
      setNewRelay("");
    }
  }

  async function cycleKey() {
    setIsCyclingKey(true);
    try {
      await api?.cycleKeys();
      toast.success("Key cycled successfully");
    } catch (error) {
      toast.error("Failed to cycle key");
      console.error("Cycle key error:", error);
    } finally {
      setIsCyclingKey(false);
    }
  }

  async function saveBacklogSize() {
    const hours = backlogUnit === "days" ? backlogSize * 24 : backlogSize;
    setMisc("relay", "backlog-size", hours);
  }
  async function setMisc(bucket: string, entry: string, value: any) {
    try {
      await api?.setSettings(bucket, entry, value);
      toast.success("Setting saved");
    } catch (e) {
      toast.error("Failed to save setting");
      console.error("settings save error:", e);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addNewRelay();
    }
  };
  function setThreadStyle(value: ThreadStyle) {
    setThreadStyleState(value);
    persistThreadStyle(value);
  }
  const firstRelayLatency = Object.keys(relays)
    .map((url) => relayLatency[url])
    .find((ms) => ms != null);

  return (
    <div id="screen-settings" className="settings-page trill-screen">
      <PageHeader title="Settings" subtitle="Manage your Trill configuration and preferences" />

      <div className="settings-content">
        <div className="settings-connection-banner">
          <span className="settings-live-dot" />
          <div>
            <div className="settings-connection-title">Connected to your ship</div>
            <div className="settings-connection-url mono">{`${WS_URL}/nostrill-ui`}</div>
          </div>
          <span className="settings-connection-latency mono">
            {firstRelayLatency != null ? `${firstRelayLatency}ms` : "live"}
          </span>
        </div>

        <div id="settings-identity" className="settings-section">
          <div className="section-header">
            <KeyRound size={18} />
            <h2>Identity</h2>
          </div>
          <div className="settings-panel">
            <label>Nostr public key</label>
            <p>Your unique identifier on the Nostr network</p>
            <div className="settings-key-row">
              <code className="pubkey">{key || "No key generated"}</code>
              <button
                onClick={cycleKey}
                disabled={isCyclingKey}
                className="cycle-btn secondary"
                title="Generate new key pair"
              >
                <RefreshCw size={15} className={isCyclingKey ? "spinning" : ""} />
                {isCyclingKey ? "Cycling..." : "Cycle key"}
              </button>
            </div>
          </div>
        </div>

        <div id="settings-relays" className="settings-section">
          <div className="section-header">
            <Radio size={18} />
            <h2>Nostr relays</h2>
          </div>
          <div className="settings-panel relay-panel">
            {Object.keys(relays).length === 0 ? (
              <div className="no-relays">
                <Radio size={24} />
                <p>No relays configured</p>
              </div>
            ) : (
              Object.entries(relays).map(([url, relay]) => {
                const latency = relayLatency[url];
                const connected = relay.wid != null;
                return (
                  <div key={url} className="relay-item">
                    <span className="relay-live-dot" />
                    <span className="relay-url mono">{url}</span>
                    <span className="relay-latency mono">
                      {!connected
                        ? "offline"
                        : latency != null
                          ? `${latency}ms`
                          : "live"}
                    </span>
                    <button
                      onClick={() => deleteRelay(url)}
                      className="remove-relay-btn"
                      title="Remove relay"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })
            )}

            <div className="settings-inline-form">
              <input
                type="text"
                value={newRelay}
                onChange={(e) => setNewRelay(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="wss://relay.example.com"
                className="relay-input mono"
              />
              <button
                onClick={addNewRelay}
                disabled={isAddingRelay || !newRelay.trim()}
                className="add-relay-btn"
              >
                {isAddingRelay ? "Adding..." : "Add relay"}
              </button>
            </div>
          </div>
        </div>

        <div id="settings-backlog" className="settings-section">
          <div className="section-header">
            <Clock3 size={18} />
            <h2>Backlog size</h2>
          </div>
          <div className="settings-panel">
            <p>How much history to fetch when syncing from a relay.</p>
            <div className="settings-backlog-row">
              <input
                type="number"
                min={1}
                value={backlogSize}
                onChange={(e) =>
                  setBacklogSize(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="backlog-input mono"
              />
              <TabStrip
                items={BACKLOG_UNITS}
                active={backlogUnit}
                onChange={setBacklogUnit}
                className="settings-segmented"
              />
              <button onClick={saveBacklogSize} className="settings-save-btn">
                Save
              </button>
            </div>
          </div>
        </div>

        <div id="settings-conversations" className="settings-section">
          <div className="section-header">
            <MessageCircle size={18} />
            <h2>Conversations</h2>
          </div>
          <p className="settings-section-copy">How replies are laid out in a thread.</p>
          <div className="conversation-grid">
            <button
              className={`conversation-tile${threadStyle === "nested" ? " active" : ""}`}
              onClick={() => setThreadStyle("nested")}
            >
              <span className="conversation-tile-head">
                <span>Nested</span>
                {threadStyle === "nested" && <Check size={18} />}
              </span>
              <span className="conversation-preview nested">
                <i />
                <i />
                <i />
              </span>
              <span className="conversation-copy">
                Reddit-style. Indented with connector lines and collapse.
              </span>
            </button>
            <button
              className={`conversation-tile${threadStyle === "linear" ? " active" : ""}`}
              onClick={() => setThreadStyle("linear")}
            >
              <span className="conversation-tile-head">
                <span>Linear</span>
                {threadStyle === "linear" && <Check size={18} />}
              </span>
              <span className="conversation-preview linear">
                <i />
                <b />
                <i />
              </span>
              <span className="conversation-copy">
                Twitter-style. Flat blocks split by dividers.
              </span>
            </button>
          </div>
        </div>

        <div id="settings-appearance" className="settings-section">
          <div className="section-header">
            <Palette size={18} />
            <h2>Appearance</h2>
          </div>
          <div className="settings-theme-grid">
            {themeSwatches.map((theme) => (
              <button
                key={theme.name}
                className={`settings-theme-tile${themeName === theme.name ? " active" : ""}`}
                onClick={() => setTheme(theme.name)}
              >
                <span className="settings-theme-swatch" style={{ background: theme.bg }}>
                  <span style={{ background: theme.accent }} />
                </span>
                <span>{theme.name}</span>
                {themeName === theme.name && (
                  <Check className="settings-theme-check" size={18} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export default Settings;
