import { usePostProfile } from "@/hooks/usePostProfile";
import { memo, useCallback, useMemo, useRef } from "react";
import TrillPost from "@/components/post/Post";
import type { FC, Poast } from "@/types/trill";
import { usePostUser } from "@/hooks/usePostUser";
import { getUserId } from "@/logic/userDisplay";

function TrillFeed({ data, refetch, spine = true }: { data: FC; refetch: Function; spine?: boolean }) {
  const posts = useMemo(() => Object.keys(data.feed)
    .filter(id => !data.feed[id].parent)
    .sort().reverse().map(id => data.feed[id]), [data]);
  // Parents often recreate this handler. Keep row props stable while invoking
  // the latest callback when an action actually needs to refresh the feed.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const refresh = useCallback((...args: unknown[]) => refetchRef.current(...args), []);
  return <>{posts.map(poast => <PostRow key={poast.id} poast={poast} refetch={refresh} spine={spine} />)}</>;
}

const PostRow = memo(function PostRow({ poast, refetch, spine }: { poast: Poast; refetch: Function; spine: boolean }) {
  const userFromPost = usePostUser();
  const user = useMemo(() => userFromPost(poast), [poast, userFromPost]);
  const userId = getUserId(user);
  const profile = usePostProfile(userId);
  return <TrillPost poast={poast} user={user} profile={profile} refetch={refetch} spine={spine} />;
});

export default TrillFeed;
