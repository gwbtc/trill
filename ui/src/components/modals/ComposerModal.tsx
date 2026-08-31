import Composer from "@/components/composer/Composer";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { shortRelayUrl } from "@/logic/relayDisplay";
import useLocalState from "@/state/state";
import { Check, ChevronDown, Radio } from "lucide-react";
import { useState } from "react";

export default function ComposerModal() {
  const { relays, setComposerData, setModal } = useLocalState((s) => ({
    relays: s.relays,
    setComposerData: s.setComposerData,
    setModal: s.setModal,
  }));
  const [relayOpen, setRelayOpen] = useState(false);
  // default: urbit only. cross-posting to nostr relays is opt-in
  const [relayMode, setRelayMode] = useState<"none" | "all" | "selected">(
    "none",
  );
  const [selectedRelays, setSelectedRelays] = useState<Set<string>>(new Set());

  // only relays with a live socket can receive a post
  const relayEntries = Object.keys(relays).filter(
    (url) => relays[url].wid != null,
  );
  const relayCount = relayEntries.length;
  const selectedCount = selectedRelays.size;
  const relayLabel =
    relayMode === "none" || (relayMode === "selected" && selectedCount === 0)
      ? "urbit only"
      : relayMode === "all"
        ? relayCount === 0
          ? "urbit only"
          : "all relays"
        : selectedCount === 1
          ? shortRelayUrl([...selectedRelays][0])
          : `${selectedCount} relays`;

  const relayTargets =
    relayMode === "none"
      ? []
      : relayMode === "all"
        ? relayEntries
        : relayEntries.filter((url) => selectedRelays.has(url));

  const pickNoRelays = () => {
    setRelayMode("none");
    setSelectedRelays(new Set());
  };

  const pickAllRelays = () => {
    setRelayMode("all");
    setSelectedRelays(new Set());
  };

  const toggleRelay = (relay: string) => {
    setRelayMode("selected");
    setSelectedRelays((current) => {
      const next = new Set(current);
      if (next.has(relay)) next.delete(relay);
      else next.add(relay);
      return next;
    });
  };

  const close = () => {
    setComposerData(null);
    setModal(null);
  };

  return (
    <div id="compose-modal" className="compose-modal">
      <header className="compose-modal-header">
        <h2 id="compose-modal-title" className="sr-only">Compose post</h2>
        <ModalCloseButton onClick={close} />
        <div className="compose-relay-wrap">
          <button
            className="compose-relay-picker"
            type="button"
            onClick={() => setRelayOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={relayOpen}
          >
            <span className={relayCount ? "online" : "offline"} />
            <span className="mono">{relayLabel}</span>
            <ChevronDown size={13} />
          </button>
          {relayOpen && (
            <div className="compose-popover compose-relay-menu" role="menu">
              <div className="compose-popover-label">Also send to</div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={relayMode === "none"}
                onClick={pickNoRelays}
              >
                <Radio size={16} />
                <span>Urbit only</span>
                {relayMode === "none" && <Check size={16} />}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={relayMode === "all"}
                onClick={pickAllRelays}
              >
                <Radio size={16} />
                <span>All relays</span>
                {relayMode === "all" && <Check size={16} />}
              </button>
              {relayEntries.length > 0 && <div className="compose-menu-rule" />}
              {relayEntries.map((relay) => (
                <button
                  type="button"
                  key={relay}
                  role="menuitemcheckbox"
                  aria-checked={relayMode === "selected" && selectedRelays.has(relay)}
                  onClick={() => toggleRelay(relay)}
                  className={relayMode === "selected" && selectedRelays.has(relay) ? "selected" : ""}
                >
                  <span className="relay-dot" />
                  <span className="mono">{shortRelayUrl(relay)}</span>
                  {relayMode === "selected" && selectedRelays.has(relay) && (
                    <Check size={15} />
                  )}
                </button>
              ))}
              <div className="compose-menu-rule" />
              <button
                type="button"
                role="menuitem"
                className="done"
                onClick={() => setRelayOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </header>
      <Composer isModal relayTargets={relayTargets} />
    </div>
  );
}
