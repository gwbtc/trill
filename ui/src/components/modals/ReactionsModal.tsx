import { useLocation } from "wouter";
import type { Poast } from "@/types/trill";

interface ReactionsModalProps {
  poast: Poast;
  onClose: () => void;
}

export default function ReactionsModal({
  poast,
  onClose,
}: ReactionsModalProps) {
  const [_, navigate] = useLocation();

  function handleNavigate(e: React.MouseEvent, routerPath: string) {
    e.preventDefault();
    e.stopPropagation();
    navigate(routerPath);
    onClose();
  }

  return (
    <div>
      <h3>Reactions</h3>
      <div>
        {Object.entries(poast.engagement.reacts).map(([ship, emoji]) => {
          const userPath = `/apps/nostrill/u/${ship}`;
          const routerPath = `/u/${ship}`;
          return (
            <div key={ship} style={{ display: "flex", gap: "10px" }}>
              <span>{emoji}</span>
              <a
                href={userPath}
                role="link"
                onClick={(e) => {
                  handleNavigate(e, routerPath);
                }}
              >
                {ship}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
