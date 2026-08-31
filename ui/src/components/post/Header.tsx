import {
  abbreviatePatp,
  date_diff,
} from "@/logic/utils";
import type { PostProps } from "./Post";
import useLocalState from "@/state/state";
import UserModal from "../modals/UserModal";

function Header(props: PostProps) {
  const setModal = useLocalState((s) => s.setModal);
  const { profile } = props;

  function go(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setModal(<UserModal user={props.user} />);
  }

  const { poast } = props;
  const handle = props.poast.authorFull.author.gwid.english.abridged
  // const displayName = profile?.name ?? abbreviatePatp(handle);
  const displayName = profile?.name ?? handle

  return (
    <header>
      <div className="cp author" role="link" onClick={go}>
        <span className="name">{displayName}</span>
      </div>
    {handle !== displayName && 
      <span className="post-handle mono cp" role="link" onClick={go}>
        {abbreviatePatp(handle)}
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
