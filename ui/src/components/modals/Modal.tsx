import useLocalState from "@/state/state";
import { getFocusWrapTarget } from "@/logic/focusTrap";
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function Modal({
  children,
  close,
}: {
  children: ReactNode;
  close?: () => void;
}) {
  const { setModal } = useLocalState((s) => ({ setModal: s.setModal }));
  const modalRef = useRef<HTMLDivElement>(null);

  function closeModal() {
    if (close) close();
    setModal(null);
  }
  // the key handler lives for the modal's whole lifetime; read the latest
  // close through a ref instead of re-running the effect
  const closeRef = useRef(closeModal);
  closeRef.current = closeModal;

  // runs once per mount: re-running it (e.g. on every new `children`
  // element, which the parent creates on each render) would yank focus
  // back to the first control while the user is typing
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const getFocusable = () =>
      modal
        ? Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];

    (getFocusable()[0] || modal)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }

      // queried per keypress so controls rendered after mount are trapped too
      const focusable = getFocusable();
      if (event.key !== "Tab" || focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const targetIndex = getFocusWrapTarget(
        currentIndex === -1 ? 0 : currentIndex,
        focusable.length,
        event.shiftKey,
      );
      if (targetIndex !== null) {
        event.preventDefault();
        focusable[targetIndex].focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, []);

  function clickAway(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    e.stopPropagation();
    closeModal();
  }

  return (
    <div id="modal-background" className="trill-modal-overlay" onClick={clickAway}>
      <div
        id="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Trill dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
export default Modal;
