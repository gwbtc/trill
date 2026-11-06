import { getUserId } from "@/logic/userDisplay";
import { usePostUser } from "@/hooks/usePostUser";
import { usePostProfile } from "@/hooks/usePostProfile";
import type { NostrMetadata } from "@/types/nostrill";
import Post from "../Post";

export function NostrSnippet({ meta }: { meta: NostrMetadata }) {
  const userFromPost = usePostUser();
  const user = meta.post ? userFromPost(meta.post) : { nostr: meta.pubkey };
  const profile = usePostProfile(getUserId(user));

  if (meta.post)
    return <Post user={user} poast={meta.post} profile={profile} />;
  else return <div className="nostr snippet">{meta.eventId}</div>;
}
