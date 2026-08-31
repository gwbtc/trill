import type { Media } from "@/types/trill";
interface Props {
  media: Media[];
}
function M({ media }: Props) {
  return (
    <div className="body-media">
      {media.map((m, i) => {
        return "video" in m.media ? (
          <video key={JSON.stringify(m) + i} src={m.media.video} controls />
        ) : "audio" in m.media ? (
          <audio key={JSON.stringify(m) + i} src={m.media.audio} controls />
        ) : "images" in m.media ? (
          <Images key={JSON.stringify(m) + i} urls={m.media.images} />
        ) : null;
      })}
    </div>
  );
}
export default M;

function Images({ urls }: { urls: string[] }) {
  return (
    <>
      {urls.map((u, i) => (
        <img
          key={u + i}
          className={`body-img body-img-1-of-${urls.length}`}
          src={u}
          alt=""
        />
      ))}
    </>
  );
}
