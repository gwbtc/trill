import type { SharedCard } from "@/logic/cards";
import "@/styles/SharedCard.css";
import TopicThumb from "@/components/TopicThumb";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import { debateKey } from "@/logic/debates";

// a UI card shared into a post, frozen as it was when shared
export default function SharedCardView({ card }: { card: SharedCard }) {
  if (card.debate) return <DebateCardView card={card} debate={card.debate} />;
  const when = card.at
    ? new Date(card.at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <div className="shared-card" onClick={(e) => e.stopPropagation()}>
      <div className="shared-card-header">
        <div className="shared-card-title">{card.title}</div>
        {card.subtitle && <div className="shared-card-subtitle">{card.subtitle}</div>}
        {when && <time className="shared-card-time">{when}</time>}
      </div>
      <ol className="shared-card-items">
        {card.items.map((item, i) => (
          <li key={`${i}-${item.title}`} className="shared-card-item">
            <div className="shared-card-rank">{i + 1}</div>
            <div className="shared-card-item-body">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              ) : (
                <div>{item.title}</div>
              )}
              {item.meta && <div className="shared-card-meta">{item.meta}</div>}
            </div>
            {item.pic && <TopicThumb src={item.pic} className="shared-card-pic" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

// a shared debate: its two sides, and a way in. the host serves it, so
// opening it works from any ship
function DebateCardView({
  card,
  debate,
}: {
  card: SharedCard;
  debate: { host: string; id: string };
}) {
  const [, navigate] = useLocation();
  const [a, b] = card.items;
  // a debate we follow shows as it is now; others as they were when shared
  const stage = useLocalState((s) => s.debates.get(debateKey(debate))?.stage);
  const subtitle = stage
    ? `${debate.host}'s debate · ${stage === "scheduled" ? "upcoming" : stage}`
    : card.subtitle;
  return (
    <div className="shared-card shared-debate" onClick={(e) => e.stopPropagation()}>
      <div className="shared-card-header">
        <div className="shared-card-title">{card.title}</div>
      </div>
      {subtitle && <div className="shared-debate-sub">{subtitle}</div>}
      <div className="shared-debate-sides">
        {[a, b].map(
          (s, i) =>
            s && (
              <div key={i} className={`shared-debate-side ${i === 0 ? "a" : "b"}`}>
                <span className="shared-debate-side-name">{s.title}</span>
                {s.meta && <span className="shared-card-meta">{s.meta}</span>}
              </div>
            ),
        )}
      </div>
      <button
        type="button"
        className="shared-debate-open"
        onClick={() => navigate(`/debates/${debate.host}/${debate.id}`)}
      >
        Open debate
      </button>
    </div>
  );
}
