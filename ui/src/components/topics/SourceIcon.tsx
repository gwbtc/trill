import gnews from "@/assets/sources/gnews.png";
import gtrends from "@/assets/sources/gtrends.png";
import hn from "@/assets/sources/hn.png";
import { sourceKind, sourceLabel } from "@/logic/topics";

// each kind of source's favicon, bundled rather than loaded from its site
const ICONS: Record<string, string> = { gnews, gtrends, hn };

export default function SourceIcon({ source }: { source: string }) {
  const src = ICONS[sourceKind(source)];
  if (!src) return null;
  return <img className="source-icon" src={src} alt="" title={sourceLabel(source)} />;
}
