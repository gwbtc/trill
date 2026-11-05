import { useParams } from "wouter";
import useLocalState from "@/state/state";
import ThreadState from "@/components/thread/ThreadState";
import "@/styles/trill.css";
import "@/styles/feed.css";
import ComposerModal from "@/components/modals/ComposerModal";
import TrillThread from "@/components/trill/Thread";
import NostrThread from "@/components/nostr/Thread";
import NostrThreadFetcher from "@/components/nostr/Fetcher";
import { decodeNostrEventId } from "@/logic/nostr";
import { nostrEventInFeed } from "@/logic/nostrill";
import PageHeader from "@/components/layout/PageHeader";
import { useEffect } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { Wevent } from "@/types/nostr";

//TODO every post needs to know which relay it came from
export default function ThreadLoader() {
  const { profiles, following, composerData, setModal } = useLocalState((s) => ({
    profiles: s.profiles,
    following: s.following,
    composerData: s.composerData,
    setModal: s.setModal,
  }));
  const params = useParams<{ host: string; id: string }>();
  const { host, id } = params;
  const feed = following.urbit.get(host);
  const profile = profiles.get(host);

  useEffect(() => {
    if (composerData) setModal(<ComposerModal />);
  }, [composerData, setModal]);

  return (
    <div id="screen-thread" className="trill-screen">
      <PageHeader title="Thread" back />
      {/* keyed so moving between threads drops the previous thread's state */}
      <TrillThread key={`${host}/${id}`} feed={feed} profile={profile} host={host} id={id} />
    </div>
  );
}

export function NostrThreadLoader() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  const eventId = id ? decodeNostrEventId(id) : null;
  // Subscribe to this event, so another note arriving in a feed does not
  // re-render the thread. Event objects are replaced when their data changes.
  const cached = useQuery<Wevent>({ queryKey: ["nostr-event", eventId], queryFn: skipToken });
  const storedEvent = useLocalState((s) => {
    if (!eventId) return undefined;
    for (const fc of [s.globalFeed, s.nostrFeed]) {
      const event = nostrEventInFeed(fc, eventId);
      if (event) return event;
    }
    return undefined;
  });
  const event = storedEvent ?? cached.data;
  if (!id) return <div id="screen-thread" className="trill-screen"><ThreadState title="Unable to load thread">No thread ID was provided.</ThreadState></div>;
  // the route carries the event id (hex, note or nevent); nostr feeds are
  // keyed by timestamp ids, so look the event up by hash
  if (!eventId) return <div id="screen-thread" className="trill-screen"><ThreadState title="Invalid thread link">The post ID in this link isn’t recognized.</ThreadState></div>;
  if (event)
    return (
      <div id="screen-thread" className="trill-screen">
        <NostrThread key={eventId} event={event} relays={event.relays ?? []} />
      </div>
    );
  return (
    <div id="screen-thread" className="trill-screen">
      <NostrThreadFetcher key={eventId} id={eventId} />
    </div>
  );
}
