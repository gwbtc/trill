import type { PostID, Poast, Reference } from "@/types/trill";

import Header from "./Header";
import Body from "./Body";
import Footer from "./Footer";
import { useLocation } from "wouter";
import useLocalState from "@/state/state";
import RP from "./RP";
import UserModal from "../modals/UserModal";
import type { Ship } from "@/types/urbit";
import Sigil from "../Sigil";
import type { UserProfile, UserType } from "@/types/nostrill";
import { getThreadPath } from "@/logic/utils";
import { AvatarPic, UrbitAvatar } from "../Avatar";

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
function Post(props: PostProps) {
  // console.log("post", props);
  const { poast } = props;
  if (!poast || poast.contents === null) {
    return null;
  }
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

function TrillPost(props: PostProps) {
  const { poast, profile, fake, rp, spine = true } = props;
  const setModal = useLocalState((s) => s.setModal);
  const [_, navigate] = useLocation();
  function openThread(_e: React.MouseEvent) {
    const sel = window.getSelection()?.toString();
    const path = getThreadPath(poast);
    if (poast.hash.includes("000000")) {
      console.warn("bad hash", poast);
      return;
    }
    if (!sel) navigate(path);
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
