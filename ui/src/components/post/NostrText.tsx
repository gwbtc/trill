import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import { shortNote, shortNpub, splitNostrRefs } from "@/logic/nostrRefs";

// text with its NIP-27 references ("nostr:npub1…") shown as @names and note
// links. clicks stop at the mention so the post around it doesn't open
export default function NostrText({ text }: { text: string }) {
  const [, navigate] = useLocation();
  const profiles = useLocalState((s) => s.profiles);
  const tokens = splitNostrRefs(text);
  // the common case: nothing to link
  if (tokens.length === 1 && "text" in tokens[0]) return <span>{text}</span>;
  const go = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(path);
  };
  return (
    <>
      {tokens.map((t, i) =>
        "text" in t ? (
          <span key={i}>{t.text}</span>
        ) : "profile" in t ? (
          <a
            key={i}
            href={`/apps/nostrill/u/${t.profile}`}
            className="nostr-mention"
            title={t.raw}
            onClick={(e) => go(e, `/u/${t.profile}`)}
          >
            @{profiles.get(t.profile)?.name?.trim() || shortNpub(t.profile)}
          </a>
        ) : (
          <a
            key={i}
            href={`/apps/nostrill/t/n/${t.event}`}
            className="nostr-mention"
            title={t.raw}
            onClick={(e) => go(e, `/t/n/${t.event}`)}
          >
            {shortNote(t.event)}
          </a>
        ),
      )}
    </>
  );
}
