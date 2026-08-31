import { useMemo, useState } from "react";
import emojis from "@/logic/emojis.json";

const QUICK = [
  "❤️", "😂", "🫡", "🤔", "😅", "😭", "😱", "👍",
  "👎", "🙏", "🤝", "👀", "💯", "🔥", "🤡", "🎤",
  "😍", "🥳", "🚀", "⚡", "🌊", "🐐", "🍕", "🎉",
];

// filters out slack-style aliases whose value is plain text
const isEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

export default function EmojiPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const out: { name: string; char: string }[] = [];
    for (const [name, char] of Object.entries(
      emojis as Record<string, string>,
    )) {
      if (!name.includes(q) || !isEmoji(char) || seen.has(char)) continue;
      seen.add(char);
      out.push({ name, char });
      if (out.length >= 48) break;
    }
    return out;
  }, [query]);

  const shown = results ?? QUICK.map((char) => ({ name: "", char }));

  return (
    <div className="compose-popover compose-emoji-picker">
      <input
        type="text"
        placeholder="Search emoji..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="compose-emoji-grid">
        {shown.map(({ name, char }) => (
          <button
            key={name || char}
            type="button"
            title={name || undefined}
            onClick={() => onPick(char)}
          >
            {char}
          </button>
        ))}
        {results && results.length === 0 && (
          <span className="compose-emoji-empty">no matches</span>
        )}
      </div>
    </div>
  );
}
