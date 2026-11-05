import type { NostrMetadata } from "@/types/nostrill";
import Post from "../Post";
import useLocalState from "@/state/state";

export function NostrSnippet({ meta }: { meta: NostrMetadata }) {
  const profile = useLocalState((s) => s.profiles.get(meta.pubkey));
  const user = { nostr: meta.pubkey };

  if (meta.post) return <Post user={user} poast={meta.post} profile={profile} />;
  else return <div className="nostr snippet">{meta.eventId}</div>;
}
