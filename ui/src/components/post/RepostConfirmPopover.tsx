export default function RepostConfirmPopover({
  reposting,
  onCancel,
  onConfirm,
}: {
  reposting: boolean;
  onCancel: (e: React.MouseEvent) => void;
  onConfirm: (e: React.MouseEvent) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="trill-repost-popover-backdrop"
        aria-label="Close repost confirmation"
        onClick={onCancel}
      />
      <div className="trill-repost-popover" role="dialog" aria-label="Remove repost">
        <div className="trill-repost-popover-title">Remove this repost?</div>
        <div className="trill-repost-popover-copy">
          It'll no longer show on your followers' feeds.
        </div>
        <div className="trill-repost-popover-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="danger"
            disabled={reposting}
            onClick={onConfirm}
          >
            Remove
          </button>
        </div>
      </div>
    </>
  );
}
