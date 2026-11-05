import "@/styles/Follows.css";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { useMemo, useState } from "react";
import type { UserProfile } from "@/types/nostrill";
import Avatar from "@/components/Avatar";
import { buildFollowEntries, type FollowEntryData } from "@/logic/follows";
import {
  getDisplayName,
  getFollowerCount,
  getHandleLabel,
  getUserKind,
} from "@/logic/userDisplay";
import UserModal from "@/components/modals/UserModal";
import { UserPlus } from "lucide-react";

type FollowFilter = "all" | "urbit" | "nostr";

const FOLLOW_FILTERS: TabItem<FollowFilter>[] = [
  { key: "all", label: "All" },
  { key: "urbit", label: "Urbit" },
  { key: "nostr", label: "Nostr" },
];

export default function Follows() {
  const { following, followGraph, profiles, setModal, stateLoaded, our, pubkey, followedUsers } =
    useLocalState((s) => ({
      following: s.following,
      followGraph: s.followGraph,
      profiles: s.profiles,
      setModal: s.setModal,
      stateLoaded: s.stateLoaded,
      our: s.api?.airlock.our,
      pubkey: s.pubkey,
      followedUsers: s.followedUsers,
    }));
  const [filter, setFilter] = useState<FollowFilter>("all");
  const entries = useMemo(
    () => buildFollowEntries(following, followGraph, [our ?? "", pubkey], followedUsers),
    [following, followGraph, our, pubkey, followedUsers],
  );
  const visible = filter === "all"
    ? [...entries.urbit, ...entries.nostr]
    : entries[filter];

  return (
    <div id="screen-follows" className="follows-page trill-screen">
      <header className="follows-header trill-screen-header">
        <div className="follows-header-top">
          <div>
            <h1>Following</h1>
            <p>Ships and keys you follow across the network</p>
          </div>
          {stateLoaded && (
            <div className="follows-count" aria-live="polite">
              <span className="count-number">{visible.length}</span>
              <span className="count-label">following</span>
            </div>
          )}
        </div>
        <TabStrip
          id="follows-filter"
          items={FOLLOW_FILTERS}
          active={filter}
          onChange={setFilter}
          className="follows-filter-row"
          buttonClassName="follows-filter-chip"
        />
      </header>

      {!stateLoaded ? (
        <div className="follows-empty" role="status">Loading follows...</div>
      ) : visible.length === 0 ? (
        <div className="follows-empty">
          <UserPlus size={48} aria-hidden="true" />
          <h3>{filter === "all" ? "No follows yet" : `No ${filter === "urbit" ? "Urbit" : "Nostr"} follows yet`}</h3>
          <p>Start following users to see them here</p>
        </div>
      ) : (
        <div id="follows-grid" className="follows-grid">
          {visible.map((entry) => (
            <FollowEntry
              key={`${getUserKind(entry.user)}/${entry.id}`}
              entry={entry}
              profile={profiles.get(entry.id)}
              onOpen={() => setModal(<UserModal user={entry.user} />)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowEntry({
  entry: { feed, user },
  profile,
  onOpen,
}: {
  entry: FollowEntryData;
  profile: UserProfile | undefined;
  onOpen: () => void;
}) {
  const displayName = getDisplayName(user, profile);
  const kind = getUserKind(user);
  const postCount = feed ? Object.keys(feed.feed).length : null;
  const followerCount = profile && profile.followersKnown !== false ? getFollowerCount(profile) : null;

  return (
    <div
      className="follow-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="follow-card-header">
        <Avatar user={user} picOnly size={56} profile={profile} noClick />
        <div className="follow-card-info">
          <h3 className="follow-card-name">{displayName}</h3>
          <p className="follow-card-id">{getHandleLabel(user)}</p>
        </div>
        <span className={`follow-kind-badge ${kind}`}>{kind}</span>
      </div>

      {profile?.about && <p className="follow-card-about">{profile.about}</p>}

      {(postCount !== null || followerCount !== null) && (
        <div className="follow-card-stats">
          {postCount !== null && (
            <div className="stat-item">
              <span className="stat-value">{postCount}</span>
              <span className="stat-label">{postCount === 1 ? "post" : "posts"}</span>
            </div>
          )}
          {followerCount !== null && (
            <div className="stat-item">
              <span className="stat-value">{followerCount}</span>
              <span className="stat-label">{followerCount === 1 ? "follower" : "followers"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
