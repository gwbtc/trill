import type { ExternalContent } from "@/types/trill";
import Card from "./Card";

interface JSONProps {
  content: ExternalContent[];
}

function JSONContent({ content }: JSONProps) {
  return (
    <>
      {content.map((c, i) => {
        if (!JSON.parse(c.json.content)) return <p key={i}>Error</p>;
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
