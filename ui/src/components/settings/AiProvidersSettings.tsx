import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bot, KeyRound, Pencil, X } from "lucide-react";
import useLocalState from "@/state/state";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import {
  baseUrlProblem,
  parseProviders,
  parseSuggestions,
  providerNameProblem,
  type AiProvider,
  type AiSuggestion,
} from "@/logic/aiClient";

// the AI model providers %trill-ai-client can call: a name, a base url and
// a key. keys go in and never come back out. hidden when the agent isn't
// running
export default function AiProvidersSettings() {
  const { api, setModal } = useLocalState((s) => ({ api: s.api, setModal: s.setModal }));
  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    if (!api) return;
    const res = await api.scryAiProviders();
    setProviders("ok" in res ? parseProviders(res.ok) : null);
  }

  useEffect(() => {
    if (!api) return;
    void load();
    api.scryAiSuggestions().then((res) => {
      if ("ok" in res) setSuggestions(parseSuggestions(res.ok));
    });
  }, [api]);

  if (!providers) return null;

  function remove(p: AiProvider) {
    setModal(
      <ConfirmationDialog
        message={`Remove ${p.name}? Its key is deleted with it.`}
        onConfirm={async () => {
          setModal(null);
          const res = await api!.deleteAiProvider(p.name);
          if ("error" in res) toast.error(`Couldn't remove ${p.name}`);
          await load();
        }}
        onCancel={() => setModal(null)}
      />,
    );
  }

  return (
    <div id="settings-ai" className="settings-section">
      <div className="section-header">
        <Bot size={18} />
        <h2>AI providers</h2>
      </div>
      <div className="settings-panel relay-panel">
        <p>
          Services Trill can ask AI models, e.g. to filter spam: any base url speaking
          the API, and your key for it. Keys stay on your ship.
        </p>
        {providers.length === 0 ? (
          <div className="no-relays">
            <Bot size={24} />
            <p>No providers yet</p>
          </div>
        ) : (
          providers.map((p) =>
            editing === p.name ? (
              <EditProvider
                key={p.name}
                p={p}
                done={async () => {
                  setEditing(null);
                  await load();
                }}
              />
            ) : (
              <div key={p.name} className="relay-item ai-provider">
                <span className="ai-provider-name">{p.name}</span>
                <span className="relay-url mono">{p.baseUrl}</span>
                <span
                  className={`ai-provider-key${p.hasKey ? " set" : ""}`}
                  title={p.hasKey ? "A key is set" : "No key: sent without authorization"}
                >
                  <KeyRound size={13} />
                  {p.hasKey ? "key" : "no key"}
                </span>
                <button
                  onClick={() => setEditing(p.name)}
                  className="remove-relay-btn edit"
                  title={`Edit ${p.name}`}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remove(p)}
                  className="remove-relay-btn"
                  title={`Remove ${p.name}`}
                  aria-label={`Remove ${p.name}`}
                >
                  <X size={16} />
                </button>
              </div>
            ),
          )
        )}
        <AddProvider taken={providers.map((p) => p.name)} suggestions={suggestions} added={load} />
      </div>
    </div>
  );
}

function AddProvider({
  taken,
  suggestions,
  added,
}: {
  taken: string[];
  suggestions: AiSuggestion[];
  added: () => Promise<void>;
}) {
  const api = useLocalState((s) => s.api);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const n = name.trim();
  const problem =
    (n && (providerNameProblem(n) ?? (taken.includes(n) ? `You already have ${n}` : null))) ||
    (url.trim() && baseUrlProblem(url)) ||
    null;
  const ready = n !== "" && url.trim() !== "" && !problem;
  const offered = suggestions.filter((s) => !taken.includes(s.name));

  async function add() {
    if (!api || !ready) return;
    setSaving(true);
    const res = await api.setAiProvider(n, url.trim(), key.trim());
    setSaving(false);
    if ("error" in res) {
      toast.error(`Couldn't add ${n}`);
      return;
    }
    setName("");
    setUrl("");
    setKey("");
    toast.success(`${n} added`);
    await added();
  }

  return (
    <form
      className="ai-provider-form"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      {offered.length > 0 && (
        <div className="ai-provider-suggestions">
          <span>Start from</span>
          {offered.map((s) => (
            <button
              key={s.name}
              type="button"
              className={`topics-settings-cat${name === s.name && url === s.baseUrl ? " active" : ""}`}
              onClick={() => {
                setName(s.name);
                setUrl(s.baseUrl);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="ai-provider-fields">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="name"
          className="relay-input mono ai-provider-name-input"
          aria-label="Provider name"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="relay-input mono"
          aria-label="Base url"
        />
      </div>
      <div className="ai-provider-fields">
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API key (optional)"
          className="relay-input mono"
          aria-label="API key"
        />
        <button type="submit" className="add-relay-btn" disabled={!ready || saving}>
          {saving ? "Adding…" : "Add provider"}
        </button>
      </div>
      {problem && <p className="ai-provider-problem">{problem}</p>}
    </form>
  );
}

function EditProvider({ p, done }: { p: AiProvider; done: () => Promise<void> }) {
  const api = useLocalState((s) => s.api);
  const [url, setUrl] = useState(p.baseUrl);
  const [key, setKey] = useState("");
  const [dropKey, setDropKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const problem = baseUrlProblem(url);

  async function save() {
    if (!api || problem) return;
    setSaving(true);
    // a new key replaces it, none keeps it, unless it's being removed
    const apiKey = key.trim() ? key.trim() : dropKey ? "" : null;
    const res = await api.setAiProvider(p.name, url.trim(), apiKey);
    setSaving(false);
    if ("error" in res) {
      toast.error(`Couldn't save ${p.name}`);
      return;
    }
    await done();
  }

  return (
    <form
      className="ai-provider-form editing"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <span className="ai-provider-name">{p.name}</span>
      <div className="ai-provider-fields">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="relay-input mono"
          aria-label="Base url"
          autoFocus
        />
      </div>
      <div className="ai-provider-fields">
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={p.hasKey && !dropKey ? "Keep the current key" : "API key (optional)"}
          className="relay-input mono"
          aria-label="API key"
        />
        {p.hasKey && (
          <label className="ai-provider-drop">
            <input type="checkbox" checked={dropKey} onChange={(e) => setDropKey(e.target.checked)} />
            Remove key
          </label>
        )}
      </div>
      {problem && <p className="ai-provider-problem">{problem}</p>}
      <div className="topics-settings-actions">
        <button type="button" className="ai-provider-cancel" onClick={() => void done()}>
          Cancel
        </button>
        <button type="submit" className="settings-save-btn" disabled={!!problem || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
