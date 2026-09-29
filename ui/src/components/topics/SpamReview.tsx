import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import useLocalState from "@/state/state";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { sourceLabel, TOPIC_PREFS_EVENT, type FlaggedTopic } from "@/logic/topics";
import "@/styles/Topics.css";

// the trending topics hidden as spam, to check: Jev's say, and the owner's
// word over it. "not spam" brings one back; "hide again" leaves it to Jev
export default function SpamReview({
  flagged,
  threshold,
}: {
  flagged: FlaggedTopic[];
  threshold: number;
}) {
  const { api, setModal } = useLocalState((s) => ({ api: s.api, setModal: s.setModal }));
  // the owner's word per key, as changed here; the card reloads behind us
  const [words, setWords] = useState<Record<string, boolean | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const wordOf = (t: FlaggedTopic) => (t.key in words ? words[t.key] : t.override);
  // as +hidden:sur/topics: the owner's word, else Jev's over the threshold
  const isHidden = (t: FlaggedTopic) => {
    const w = wordOf(t);
    return w !== null ? w : t.spam !== null && t.spam >= threshold;
  };
  const hidden = flagged.filter(isHidden);
  const cleared = flagged.filter((t) => !isHidden(t));

  async function mark(t: FlaggedTopic, spam: boolean | null) {
    if (!api) return;
    setBusy(t.key);
    const res = await api.markTopic(t.key, spam);
    setBusy(null);
    if ("error" in res) {
      toast.error("Couldn't save that");
      return;
    }
    setWords((w) => ({ ...w, [t.key]: spam }));
    // the card reloads
    window.dispatchEvent(new Event(TOPIC_PREFS_EVENT));
  }

  const row = (t: FlaggedTopic, action: ReactNode) => (
    <div key={t.key} className="spam-review-row">
      <div className="spam-review-text">
        {t.url ? (
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="spam-review-title">
            {t.title}
          </a>
        ) : (
          <span className="spam-review-title">{t.title}</span>
        )}
        <span className="spam-review-meta">
          {sourceLabel(t.source)}
          {t.spam !== null && ` · ${Math.round(t.spam * 100)}% spam`}
          {wordOf(t) !== null && " · your call"}
        </span>
      </div>
      {action}
    </div>
  );

  return (
    <div className="topic-modal spam-review">
      <div className="topic-modal-top">
        <span className="topic-modal-source">Hidden as spam</span>
        <ModalCloseButton onClick={() => setModal(null)} />
      </div>
      <p className="spam-review-copy">
        Jev rates each trending topic; what it's {Math.round(threshold * 100)}% sure is spam is
        hidden from the card.
      </p>
      {hidden.length === 0 ? (
        <p className="spam-review-empty">Nothing hidden right now.</p>
      ) : (
        hidden.map((t) =>
          row(
            t,
            <button
              type="button"
              className="topic-modal-btn"
              disabled={busy === t.key}
              onClick={() => mark(t, false)}
            >
              Not spam
            </button>,
          ),
        )
      )}
      {cleared.length > 0 && (
        <>
          <div className="topic-modal-label spam-review-label">You said these aren't spam</div>
          {cleared.map((t) =>
            row(
              t,
              <button
                type="button"
                className="topic-modal-btn"
                disabled={busy === t.key}
                onClick={() => mark(t, null)}
              >
                Hide again
              </button>,
            ),
          )}
        </>
      )}
    </div>
  );
}
