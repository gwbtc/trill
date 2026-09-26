import useLocalState from "@/state/state";
import Icon from "@/components/Icon";
import type { FullNode } from "@/types/trill";
import ComposerModal from "@/components/modals/ComposerModal";
import type { UserProfile } from "@/types/nostrill";
import { useEffect } from "react";
import { eventToFn } from "@/logic/trill/helpers";
import { toFlat } from "../post/RP";
import type { NostrEvent } from "@/types/nostr";
import { useThreadStyle } from "@/hooks/useThreadStyle";
import ThreadRootPost from "@/components/thread/ThreadRootPost";
import ThreadReplyComposer from "@/components/thread/ThreadReplyComposer";
import { LinearThreadReplies, NestedThreadReplies } from "@/components/thread/ThreadReplies";
import { flattenThreadChildren } from "@/logic/threadTree";

type Props = {
  event: NostrEvent;
  relays: string[];
};

export default function Thread({ event, relays }: Props) {
  const { profiles, composerData, setModal } =
    useLocalState((s) => ({
      composerData: s.composerData,
      setModal: s.setModal,
      profiles: s.profiles,
    }));

  const fn = eventToFn({ ...event, relays });
  const profile = profiles.get(event.pubkey);

  useEffect(() => {
    if (composerData) setModal(<ComposerModal />);
  }, [composerData]);

  return (
    <>
      <div className="thread-header">
        <div className="thread-nav">
          <button
            className="back-btn"
            onClick={() => window.history.back()}
            title="Go back"
          >
            <Icon name="reply" size={16} />
            <span>Back to Feed</span>
          </button>
        </div>
        <h2>Nostr Thread</h2>
        <div className="thread-info">
          <span className="thread-host">{relays[0]}</span>
          <span className="thread-separator">•</span>
          <span className="thread-id">#{event.id}</span>
        </div>
      </div>
      <div id="feed-proper">
        <Head node={fn} profile={profile} relay={relays[0]} />
      </div>
    </>
  );
}

function Head({
  node,
  profile,
  relay,
}: {
  node: FullNode;
  profile?: UserProfile;
  relay?: string;
}) {
  const threadStyle = useThreadStyle();

  return (
    <>
      <ThreadRootPost
        poast={toFlat(node)}
        user={{ nostr: node.author }}
        profile={profile}
        provenance={relay}
      />
      <NostrThreadReplyComposer node={node} />
      <div id="thread-children" className={`thread-replies-${threadStyle}`}>
        {threadStyle === "linear" ? (
          <LinearThreadReplies
            nodes={flattenThreadChildren(node)}
            userForNode={(reply) => ({ nostr: reply.author })}
          />
        ) : (
          <div id="tail">
            <NestedThreadReplies
              nodes={Object.values(node.children || {})}
              userForNode={(reply) => ({ nostr: reply.author })}
            />
          </div>
        )}
      </div>
    </>
  );
}

function NostrThreadReplyComposer({ node }: { node: FullNode }) {
  const poast = toFlat(node);

  return (
    <ThreadReplyComposer
      label={node.author}
      composerData={{
      type: "reply",
      post: {
        nostr: {
          post: poast,
          pubkey: node.author,
          eventId: node.event?.id || node.hash,
        },
      },
    }}
    />
  );
}
