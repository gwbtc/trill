import type { Lock, Rank } from "@/types/trill";

interface LockEditorProps {
  lock: Lock;
  onChange: (lock: Lock) => void;
  label: string;
}

const RANKS: Rank[] = ["czar", "king", "duke", "earl", "pawn"];

export default function LockEditor({ lock, onChange, label }: LockEditorProps) {
  const updateRank = (r: Rank, checked: boolean) => {
    const current = lock.rank.caveats;
    const newCaveats = checked
      ? [...current, r]
      : current.filter((x) => x !== r);
    onChange({
      ...lock,
      rank: { ...lock.rank, caveats: newCaveats },
    });
  };

  const updateShips = (val: string) => {
    const ships = val
      .split(/[\s,]+/) // Split by newline, whitespace, or comma
      .map((s) => s.trim())
      .filter((s) => s !== "" && s.startsWith("~")); // Basic validation
    // TODO: better ship validation
    onChange({
      ...lock,
      ship: { ...lock.ship, caveats: ships as any[] }, // Type assertion needed if Ship is stricter than string
    });
  };

  const updateTags = (val: string) => {
    const tags = val
      .split(/[\s,]+/) // Split by newline, whitespace, or comma
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onChange({
      ...lock,
      tags: { ...lock.tags, caveats: tags },
    });
  };

  const toggleLocked = (
    type: "rank" | "ship" | "luk" | "tags",
    val: boolean,
  ) => {
    onChange({
      ...lock,
      [type]: { ...lock, locked: val },
    });
  };

  return (
    <div
      className="lock-editor"
      style={{
        border: "1px solid #333",
        padding: "10px",
        marginBottom: "10px",
        borderRadius: "4px",
      }}
    >
      <h4>{label}</h4>

      <div className="lock-section">
        <label>
          <input
            type="checkbox"
            checked={lock.rank.locked}
            onChange={(e) => toggleLocked("rank", e.target.checked)}
          />
          Restrict by Rank
        </label>
        {lock.rank.locked && (
          <div style={{ marginLeft: "20px" }}>
            {RANKS.map((r) => (
              <label key={r} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={lock.rank.caveats.includes(r)}
                  onChange={(e) => updateRank(r, e.target.checked)}
                />
                {r}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="lock-section" style={{ marginTop: "10px" }}>
        <label>
          <input
            type="checkbox"
            checked={lock.ship.locked}
            onChange={(e) => toggleLocked("ship", e.target.checked)}
          />
          Restrict by Ship (Whitelist)
        </label>
        {lock.ship.locked && (
          <div style={{ marginLeft: "20px" }}>
            <textarea
              value={lock.ship.caveats.join("\n")}
              onChange={(e) => updateShips(e.target.value)}
              placeholder="~zod\n~bus"
              rows={3}
              style={{
                width: "100%",
                background: "#222",
                color: "#fff",
                border: "1px solid #444",
              }}
            />
          </div>
        )}
      </div>

      <div className="lock-section" style={{ marginTop: "10px" }}>
        <label>
          <input
            type="checkbox"
            checked={lock.tags.locked}
            onChange={(e) => toggleLocked("tags", e.target.checked)}
          />
          Restrict by Tags (Whitelist)
        </label>
        {lock.tags.locked && (
          <div style={{ marginLeft: "20px" }}>
            <textarea
              value={lock.tags.caveats.join("\n")}
              onChange={(e) => updateTags(e.target.value)}
              placeholder="politics\nnsfw"
              rows={3}
              style={{
                width: "100%",
                background: "#222",
                color: "#fff",
                border: "1px solid #444",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
