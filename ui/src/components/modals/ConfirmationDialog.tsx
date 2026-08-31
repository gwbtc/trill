import { useState, type ReactNode } from "react";
import triangles from "@/assets/triangles.svg";

interface ConfirmationDialogProps {
  message?: string;
  children?: ReactNode;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  message = "Are you sure?",
  children,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="confirmation-dialog">
      <p>{message}</p>
      {children && children}
      {loading ? (
        <div className="loading-spinner">
          <img src={triangles} alt="Loading..." />
        </div>
      ) : (
        <div className="confirmation-buttons">
          <button className="btn-confirm" onClick={handleConfirm}>
            Yes
          </button>
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
