import { useLocation } from "wouter";
import type { Poast } from "@/types/trill";

interface QuoteModalProps {
  poast: Poast;
  onClose: () => void;
}

export default function QuoteModal({ poast, onClose }: QuoteModalProps) {
  const [_, navigate] = useLocation();

  function handleNavigate(e: React.MouseEvent, routerPath: string) {
    e.preventDefault();
    e.stopPropagation();
    navigate(routerPath);
    onClose();
  }

  return (
    <div>
      <h3>Quotes</h3>
      <div>
        {poast.engagement.quoted.map((quote, i) => {
          const threadPath = `/apps/nostrill/t/${quote.pid.ship}/${quote.pid.id}`;
          const routerPath = `/t/${quote.pid.ship}/${quote.pid.id}`;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{quote.pid.ship}</span>
              <a href={threadPath}
                onClick={(e) => { handleNavigate(e, routerPath) }}
                role="link">view quote</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}