import type { Gate } from "@/types/trill";
import GateEditor from "./GateEditor";
import { defaultGate } from "@/logic/bunts";

export interface PostPerms {
  read: Gate;
  write: Gate;
}

interface PostPermsEditorProps {
  perms: PostPerms;
  onChange: (perms: PostPerms) => void;
}

export default function PostPermsEditor({ perms, onChange }: PostPermsEditorProps) {
  return (
    <div className="post-perms-editor" style={{ maxHeight: "400px", overflowY: "auto", padding: "10px", background: "#111" }}>
      <GateEditor
        gate={perms.read}
        onChange={(g) => onChange({ ...perms, read: g })}
        label="Read Permissions"
      />
      <GateEditor
        gate={perms.write}
        onChange={(g) => onChange({ ...perms, write: g })}
        label="Write/Reply Permissions"
      />
    </div>
  );
}

export const defaultPostPerms: PostPerms = {
  read: defaultGate,
  write: defaultGate,
};
