import Quote from "@/components/post/Quote";
import type { SPID } from "@/types/ui";
import { NostrSnippet } from "../post/wrappers/Nostr";

export default Snippets;
function Snippets({ post }: { post: SPID }) {
  return (
    <ComposerSnippet>
      <PostSnippet post={post} />
    </ComposerSnippet>
  );
}

export function ComposerSnippet({
  onClick,
  children,
}: {
  onClick?: any;
  children: any;
}) {
  function onc(e: React.MouseEvent) {
    e.stopPropagation();
    if (onClick) onClick();
  }
  return (
    <div className="composer-snippet">
      {onClick && (
        <div className="pop-snippet-icon cp" role="link" onClick={onc}>
          ×
        </div>
      )}
      {children}
    </div>
  );
}
function PostSnippet({ post }: { post: SPID }) {
  if (!post) return <div className="snippet-error">No post data</div>;

  try {
    if ("trill" in post) return <Quote data={post.trill} nest={0} />;
    else if ("nostr" in post) return <NostrSnippet meta={post.nostr} />;
    // else if ("twatter" in post)
    //   return (
    //     <div id={`composer-${type}`}>
    //       <Tweet tweet={post.post} quote={true} />
    //     </div>
    //   );
    // else if ("rumors" in post)
    //   return (
    //     <div id={`composer-${type}`}>
    //       <div className="rumor-quote f1">
    //         <img src={rumorIcon} alt="" />
    //         <Body poast={post.post} refetch={() => {}} />
    //         <span>{date_diff(post.post.time, "short")}</span>
    //       </div>
    //     </div>
    //   );
    else return <div className="snippet-error">Unsupported post type</div>;
  } catch (error) {
    console.error("Error rendering post snippet:", error);
    return <div className="snippet-error">Failed to load post</div>;
  }
}

export function ReplySnippet({ post }: { post: SPID }) {
  if (!post) return <div className="snippet-error">No post to reply to</div>;

  try {
    if ("trill" in post)
      return (
        <div id="reply" className="reply-snippet">
          <Quote data={post.trill} nest={0} />
        </div>
      );
    else if ("nostr" in post)
      return (
        <div id="reply" className="reply-snippet">
          <NostrSnippet meta={post.nostr} />
        </div>
      );
    else
      return (
        <div className="snippet-error">Cannot reply to this post type</div>
      );
  } catch (error) {
    console.error("Error rendering reply snippet:", error);
    return <div className="snippet-error">Failed to load reply context</div>;
  }
}
