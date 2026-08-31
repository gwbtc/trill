import {
  Bookmark,
  Flag,
  Info,
  Link2,
  MoreHorizontal,
  RadioTower,
  Trash2,
  VolumeX,
} from "lucide-react";

export default function PostActionMenu({
  open,
  bookmarked,
  muted,
  isMine,
  canRelay,
  hasDetails,
  menuRef,
  onToggle,
  onClose,
  onCopyLink,
  onShowDetails,
  onSendToRelay,
  onToggleBookmark,
  onToggleMute,
  onDelete,
  onReport,
}: {
  open: boolean;
  bookmarked: boolean;
  muted: boolean;
  isMine: boolean;
  // own urbit posts only: cross-post to nostr relays
  canRelay: boolean;
  // nostr posts only: relay provenance + raw event data
  hasDetails: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: (e: React.MouseEvent) => void;
  onClose: (e?: React.MouseEvent) => void;
  onCopyLink: (e: React.MouseEvent) => void;
  onShowDetails: (e: React.MouseEvent) => void;
  onSendToRelay: (e: React.MouseEvent) => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
  onToggleMute: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onReport: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`post-more-container${open ? " open" : ""}`}
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="trill-post-more"
        title="More"
        aria-label="More post actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MoreHorizontal size={18.5} strokeWidth={2} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="trill-post-menu-backdrop"
            aria-label="Close post menu"
            onClick={onClose}
          />
          <div className="trill-post-menu" role="menu">
            <button type="button" role="menuitem" onClick={onCopyLink}>
              <Link2 size={17} strokeWidth={1.8} />
              <span>Copy link</span>
            </button>
            {hasDetails && (
              <button type="button" role="menuitem" onClick={onShowDetails}>
                <Info size={17} strokeWidth={1.8} />
                <span>See details</span>
              </button>
            )}
            {canRelay && (
              <button type="button" role="menuitem" onClick={onSendToRelay}>
                <RadioTower size={17} strokeWidth={1.8} />
                <span>Send to relay</span>
              </button>
            )}
            <button type="button" role="menuitem" onClick={onToggleBookmark}>
              <Bookmark
                size={17}
                strokeWidth={1.8}
                fill={bookmarked ? "currentColor" : "none"}
              />
              <span>{bookmarked ? "Remove bookmark" : "Bookmark"}</span>
            </button>
            <div className="trill-post-menu-separator" />
            <button type="button" role="menuitem" onClick={onToggleMute}>
              <VolumeX size={17} strokeWidth={1.8} />
              <span>{muted ? "Unmute author" : "Mute author"}</span>
            </button>
            {isMine && (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={onDelete}
              >
                <Trash2 size={17} strokeWidth={1.8} />
                <span>Delete post</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={onReport}
            >
              <Flag size={17} strokeWidth={1.8} />
              <span>Report post</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
