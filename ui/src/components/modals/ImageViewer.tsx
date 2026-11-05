import { useState } from "react";
import useLocalState from "@/state/state";
import ModalCloseButton from "@/components/ui/ModalCloseButton";

export default function ImageViewer({ src }: { src: string }) {
  const setModal = useLocalState((s) => s.setModal);
  const [failed, setFailed] = useState(false);
  return (
    <section id="image-viewer" aria-label="Image viewer">
      <header className="image-viewer-toolbar">
        <ModalCloseButton onClick={() => setModal(null)} />
        <a href={src} target="_blank" rel="noopener noreferrer">Open original</a>
      </header>
      {failed ? (
        <p className="image-viewer-error">Unable to load this image. Try opening the original.</p>
      ) : (
        <img src={src} alt="Full-size post image" onError={() => setFailed(true)} />
      )}
    </section>
  );
}
