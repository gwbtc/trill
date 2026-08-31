import Icon from "@/components/Icon";

export default function ({ open }: { open: () => void }) {
  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    open();
  }
  return (
    <div className="icon-container">
      <span className="icon-count" />
      <div className="icon-wrapper" role="link" onMouseUp={handleClick}>
        <Icon name="nostr2" title="relay to nostr" />
      </div>
    </div>
  );
}

// npub1w8k2hk9kkv653cr4luqmx9tglldpn59vy7yqvlvex2xxmeygt96s4dlh8p
