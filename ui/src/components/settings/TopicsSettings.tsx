import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, TrendingUp } from "lucide-react";
import useLocalState from "@/state/state";
import { unwrap } from "@/logic/result";
import { parseProviders, type AiProvider } from "@/logic/aiClient";
import {
  CATEGORY_OPTIONS,
  COUNTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  parseTrending,
  TOPIC_PREFS_EVENT,
  type TopicPrefs,
} from "@/logic/topics";

// what the trending topics card draws from. %topics keeps these; hidden when
// it isn't running
export default function TopicsSettings() {
  const api = useLocalState((s) => s.api);
  const [saved, setSaved] = useState<TopicPrefs | null>(null);
  const [draft, setDraft] = useState<TopicPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  // the spam filter: a %trill-ai-client provider, or none
  const [spamProvider, setSpamProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);

  useEffect(() => {
    if (!api) return;
    api.scryTopics().then((res) => {
      const trending = "ok" in res ? parseTrending(res.ok) : null;
      const prefs = trending?.prefs ?? null;
      setSaved(prefs);
      setDraft(prefs);
      setSpamProvider(trending?.spam.provider ?? null);
    });
    // fails when %trill-ai-client isn't running: no providers to offer
    api.scryAiProviders().then((res) => {
      if ("ok" in res) setProviders(parseProviders(res.ok));
    });
  }, [api]);

  async function chooseSpamProvider(next: string | null) {
    if (!api) return;
    const before = spamProvider;
    setSpamProvider(next);
    const res = await api.setTopicSpamProvider(next);
    if ("error" in res) {
      setSpamProvider(before);
      toast.error("Couldn't change the spam filter");
      return;
    }
    window.dispatchEvent(new Event(TOPIC_PREFS_EVENT));
    toast.success(next ? `Spam filtered by ${next}` : "Spam filter off");
  }

  if (!draft || !saved) return null;
  const dirty =
    draft.country !== saved.country ||
    draft.lang !== saved.lang ||
    [...draft.categories].sort().join() !== [...saved.categories].sort().join();

  function toggle(cat: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.categories.includes(cat);
      // at least one: an empty card isn't a setting
      if (has && d.categories.length === 1) return d;
      return {
        ...d,
        categories: has ? d.categories.filter((c) => c !== cat) : [...d.categories, cat],
      };
    });
  }

  async function save() {
    if (!api || !draft) return;
    setSaving(true);
    try {
      unwrap(await api.setTopicPrefs(draft));
      setSaved(draft);
      window.dispatchEvent(new Event(TOPIC_PREFS_EVENT));
      toast.success("Trending topics updated");
    } catch {
      toast.error("Couldn't save trending topics settings");
    }
    setSaving(false);
  }

  // saved codes missing from the menus (set from dojo) still show
  const countries = COUNTRY_OPTIONS.some((c) => c.code === draft.country)
    ? COUNTRY_OPTIONS
    : [...COUNTRY_OPTIONS, { code: draft.country, label: draft.country }];
  const languages = LANGUAGE_OPTIONS.some((l) => l.code === draft.lang)
    ? LANGUAGE_OPTIONS
    : [...LANGUAGE_OPTIONS, { code: draft.lang, label: draft.lang }];

  return (
    <div id="settings-topics" className="settings-section">
      <div className="section-header">
        <TrendingUp size={18} />
        <h2>Trending topics</h2>
      </div>
      <div className="settings-panel">
        <p>
          Where the trending topics card looks. Country sets Google Trends and the Google
          News edition; language applies to Google News. Hacker News is always included.
        </p>
        <div className="topics-settings-row">
          <label>
            Country
            <select
              className="topics-settings-select"
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              className="topics-settings-select"
              value={draft.lang}
              onChange={(e) => setDraft({ ...draft, lang: e.target.value })}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="topics-settings-cats" role="group" aria-label="Categories">
          {CATEGORY_OPTIONS.map((c) => {
            const on = draft.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                className={`topics-settings-cat${on ? " active" : ""}`}
                onClick={() => toggle(c.id)}
              >
                {on && <Check size={14} />}
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="topics-settings-row topics-settings-spam">
          <label>
            Spam filter
            <select
              className="topics-settings-select"
              value={spamProvider ?? ""}
              onChange={(e) => chooseSpamProvider(e.target.value || null)}
            >
              <option value="">Off</option>
              {/* a provider set before it was deleted still shows */}
              {spamProvider && !providers.some((p) => p.name === spamProvider) && (
                <option value={spamProvider}>{spamProvider} (missing)</option>
              )}
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="topics-settings-note">
            Jev, through one of your AI providers, rates each topic; those it's 90% sure are
            spam are hidden, and listed under the card to check.
            {providers.length === 0 && " Add a provider under AI providers first."}
          </p>
        </div>
        <div className="topics-settings-actions">
          <button
            onClick={save}
            className="settings-save-btn"
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
