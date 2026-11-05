import useLocalState from "@/state/state";
import ImageViewer from "@/components/modals/ImageViewer";
import "@/styles/ImageViewer.css";

export default function PostImage({ src, className }: { src: string; className?: string }) {
  const setModal = useLocalState((s) => s.setModal);
  return (
    <button
      type="button"
      className="post-image-trigger"
      aria-label="View image"
      onClick={(event) => {
        event.stopPropagation();
        setModal(<ImageViewer src={src} />);
      }}
    >
      <img src={src} className={className} alt="" />
    </button>
  );
}
