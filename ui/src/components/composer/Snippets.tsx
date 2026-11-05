import Quote from "@/components/post/Quote";
import type { SPID } from "@/types/ui";
import type { MouseEvent, ReactNode } from "react";
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
  onClick?: () => void;
  children: ReactNode;
}) {
  function onc(e: MouseEvent) {
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
  if ("trill" in post) return <Quote data={post.trill} nest={0} />;
  if ("nostr" in post) return <NostrSnippet meta={post.nostr} />;
  return <div className="snippet-error">Unsupported post type</div>;
}

export function ReplySnippet({ post }: { post: SPID }) {
  return <div id="reply" className="reply-snippet"><PostSnippet post={post} /></div>;
}
