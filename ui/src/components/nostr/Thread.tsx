import { usePostUser } from "@/hooks/usePostUser";
import { usePostProfile } from "@/hooks/usePostProfile";
import useLocalState from "@/state/state";
import type { FullNode } from "@/types/trill";
import ComposerModal from "@/components/modals/ComposerModal";
import type { UserProfile } from "@/types/nostrill";
import { memo, useEffect, useMemo, useRef } from "react";
import { eventToFn } from "@/logic/trill/helpers";
import { toFlat } from "../post/RP";
import type { NostrEvent, Wevent } from "@/types/nostr";
import Post from "@/components/post/Post";
import { eventToPoast } from "@/logic/nostrill";
import { useNostrAncestors } from "@/hooks/useNostrAncestors";
import { nostrThreadRefs } from "@/logic/nostrThread";
import "@/styles/NostrThread.css";
import { useThreadStyle } from "@/hooks/useThreadStyle";
import ThreadRootPost from "@/components/thread/ThreadRootPost";
import ThreadReplyComposer from "@/components/thread/ThreadReplyComposer";
import { useNostrReplies } from "@/hooks/useNostrReplies";

type Props = {
  event: NostrEvent;
  relays: string[];
};

export default function Thread({ event, relays }: Props) {
  const profile = usePostProfile(event.pubkey);
  const { composerData, setModal, configuredRelays } =
    useLocalState((s) => ({
      composerData: s.composerData,
      setModal: s.setModal,
      configuredRelays: Object.keys(s.relays).join("\n"),
    }));

  const fn = useMemo(() => eventToFn({ ...event, relays }), [event, relays]);
  const sources = useMemo(() => [...new Set([...relays, ...configuredRelays.split("\n").filter(Boolean)])], [relays, configuredRelays]);
  const context = useNostrAncestors(event, sources);
  const replies = useNostrReplies(event.id, relays[0] ?? sources[0], event.kind === 1);
  const selectedRef = useRef<HTMLElement>(null);
  const centered = useRef(false);
  const interacted = useRef(false);

  useEffect(() => {
    const moved = () => { interacted.current = true; };
    const keyed = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) moved();
    };
    window.addEventListener("wheel", moved, { passive: true });
    window.addEventListener("touchmove", moved, { passive: true });
    window.addEventListener("keydown", keyed);
    return () => {
      window.removeEventListener("wheel", moved);
      window.removeEventListener("touchmove", moved);
      window.removeEventListener("keydown", keyed);
    };
  }, []);

  useEffect(() => {
    if (context.loading || centered.current || !nostrThreadRefs(event).parent) return;
    centered.current = true;
    const active = document.activeElement;
    if (interacted.current || active?.closest("a, button, input, textarea, [contenteditable='true'], #modal")) return;
    const selected = selectedRef.current;
    if (selected?.parentElement) {
      const bounds = selected.getBoundingClientRect();
      const leadingSpace = Math.max(0, window.innerHeight / 2 - bounds.top - bounds.height / 2);
      selected.parentElement.style.paddingBlockStart = `${leadingSpace}px`;
    }
    selectedRef.current?.focus({ preventScroll: true });
    selectedRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [context.loading, event]);

  useEffect(() => {
    if (composerData) setModal(<ComposerModal />);
  }, [composerData]);

  return (
    <>
      {/* the page header has the title and the back arrow */}
      <div id="feed-proper" className={nostrThreadRefs(event).parent ? "nostr-thread-view" : undefined}>
        {context.ancestors.length > 0 && (
          <section className="nostr-thread-ancestors" aria-label="Earlier posts">
            <h2>Earlier in this thread</h2>
            {context.ancestors.map((ancestor, i) => (
              <div key={ancestor.id}>
                <Ancestor event={ancestor} />
                {i === 0 && context.gapAfterRoot && <ContextGap retry={context.retry} />}
              </div>
            ))}
          </section>
        )}
        {context.loading && <p className="nostr-thread-context-note" role="status">Loading earlier posts…</p>}
        {context.incomplete && !context.gapAfterRoot && <ContextGap retry={context.retry} />}
        <section ref={selectedRef} className="nostr-thread-focus" role="region" aria-label="Selected post" tabIndex={-1} data-thread-event={event.id}>
          <Head node={fn} profile={profile} relay={relays[0]} replyIds={replies.events.map(note => note.id)} />
        </section>
        {event.kind === 1 && <section aria-label="Replies" className="nostr-thread-replies">
          <h2>Replies</h2>
          <ReplyList events={replies.events} />
          {replies.loading && <p className="nostr-thread-context-note" role="status">Loading replies…</p>}
          {replies.error && <div className="nostr-thread-context-note" role="status">
            <p>Couldn’t load replies from this relay.</p>
            <button type="button" aria-label="Retry replies" onClick={replies.retry}>Try again</button>
          </div>}
          {!replies.available && <p className="nostr-thread-context-note">No source relay is available to check for replies.</p>}
          {replies.available && !replies.loading && !replies.error && replies.events.length === 0 && <p className="nostr-thread-context-note">No direct replies returned by this relay.</p>}
          {replies.limited && <p className="nostr-thread-context-note">Reply history may be incomplete.</p>}
        </section>}
      </div>
    </>
  );
}

const Ancestor = memo(function Ancestor({ event }: { event: Wevent }) {
  const post = useMemo(() => eventToPoast(event), [event]);
  const profile = usePostProfile(event.pubkey);
  const userFromPost = usePostUser();
  return post ? <div data-thread-event={event.id}><Post poast={post} user={userFromPost(post)} profile={profile} /></div> : null;
});

function ContextGap({ retry }: { retry: () => void }) {
  return <div className="nostr-thread-context-note" role="status">
    <p>Some earlier posts couldn’t be loaded.</p>
    <button type="button" onClick={retry} aria-label="Retry earlier posts">Try again</button>
  </div>;
}

function ReplyList({ events }: { events: Wevent[] }) {
  const threadStyle = useThreadStyle();
  return <div id="thread-children" className={`thread-replies-${threadStyle}`}>
    {events.map(event => <Reply key={event.id} event={event} spine={threadStyle !== "linear"} />)}
  </div>;
}

const Reply = memo(function Reply({ event, spine }: { event: Wevent; spine: boolean }) {
  const post = useMemo(() => eventToPoast(event), [event]);
  const profile = usePostProfile(event.pubkey);
  const userFromPost = usePostUser();
  return post ? <Post poast={post} user={userFromPost(post)} profile={profile} spine={spine} /> : null;
});

function Head({ node, profile, relay, replyIds }: {
  node: FullNode;
  profile?: UserProfile;
  relay?: string;
  replyIds: string[];
}) {
  const userFromPost = usePostUser();
  const post = toFlat(node);
  return <>
    <ThreadRootPost poast={{ ...post, children: replyIds }} user={userFromPost(post)} profile={profile} provenance={relay} />
    <NostrThreadReplyComposer node={node} />
  </>;
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
