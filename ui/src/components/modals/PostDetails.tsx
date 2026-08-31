import type { Poast } from "@/types/trill";
import { ExternalLink, RadioTower } from "lucide-react";
import CodeBlock from "../CodeBlock";
import { generateNevent, generateNpub } from "@/logic/nostr";

// nostr provenance and wire data for a post: which relay(s) served it
// plus the raw event fields (id, pubkey, tags...)
export default function PostDetails({
  poast,
  onClose,
}: {
  poast: Poast;
  onClose: () => void;
}) {
  const event = poast.event;
  if (!event) return null;

  const relays = event.relays ?? [];
  const created = new Date(event.created_at * 1000);

  function openPost() {
    const nev = generateNevent(event!);
    window.open(`https://primal.net/e/${nev}`, "_blank");
  }
  function openProf() {
    const npub = generateNpub(event!.pubkey);
    window.open(`https://primal.net/p/${npub}`, "_blank");
  }

  return (
    <div className="confirmation-dialog post-details-modal">
      <header className="post-details-header">
        <h3>Post details</h3>
        <span className="post-details-kind mono">
          kind {event.kind} · {created.toLocaleString()}
        </span>
      </header>

      <div className="post-details-content">
        <h4>Content</h4>
        <CodeBlock>{event.content}</CodeBlock>

        <h4>Fetched from</h4>
        {relays.length > 0 ? (
          <div className="post-details-relays">
            {relays.map((url) => (
              <span key={url} className="post-details-relay-chip mono">
                <RadioTower size={13} strokeWidth={1.8} />
                {url}
              </span>
            ))}
          </div>
        ) : (
          <p className="post-details-muted">
            unknown — streamed live; relay attribution arrives with the next
            feed refresh
          </p>
        )}

        <div className="post-details-section-head">
          <h4>Event ID</h4>
          <button
            type="button"
            className="post-details-link-btn"
            onClick={openPost}
          >
            <ExternalLink size={13} strokeWidth={2} />
            Open post in Primal
          </button>
        </div>
        <CodeBlock>{event.id}</CodeBlock>
        <CodeBlock>{generateNevent(event)}</CodeBlock>

        <div className="post-details-section-head">
          <h4>Author pubkey</h4>
          <button
            type="button"
            className="post-details-link-btn"
            onClick={openProf}
          >
            <ExternalLink size={13} strokeWidth={2} />
            Open profile in Primal
          </button>
        </div>
        <CodeBlock>{event.pubkey}</CodeBlock>
        <CodeBlock>{generateNpub(event.pubkey)}</CodeBlock>

        <h4>Tags</h4>
        {event.tags.length > 0 ? (
          <CodeBlock>{JSON.stringify(event.tags, null, 1)}</CodeBlock>
        ) : (
          <p className="post-details-muted">none</p>
        )}

        <h4>Signature</h4>
        <CodeBlock>{event.sig}</CodeBlock>
      </div>

      <div className="confirmation-buttons">
        <button className="btn-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
