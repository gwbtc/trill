import "@/styles/s3.css";
import useLocalState from "@/state/state";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMedia, mediaUrl, uploadToS3 } from "@/logic/s3";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

interface S3BrowserProps {
  onSelect: (url: string) => void;
}

export default function S3Browser({ onSelect }: S3BrowserProps) {
  const { s3, status, initMedia } = useLocalState(s => ({ s3: s.s3, status: s.s3Status, initMedia: s.initMedia }));
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // Allow choosing the same file again after a failure.
    if (!file || !s3 || uploading) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose an image file.");
      return;
    }
    const pending = new AbortController();
    controller.current = pending;
    setUploadError(null);
    setUploading(file.name);
    try {
      const url = await uploadToS3(file, s3, pending.signal);
      if (pending.signal.aborted) return;
      void client.invalidateQueries({ queryKey: ["s3-objects", s3.endpoint, s3.currentBucket] });
      onSelect(url);
    } catch {
      if (!pending.signal.aborted) setUploadError(`Couldn’t upload ${file.name}. Try again.`);
    } finally {
      if (!pending.signal.aborted) setUploading(null);
    }
  }
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
    <div className="media-toolbar">
      <h2>Choose Media</h2>
      <button type="button" className="media-upload" disabled={!s3 || Boolean(uploading)} onClick={() => fileInput.current?.click()}>
        <Upload size={17} aria-hidden="true" /> Upload image
      </button>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={uploadFile} />
    </div>
    {uploading && <p className="media-status" role="status">Uploading {uploading}…</p>}
    {uploadError && <p className="media-upload-error" role="alert">{uploadError}</p>}
    {status === "loading" || (s3 && isLoading) ? <p className="media-status" role="status">Loading media…</p>
      : failed ? <div className="media-status" role="status">
        <p>{status === "unavailable" ? "Media storage is unavailable on this ship." : status === "error" ? "Couldn’t prepare media storage." : "Couldn’t load your media."}</p>
        <button type="button" onClick={() => { if (s3) void refetch(); else void initMedia(); }}>Retry</button>
      </div>
      : <>
        {keys.length === 0 && <p className="media-status">No images or videos yet. Upload an image to get started.</p>}
        <div className="image-grid">
          {s3 && keys.map(key => {
            const url = mediaUrl(s3, key);
            return <button type="button" className="entry" key={key} disabled={Boolean(uploading)} aria-label={`Choose ${key}`} onClick={() => onSelect(url)}>
              {/\.(mp4|mkv|webm)$/i.test(key) ? <video src={url} preload="metadata" /> : <img src={url} alt={key} loading="lazy" />}
            </button>;
          })}
        </div>
        {data?.limited && <p className="media-status">Showing the first 1,000 stored files.</p>}
      </>}
  </div>;
}
