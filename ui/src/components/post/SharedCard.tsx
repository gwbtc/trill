import type { SharedCard } from "@/logic/cards";
import "@/styles/SharedCard.css";
import TopicThumb from "@/components/TopicThumb";

// a UI card shared into a post, frozen as it was when shared
export default function SharedCardView({ card }: { card: SharedCard }) {
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
