import "@/styles/Follows.css";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { useState } from "react";
import type { UserProfile, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import Avatar from "@/components/Avatar";
import { stringToUser } from "@/logic/nostrill";
import { abbreviateHex } from "@/logic/utils";
import { getDisplayName, getFollowerCount, getHandleLabel, getUserKind } from "@/logic/userDisplay";
import UserModal from "@/components/modals/UserModal";
import { UserPlus } from "lucide-react";

type FollowFilter = "all" | "urbit" | "nostr";

const FOLLOW_FILTERS: TabItem<FollowFilter>[] = [
  { key: "all", label: "All" },
  { key: "urbit", label: "Urbit" },
  { key: "nostr", label: "Nostr" },
];

export default function Follows() {
  const { following, profiles, setModal } = useLocalState(
    (s) => ({
      following: s.following,
      profiles: s.profiles,
      setModal: s.setModal,
    }),
  );

  const [filter, setFilter] = useState<FollowFilter>("all");

  const followList = Array.from(following.entries()).filter(([id]) => {
    const user = stringToUser(id);
    if ("error" in user) return false;
    if (filter === "urbit") return "urbit" in user.ok;
    if (filter === "nostr") return "nostr" in user.ok;
    return true;
  });
  const hasFollows = followList.length > 0;

  return (
    <div id="screen-follows" className="follows-page trill-screen">
      <header className="follows-header trill-screen-header">
        <div className="follows-header-top">
          <div>
            <h1>Following</h1>
            <p>Ships and keys you follow across the network</p>
          </div>
          <div className="follows-count">
            <span className="count-number">{following.size}</span>
            <span className="count-label">following</span>
          </div>
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

      {!hasFollows ? (
        <div className="follows-empty">
          <UserPlus size={48} />
          <h3>No follows yet</h3>
          <p>Start following users to see them here</p>
        </div>
      ) : (
        <div id="follows-grid" className="follows-grid">
          {followList.map(([id, f]) => {
            const user = stringToUser(id);
            if ("error" in user) return null;
            return (
              <FollowEntry
                key={id}
                feed={f}
                id={id}
                user={user.ok}
                profile={profiles.get(id)}
                onOpen={() => setModal(<UserModal user={user.ok} />)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowEntry({
  feed,
  profile,
  id,
  user,
  onOpen,
}: {
  feed: FC;
  id: string;
  user: UserType;
  profile: UserProfile | undefined;
  onOpen: () => void;
}) {
  const displayName = getDisplayName(user, profile, abbreviateHex(id));
  const postCount = Object.keys(feed.feed).length;
  const kind = getUserKind(user);

  return (
    <div className="follow-card" role="link" onClick={onOpen}>
      <div className="follow-card-header">
        <Avatar user={user} picOnly={true} size={56} profile={profile} />
        <div className="follow-card-info">
          <h3 className="follow-card-name">{displayName}</h3>
          <p className="follow-card-id">{getHandleLabel(user, id)}</p>
        </div>
        <span className={`follow-kind-badge ${kind}`}>{kind}</span>
      </div>

      {profile?.about && <p className="follow-card-about">{profile.about}</p>}

      <div className="follow-card-stats">
        <div className="stat-item">
          <span className="stat-value">{postCount}</span>
          <span className="stat-label">{postCount === 1 ? "post" : "posts"}</span>
        </div>
        {profile && (
          <div className="stat-item">
            <span className="stat-value">{getFollowerCount(profile)}</span>
            <span className="stat-label">
              {getFollowerCount(profile) === 1 ? "follower" : "followers"}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
