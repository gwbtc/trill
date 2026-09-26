import { safeHref } from "@/logic/utils";
import { postToText } from "@/logic/search";
import type { Block, FC, Inline, Poast } from "@/types/trill";
import { Search, X } from "lucide-react";
import { useMemo } from "react";
import { useRenderCount } from "@/logic/renderProfile";
import type { DmLinkItem, DmMediaItem, DmPanel, DmRichMessage } from "./types";

export default function DmInlinePanel({
  panel,
  searchQuery,
  setSearchQuery,
  richMessages,
  onSearchResultClick,
  onClose,
}: {
  panel: Exclude<DmPanel, "thread">;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  richMessages: DmRichMessage[];
  onSearchResultClick: (messageId: string) => void;
  onClose: () => void;
}) {
  const title = panel === "search" ? "Search" : panel === "media" ? "Media" : "Links";
  const mediaItems = useMemo(
    () => richMessages.flatMap((message) => message.media),
    [richMessages],
  );
  const linkItems = useMemo(
    () => richMessages.flatMap((message) => message.links),
    [richMessages],
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return richMessages.filter((message) =>
      [
        message.text,
        ...message.links.map((link) => `${link.label} ${link.href}`),
        ...message.media.map((item) => item.url),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [richMessages, searchQuery]);

  useRenderCount("DmInlinePanel", () => ({
    panel,
    searchQueryLength: searchQuery.length,
    searchResults: searchResults.length,
    mediaItems: mediaItems.length,
    linkItems: linkItems.length,
  }));

  return (
    <section className="dm-inline-panel" aria-label={`${title} in conversation`}>
      <header className="dm-inline-panel-header">
        <h2>{title}</h2>
        <button type="button" className="dm-icon-button" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </header>

      {panel === "search" && (
        <>
          <label className="dm-inline-search">
            <Search size={17} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search this conversation"
            />
          </label>
          <div className="dm-search-results">
            {searchQuery.trim() && searchResults.length === 0 && (
              <div className="dm-panel-empty">No messages match "{searchQuery.trim()}"</div>
            )}
            {!searchQuery.trim() && (
              <div className="dm-panel-empty">Type to search this conversation.</div>
            )}
            {searchResults.map((message) => (
              <button
                type="button"
                className="dm-search-result"
                key={message.id}
                onClick={() => onSearchResultClick(message.id)}
                aria-label={`Jump to message from ${message.mine ? "you" : "them"} at ${message.time}`}
              >
                <span className="dm-search-result-meta mono">
                  {message.mine ? "you" : "them"} · {message.time}
                </span>
                <p>{message.text || "[media]"}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {panel === "media" && (
        <div className="dm-media-grid">
          {mediaItems.length === 0 && (
            <div className="dm-panel-empty">No media in this conversation.</div>
          )}
          {mediaItems.map((item) => (
            <a
              className="dm-media-item"
              href={safeHref(item.url)}
              target="_blank"
              rel="noreferrer"
              key={item.id}
            >
              {item.kind === "image" && <img src={item.url} alt="" loading="lazy" />}
              {item.kind === "video" && <video src={item.url} controls />}
              {item.kind === "audio" && <audio src={item.url} controls />}
              <span className="dm-media-time mono">{item.time}</span>
            </a>
          ))}
        </div>
      )}

      {panel === "links" && (
        <div className="dm-link-list">
          {linkItems.length === 0 && (
            <div className="dm-panel-empty">No links in this conversation.</div>
          )}
          {linkItems.map((item) => (
            <a
              className="dm-link-item"
              href={safeHref(item.href)}
              target="_blank"
              rel="noreferrer"
              key={item.id}
            >
              <span className="dm-link-label">{item.label}</span>
              <span className="dm-link-url mono">{item.href}</span>
              <span className="dm-link-time mono">{item.time}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function buildRichDmMessages(fc: FC | null | undefined, our: string): DmRichMessage[] {
  return Object.values(fc?.feed || {})
    .sort((a, b) => a.time - b.time)
    .map((post) => {
      const text = postToText(post);
      return {
        id: post.id,
        mine: post.author === our,
        text,
        time: formatDmPanelTime(post.time),
        media: extractPostMedia(post),
        links: extractPostLinks(post),
      };
    });
}

function extractPostMedia(post: Poast): DmMediaItem[] {
  const urls = new Map<string, DmMediaItem["kind"]>();
  post.contents?.forEach((block) => {
    if ("media" in block) {
      if ("images" in block.media) {
        block.media.images.forEach((url) => urls.set(url, "image"));
      } else if ("video" in block.media) {
        urls.set(block.media.video, "video");
      } else if ("audio" in block.media) {
        urls.set(block.media.audio, "audio");
      }
    }
    extractBlockLinks(block).forEach((link) => {
      const kind = mediaKindFromUrl(link.href);
      if (kind) urls.set(link.href, kind);
    });
  });
  return Array.from(urls.entries()).map(([url, kind], index) => ({
    id: `${post.id}-media-${index}`,
    url,
    kind,
    messageId: post.id,
    time: formatDmPanelTime(post.time),
  }));
}

function extractPostLinks(post: Poast): DmLinkItem[] {
  const links = new Map<string, string>();
  post.contents?.forEach((block) => {
    extractBlockLinks(block).forEach((link) => links.set(link.href, link.label));
  });
  return Array.from(links.entries()).map(([href, label], index) => ({
    id: `${post.id}-link-${index}`,
    href,
    label,
    messageId: post.id,
    time: formatDmPanelTime(post.time),
  }));
}

function extractBlockLinks(block: Block): Array<{ href: string; label: string }> {
  if ("paragraph" in block) return extractInlineLinks(block.paragraph);
  if ("blockquote" in block) return extractInlineLinks(block.blockquote);
  if ("list" in block) return extractInlineLinks(block.list.text);
  return [];
}

function extractInlineLinks(inlines: Inline[]) {
  return inlines.flatMap((inline) => {
    if ("link" in inline) {
      return [{ href: inline.link.href, label: inline.link.show || inline.link.href }];
    }
    if ("text" in inline) {
      return Array.from(inline.text.matchAll(/https?:\/\/[^\s<>"')]+/g)).map((match) => ({
        href: match[0],
        label: match[0],
      }));
    }
    return [];
  });
}

function mediaKindFromUrl(url: string): DmMediaItem["kind"] | null {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(path)) return "audio";
  return null;
}

function formatDmPanelTime(timestamp: number | null) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
