import { Ban, Send } from "lucide-react";
import { useRef, useState } from "react";
import type IO from "@/logic/requests/nostrill";

export default function DmComposer({
  api,
  peer,
  blocked,
}: {
  api: IO | null;
  peer: string;
  blocked: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef("");
  const [hasDraft, setHasDraft] = useState(false);
  const canSend = !blocked && hasDraft;

  function submitMessage() {
    const draft = draftRef.current.trim();
    if (!api || blocked || !draft) return;
    void api.addChat(peer, draft);
    draftRef.current = "";
    if (textareaRef.current) textareaRef.current.value = "";
    setHasDraft(false);
  }

  function onComposerInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextDraft = event.target.value;
    draftRef.current = nextDraft;
    const nextHasDraft = nextDraft.trim().length > 0;
    setHasDraft((current) => current === nextHasDraft ? current : nextHasDraft);
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (blocked) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitMessage();
  }

  return (
    <footer className={`dm-composer${blocked ? " blocked" : ""}`}>
      {blocked && (
        <div className="dm-composer-blocked-note">
          <Ban size={14} />
          This user is blocked. Unblock them to send messages.
        </div>
      )}
      <textarea
        ref={textareaRef}
        onChange={onComposerInput}
        onKeyDown={onComposerKeyDown}
        placeholder={blocked ? "Blocked users cannot be messaged" : "Send an encrypted message..."}
        rows={1}
        disabled={blocked}
      />
      <button
        type="button"
        className="dm-send-button"
        onClick={submitMessage}
        disabled={!canSend}
        aria-label="Send message"
        title="Send"
      >
        <Send size={20} strokeWidth={2} />
      </button>
    </footer>
  );
}
