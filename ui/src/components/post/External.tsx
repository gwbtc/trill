import type { ExternalContent } from "@/types/trill";
import Card from "./Card";
import SharedCardView from "./SharedCard";
import { parseSharedCard } from "@/logic/cards";

interface JSONProps {
  content: ExternalContent[];
}

// remote content: malformed json must not throw during render
function parsesToValue(s: string) {
  try {
    return !!JSON.parse(s);
  } catch {
    return false;
  }
}

function JSONContent({ content }: JSONProps) {
  return (
    <>
      {content.map((c, i) => {
        if (c.json.origin === "card") {
          const card = parseSharedCard(c.json.content);
          return card ? <SharedCardView key={i} card={card} /> : null;
        }
        if (!parsesToValue(c.json.content)) return <p key={i}>Error</p>;
        else
          return (
            <p
              key={JSON.stringify(c.json)}
              className="external-content-warning"
            >
              External content from "{c.json.origin}", use
              <a href="https://urbit.org/applications/~sortug/ufa">UFA</a>
              to display.
            </p>
          );
      })}
    </>
  );
}
export default JSONContent;

export function YoutubeSnippet({ href, id }: { href: string; id: string }) {
  const thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  // todo styiling
  return (
    <Card logo="youtube" cn="youtube-thumbnail">
      <a href={href}>
        <img src={thumbnail} alt="" />
      </a>
    </Card>
  );
}
