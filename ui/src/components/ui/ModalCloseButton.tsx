import { X } from "lucide-react";

export default function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="modal-icon-button" onClick={onClick} aria-label="Close">
      <X size={19} />
    </button>
  );
}
