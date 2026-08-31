import type { UrbitID } from "@/types/nostrill";
import { UrbitAvatar } from "./Avatar";
import { getDisplayName } from "@/logic/userDisplay";

export default function({ goto, our }: { goto: (s: string) => void; our: UrbitID }) {
  const displayName = getDisplayName( {urbit: our}, undefined);
    return (
      <div
        id="ship-card"
        className="sidebar-ship-card"
        role="link"
        onClick={() => goto(`/u/${our.gwid.english.nym}`)}
      >
        <div className="ship-card-top">
          <div className="ship-card-avatar">
            <UrbitAvatar uid={our} size={42} />
          </div>
          <div className="ship-card-info">
            <div className="ship-card-name">you</div>
            <div className="ship-card-patp mono">{displayName}</div>
          </div>
        </div>
        <div className="ship-card-status">
          <span className="status-pulse" />
          <span className="status-label">on the network</span>
        </div>
      </div>
    )
}
