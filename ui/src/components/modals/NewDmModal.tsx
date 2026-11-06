import "@/styles/Messages.css";
import Avatar from "@/components/Avatar";
import useLocalState from "@/state/state";
import { useChatStore } from "@/state/chat";
import { patpToFallbackUID } from "@/logic/gw";
import { newTlonActionId } from "@/logic/tlon/client";
import { isValidPatp } from "urbit-ob";
import { Check, MessageSquarePlus, Search, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";

export default function NewDmModal() {
  const [, navigate] = useLocation();
  const { profiles, setModal } = useLocalState((s) => ({
    profiles: s.profiles,
    setModal: s.setModal,
  }));
  const conversations = useChatStore((s) => s.conversations);
  const our = useChatStore((s) => s.our);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [groupId] = useState(newTlonActionId);
  const ids = [
    ...new Set([
      ...profiles.keys(),
      ...[...conversations.values()]
        .filter((row) => row.kind === "direct")
        .map((row) => row.id),
    ]),
  ].filter((id) => id !== our && id.startsWith("~") && isValidPatp(id));
  const matches = ids.filter((id) =>
    `${id} ${profiles.get(id)?.name ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const raw = query.trim();
  const canCreate =
    raw !== our &&
    raw.startsWith("~") &&
    isValidPatp(raw) &&
    !matches.includes(raw);
  function choose(id: string) {
    if (!group) {
      setModal(null);
      navigate(`/dms/${encodeURIComponent(id)}`);
      return;
    }
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
    setQuery("");
  }
  async function create() {
    const client = useChatStore.getState().client;
    if (!client || creating || selected.length < 2) return;
    setCreating(true);
    try {
      await client.createGroup(groupId, selected);
      await useChatStore.getState().refresh();
      setModal(null);
      navigate(`/dms/${encodeURIComponent(groupId)}`);
    } catch {
      toast.error("Could not create this group. Please try again.");
    } finally {
      setCreating(false);
    }
  }
  return (
    <section id="new-dm-modal" aria-labelledby="new-dm-title">
      <header className="new-dm-header">
        <button
          className="new-dm-close"
          onClick={() => setModal(null)}
          aria-label="Close new message"
        >
          <X size={19} />
        </button>
        <h2 id="new-dm-title">{group ? "New group message" : "New message"}</h2>
      </header>
      <label className="dm-group-toggle">
        <input
          type="checkbox"
          checked={group}
          disabled={creating}
          onChange={(e) => {
            setGroup(e.target.checked);
            setSelected([]);
          }}
        />
        Message several people
      </label>
      <label className="new-dm-search">
        <Search size={18} />
        <input
          autoFocus
          value={query}
          disabled={creating}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or paste a ~ship..."
        />
      </label>
      {group && (
        <div className="dm-selected-members">
          {selected.map((id) => (
            <button
              key={id}
              disabled={creating}
              onClick={() => choose(id)}
              aria-label={`Remove ${id}`}
            >
              {id} <X size={12} />
            </button>
          ))}
          <button
            className="dm-create-group"
            disabled={creating || selected.length < 2}
            onClick={() => void create()}
          >
            {creating ? "Creating..." : "Create group"}
          </button>
          <small>Choose at least two other people.</small>
        </div>
      )}
      <div className="new-dm-results">
        {matches.map((id) => (
          <button
            className="new-dm-person"
            key={id}
            disabled={creating}
            onClick={() => choose(id)}
            aria-pressed={group ? selected.includes(id) : undefined}
          >
            <Avatar
              user={{ urbit: patpToFallbackUID(id) }}
              profile={profiles.get(id)}
              size={44}
              noClick
              picOnly
            />
            <span className="new-dm-person-main">
              <span className="new-dm-person-name">
                {profiles.get(id)?.name || id}
              </span>
              <span className="new-dm-person-id mono">{id}</span>
            </span>
            {selected.includes(id) && <Check size={18} />}
          </button>
        ))}
        {canCreate && (
          <button
            className="new-dm-person"
            disabled={creating}
            onClick={() => choose(raw)}
          >
            <MessageSquarePlus size={20} />
            <span className="new-dm-person-main">
              <span className="new-dm-person-name">
                {group ? "Add this person" : "Message this address"}
              </span>
              <span className="new-dm-person-id mono">{raw}</span>
            </span>
          </button>
        )}
        {!matches.length && !canCreate && query && (
          <div className="new-dm-empty">No people match "{query}"</div>
        )}
      </div>
    </section>
  );
}
