import type { PostProps } from "./Post";
import { useEffect, useRef, useState } from "react";
import useLocalState from "@/state/state";
import { useLocation } from "wouter";
import { displayCount, getThreadPath } from "@/logic/utils";
import { TrillReactModal } from "./Reactions";
import toast from "react-hot-toast";
import type { SPID } from "@/types/ui";
import QuoteModal from "@/components/modals/QuoteModal";
import ReactionsModal from "@/components/modals/ReactionsModal";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import RelayPost from "../modals/RelayPost";
import PostDetails from "../modals/PostDetails";
import {
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  Zap,
} from "lucide-react";
import PostActionButton from "./PostActionButton";
import PostActionMenu from "./PostActionMenu";
import RepostConfirmPopover from "./RepostConfirmPopover";
import ZapSheet from "@/components/modals/ZapSheet";
import { getHandleLabel } from "@/logic/userDisplay";
// TODO abstract this somehow

function Footer({ user, poast, profile, thread, refetch }: PostProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [repostConfirmOpen, setRepostConfirmOpen] = useState(false);
  const [repostOverride, setRepostOverride] = useState<boolean | null>(null);
  const [repostCountDelta, setRepostCountDelta] = useState(0);
  const [zapCountDelta, setZapCountDelta] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [location, navigate] = useLocation();
  const [reposting, setReposting] = useState(false);
  const { api, setComposerData, setModal, relays } = useLocalState((s) => ({
    api: s.api,
    setComposerData: s.setComposerData,
    setModal: s.setModal,
    relays: s.relays,
  }));
  const our = api!.airlock.our!;
  function getComposerData(): SPID {
    return "urbit" in user
      ? { trill: poast }
      : { nostr: { post: poast, pubkey: user.nostr, eventId: poast.hash } };
  }
  function doReply(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setComposerData({ type: "reply", post: getComposerData() });
    // Scroll to top where composer is located
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Focus will be handled by the composer component
  }
  function doQuote(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setComposerData({
      type: "quote",
      post: getComposerData(),
    });
    // Scroll to top where composer is located
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const childrenCount = poast.children
    ? poast.children.length
      ? poast.children.length
      : Object.keys(poast.children).length
    : 0;
  const myRP = poast.engagement.shared.find((r) => r.pid.ship === our);
  const reposted = repostOverride ?? Boolean(myRP);
  const repostCount = Math.max(0, poast.engagement.shared.length + repostCountDelta);

  useEffect(() => {
    setRepostConfirmOpen(false);
    setRepostOverride(null);
    setRepostCountDelta(0);
  }, [poast.id, poast.engagement.shared.length]);

  useEffect(() => {
    setZapCountDelta(0);
  }, [poast.id]);

  function openZap(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const fallbackName = poast.authorFull.author.gwid.english.abridged || poast.author;
    setModal(
      <ZapSheet
        targetName={profile?.name || fallbackName}
        targetHandle={getHandleLabel(user)}
        targetUser={user}
        targetProfile={profile}
        onZapped={() => setZapCountDelta((count) => count + 1)}
        onClose={() => setModal(null)}
      />,
    );
  }

  async function doCancelRP() {
    setRepostConfirmOpen(false);
    setReposting(true);
    const repostId = myRP?.pid.id ?? poast.id;
    const r = await api!.deletePost(user, repostId);
    if (r) {
      setRepostOverride(false);
      if (myRP) setRepostCountDelta((count) => count - 1);
      toast.success("Repost removed");
    } else {
      toast.error("Could not remove repost");
    }
    setReposting(false);
    setModal(null);
    if (location.includes(poast.id)) navigate("/");
  }
  function cancelRP(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setRepostConfirmOpen(true);
  }
  async function doSendRP() {
    if (reposting) return;
    const id = "urbit" in user ? poast.id : poast.hash;
    setReposting(true);
    setRepostOverride(true);
    if (!myRP) setRepostCountDelta((count) => count + 1);
    const toastId = toast.custom(
      (t) => (
        <div className="trill-action-toast">
          <span>Your repost was published</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              undoRepost();
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000, id: `repost-${poast.id}`, position: "bottom-center" },
    );
    const r = await api!.addRP(user, id);
    if (!r) {
      toast.dismiss(toastId);
      setRepostOverride(false);
      if (!myRP) setRepostCountDelta((count) => count - 1);
      toast.error("Could not publish repost");
    }
    setReposting(false);
  }
  function sendRP(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    doSendRP();
  }
  async function undoRepost() {
    setRepostConfirmOpen(false);
    setRepostOverride(false);
    if (!myRP) setRepostCountDelta((count) => count - 1);
    const repostId = myRP?.pid.id ?? poast.id;
    const r = await api!.deletePost(user, repostId);
    if (!r) {
      setRepostOverride(true);
      if (!myRP) setRepostCountDelta((count) => count + 1);
      toast.error("Could not undo repost");
    }
  }
  function doReact(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const modal = <TrillReactModal user={user} poast={poast} />;
    setModal(modal);
  }
  function showReplyCount() {
    if (poast.children[0]) fetchAndShow(); // Flatpoast
    // else {
    //   const authors = Object.keys(poast.children).map(
    //     (i) => poast.children[i].post.author
    //   );
    //   setEngagement({ type: "replies", ships: authors }, poast);
    // }
  }
  async function fetchAndShow() {
    // let authors = [];
    // for (let i of poast.children as string[]) {
    //   const res = await scrypoastFull(poast.host, i);
    //   if (res)
    //   authors.push(res.post.author || "deleter");
    // }
    // setEngagement({ type: "replies", ships: authors }, poast);
  }
  function showRepostCount() {
    // const ships = poast.engagement.shared.map((entry) => entry.host);
    // setEngagement({ type: "reposts", ships: ships }, poast);
  }

  function showQuoteCount(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setModal(<QuoteModal poast={poast} onClose={() => setModal(null)} />);
  }

  function showReactCount(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setModal(<ReactionsModal poast={poast} onClose={() => setModal(null)} />);
  }

  function deletePoast(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    setModal(
      <ConfirmationDialog
        onConfirm={doDelete}
        onCancel={() => setModal(null)}
      />,
    );
  }

  async function doDelete() {
    const r = await api!.deletePost(user, poast.id);
    toast.success("Post deleted");
    setModal(null);
  }

  const isMine = poast.author === api?.airlock.our;
  // cross-posting is for the user's own urbit posts only
  const canRelay =
    isMine && "urbit" in user && Object.keys(relays).length > 0;
  const hasDetails = !!poast.event;

  useEffect(() => {
    if (!showMenu && !repostConfirmOpen) return;

    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowMenu(false);
      if (e.key === "Escape") setRepostConfirmOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showMenu, repostConfirmOpen]);

  // TODO round up all helpers
  //

  function toggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu((open) => !open);
  }

  function closeMenu(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setShowMenu(false);
  }

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const webLink =
      typeof window !== "undefined"
        ? `${window.location.origin}${getThreadPath(poast)}`
        : getThreadPath(poast);

    try {
      await navigator.clipboard.writeText(webLink);
      toast.success("Post link copied");
    } catch {
      toast.error("Could not copy post link");
    } finally {
      setShowMenu(false);
    }
  }

  function sendToRelay(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    setModal(<RelayPost poast={poast} />);
  }

  function showDetails(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    setModal(<PostDetails poast={poast} onClose={() => setModal(null)} />);
  }

  function toggleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setBookmarked((saved) => {
      toast.success(saved ? "Bookmark removed" : "Post bookmarked");
      return !saved;
    });
    setShowMenu(false);
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setMuted((hidden) => {
      toast.success(hidden ? `${poast.author} unmuted` : `${poast.author} muted`);
      return !hidden;
    });
    setShowMenu(false);
  }

  function reportPost(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    toast.success("Post reported");
    setShowMenu(false);
  }

  return (
    <div className="footer-wrapper post-footer">
      <footer>
        <PostActionButton
          className="reply-action"
          onClick={doReply}
          icon={<MessageCircle size={18.5} strokeWidth={1.8} />}
          count={displayCount(childrenCount)}
          countClassName="reply-count"
          onCountClick={(e) => {
            e.stopPropagation();
            showReplyCount();
          }}
        />
        <PostActionButton
          className="repost-action"
          active={reposted}
          onClick={reposted ? cancelRP : sendRP}
          icon={<Repeat2 size={18.5} strokeWidth={1.8} />}
          count={displayCount(repostCount)}
          countClassName="repost-count"
          onCountClick={(e) => {
            e.stopPropagation();
            showRepostCount();
          }}
        >
          {repostConfirmOpen && (
            <RepostConfirmPopover
              reposting={reposting}
              onCancel={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setRepostConfirmOpen(false);
              }}
              onConfirm={(e) => {
                e.stopPropagation();
                e.preventDefault();
                doCancelRP();
              }}
            />
          )}
        </PostActionButton>
        <PostActionButton
          className="quote-action"
          onClick={doQuote}
          icon={<Quote size={18.5} strokeWidth={1.8} />}
          count={displayCount(poast.engagement.quoted.length)}
          countClassName="quote-count"
          onCountClick={showQuoteCount}
        />
        <PostActionButton
          className="reaction-action"
          onClick={doReact}
          icon={
            <Heart
              size={18.5}
              strokeWidth={1.8}
              fill={Object.keys(poast.engagement.reacts).length > 0 ? "currentColor" : "none"}
            />
          }
          count={displayCount(Object.keys(poast.engagement.reacts).length)}
          countClassName="reaction-count"
          onCountClick={showReactCount}
        />
        <PostActionButton
          className="zap-action"
          active={zapCountDelta > 0}
          onClick={openZap}
          ariaLabel={`Zap post${zapCountDelta > 0 ? `, ${zapCountDelta} sent` : ""}`}
          icon={
            <Zap
              size={18.5}
              strokeWidth={1.8}
              fill={zapCountDelta > 0 ? "currentColor" : "none"}
            />
          }
          count={zapCountDelta.toLocaleString()}
          countClassName="zap-count"
        />
        <PostActionMenu
          open={showMenu}
          bookmarked={bookmarked}
          muted={muted}
          isMine={isMine}
          canRelay={canRelay}
          hasDetails={hasDetails}
          menuRef={menuRef}
          onToggle={toggleMenu}
          onClose={closeMenu}
          onCopyLink={copyLink}
          onShowDetails={showDetails}
          onSendToRelay={sendToRelay}
          onToggleBookmark={toggleBookmark}
          onToggleMute={toggleMute}
          onDelete={deletePoast}
          onReport={reportPost}
        />
      </footer>
    </div>
  );
}
export default Footer;
