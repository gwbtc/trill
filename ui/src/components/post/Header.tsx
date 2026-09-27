import {
  abbreviatePatp,
  date_diff,
} from "@/logic/utils";
import type { PostProps } from "./Post";
import useLocalState from "@/state/state";
import UserModal from "../modals/UserModal";
import { shortNpub } from "@/logic/nostrRefs";

function Header(props: PostProps) {
  const setModal = useLocalState((s) => s.setModal);
  const { profile } = props;

  function go(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setModal(<UserModal user={props.user} />);
  }

  const { poast } = props;
  // from the post's user, not its authorFull: nostr notes carry a
  // placeholder urbit id (blank gwid, "~zod"), and our own notes are
  // attributed to our ship (usePostUser)
  const { user } = props;
  const handle =
    "nostr" in user
      ? shortNpub(user.nostr)
      : user.urbit.gwid?.english?.abridged || user.urbit.patp;
  const displayName = profile?.name?.trim() || handle;

  return (
    <header>
      <div className="cp author" role="link" onClick={go}>
        <span className="name">{displayName}</span>
      </div>
    {handle !== displayName && 
      <span className="post-handle mono cp" role="link" onClick={go}>
        {handle.startsWith("~") ? abbreviatePatp(handle) : handle}
      </span>
      }
      <div className="date">
        <p title={new Date(poast.time).toLocaleString()}>
          {date_diff(poast.time, "short")}
        </p>
      </div>
    </header>
  );
}
export default Header;
