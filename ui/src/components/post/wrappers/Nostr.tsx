import { usePostUser } from "@/hooks/usePostUser";
import { usePostProfile } from "@/hooks/usePostProfile";
import type { NostrMetadata } from "@/types/nostrill";
import Post from "../Post";

export function NostrSnippet({ meta }: { meta: NostrMetadata }) {
  const profile = usePostProfile(meta.pubkey);
  const userFromPost = usePostUser();

  if (meta.post) return <Post user={userFromPost(meta.post)} poast={meta.post} profile={profile} />;
  else return <div className="nostr snippet">{meta.eventId}</div>;
}
