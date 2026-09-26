import "@/styles/Profile.css";
import "@/styles/Bookmarks.css";
import { Bookmark } from "lucide-react";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import PageHeader from "@/components/layout/PageHeader";
import Post from "@/components/post/Post";
import PostData from "@/components/post/Loader";
import { toFlat } from "@/components/post/RP";
import { refKey, type PostRef } from "@/logic/lists";
import { userFromAuthor, userFromPost } from "@/logic/trill/helpers";
import type { FullNode, Poast } from "@/types/trill";

export default function Bookmarks() {
  const lists = useLocalState((s) => s.lists);
  // newest bookmark first
  const items = [...lists.bookmarks.values()].sort((a, b) => b.at - a.at);
  const n = items.length;

  return (
    <div id="screen-bookmarks" className="trill-screen">
      <PageHeader title="Bookmarks" subtitle={`${n} saved ${n === 1 ? "post" : "posts"}`} />
      {n === 0 ? (
        <div className="profile-tab-empty">
          <span className="profile-tab-empty-icon" aria-hidden="true">
            <Bookmark size={34} />
          </span>
          <h3>No bookmarks yet</h3>
          <p>Bookmark posts from their ••• menu to find them here later.</p>
        </div>
      ) : (
        items.map(({ ref }) => <BookmarkedPost key={refKey(ref)} postRef={ref} />)
      )}
    </div>
  );
}

function BookmarkedPost({ postRef }: { postRef: PostRef }) {
  const { myFeed, following, nostrFeeds, globalFeed } = useLocalState((s) => ({
    myFeed: s.myFeed,
    following: s.following,
    nostrFeeds: s.nostrFeeds,
    globalFeed: s.globalFeed,
  }));

  if ("urbit" in postRef) {
    const { host, id } = postRef.urbit;
    // cached in our own feed or a followed ship's; else ask the host
    const cached = myFeed.feed[id]?.host === host ? myFeed.feed[id] : following.get(host)?.feed[id];
    if (cached) return <Post poast={cached} user={userFromPost(cached)} />;
    return <RemotePost host={host} id={id} />;
  }

  // nostr feeds are keyed by timestamp ids; find the note by event id
  const note: Poast | undefined = [globalFeed, ...Object.values(nostrFeeds)]
    .flatMap((fc) => Object.values(fc.feed))
    .find((p) => p.hash === postRef.nostr);
  if (note) return <Post poast={note} user={userFromPost(note)} />;
  return <UnloadedNote id={postRef.nostr} />;
}

function RemotePost(props: { host: string; id: string }) {
  return PostData(props)(NodePost);
}

function NodePost({ data, refetch }: { data: FullNode; refetch: Function }) {
  return <Post poast={toFlat(data)} user={userFromAuthor(data.author)} refetch={refetch} />;
}

// a bookmarked nostr note that none of our loaded feeds has
function UnloadedNote({ id }: { id: string }) {
  const [, navigate] = useLocation();
  return (
    <button type="button" className="bookmark-unloaded" onClick={() => navigate(`/t/n/${id}`)}>
      <span>Nostr note not loaded</span>
      <span className="mono">{id.slice(0, 16)}…</span>
    </button>
  );
}
