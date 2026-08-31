import type { NostrMetadata, NostrPost } from "@/types/nostrill";
import Post from "../Post";
import useLocalState from "@/state/state";

export default NostrPost;
function NostrPost({ data }: { data: NostrPost }) {
  const { profiles } = useLocalState((s) => ({ profiles: s.profiles }));
  const profile = profiles.get(data.event.pubkey);

  return (
    <Post
      user={{ nostr: data.event.pubkey }}
      poast={data.post}
      profile={profile}
    />
  );
}

export function NostrSnippet({ meta }: { meta: NostrMetadata }) {
  const user = { nostr: meta.pubkey };
  // TODO need a PostData sort of loader here

  if (meta.post) return <Post user={user} poast={meta.post} />;
  else return <div className="nostr snippet">{meta.eventId}</div>;
}
