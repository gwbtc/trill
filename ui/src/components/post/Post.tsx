import "@/styles/trill.css";
import type { PostID, Poast, Reference } from "@/types/trill";

import Header from "./Header";
import Body from "./Body";
import Footer from "./Footer";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import { createContext, useContext } from "react";
import { isHiddenPost } from "@/logic/lists";
import RP from "./RP";
import UserModal from "../modals/UserModal";
import type { Ship } from "@/types/urbit";
import type { UserProfile, UserType } from "@/types/nostrill";
import { getThreadPath } from "@/logic/utils";
import { AvatarPic } from "../Avatar";

export interface PostProps {
  poast: Poast;
  user: UserType;
  thread?: boolean;
  fake?: boolean;
  spine?: boolean;
  rp?: { ship: Ship; time: number; id: PostID };
  nest?: number;
  refetch?: Function;
  profile?: UserProfile;
}
// set by pages that show a muted author's posts on purpose (their profile)
export const ShowMutedPosts = createContext(false);

function Post(props: PostProps) {
  const { poast } = props;
  const lists = useLocalState((s) => s.lists);
  const showMuted = useContext(ShowMutedPosts);
  if (!poast || poast.contents === null) {
    return null;
  }
  // reported posts and muted authors, wherever posts are listed
  if (isHiddenPost(poast, lists, showMuted)) return null;
  const isRP =
    poast.contents.length === 1 &&
    "ref" in poast.contents[0] &&
    poast.contents[0].ref.type === "trill";
  if (isRP) {
    const ref = (poast.contents[0] as Reference).ref;
    return (
      <RP
        host={ref.ship}
        id={ref.path.slice(1)}
        rp={{ ship: poast.author, time: poast.time, id: poast.id }}
      />
    );
  } else return <TrillPost {...props} />;
}
export default Post;

const INTERACTIVE_SELECTOR = "a, button, video, audio, input, textarea, select, label";

function TrillPost(props: PostProps) {
  const { poast, profile, fake, rp, spine = true } = props;
  const setModal = useLocalState((s) => s.setModal);
  const [_, navigate] = useLocation();
  function openThread(e: React.MouseEvent) {
    // links, buttons, media controls etc. inside the post do their own thing
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    // a nested post (repost, quote) handles its own click; don't let the
    // outer post navigate over it
    e.stopPropagation();
    const sel = window.getSelection()?.toString();
    // (no hash check: urbit-only posts have an all-zero hash, and the thread
    // route doesn't use it: /t/u/host/id for urbit, the event id for nostr)
    if (!sel) navigate(getThreadPath(poast));
  }

  function openModal(e: React.MouseEvent) {
    e.stopPropagation();
    setModal(<UserModal user={props.user} />);
  }
  // TODO
  const rpString = rp ? `Reposted by ${rp.ship} at ${rp.time}` : "";
  return (
    <article
      className={`timeline-post trill-post cp${spine ? "" : " no-spine"}`}
      role="link"
      onClick={openThread}
    >
      <div className="trill-post-gutter left">
    <div className="avatar sigil cp" role="link" onClick={openModal}>
      <AvatarPic user={props.user} profile={profile} size={44} />
    </div>

        </div>
      <div className="trill-post-body right">
        <Header {...props} />
        <Body {...props} />
        {!fake && <Footer {...props} />}
      </div>
    </article>
  );
}
