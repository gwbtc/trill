import "@/styles/s3.css";

import useLocalState from "@/state/state";
import { S3Client, type S3Object } from "@bradenmacdonald/s3-lite-client";
import { useQuery } from "@tanstack/react-query";

import spinner from "@/assets/triangles.svg";

interface S3BrowserProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function S3Browser({ onSelect }: S3BrowserProps) {
  const { s3 } = useLocalState((s) => ({ s3: s.s3 }));

  const {
    data: objects,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["s3-objects", s3?.endpoint, s3?.currentBucket],
    queryFn: async () => {
      if (!s3) throw new Error("S3 not configured");

      const client = new S3Client({
        bucket: s3.currentBucket,
        endPoint: s3.endpoint,
        region: "us-east-1",
        accessKey: s3.accessKeyId,
        secretKey: s3.secretAccessKey,
      });

      const objs = new Set<S3Object>();
      // There seems to be some reduplication issues with this library so let's just do sets
      for await (const obj of client.listObjects()) {
        objs.add(obj);
      }
      return objs;
    },
    enabled: !!s3,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  return (
    <div id="s3-browser">
      <div
        style={{
          textAlign: "center",
        }}
      >
        <h2>Choose Media</h2>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
          }}
        >
          <img src={spinner} />
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "red" }}>
          <p>Error: {(error as Error).message || "Unknown error"}</p>
          <p>Please check your S3 configuration in Settings.</p>
        </div>
      ) : (
        <div className="image-grid">
          {[...(objects || [])].map((obj) => {
            const url = `${s3?.endpoint}/${s3?.currentBucket}/${obj.key}`;
            const isImg = obj.key.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
            const isVid = obj.key.match(/\.(mp4|mkv|webm)$/i);
            return (
              <div
                className="entry"
                key={obj.key}
                onClick={() => onSelect(url)}
              >
                {isImg ? (
                  <img src={url} loading="lazy" />
                ) : isVid ? (
                  <video src={url} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
