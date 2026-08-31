import Sigil from "@/components/Sigil";
import useLocalState from "@/state/state";
import type { ComposerData } from "@/types/ui";
import { MessageCircle } from "lucide-react";

export default function ThreadReplyComposer({
  label,
  composerData,
}: {
  label: string;
  composerData: ComposerData;
}) {
  const { api, setComposerData } = useLocalState((s) => ({
    api: s.api,
    setComposerData: s.setComposerData,
  }));

  function openReply(e: React.MouseEvent) {
    e.stopPropagation();
    setComposerData(composerData);
  }

  return (
    <button id="thread-reply-composer" type="button" onClick={openReply}>
      <span className="thread-reply-avatar">
        <Sigil patp={api?.airlock.our || ""} size={44} />
      </span>
      <span className="thread-reply-copy">
        Reply to <span className="mono">{label}</span>...
      </span>
      <span className="thread-reply-button">
        <MessageCircle size={15} />
        Reply
      </span>
    </button>
  );
}
