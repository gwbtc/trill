import { safeHref } from "@/logic/utils";
import { conversationPreview, storyAttachments } from "@/logic/tlon/story";
import type { TlonMessage } from "@/logic/tlon/types";
import { Search, X } from "lucide-react";
import { useMemo } from "react";
import { useRenderCount } from "@/logic/renderProfile";
import type { DmPanel, DmRichMessage } from "./types";

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
  const title =
    panel === "search" ? "Search" : panel === "media" ? "Media" : "Links";
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
    <section
      className="dm-inline-panel"
      aria-label={`${title} in conversation`}
    >
      <header className="dm-inline-panel-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="dm-icon-button"
          onClick={onClose}
          aria-label="Close panel"
        >
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
              <div className="dm-panel-empty">
                No messages match "{searchQuery.trim()}"
              </div>
            )}
            {!searchQuery.trim() && (
              <div className="dm-panel-empty">
                Type to search this conversation.
              </div>
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
              {item.kind === "image" && (
                <img src={item.url} alt="" loading="lazy" />
              )}
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

export function buildRichDmMessages(
  messages: TlonMessage[],
  our: string,
): DmRichMessage[] {
  return messages.map((message) => {
    const time = new Date(message.sent).toLocaleString();
    const attachments = [...storyAttachments(message.content)];
    return {
      id: message.id,
      mine: message.author === our,
      text: conversationPreview(message.content),
      time,
      media: attachments.flatMap(([url, kind], index) =>
        kind === "link"
          ? []
          : [
              {
                id: `${message.id}-${index}`,
                url,
                kind,
                messageId: message.id,
                time,
              },
            ],
      ),
      links: attachments
        .filter(([, kind]) => kind === "link")
        .map(([href], index) => ({
          id: `${message.id}-${index}`,
          href,
          label: href,
          messageId: message.id,
          time,
        })),
    };
  });
}
