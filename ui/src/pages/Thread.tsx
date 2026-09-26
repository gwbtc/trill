import { useParams } from "wouter";
import useLocalState from "@/state/state";
import { ErrorPage } from "@/pages/Error";
import "@/styles/trill.css";
import "@/styles/feed.css";
import ComposerModal from "@/components/modals/ComposerModal";
import TrillThread from "@/components/trill/Thread";
import NostrThread from "@/components/nostr/Thread";
import NostrThreadFetcher from "@/components/nostr/Fetcher";
import { decodeNostrEventId } from "@/logic/nostr";
import PageHeader from "@/components/layout/PageHeader";
import { useEffect } from "react";

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
  const feed = following.get(host);
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
  const { globalFeed, nostrFeed } = useLocalState((s) => ({
    globalFeed: s.globalFeed,
    nostrFeed: s.nostrFeed,
  }));
  const params = useParams<{ id: string }>();
  const { id } = params;
  if (!id) return <ErrorPage msg="No thread id passed" />;
  // the route carries the event id (hex, note or nevent); nostr feeds are
  // keyed by timestamp ids, so look the event up by hash
  const eventId = decodeNostrEventId(id);
  if (!eventId) return <ErrorPage msg="Unknown thread id format" />;
  const known = [globalFeed, nostrFeed]
    .flatMap((fc) => Object.values(fc.feed))
    .find((p) => p.hash === eventId && p.event);
  if (known?.event)
    return (
      <div id="screen-thread" className="trill-screen">
        <NostrThread event={known.event} relays={known.event.relays ?? []} />
      </div>
    );
  return (
    <div id="screen-thread" className="trill-screen">
      <NostrThreadFetcher key={eventId} id={eventId} />
    </div>
  );
}
