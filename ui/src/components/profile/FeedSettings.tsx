import GateEditor from "@/components/permissions/GateEditor";
import useLocalState from "@/state/state";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function FeedSettings() {
  const { api, feedPerms } = useLocalState((s) => ({
    api: s.api,
    feedPerms: s.feedPerms,
  }));
  const [gate, setGate] = useState(feedPerms);

  // Update local state when store updates (if not dirty? complex)
  // For now, just init on mount or when feedPerms changes
  useEffect(() => {
    if (feedPerms) setGate(feedPerms);
  }, [feedPerms]);

  const handleSave = async () => {
    if (!api) return;
    await api.setFeedPerms(gate);
    toast.success("Feed permissions updated");
  };

  if (!gate) return <div>Loading permissions...</div>;

  return (
    <div
      className="feed-settings"
      style={{
        marginTop: "20px",
        padding: "15px",
        borderTop: "1px solid #333",
      }}
    >
      <h3>Feed Settings</h3>
      <p style={{ fontSize: "0.9em", color: "#aaa", marginBottom: "15px" }}>
        Control who can see your feed and who can interact with it.
      </p>
      <GateEditor
        gate={gate}
        onChange={setGate}
        label="Global Feed Permissions"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "10px",
        }}
      >
        <button
          onClick={handleSave}
          className="save-btn"
          style={{
            padding: "8px 16px",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Save Feed Permissions
        </button>
      </div>
    </div>
  );
}
