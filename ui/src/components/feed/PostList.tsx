import TrillPost from "@/components/post/Post";
import type { FC } from "@/types/trill";
import useLocalState from "@/state/state";
import type { UserType } from "@/types/nostrill";
import { isValidPatp } from "urbit-ob";
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
  // const qc = useQueryClient();
  // useEffect(() => {
  //   Object.values(data.feed).forEach((poast) => {
  //     const queryKey = ["trill-thread", poast.host, poast.id];
  //     const existing = qc.getQueryData(queryKey);
  //     if (!existing || !("fpost" in (existing as any))) {
  //       qc.setQueryData(queryKey, {
  //         fpost: toFull(poast),
  //       });
  //     }
  //   });
  // }, [data]);
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
