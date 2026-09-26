import { useState } from "react";
import { unwrap } from "@/logic/result";
import toast from "react-hot-toast";
import Body from "@/components/post/Body";
import Footer from "@/components/post/Footer";
import { AvatarPic } from "@/components/Avatar";
import UserModal from "@/components/modals/UserModal";
import useLocalState from "@/state/state";
import { displayCount } from "@/logic/utils";
import {
  getDisplayName,
  getHandleLabel,
  getUserId,
} from "@/logic/userDisplay";
import type { Poast } from "@/types/trill";
import type { UserProfile, UserType } from "@/types/nostrill";

type ThreadRootPostProps = {
  poast: Poast;
  user: UserType;
  profile?: UserProfile;
  provenance?: string;
};

export default function ThreadRootPost({
  poast,
  user,
  profile,
  provenance,
}: ThreadRootPostProps) {
  const { api, pubkey, following, setModal } = useLocalState((s) => ({
    api: s.api,
    pubkey: s.pubkey,
    following: s.following,
    setModal: s.setModal,
  }));
  const [isLoading, setLoading] = useState(false);

  const userId = getUserId(user);
  const isFollowing = following.has(userId);
  const isMe =
    ("urbit" in user && user.urbit.patp === api?.airlock.our) ||
    ("nostr" in user && user.nostr === pubkey);
  const displayName = getDisplayName(user, profile);
  const handleLabel = getHandleLabel(user, userId);

  function openUser(e: React.MouseEvent) {
    e.stopPropagation();
    setModal(<UserModal user={user} />);
  }

  async function toggleFollow(e: React.MouseEvent) {
    e.stopPropagation();
    if (!api || isMe || isLoading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        unwrap(await api.unfollow(user));
        toast.success(`Unfollowed ${displayName}`);
      } else {
        unwrap(await api.follow(user));
        toast.success(`Following ${displayName}`);
      }
    } catch (error) {
      toast.error(`Failed to ${isFollowing ? "unfollow" : "follow"} ${displayName}`);
      console.error("Thread follow error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <article id="thread-root-post" className="thread-root-card">
      <div className="thread-root-author-row">
        <button
          type="button"
          className="thread-root-avatar"
          onClick={openUser}
          aria-label={`Open ${displayName} profile`}
        >
          <AvatarPic user={user} profile={profile} size={50} />
        </button>
        <button
          type="button"
          className="thread-root-identity"
          onClick={openUser}
        >
          <span className="thread-root-name">{displayName}</span>
          <span className="thread-root-handle mono">{handleLabel}</span>
        </button>
        {!isMe && (
          <button
            type="button"
            className={`thread-root-follow${isFollowing ? " following" : ""}`}
            onClick={toggleFollow}
            disabled={isLoading}
          >
            {isLoading
              ? isFollowing
                ? "Unfollowing..."
                : "Following..."
              : isFollowing
                ? "Following"
                : "Follow"}
          </button>
        )}
      </div>

      <div className="thread-root-content">
        <Body poast={poast} user={user} profile={profile} thread />
      </div>

      <ThreadRootMeta poast={poast} provenance={provenance} />

      <div className="thread-root-actions">
        <Footer poast={poast} user={user} profile={profile} thread />
      </div>
    </article>
  );
}

function ThreadRootMeta({
  poast,
  provenance,
}: {
  poast: Poast;
  provenance?: string;
}) {
  const reposts = poast.engagement.shared.length;
  const quotes = poast.engagement.quoted.length;
  const likes = Object.keys(poast.engagement.reacts).length;
  const source = provenance || poast.event?.relays?.[0] || poast.host;

  return (
    <div className="thread-root-meta">
      <div className="thread-root-provenance">
        <span className="mono">{new Date(poast.time).toLocaleString()}</span>
        <span aria-hidden="true">·</span>
        <span>
          via <span className="mono">{source}</span>
        </span>
      </div>
      <div className="thread-root-stats" aria-label="Thread engagement">
        <span>
          <b>{displayCount(reposts) || "0"}</b> Reposts
        </span>
        <span>
          <b>{displayCount(quotes) || "0"}</b> Quotes
        </span>
        <span>
          <b>{displayCount(likes) || "0"}</b> Likes
        </span>
      </div>
    </div>
  );
}
