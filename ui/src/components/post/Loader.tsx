import { useQuery, useQueryClient } from "@tanstack/react-query";
import spinner from "@/assets/triangles.svg";
import { useEffect, useRef, useState } from "react";
import useLocalState from "@/state/state";
import type { FullNode, PostID } from "@/types/trill";
import type { Ship } from "@/types/urbit";
import type { AsyncRes, Result } from "@/types/ui";
import { toFlat } from "@/logic/trill/helpers";
import type { PeekThreadRes } from "@/types/nostrill";

type Props = {
  host: Ship;
  id: PostID;
  nest?: number; // nested quotes
  rter?: Ship;
  rtat?: number;
  rtid?: PostID;
  className?: string;
};
function PostData(props: Props) {
  const { api } = useLocalState((s) => ({
    api: s.api,
  }));

  const { host, id, nest } = props;

  const [enest, setEnest] = useState(nest || 0);
  useEffect(() => {
    if (nest) setEnest(nest);
  }, [nest]);

  return function (Component: React.ElementType) {
    // const [showNested, setShowNested] = useState(nest <= 3);
    const handleShowNested = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEnest(enest! - 3);
    };
    const [dead, setDead] = useState(false);
    const [denied, setDenied] = useState(false);
    const { isLoading, isError, data, refetch } = useQuery({
      queryKey: ["trill-thread", host, id],
      queryFn: fetchNode,
    });
    const queryClient = useQueryClient();
    const dataRef = useRef(data);
    useEffect(() => {
      dataRef.current = data;
    }, [data]);

    async function fetchNode(): AsyncRes<FullNode> {
      const res = await api!.scryThread(host, id);
      const data = handleRes(res);
      return data;
    }

    function handleRes(res: Result<PeekThreadRes>): Result<FullNode> {
      if ("error" in res) return { error: "Failed to load post: " + res.error };
      else {
        const msg = res.ok.data.msg;
        const data = res.ok.data.data;
        if (data === "maybe") {
          setDenied(true);
          return {
            error: `The post ${host}/${id} is gated: ${msg}. A request has been sent.`,
          };
        } else if (data === null) {
          setDenied(true);
          return {
            error: `The post ${host}/${id} is gated and access was denied: ${msg}`,
          };
        } else {
          return { ok: data.node };
        }
      }
    }

    async function peekTheNode() {
      const res2 = await api!.peekThread(host, id);
      const node = handleRes(res2);
      queryClient.setQueryData(["trill-thread", host, id], node);

      // let timer;
      // peekNode({ ship: host, id });
      // timer = setTimeout(() => {
      //   const gotPost = dataRef.current && "fpost" in dataRef.current;
      //   setDead(!gotPost);
      //   // clearTimeout(timer);
      // }, 10_000);
    }

    // useEffect(() => {
    //   const path = `${host}/${id}`;
    //   if (path in peekedPosts) {
    //     queryClient.setQueryData(["trill-thread", host, id], {
    //       fpost: peekedPosts[path],
    //     });
    //   } else if (path in deniedPosts) {
    //     setDenied(true);
    //   }
    // }, [peekedPosts]);
    // useEffect(() => {
    //   const path = `${host}/${id}`;
    //   if (path in deniedPosts) setDenied(true);
    // }, [deniedPosts]);

    // useEffect(() => {
    //   const l = lastThread;
    //   if (l && l.thread == id) {
    //     queryClient.setQueryData(["trill-thread", host, id], { fpost: l });
    //   }
    // }, [lastThread]);
    function retryPeek(e: React.MouseEvent) {
      e.stopPropagation();
      setDead(false);
      peekTheNode();
    }
    if (enest > 3)
      return (
        <div className={props.className}>
          <div className="lazy x-center not-found">
            <button className="x-center" onMouseUp={handleShowNested}>
              Load more
            </button>
          </div>
        </div>
      );
    else
      return data ? (
        dead ? (
          <div className={props.className}>
            <div className="no-response x-center not-found">
              <p>{host} did not respond</p>
              <button className="x-center" onMouseUp={retryPeek}>
                Try again
              </button>
            </div>
          </div>
        ) : denied ? (
          <div className={props.className}>
            <p className="x-center not-found">
              {host} denied you access to this post
            </p>
          </div>
        ) : "error" in data ? (
          <div className={props.className}>
            <p className="x-center not-found">Post not found</p>
            <p className="x-center not-found">{data.error}</p>
          </div>
        ) : (
          <Component
            data={toFlat(data.ok)}
            refetch={refetch}
            {...props}
            nest={enest}
          />
        )
      ) : // no data
      isLoading || isError ? (
        <div className={props.className}>
          <img className="x-center post-spinner" src={spinner} alt="" />
        </div>
      ) : (
        <div className={props.className}>
          <p>...</p>
        </div>
      );
  };
}
export default PostData;
