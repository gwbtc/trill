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
import { LinearThreadReplies, NestedThreadReplies } from "@/components/thread/ThreadReplies";
import { flattenThreadChildren } from "@/logic/threadTree";

type Props = {
  event: NostrEvent;
  relays: string[];
};

export default function Thread({ event, relays }: Props) {
  const { profile, composerData, setModal, configuredRelays } =
    useLocalState((s) => ({
      composerData: s.composerData,
      setModal: s.setModal,
      profile: s.profiles.get(event.pubkey),
      configuredRelays: Object.keys(s.relays).join("\n"),
    }));

  const fn = useMemo(() => eventToFn({ ...event, relays }), [event, relays]);
  const sources = useMemo(() => [...new Set([...relays, ...configuredRelays.split("\n").filter(Boolean)])], [relays, configuredRelays]);
  const context = useNostrAncestors(event, sources);
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
          <Head node={fn} profile={profile} relay={relays[0]} />
        </section>
      </div>
    </>
  );
}

const Ancestor = memo(function Ancestor({ event }: { event: Wevent }) {
  const post = useMemo(() => eventToPoast(event), [event]);
  const profile = useLocalState(s => s.profiles.get(event.pubkey));
  return post ? <div data-thread-event={event.id}><Post poast={post} user={{ nostr: event.pubkey }} profile={profile} /></div> : null;
});

function ContextGap({ retry }: { retry: () => void }) {
  return <div className="nostr-thread-context-note" role="status">
    <p>Some earlier posts couldn’t be loaded.</p>
    <button type="button" onClick={retry} aria-label="Retry earlier posts">Try again</button>
  </div>;
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
