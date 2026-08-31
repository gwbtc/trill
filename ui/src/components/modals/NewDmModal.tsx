import "@/styles/Messages.css";
import Avatar from "@/components/Avatar";
import useLocalState from "@/state/state";
import {
  canCreateRawDm,
  dmUserFromId,
  filterDmDirectory,
} from "@/logic/dms";
import { MessageSquarePlus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

export default function NewDmModal() {
  const [, navigate] = useLocation();
  const { dms, profiles, setModal } = useLocalState((s) => ({
    dms: s.dms,
    profiles: s.profiles,
    setModal: s.setModal,
  }));
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => filterDmDirectory(query, dms, profiles),
    [dms, profiles, query],
  );
  const canCreate = canCreateRawDm(query);
  const noResults = query.trim().length > 0 && results.length === 0 && !canCreate;

  function close() {
    setModal(null);
  }

  function openConversation(id2: string) {
    close();
    navigate(`/dms/${encodeURIComponent(id2)}`);
  }

  return (
    <section id="new-dm-modal" aria-labelledby="new-dm-title">
      <header className="new-dm-header">
        <button
          type="button"
          className="new-dm-close"
          onClick={close}
          aria-label="Close new message"
        >
          <X size={19} strokeWidth={2} />
        </button>
        <h2 id="new-dm-title">New message</h2>
      </header>

      <label className="new-dm-search">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people or paste a ~ship / npub..."
        />
      </label>

      <div className="new-dm-results">
        {results.map((person) => (
          <button
            type="button"
            className="new-dm-person"
            key={person.id2}
            onClick={() => openConversation(person.id2)}
          >
            <Avatar user={dmUserFromId(person.id2)} size={44} noClick picOnly />
            <span className="new-dm-person-main">
              <span className="new-dm-person-name">{person.name}</span>
              <span className="new-dm-person-id mono">{person.label}</span>
            </span>
            {person.existing && <span className="new-dm-existing">existing chat</span>}
          </button>
        ))}

        {canCreate && (
          <button
            type="button"
            className="new-dm-person"
            onClick={() => openConversation(query.trim())}
          >
            <span className="new-dm-raw-icon">
              <MessageSquarePlus size={20} strokeWidth={1.9} />
            </span>
            <span className="new-dm-person-main">
              <span className="new-dm-person-name">Message this address</span>
              <span className="new-dm-person-id mono">{query.trim()}</span>
            </span>
          </button>
        )}

        {noResults && (
          <div className="new-dm-empty">No people match "{query.trim()}"</div>
        )}
      </div>
    </section>
  );
}
