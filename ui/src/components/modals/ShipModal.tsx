import type { Ship } from "@/types/urbit";
import Avatar from "../Avatar";
import Icon from "@/components/Icon";
import useLocalState from "@/state/state";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import { userFromAuthor } from "@/logic/trill/helpers";

export default function ({ ship }: { ship: Ship }) {
  const { setModal, api } = useLocalState((s) => ({
    setModal: s.setModal,
    api: s.api,
  }));
  const user = userFromAuthor(ship);
  const [_, navigate] = useLocation();
  function close() {
    setModal(null);
  }
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(ship);
    toast.success("Copied to clipboard");
  }
  return (
    <div id="ship-modal">
      <div className="flex">
        <Avatar user={user} size={60} />
        <Icon
          name="copy"
          size={20}
          className="copy-icon cp"
          onClick={copy}
          title="Copy ship name"
        />
      </div>
      <div className="buttons f1">
        <button onClick={() => navigate(`/u/${ship}`)}>Feed</button>
        <button onClick={() => navigate(`/pals/${ship}`)}>Profile</button>
        {ship !== api!.airlock.our && (
          <>
            <button onClick={() => navigate(`/chat/dm/${ship}`)}>DM</button>
          </>
        )}
      </div>
    </div>
  );
}
