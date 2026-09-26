import TrillPost from "@/components/post/Post";
import type { FC } from "@/types/trill";
import useLocalState from "@/state/state";
import { userFromPost } from "@/logic/trill/helpers";
import { getUserId } from "@/logic/userDisplay";
// import { useEffect } from "react";
// import { useQueryClient } from "@tanstack/react-query";
// import { toFull } from "../thread/helpers";

function TrillFeed({
  data,
  refetch,
  spine = true,
}: {
  data: FC;
  refetch: Function;
  spine?: boolean;
}) {
  const { profiles } = useLocalState((s) => ({ profiles: s.profiles }));
  return (
    <>
      {Object.keys(data.feed)
        // omit replies
        .filter((i) => !data.feed[i].parent)
        .sort()
        .reverse()
        // .slice(0, 50)
        .map((i) => {
          const poast = data.feed[i];
          const user = userFromPost(poast);
          const userString = getUserId(user);
          const profile = profiles.get(userString);
          return (
            <TrillPost
              key={i}
              poast={poast}
              user={user}
              profile={profile}
              refetch={refetch}
              spine={spine}
            />
          );
        })}
    </>
  );
}

export default TrillFeed;
