import "@/styles/Profile.css";
import "@/styles/UserModal.css";
import Avatar from "../Avatar";
import Icon from "@/components/Icon";
import useLocalState from "@/state/state";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import { generateNprofile } from "@/logic/nostr";
import { useEffect, useState } from "react";
import type {
  Deferred,
  Enbowled,
  FeedData,
  NostrFollow,
  UserType,
} from "@/types/nostrill";
import {
  getCustomProfileFields,
  getDisplayName,
  getFollowerCount,
  getFollowingCount,
  getHandleLabel,
  getProfileBanner,
  getUserId,
  getUserKind,
} from "@/logic/userDisplay";
import { Home, MessageSquare, X } from "lucide-react";

export default function UserModal({ user }: { user: UserType }) {
  const {
    setModal,
    api,
    lastFact,
    pubkey,
    profiles,
    following,
    followers,
    relays,
  } = useLocalState((s) => ({
    setModal: s.setModal,
    api: s.api,
    pubkey: s.pubkey,
    profiles: s.profiles,
    following: s.following,
    followers: s.followers,
    lastFact: s.lastFact,
    relays: s.relays,
  }));
  const [, navigate] = useLocation();
  const [isLoading, setLoading] = useState(false);

  const itsMe =
    "urbit" in user
      ? user.urbit.patp === api?.airlock.our
      : "nostr" in user
        ? user.nostr === pubkey
        : false;

  const userString = getUserId(user);
  const userKind = getUserKind(user);
  const profile = profiles.get(userString);
  const isFollowing = following.has(userString);
  const isFollower = followers.includes(userString);
  const userFeed = following.get(userString);
  const postCount = userFeed ? Object.keys(userFeed.feed).length : 0;
  const followingCount = getFollowingCount(profile);
  const followerCount = getFollowerCount(profile);
  const displayName = getDisplayName(user, profile);
  const idLabel = getHandleLabel(user, userString);
  const bannerImage = getProfileBanner(profile);
  const otherFields = getCustomProfileFields(profile);

  useEffect(() => {
    if (!lastFact || !("fols" in lastFact)) return;
    if ("quit" in lastFact.fols) handleQuit(lastFact.fols.quit);
    if ("new-urbit" in lastFact.fols) followedUrbit(lastFact.fols["new-urbit"]);
    if ("new-nostr" in lastFact.fols) followedNostr(lastFact.fols["new-nostr"]);
  }, [lastFact]);

  function close() {
    setModal(null);
  }

  function handleQuit(ustring: string) {
    if (ustring === userString) {
      setLoading(false);
      toast.success(`Unfollowed ${profile?.name || userString}`);
    }
  }

  function followedUrbit(_data: Enbowled<Deferred<FeedData>>) {
    setLoading(false);
  }

  function followedNostr(fact: NostrFollow) {
    if (fact.pubkey === userString) {
      setLoading(false);
      toast.success(`Followed ${profile?.name || userString}`);
    }
  }

  async function copy(e: React.MouseEvent, text: string) {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function handleFollow(e: React.MouseEvent) {
    if ("error" in user) return;
    e.stopPropagation();
    if (!api) return;

    setLoading(true);
    try {
      if (isFollowing) {
        await api.unfollow(user);
      } else {
        await api.follow(user);
      }
    } catch (_err) {
      toast.error("Action failed");
      setLoading(false);
    }
  }

  async function handleAvatarClick(e: React.MouseEvent) {
    e.stopPropagation();
    if ("nostr" in user) {
      const nprof = generateNprofile(userString);
      window.open(`https://primal.net/p/${nprof}`, "_blank");
    }
  }

  function handleMessage() {
    navigate(`/dms/${encodeURIComponent(userString)}`);
    close();
  }

  return (
    <div id="user-modal" className="user-modal">
      <div className="user-modal-scroll">
        <div
          className={`user-modal-banner${bannerImage ? " image" : " generated"}`}
          style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
        >
          <button
            className="user-modal-close"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="user-modal-body">
          <div className="user-modal-topline">
            <button
              className="user-modal-avatar-wrapper"
              onClick={handleAvatarClick}
              style={{ cursor: "nostr" in user ? "pointer" : "default" }}
              aria-label="Open external profile"
            >
              <Avatar user={user} profile={profile} size={84} picOnly />
            </button>

            {"nostr" in user && Object.keys(relays).length === 0 ? (
              <span className="user-modal-relay-note">
                Connect to a relay to follow
              </span>
            ) : (
              "nostr" in user &&
              !itsMe && (
                <button
                  className={`user-modal-follow ${isFollowing ? "following" : ""}`}
                  onClick={handleFollow}
                  disabled={isLoading}
                >
                  {isLoading ? "..." : isFollowing ? "Following" : "Follow"}
                </button>
              )
            )}
          </div>

          <section className="user-modal-identity">
            <h2>{displayName}</h2>
            <div className="user-modal-id-line">
              <button
                className="user-modal-id mono"
                onClick={(e) => copy(e, userString)}
                title="Copy to clipboard"
              >
                {idLabel}
              </button>
              <span className={`user-kind-badge ${userKind}`}>
                {userKind === "urbit" ? "Urbit" : "Nostr"}
              </span>
              {itsMe && <span className="user-soft-badge">You</span>}
              {isFollower && !itsMe && (
                <span className="user-soft-badge">Follows you</span>
              )}
            </div>
          </section>

          {profile?.about && <p className="user-modal-about">{profile.about}</p>}

          <div className="user-modal-stats">
            <span>
              <b>{followingCount}</b> Following
            </span>
            <span>
              <b>{followerCount}</b> Followers
            </span>
            <span>
              <b>{postCount}</b> Posts
            </span>
          </div>

          {otherFields.length > 0 && (
            <div className="user-modal-custom-fields">
              {otherFields.map(([key, value]) => (
                <div key={key} className="custom-field-item">
                  <span className="field-key">{key}</span>
                  <ProfValue value={value} />
                </div>
              ))}
            </div>
          )}

          <div className="user-modal-actions">
            {!itsMe && (
              <button
                className="action-btn primary"
                onClick={handleMessage}
              >
                <MessageSquare size={17} />
                Message
              </button>
            )}
            <button
              className="action-btn secondary"
              onClick={() => {
                navigate(`/u/${userString}`);
                close();
              }}
            >
              <Home size={17} />
              View feed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const isURL = (str: string): boolean => {
  if (!str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

export function ProfValue({ value }: { value: any }) {
  if (typeof value === "string")
    return isURL(value) ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="field-value field-link"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
        <Icon name="nostr" size={12} className="external-link-icon" />
      </a>
    ) : (
      <span className="field-value">{value}</span>
    );
  if (typeof value === "number") return <span className="field-value">{value}</span>;
  if (typeof value === "object")
    return <span className="field-value">{JSON.stringify(value)}</span>;
  return <span className="field-value">{JSON.stringify(value)}</span>;
}
