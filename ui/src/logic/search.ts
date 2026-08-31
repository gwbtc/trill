import type { Block, Inline, Poast } from "@/types/trill";
import type { UserProfile } from "@/types/nostrill";

export function profileSearchText(id: string, profile: UserProfile) {
  return [
    id,
    profile.name,
    profile.about,
    profile.urbitID?.patp,
    profile.gwid?.english?.nym,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function postToText(post: Poast) {
  return post.contents?.map(blockToText).join(" ") ?? "";
}

export function blockToText(block: Block): string {
  if ("paragraph" in block) return block.paragraph?.map(inlineToText).join("") ?? "";
  if ("blockquote" in block) return block.blockquote?.map(inlineToText).join("") ?? "";
  if ("heading" in block) return block.heading?.text ?? "";
  if ("codeblock" in block) return block.codeblock?.code ?? "";
  if ("list" in block) return block.list?.text?.map(inlineToText).join("") ?? "";
  if ("json" in block) return block.json?.content ?? "";
  return "";
}

export function inlineToText(inline: Inline): string {
  if ("text" in inline) return inline.text;
  if ("italic" in inline) return inline.italic;
  if ("bold" in inline) return inline.bold;
  if ("strike" in inline) return inline.strike;
  if ("underline" in inline) return inline.underline;
  if ("sup" in inline) return inline.sup;
  if ("sub" in inline) return inline.sub;
  if ("ship" in inline) return inline.ship;
  if ("codespan" in inline) return inline.codespan;
  if ("link" in inline) return `${inline.link.show} ${inline.link.href}`;
  return "";
}
