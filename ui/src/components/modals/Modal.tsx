import useLocalState from "@/state/state";
import { getFocusWrapTarget } from "@/logic/focusTrap";
import { useEffect, useRef, useState, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
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

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = modal
      ? Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];

    (focusable[0] || modal)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeModal();
        return;
      }

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
  }, [children]);

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

export function Tooltip({ children, text, className }: any) {
  const [show, toggle] = useState(false);
  return (
    <div
      className={"tooltip-wrapper " + (className || "")}
      onMouseOver={() => toggle(true)}
      onMouseOut={() => toggle(false)}
    >
      {children}
      {show && <div className="tooltip">{text}</div>}
    </div>
  );
}
