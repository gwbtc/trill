import "@/styles/Follows.css";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { useState } from "react";
import type { NostrFollowGraph, UrbitFollowGraph, UserKey, UserProfile, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import Avatar from "@/components/Avatar";
import { stringToUser } from "@/logic/nostrill";
import { abbreviateHex } from "@/logic/utils";
import {
  getDisplayName,
  getFollowerCount,
  getHandleLabel,
  getUserKind,
} from "@/logic/userDisplay";
import UserModal from "@/components/modals/UserModal";
import { UserPlus } from "lucide-react";
import type { UserTagged } from "@/logic/stateFact";

type FollowFilter = "all" | "urbit" | "nostr";

const FOLLOW_FILTERS: TabItem<FollowFilter>[] = [
  { key: "all", label: "All" },
  { key: "urbit", label: "Urbit" },
  { key: "nostr", label: "Nostr" },
];

export default function Follows() {
  const { following, followGraph, profiles, setModal } = useLocalState((s) => ({
    following: s.following,
    followGraph: s.followGraph,
    profiles: s.profiles,
    setModal: s.setModal,
  }));

  const [filter, setFilter] = useState<FollowFilter>("all");


  if (filter === "all") return(
    <></>
  )
  
  else return (
    <div id="screen-follows" className="follows-page trill-screen">
      <header className="follows-header trill-screen-header">
        <div className="follows-header-top">
          <div>
            <h1>Following</h1>
            <p>Ships and keys you follow across the network</p>
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
    {
    filter === "urbit" ?
    (<UrbitFollowsList following={following.urbit} followGraph={followGraph.urbit} />)
    :
    (<NostrFollowsList following={following.nostr}  followGraph={followGraph.nostr} />)
    }
    </div>

  );
}

function UrbitFollowsList({following, followGraph}: { following: Map<string, FC>, followGraph: UrbitFollowGraph[]}){
  const { profiles, setModal } = useLocalState((s) => ({
    following: s.following,
    followGraph: s.followGraph,
    profiles: s.profiles,
    setModal: s.setModal,
  }));
  return(<>
          {followGraph.map(ft => {
            const [uid, follows] = ft;
            const id = uid.patp;
            const user = {urbit: uid}
            return (
              <FollowEntry
                key={uid.point}
                feed={null}
                user={user}
                profile={profiles.get(id)}
                onOpen={() => setModal(<UserModal user={user} />)}
                kind="urbit"
              />
            );
            })
            }

    </>)
}
function NostrFollowsList({following, followGraph}: {following: Map<string, FC>, followGraph: NostrFollowGraph[]}){
  const { profiles, setModal } = useLocalState((s) => ({
    following: s.following,
    followGraph: s.followGraph,
    profiles: s.profiles,
    setModal: s.setModal,
  }));
  return(<>
          {followGraph.map(ft => {
            const [k, v] = ft;
            const id = k.pubkey
            const user = {nostr: id}
            return (
              <FollowEntry
                key={k.pubkey}
                feed={null}
                user={user}
                profile={profiles.get(id)}
                onOpen={() => setModal(<UserModal user={user} />)}
                kind="nostr"
              />
            );
            })
            }

    </>)
}
function FollowsList({following, followGraph}: {following: Map<string, FC>, followGraph: NostrFollowGraph[]}){
const count = followGraph.length + following.size;
const followList = Array.from(following.entries());
  return count === 0? (
        <div className="follows-empty">
          <UserPlus size={48} />
          <h3>No follows yet</h3>
          <p>Start following users to see them here</p>
        </div>
      ) : (
      <div>
          <div className="follows-count">
            <span className="count-number">{following.size}</span>
            <span className="count-label">following</span>
          </div>
        <div id="follows-grid" className="follows-grid">
          {Array.from(followList).map(([id, f]) => {
            const user = stringToUser(id);
            if ("error" in user) return null
            console.log({user})
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
    
  
}
function FollowEntry({
  feed,
  profile,
  user,
  onOpen,
  kind 
}: {
  feed: FC | null;
  user: UserType;
  profile: UserProfile | undefined;
  onOpen: () => void;
  kind: UserKey;
}) {
  const displayName = getDisplayName(user, profile);
  const postCount = feed ? Object.keys(feed.feed).length : null;

  return (
    <div className="follow-card" role="link" onClick={onOpen}>
      <div className="follow-card-header">
        <Avatar user={user} picOnly={true} size={56} profile={profile} />
        <div className="follow-card-info">
          <h3 className="follow-card-name">{displayName}</h3>
          <p className="follow-card-id">{getHandleLabel(user)}</p>
        </div>
        <span className={`follow-kind-badge ${kind}`}>{kind}</span>
      </div>

      {profile?.about && <p className="follow-card-about">{profile.about}</p>}

      <div className="follow-card-stats">
        <div className="stat-item">
          <span className="stat-value">{postCount}</span>
          {postCount && (
            <span className="stat-label">
              {postCount === 1 ? "post" : "posts"}
            </span>
          )}
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
