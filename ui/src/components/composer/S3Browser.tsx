import "@/styles/s3.css";
import useLocalState from "@/state/state";
import { useQuery } from "@tanstack/react-query";
import { listMedia, mediaUrl } from "@/logic/s3";

interface S3BrowserProps {
  onSelect: (url: string) => void;
}

export default function S3Browser({ onSelect }: S3BrowserProps) {
  const { s3, status, initMedia } = useLocalState(s => ({ s3: s.s3, status: s.s3Status, initMedia: s.initMedia }));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["s3-objects", s3?.endpoint, s3?.currentBucket],
    queryFn: ({ signal }) => {
      if (!s3) throw new Error("Media storage is unavailable");
      return listMedia(s3, signal);
    },
    enabled: Boolean(s3),
    staleTime: 0,
    retry: false,
  });
  const keys = data?.keys.filter(key => /\.(jpe?g|png|gif|webp|svg|avif|mp4|mkv|webm)$/i.test(key)) ?? [];
  const failed = status === "unavailable" || status === "error" || Boolean(error);
  return <div id="s3-browser">
    <h2>Choose Media</h2>
    {status === "loading" || (s3 && isLoading) ? <p className="media-status" role="status">Loading media…</p>
      : failed ? <div className="media-status" role="status">
        <p>{status === "unavailable" ? "Media storage is unavailable on this ship." : status === "error" ? "Couldn’t prepare media storage." : "Couldn’t load your media."}</p>
        <button type="button" onClick={() => { if (s3) void refetch(); else void initMedia(); }}>Retry</button>
      </div>
      : <>
        {keys.length === 0 && <p className="media-status">No images or videos yet. Paste an image into your post to upload it.</p>}
        <div className="image-grid">
          {s3 && keys.map(key => {
            const url = mediaUrl(s3, key);
            return <button type="button" className="entry" key={key} aria-label={`Choose ${key}`} onClick={() => onSelect(url)}>
              {/\.(mp4|mkv|webm)$/i.test(key) ? <video src={url} preload="metadata" /> : <img src={url} alt={key} loading="lazy" />}
            </button>;
          })}
        </div>
        {data?.limited && <p className="media-status">Showing the first 1,000 stored files.</p>}
      </>}
  </div>;
}
