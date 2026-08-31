import useLocalState from "@/state/state";
import { Radio } from "lucide-react";
import RelayDashboard from "./RelayDashboard";
import "./RelayDashboard.css";

export default function RelayStatusButton() {
  const { relays, setModal } = useLocalState((s) => ({
    relays: s.relays,
    setModal: s.setModal,
  }));

  const relayCount = Object.keys(relays).length;
  const hasRelays = relayCount > 0;

  const openDashboard = () => {
    setModal(<RelayDashboard />);
  };

  return (
    <button
      className="relay-status-button"
      onClick={openDashboard}
      title="View relay connections"
    >
      <span className={`status-dot ${hasRelays ? "" : "inactive"}`} />
      <Radio size={16} />
      <span className="status-text">
        {relayCount} Relay{relayCount !== 1 ? "s" : ""}
      </span>
    </button>
  );
}
