import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A dialog stacked over the composer (S3 picker, paste confirmation).
// Not the app's global modal slot: when the composer is itself opened as a
// modal it occupies that slot, and replacing it would unmount the composer,
// losing the draft and the place to insert into.
export default function ComposerLayer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // capture phase, so this layer closes and the modal underneath doesn't
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="composer-layer-bg"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="composer-layer" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}
