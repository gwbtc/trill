import { useState } from "react";
import toast from "react-hot-toast";
import triangles from "@/assets/triangles.svg";
import useLocalState from "@/state/state";
import type { PostRef } from "@/logic/lists";

const REASONS = ["Spam", "Harassment", "Illegal content", "Something else"] as const;

// reporting hides the post for us; for an urbit post the host ship also gets
// a notification with the reason
export default function ReportDialog({
  postRef,
  host,
}: {
  postRef: PostRef;
  // the ship that will be told, if any (urbit posts not our own)
  host: string | null;
}) {
  const { api, setModal } = useLocalState((s) => ({ api: s.api, setModal: s.setModal }));
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!api) return;
    setSending(true);
    const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
    const res = await api.report(postRef, text);
    setSending(false);
    if ("error" in res) {
      toast.error("Could not report post");
      return;
    }
    toast.success("Post reported");
    setModal(null);
  }

  return (
    <div className="confirmation-dialog report-dialog">
      <p>Report this post</p>
      <span className="report-dialog-note">
        {host
          ? `It will be hidden for you, and ${host} will be notified.`
          : "It will be hidden for you."}
      </span>
      <div className="report-dialog-reasons" role="radiogroup" aria-label="Reason">
        {REASONS.map((r) => (
          <label key={r} className={r === reason ? "selected" : ""}>
            <input
              type="radio"
              name="report-reason"
              checked={r === reason}
              onChange={() => setReason(r)}
            />
            {r}
          </label>
        ))}
      </div>
      <textarea
        className="report-dialog-details"
        placeholder="Add details (optional)"
        value={details}
        maxLength={280}
        onChange={(e) => setDetails(e.target.value)}
      />
      {sending ? (
        <div className="loading-spinner">
          <img src={triangles} alt="Sending..." />
        </div>
      ) : (
        <div className="confirmation-buttons">
          <button className="btn-confirm" onClick={submit}>
            Report
          </button>
          <button className="btn-cancel" onClick={() => setModal(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
