import type { TlonStory } from "./types";

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function storyText(value: unknown, depth = 0): string {
  if (depth > 24 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((entry) => storyText(entry, depth + 1)).join("");
  const node = record(value);
  if (!node) return "";
  if ("break" in node) return "\n";
  if ("image" in node) return "[Image]";
  if ("rule" in node) return "\n";
  if ("link" in node) {
    const link = record(node.link);
    return link ? String(link.content ?? link.href ?? link.url ?? "") : "";
  }
  if ("code" in node && record(node.code))
    return String(record(node.code)?.code ?? "");
  if ("content" in node) return storyText(node.content, depth + 1);
  if ("contents" in node) return storyText(node.contents, depth + 1);
  if ("items" in node) return storyText(node.items, depth + 1);
  return Object.values(node)
    .map((entry) => storyText(entry, depth + 1))
    .join("");
}

export function conversationPreview(content: TlonStory): string {
  return content.map((verse) => storyText(verse)).join("\n");
}

export function textStory(text: string): TlonStory {
  return text.split("\n").map((line) => ({ inline: [line] }));
}

export function storyAttachments(content: TlonStory) {
  const urls = new Map<string, "image" | "video" | "audio" | "link">();
  function add(url: unknown, image = false) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
    const path = url.split(/[?#]/)[0].toLowerCase();
    urls.set(
      url,
      image || /\.(png|jpe?g|gif|webp|avif)$/.test(path)
        ? "image"
        : /\.(mp4|webm|mov)$/.test(path)
          ? "video"
          : /\.(mp3|wav|ogg|m4a)$/.test(path)
            ? "audio"
            : "link",
    );
  }
  function walk(value: unknown, depth = 0) {
    if (depth > 24 || value == null) return;
    if (typeof value === "string") {
      for (const match of value.matchAll(/https?:\/\/[^\s<>"')]+/g))
        add(match[0]);
    } else if (Array.isArray(value))
      value.forEach((entry) => walk(entry, depth + 1));
    else {
      const node = record(value);
      if (!node) return;
      const image = record(node.image);
      if (image) add(image.src, true);
      for (const [key, entry] of Object.entries(node)) {
        if (key === "href" || key === "url") add(entry);
        else if (key !== "image") walk(entry, depth + 1);
      }
    }
  }
  walk(content);
  return urls;
}
