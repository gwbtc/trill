import { Ban, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useChatStore } from "@/state/chat";
import toast from "react-hot-toast";

export default function DmComposer({
  peer,
  blocked,
  disabledReason,
}: {
  peer: string;
  blocked: boolean;
  disabledReason?: string;
}) {
  const draft = useChatStore((s) => s.drafts[peer] ?? "");
  const [sending, setSending] = useState(false);
  const pending = useRef(false);
  async function submit() {
    if (blocked || disabledReason || pending.current || !draft.trim()) return;
    pending.current = true;
    setSending(true);
    try {
      await useChatStore.getState().send(peer, draft.trim());
      if (useChatStore.getState().drafts[peer] === draft)
        useChatStore.getState().setDraft(peer, "");
    } catch {
      toast.error("Message could not be sent. Your draft is saved.");
    } finally {
      pending.current = false;
      setSending(false);
    }
  }
  return (
    <footer className={`dm-composer${blocked ? " blocked" : ""}`}>
      {blocked && (
        <div className="dm-composer-blocked-note">
          <Ban size={14} />
          Unblock this person to send messages.
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => useChatStore.getState().setDraft(peer, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={
          blocked
            ? "Blocked users cannot be messaged"
            : disabledReason || "Send an encrypted message..."
        }
        rows={1}
        disabled={blocked || !!disabledReason}
      />
      <button
        type="button"
        className="dm-send-button"
        disabled={blocked || !!disabledReason || sending || !draft.trim()}
        onClick={() => void submit()}
        aria-label="Send message"
      >
        <Send size={20} />
      </button>
    </footer>
  );
}
