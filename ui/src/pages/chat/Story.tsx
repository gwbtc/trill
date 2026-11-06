import type { ReactNode } from "react";
import { Link } from "wouter";
import PostImage from "@/components/post/PostImage";
import { safeHref } from "@/logic/utils";
import { record } from "@/logic/tlon/story";
import type { TlonStory } from "@/logic/tlon/types";

function rich(value: unknown, depth = 0): ReactNode {
  if (depth > 24 || value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((entry, index) => (
      <span key={index}>{rich(entry, depth + 1)}</span>
    ));
  const node = record(value);
  if (!node) return null;
  const child = (entry: unknown) => rich(entry, depth + 1);
  if ("break" in node) return <br />;
  if ("ship" in node && typeof node.ship === "string")
    return (
      <Link href={`/u/${encodeURIComponent(node.ship)}`}>{node.ship}</Link>
    );
  if ("bold" in node) return <strong>{child(node.bold)}</strong>;
  if ("italics" in node) return <em>{child(node.italics)}</em>;
  if ("strike" in node) return <s>{child(node.strike)}</s>;
  if ("blockquote" in node)
    return <blockquote>{child(node.blockquote)}</blockquote>;
  if (typeof node["inline-code"] === "string")
    return <code>{node["inline-code"]}</code>;
  if ("inline" in node) return child(node.inline);
  if ("block" in node) return child(node.block);
  if ("rule" in node) return <hr />;
  const image = record(node.image);
  if (image && typeof image.src === "string" && safeHref(image.src))
    return <PostImage src={image.src} className="inline-pic" />;
  const link = record(node.link);
  if (link) {
    const url =
      typeof link.href === "string"
        ? link.href
        : typeof link.url === "string"
          ? link.url
          : "";
    const label = typeof link.content === "string" ? link.content : url;
    return safeHref(url) ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    ) : (
      <span>{label}</span>
    );
  }
  if (typeof node.code === "string") return <code>{node.code}</code>;
  const code = record(node.code);
  if (code)
    return (
      <pre>
        <code>{String(code.code ?? "")}</code>
      </pre>
    );
  const header = record(node.header);
  if (header) return <strong>{child(header.content)}</strong>;
  if ("listing" in node) return <div>{child(node.listing)}</div>;
  if ("item" in node) return <div>• {child(node.item)}</div>;
  const list = record(node.list);
  if (list)
    return (
      <div>
        {child(list.contents)}
        {child(list.items)}
      </div>
    );
  const task = record(node.task);
  if (task)
    return (
      <span>
        {task.checked ? "☑ " : "☐ "}
        {child(task.content)}
      </span>
    );
  if ("cite" in node) return <span>Shared content</span>;
  if ("text" in node && typeof node.text === "string") return node.text;
  return <span>{Object.values(node).map(child)}</span>;
}

export default function Story({ content }: { content: TlonStory }) {
  return (
    <>
      {content.map((verse, index) => (
        <div className="trill-post-paragraph" key={index}>
          {rich(verse)}
        </div>
      ))}
    </>
  );
}
