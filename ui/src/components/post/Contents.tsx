import { linkLabel, safeHref } from "@/logic/utils";
import NostrText from "./NostrText";
import type {
  Block,
  Inline,
  Media as MediaType,
  Content,
} from "@/types/trill";
import Media from "./Media";
import { YoutubeSnippet } from "./External";
import { useLocation } from "wouter";
import type { Ship } from "@/types/urbit.ts";
import { IMAGE_REGEX } from "@/logic/constants.ts";

function Body({ contents }: { contents: Content }) {
  const text = contents.filter((c) => {
    return (
      "paragraph" in c ||
      "blockquote" in c ||
      "heading" in c ||
      "codeblock" in c ||
      "list" in c
    );
  });

  const media: MediaType[] = contents.filter(
    (c): c is MediaType => "media" in c,
  );
  const hasMedia = media.reduce((acc, item) => {
    if (acc === true) return acc
    if ("images" in item.media) {
      if (item.media.images.length === 0) return false
      const f = item.media.images.filter(i => i !== "");
      return f.length > 0
    }
    else if ("video" in item.media) return item.media.video !== ""
    else if ("audio" in item.media) return item.media.audio !== ""
    else return acc
  }, false);



  return (
    <div className="body">
      <div className="body-text">
        {text.map((b, i) => (
          <TextBlock key={JSON.stringify(b) + i} block={b} />
        ))}
      </div>
      {hasMedia && <Media media={media} />}
    </div>
  );
}
export default Body;

function TextBlock({ block }: { block: Block }) {
  const key = JSON.stringify(block);
  return "paragraph" in block ? (
    <div className="trill-post-paragraph">
      {block.paragraph.map((i, ind) => (
        <Inlin key={key + ind} i={i} />
      ))}
    </div>
  ) : "blockquote" in block ? (
    <blockquote>
      {block.blockquote.map((i, ind) => (
        <Inlin key={key + ind} i={i} />
      ))}
    </blockquote>
  ) : "heading" in block ? (
    <Heading string={block.heading.text} num={block.heading.num} />
  ) : "codeblock" in block ? (
    <pre>
      <code className={`language-${block.codeblock.lang}`}>
        {block.codeblock.code}
      </code>
    </pre>
  ) : "list" in block ? (
    block.list.ordered ? (
      <ol>
        {block.list.text.map((i, ind) => (
          <li key={JSON.stringify(i) + ind}>
            <Inlin key={key + ind} i={i} />
          </li>
        ))}
      </ol>
    ) : (
      <ul>
        {block.list.text.map((i, ind) => (
          <li key={JSON.stringify(i) + ind}>
            <Inlin key={JSON.stringify(i) + ind} i={i} />
          </li>
        ))}
      </ul>
    )
  ) : null;
}

function Inlin({ i }: { i: Inline }) {
  const [_, navigate] = useLocation();
  function gotoShip(e: React.MouseEvent, ship: Ship) {
    e.stopPropagation();
    navigate(`/u/${ship}`);
  }
  if ("text" in i) return <NostrText text={i.text} />;
  else {
    return "italic" in i ? (
      <i>{i.italic}</i>
    ) : "bold" in i ? (
      <strong>{i.bold}</strong>
    ) : "strike" in i ? (
      <span>{i.strike}</span>
    ) : "underline" in i ? (
      <span>{i.underline}</span>
    ) : "sup" in i ? (
      <sup>{i.sup}</sup>
    ) : "sub" in i ? (
      <sub>{i.sub}</sub>
    ) : "ship" in i ? (
      <span
        className="mention"
        role="link"
        onClick={(e) => gotoShip(e, i.ship)}
      >
        {i.ship}
      </span>
    ) : "codespan" in i ? (
      <code>{i.codespan}</code>
    ) : "link" in i ? (
      <LinkParser {...i.link} />
    ) : "break" in i ? (
      <br />
    ) : null;
  }
}

function LinkParser({ href, show }: { href: string; show: string }) {
  const isImg = href.match(IMAGE_REGEX);
  // const isImg2 = href.match(IMAGE_SUBREGEX);
  const YOUTUBE_REGEX_1 = /(youtube\.com\/watch\?v=)(\w+)/;
  const YOUTUBE_REGEX_2 = /(youtu\.be\/)([a-zA-Z0-9-_]+)/;
  const m1 = href.match(YOUTUBE_REGEX_1);
  const m2 = href.match(YOUTUBE_REGEX_2);
  const ytb = m1 && m1[2] ? m1[2] : m2 && m2[2] ? m2[2] : "";
  return ytb ? (
    <YoutubeSnippet href={href} id={ytb} />
  ) : isImg ? (
    <img className="inline-pic" src={href} />
  ) : (
    safeHref(href) ? (
      <a href={href} title={href}>
        {linkLabel(show)}
      </a>
    ) : (
      <span>{linkLabel(show)}</span>
    )
  );
}
function Heading({ string, num }: { string: string; num: number }) {
  return num === 1 ? (
    <h1>{string}</h1>
  ) : num === 2 ? (
    <h2>{string}</h2>
  ) : num === 3 ? (
    <h3>{string}</h3>
  ) : num === 4 ? (
    <h4>{string}</h4>
  ) : num === 5 ? (
    <h5>{string}</h5>
  ) : num === 6 ? (
    <h6>{string}</h6>
  ) : null;
}

