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
  return (
    <MessageComposer
      draft={draft}
      blocked={blocked}
      disabledReason={disabledReason}
      onChange={(text) => useChatStore.getState().setDraft(peer, text)}
      onSend={(text) => useChatStore.getState().send(peer, text)}
    />
  );
}

export function MessageComposer({
  draft,
  blocked = false,
  disabledReason,
  onChange,
  onSend,
  placeholder = "Send an encrypted message...",
}: {
  draft: string;
  blocked?: boolean;
  disabledReason?: string;
  onChange: (text: string) => void;
  onSend: (text: string) => Promise<void>;
  placeholder?: string;
}) {
  const [sending, setSending] = useState(false);
  const pending = useRef(false);
  async function submit() {
    if (blocked || disabledReason || pending.current || !draft.trim()) return;
    pending.current = true;
    setSending(true);
    try {
      await onSend(draft.trim());
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
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={
          blocked
            ? "Blocked users cannot be messaged"
            : disabledReason || placeholder
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
