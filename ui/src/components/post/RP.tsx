import Post from "./Post";
import type { Ship } from "@/types/urbit";
import type { Poast, FullNode, ID } from "@/types/trill";
import PostData from "./Loader";
import { userFromAuthor } from "@/logic/trill/helpers";

export default function (props: {
  host: string;
  id: string;
  rp?: { ship: Ship; time: number; id: ID };
  refetch?: Function;
}) {
  return PostData(props)(RP);
}

function RP({
  data,
  refetch,
  rp,
}: {
  data: FullNode;
  refetch: Function;
  rp: { ship: Ship; time: number; id: ID };
}) {
  return (
    <Post
      user={userFromAuthor(data.author)}
      poast={toFlat(data)}
      rp={rp}
      refetch={refetch}
    />
  );
}

export function toFlat(n: FullNode): Poast {
  return {
    ...n,
    children: !n.children
      ? []
      : Object.keys(n.children).map((c) => n.children[c].id),
  };
}
