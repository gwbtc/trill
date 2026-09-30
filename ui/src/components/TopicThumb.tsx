import { useState } from "react";

// a trending topic's thumbnail. remote images break often, so a failed one
// disappears instead of leaving a broken icon. no referrer: the viewer's
// ship shouldn't be leaked to image hosts
export default function TopicThumb({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
