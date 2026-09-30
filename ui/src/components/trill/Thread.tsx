import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { toFlat } from "@/logic/trill/helpers";
import type { FC, FullNode, Poast } from "@/types/trill";
import type { UserProfile } from "@/types/nostrill";
import type { Ship } from "@/types/urbit";
import { useEffect, useState } from "react";
import Body from "../post/Body";
import Footer from "../post/Footer";
import toast from "react-hot-toast";
import { useThreadStyle, type ThreadStyle } from "@/hooks/useThreadStyle";
import ThreadRootPost from "@/components/thread/ThreadRootPost";
import ThreadReplyComposerBase from "@/components/thread/ThreadReplyComposer";
import { LinearThreadReplies, NestedThreadReplies } from "@/components/thread/ThreadReplies";
import { flattenThreadChildren } from "@/logic/threadTree";

export default function Thread({
  host,
  id,
  feed,
  profile,
}: {
  host: Ship;
  id: string;
  feed?: FC;
  profile?: UserProfile;
}) {
  const poast = feed?.feed[id];
  return (
    <>
      {/* the page header has the title and the back arrow */}
      <div id="feed-proper">
        {/* always fetch: a cached copy with no children may just not have
            synced its replies yet. Loader shows the cached post meanwhile */}
        <Loader poast={poast} host={host} id={id} profile={profile} />
      </div>
    </>
  );
}
function Loader({
  host,
  id,
  profile,
  poast,
}: {
  host: Ship;
  id: string;
  poast?: Poast;
  profile?: UserProfile;
}) {
  const api = useLocalState((s) => s.api);
  const [data, setData] = useState<FullNode>();
  const [ted, setThread] = useState<FullNode[]>([]);
  const [error, setError] = useState("");
  const threadStyle = useThreadStyle();
  async function fetchThread() {
    const res = await api!.scryThread(host, id);
    if ("error" in res) setError(res.error);
    else {
      const msg = res.ok.data.msg;
      const data = res.ok.data.data;
      const withMsg = (s: string) => (msg ? `${s}\nHe added: ${msg}.` : s);
      if (data === "maybe") {
        const toastMsg = withMsg(
          `The request to access this thread will be reviewed manually.`,
        );
        toast.success(toastMsg, { duration: 5000 });
        setError(toastMsg);
      } else if (data === null) {
        const toastMsg = withMsg(`The request to access this thread was denied.`);
        toast.error(toastMsg, { duration: 5000 });
        setError(toastMsg);
      } else {
        setData(data.node);
        setThread(data.thread);
      }
    }
  }
  useEffect(() => {
    fetchThread();
  }, [host, id]);

  // the scry is a one-off snapshot; refetch when a post fact touches this
  // thread (a new or deleted reply, an updated parent) so it stays live
  const lastFact = useLocalState((s) => s.lastFact);
  useEffect(() => {
    if (!lastFact || !("post" in lastFact)) return;
    const f = lastFact.post;
    const p = "add" in f ? f.add.post : "upd" in f ? f.upd.post : f.del.post;
    if (p.host !== host) return;
    const root = data?.thread || id;
    const shown = new Set([id, ...ted.map((n) => n.id)]);
    if (data) flattenThreadChildren(data).forEach(({ node }) => shown.add(node.id));
    const touches =
      shown.has(p.id) ||
      (p.parent != null && shown.has(p.parent)) ||
      p.thread === root;
    if (touches) fetchThread();
  }, [lastFact]);
  if (ted.length > 1)
    return (
      <LongThread
        thread={ted}
        node={data}
        profile={profile}
        threadStyle={threadStyle}
      />
    );
  if (data)
    return (
      <>
        <Head poast={toFlat(data)} profile={profile} />
        <ThreadReplyComposer poast={toFlat(data)} />
        <div
          id="thread-children"
          className={`thread-replies-${threadStyle}`}
        >
          {threadStyle === "linear" ? (
            <LinearThreadReplies
              nodes={flattenThreadChildren(data)}
              userForNode={(node) => ({ urbit: node.authorFull.author })}
            />
          ) : (
            <NestedThreadReplies
              nodes={Object.values(data.children || {})}
              userForNode={(node) => ({ urbit: node.authorFull.author })}
              nodeKey={(node) => node.id}
            />
          )}
        </div>
      </>
    );
  if (poast)
    return (
      <>
        <Head poast={poast} profile={profile} />
        <ThreadReplyComposer poast={poast} />
        <div id="thread-children" className={`thread-replies-${threadStyle}`}>
          <h2>Loading Replies...</h2>
          <div className="loading-container">
            <img className="x-center" src={spinner} alt="Loading" />
          </div>
        </div>
      </>
    );
  if (error)
    return (
      <div className="thread-header">
        <h2>Error Loading Thread</h2>
        <p className="error">{error}</p>
      </div>
    );
  else
    return (
      <div id="feed-proper">
        <h2>Loading Thread...</h2>
        <div className="loading-container">
          <img className="x-center" src={spinner} alt="Loading" />
        </div>
      </div>
    );
}

function Head({ poast, profile }: { poast: Poast; profile?: UserProfile }) {
  return (
    <ThreadRootPost
      user={{ urbit: poast.authorFull.author }}
      poast={poast}
      profile={profile}
    />
  );
}

function ThreadReplyComposer({ poast }: { poast: Poast }) {
  return (
    <ThreadReplyComposerBase
      label={poast.author}
      composerData={{ type: "reply", post: { trill: poast } }}
    />
  );
}

function LongThread({
  thread,
  profile,
  threadStyle,
}: {
  thread: FullNode[];
  node?: FullNode;
  profile?: UserProfile;
  threadStyle: ThreadStyle;
}) {
  if (thread.length === 0) return <p>wtf</p>;
  const op = thread[0];
  // `thread` is only the author's self-reply chain; everyone else's replies
  // to posts in it hang off the chain nodes' children
  const chainIds = new Set(thread.map((n) => n.id));
  const replies = thread.flatMap((parent) =>
    Object.values(parent.children || {})
      .filter((child) => !chainIds.has(child.id))
      .map((node) => ({ node, parent })),
  );
  return (
    <div id="trill-thread" className={`thread-replies-${threadStyle}`}>
      <ThreadRootPost
        poast={toFlat(op)}
        user={{ urbit: op.authorFull.author }}
        profile={profile}
      />
      <ThreadReplyComposer poast={toFlat(op)} />
      {thread.slice(1).map((child, i) => (
        <div
          key={child.id}
          className="timeline-post trill-post cp thread-child"
        >
          <div className="left">{`${i + 2}/${thread.length}`}</div>
          <div className="right">
            <Body poast={toFlat(child)} user={{ urbit: child.authorFull.author }} />
            <Footer
              poast={toFlat(child)}
              user={{ urbit: child.authorFull.author }}
              thread={true}
            />
          </div>
        </div>
      ))}
      {replies.length > 0 &&
        (threadStyle === "linear" ? (
          <LinearThreadReplies
            nodes={replies.flatMap((r) => [r, ...flattenThreadChildren(r.node)])}
            userForNode={(node) => ({ urbit: node.authorFull.author })}
          />
        ) : (
          <NestedThreadReplies
            nodes={replies.map((r) => r.node)}
            userForNode={(node) => ({ urbit: node.authorFull.author })}
            nodeKey={(node) => node.id}
          />
        ))}
    </div>
  );
}

