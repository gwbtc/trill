import Avatar from "@/components/Avatar";
import UserModal from "@/components/modals/UserModal";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { fetchFollowers, fetchFollows } from "@/logic/nostr";
import { stringToUser } from "@/logic/nostrill";
import {
  getDisplayName,
  getFollowerCount,
  getFollowingCount,
  getHandleLabel,
  getUserId,
} from "@/logic/userDisplay";
import useLocalState from "@/state/state";
import type { UserProfile, UserType } from "@/types/nostrill";
import { LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export type ConnectionTab = "following" | "followers";

export default function ConnectionsModal({
  user,
  profile,
  initialTab,
}: {
  user: UserType;
  profile: UserProfile | undefined;
  initialTab: ConnectionTab;
}) {
  const {
    api,
    followers,
    following,
    our,
    pubkey,
    profiles,
    relays,
    setModal,
  } = useLocalState((state) => ({
    api: state.api,
    followers: state.followers,
    following: state.following,
    our: state.our,
    pubkey: state.pubkey,
    profiles: state.profiles,
    relays: state.relays,
    setModal: state.setModal,
  }));
  const [activeTab, setActiveTab] = useState<ConnectionTab>(initialTab);
  const [lists, setLists] = useState<Record<ConnectionTab, UserType[]>>(() => ({
    following: initialFollowingList(user, profile, following, our?.patp, pubkey),
    followers: initialFollowerList(user, profile, followers, our?.patp, pubkey),
  }));
  const [loaded, setLoaded] = useState<Record<ConnectionTab, boolean>>({
    following: "urbit" in user,
    followers: "urbit" in user,
  });
  const [loading, setLoading] = useState<ConnectionTab | null>(null);
  const [loadError, setLoadError] = useState<Record<ConnectionTab, string | null>>({
    following: null,
    followers: null,
  });
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const userId = getUserId(user);
  const name = getDisplayName(user, profile, getHandleLabel(user, userId));
  const followingCount = Math.max(getFollowingCount(profile), lists.following.length);
  const followerCount = Math.max(getFollowerCount(profile), lists.followers.length);
  const list = lists[activeTab];

  useEffect(() => {
    if ("urbit" in user || loaded[activeTab] || loading === activeTab) return;
    void loadNostrConnections(activeTab);
  }, [activeTab, loaded, loading, user]);

  async function loadNostrConnections(tab: ConnectionTab) {
    if (!("nostr" in user)) return;
    const relay = Object.entries(relays).find(([, stats]) => stats.wid != null)?.[0]
      || Object.keys(relays)[0];
    if (!relay) {
      setLoaded((current) => ({ ...current, [tab]: true }));
      setLoadError((current) => ({
        ...current,
        [tab]: "Connect a relay to load Nostr connections.",
      }));
      return;
    }

    setLoading(tab);
    setLoadError((current) => ({ ...current, [tab]: null }));
    try {
      const ids = tab === "following"
        ? await fetchFollows(relay, user.nostr)
        : await fetchFollowers(relay, user.nostr);
      const next = Array.from(new Set(ids)).map((id) => ({ nostr: id }));
      setLists((current) => ({ ...current, [tab]: next }));
      setLoaded((current) => ({ ...current, [tab]: true }));
      if (next.length > 0) void api?.getProfiles(next);
    } catch (error) {
      console.error("Connection list fetch failed:", error);
      setLoaded((current) => ({ ...current, [tab]: true }));
      setLoadError((current) => ({
        ...current,
        [tab]: "Connections could not be loaded from the relay.",
      }));
    } finally {
      setLoading(null);
    }
  }

  async function toggleFollow(entry: UserType) {
    if (!api) {
      toast.error("Following is not ready yet");
      return;
    }

    const id = getUserId(entry);
    const wasFollowing = followOverrides[id] ?? following.has(id);
    const nextFollowing = !wasFollowing;
    setFollowOverrides((current) => ({ ...current, [id]: nextFollowing }));
    setPending((current) => new Set(current).add(id));
    try {
      if (nextFollowing) await api.follow(entry);
      else await api.unfollow(entry);
      toast.success(nextFollowing ? "Followed" : "Unfollowed");
    } catch (error) {
      setFollowOverrides((current) => ({ ...current, [id]: wasFollowing }));
      toast.error(nextFollowing ? "Could not follow this user" : "Could not unfollow this user");
      console.error("Connection follow action failed:", error);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function retry() {
    setLoaded((current) => ({ ...current, [activeTab]: false }));
    setLoadError((current) => ({ ...current, [activeTab]: null }));
  }

  return (
    <section id="connections-modal" className="subfollows-container" aria-labelledby="connections-title">
      <header className="connections-header">
        <Avatar user={user} profile={profile} size={42} picOnly noClick />
        <div className="connections-title">
          <strong id="connections-title">{name}</strong>
          <span className="mono">{getHandleLabel(user, userId)}</span>
        </div>
        <ModalCloseButton onClick={() => setModal(null)} />
      </header>

      <div className="connections-tabs" role="tablist" aria-label="Profile connections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "following"}
          className={activeTab === "following" ? "active" : ""}
          onClick={() => setActiveTab("following")}
        >
          {followingCount.toLocaleString()} Following
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "followers"}
          className={activeTab === "followers" ? "active" : ""}
          onClick={() => setActiveTab("followers")}
        >
          {followerCount.toLocaleString()} Followers
        </button>
      </div>

      <div className="subfollows-list" role="tabpanel">
        {loading === activeTab ? (
          <div className="connections-state" role="status">
            <LoaderCircle className="connections-spinner" size={24} />
            <span>Loading {activeTab}…</span>
          </div>
        ) : loadError[activeTab] ? (
          <div className="connections-state error">
            <Users size={26} />
            <span>{loadError[activeTab]}</span>
            <button type="button" onClick={retry}>Try again</button>
          </div>
        ) : list.length === 0 ? (
          <div className="connections-state">
            <Users size={26} />
            <span>No {activeTab} to show.</span>
          </div>
        ) : (
          list.map((entry) => {
            const id = getUserId(entry);
            const entryProfile = profiles.get(id);
            const entryName = getDisplayName(entry, entryProfile, getHandleLabel(entry, id));
            const isFollowing = followOverrides[id] ?? following.has(id);
            const isSelf = id === our?.patp || id === pubkey;
            const isPending = pending.has(id);
            const followLabel = isFollowing
              ? "Following"
              : activeTab === "followers"
                ? "Follow back"
                : "Follow";

            return (
              <article className="subfollows-entry" key={id}>
                <button
                  type="button"
                  className="connection-person"
                  onClick={() => setModal(<UserModal user={entry} />)}
                  aria-label={`Open ${entryName}'s profile`}
                >
                  <Avatar user={entry} profile={entryProfile} size={42} picOnly noClick />
                  <span className="subfollows-entry-info">
                    <span className="subfollows-entry-name">{entryName}</span>
                    <span className="subfollows-entry-id mono">{getHandleLabel(entry, id)}</span>
                  </span>
                </button>
                {!isSelf && (
                  <button
                    type="button"
                    className={`connections-follow-chip${isFollowing ? " following" : " follow-back"}`}
                    onClick={() => toggleFollow(entry)}
                    disabled={isPending}
                    aria-pressed={isFollowing}
                  >
                    {isPending ? "…" : followLabel}
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function initialFollowingList(
  user: UserType,
  profile: UserProfile | undefined,
  following: Map<string, unknown>,
  ourPatp: string | undefined,
  pubkey: string,
) {
  const userId = getUserId(user);
  const isMe = userId === ourPatp || userId === pubkey;
  if (!isMe || following.size === 0) return profile?.following || [];

  return Array.from(following.keys()).flatMap((id) => {
    const parsed = stringToUser(id);
    return "ok" in parsed ? [parsed.ok] : [];
  });
}

function initialFollowerList(
  user: UserType,
  profile: UserProfile | undefined,
  followers: string[],
  ourPatp: string | undefined,
  pubkey: string,
) {
  const userId = getUserId(user);
  const isMe = userId === ourPatp || userId === pubkey;
  if (!isMe || followers.length === 0) return profile?.followers || [];

  return followers.flatMap((id) => {
    const parsed = stringToUser(id);
    return "ok" in parsed ? [parsed.ok] : [];
  });
}
