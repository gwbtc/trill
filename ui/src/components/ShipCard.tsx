import type { UrbitID } from "@/types/nostrill";
import { UrbitAvatar } from "./Avatar";
import { getDisplayName } from "@/logic/userDisplay";
import useLocalState from "@/state/state";
import { debatePath, presenceLabel } from "@/logic/debates";

export default function({ goto, our }: { goto: (s: string) => void; our: UrbitID }) {
  const displayName = getDisplayName( {urbit: our}, undefined);
  const debate = useLocalState((s) => s.currentDebate);
    return (
      <div
        id="ship-card"
        className="sidebar-ship-card"
        role="link"
        // same route as the sidebar's Profile link, so it resolves and highlights
        onClick={() => goto(`/u/${our.patp}`)}
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
        {debate ? (
          // the debate we're in takes the status line (the sidebar has no
          // room for another row); narrower screens get NowInDebate instead
          <button
            type="button"
            className="ship-card-status ship-card-debate"
            title={`${presenceLabel(debate)}: ${debate.topic}`}
            onClick={(e) => {
              e.stopPropagation();
              goto(debatePath(debate.key));
            }}
          >
            <span className={`debate-live-dot${debate.stage === "live" ? "" : " idle"}`} />
            <span className="status-label">
              {presenceLabel(debate)}: <strong>{debate.topic}</strong>
            </span>
          </button>
        ) : (
          <div className="ship-card-status">
            <span className="status-pulse" />
            <span className="status-label">on the network</span>
          </div>
        )}
      </div>
    )
}
