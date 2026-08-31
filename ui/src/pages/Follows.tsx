import "@/styles/Follows.css";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState from "@/state/state";
import { useState } from "react";
import { useLocation } from "wouter";
import type { UserProfile, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import Avatar from "@/components/Avatar";
import { eventToProfile, stringToUser } from "@/logic/nostrill";
import { abbreviateHex } from "@/logic/utils";
import { patpToFallbackUID } from "@/logic/gw";
import {
  getDisplayName,
  getFollowerCount,
  getFollowingCount,
  getHandleLabel,
  getUserId,
  getUserKind,
} from "@/logic/userDisplay";
import { fetchFollowers, fetchFollows, fetchProfiles } from "@/logic/nostr";
import spinner from "@/assets/triangles.svg";
import UserModal from "@/components/modals/UserModal";
import { RefreshCw, UserPlus } from "lucide-react";
import { useRequestAccess } from "@/hooks/useRequestAccess";

type FollowFilter = "all" | "urbit" | "nostr";

const FOLLOW_FILTERS: TabItem<FollowFilter>[] = [
  { key: "all", label: "All" },
  { key: "urbit", label: "Urbit" },
  { key: "nostr", label: "Nostr" },
];

export default function Follows() {
  const { following, profiles, addProfile, relays, setModal } = useLocalState(
    (s) => ({
      following: s.following,
      profiles: s.profiles,
      addProfile: s.addProfile,
      relays: s.relays,
      setModal: s.setModal,
      api: s.api,
    }),
  );

  const [isLoading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FollowFilter>("all");

  const followList = Array.from(following.entries()).filter(([id]) => {
    const user = stringToUser(id);
    if ("error" in user) return false;
    if (filter === "urbit") return "urbit" in user.ok;
    if (filter === "nostr") return "nostr" in user.ok;
    return true;
  });
  const hasFollows = followList.length > 0;

  async function getFollowing(user: UserType) {
    setLoading(true);
    if ("nostr" in user) getNostrFollows(user.nostr);
    else getUrbitProfile(user.urbit.patp, "following");
  }
  async function getFollowers(user: UserType) {
    setLoading(true);
    if ("nostr" in user) getNostrFollowers(user.nostr);
    else getUrbitProfile(user.urbit.patp, "followers");
  }

  async function getProfiles(user: UserType[]) {
    //
    const { nostr, urbit } = user.reduce(
      (acc: { nostr: string[]; urbit: string[] }, item) => {
        if ("nostr" in item)
          return { ...acc, nostr: [...acc.nostr, item.nostr] };
        else return { ...acc, urbit: [...acc.urbit, item.urbit.patp] };
      },
      { nostr: [], urbit: [] },
    );
    const nres = await getNostrProfiles(nostr);
    // const ures = await getUrbitProfiles(urbit)
  }
  async function getNostrProfiles(list: string[]) {
    const relayList = Object.keys(relays);
    if (relayList.length === 0) return;
    const relay = relayList[0];
    const res = await fetchProfiles(relay, list);
    for await (const msg of res) {
      if (msg[0] === "EVENT") {
        const event = msg[2];
        const prof = eventToProfile(event);
        if (prof) addProfile(event.pubkey, prof);
      }
      if (msg[0] === "EOSE") {
        setLoading(false);
        break;
      }
    }
  }
  async function getNostrFollows(pubkey: string) {
    const relayList = Object.keys(relays);
    if (relayList.length === 0) return;
    const relay = relayList[0];

    const user = { nostr: pubkey };
    const res = await fetchFollows(relay, pubkey);
    setLoading(false);
    setModal(
      <FList
        user={user}
        userString={pubkey}
        type="following"
        list={res.map((s) => ({ nostr: s }))}
        getProfiles={getProfiles}
      />,
    );
  }

  async function getNostrFollowers(pubkey: string) {
    const user = { nostr: pubkey };
    const relayList = Object.keys(relays);
    if (relayList.length === 0) return;
    const relay = relayList[0];
    const res = await fetchFollowers(relay, pubkey);
    setLoading(false);
    setModal(
      <FList
        user={user}
        userString={pubkey}
        getProfiles={getProfiles}
        type="followers"
        list={res.map((s) => ({ nostr: s }))}
      />,
    );
  }
  const { requestAccess, isLoading: isPeeking } = useRequestAccess();
  async function getUrbitProfile(patp: string, type: Direction) {
    const urbitProfile = profiles.get(patp);
    if (urbitProfile) {
      setModal(
        <FList
          user={{ urbit: patpToFallbackUID(patp) }}
          userString={patp}
          type={type}
          list={
            type === "followers"
              ? urbitProfile.followers
              : urbitProfile.following
          }
          getProfiles={getProfiles}
        />,
      );
      setLoading(false);
    } else {
      const result = await requestAccess(patp);
      setLoading(false);
      if (!result || !result.profile) return;
      const urbitProfile = result.profile;
      if (result?.profile) {
        setModal(
          <FList
            user={{ urbit: patpToFallbackUID(patp) }}
            userString={patp}
            type={type}
            list={
              type === "followers"
                ? urbitProfile.followers
                : urbitProfile.following
            }
            getProfiles={getProfiles}
          />,
        );
      }
    }
  }

  async function syncProfile(user: UserType) {
    if ("urbit" in user) {
      const result = await requestAccess(user.urbit.patp);
    } else {
      //
    }
  }

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
          <span className="stat-label">posts</span>
        </div>
        {profile && (
          <div className="stat-item">
            <span className="stat-value">{getFollowerCount(profile)}</span>
            <span className="stat-label">followers</span>
          </div>
        )}
      </div>

    </div>
  );
}
type Direction = "followers" | "following";

function FList({
  user,
  userString,
  type,
  list,
  getProfiles,
}: {
  user: UserType;
  userString: string;
  type: Direction;
  list: UserType[];
  getProfiles: (users: UserType[]) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { profiles, setModal } = useLocalState((s) => ({
    profiles: s.profiles,
    setModal: s.setModal,
  }));
  const profile = profiles.get(userString);
  const name = getDisplayName(user, profile, getHandleLabel(user, userString));

  async function handleFetchProfiles() {
    setIsLoading(true);
    await getProfiles(list);
    setIsLoading(false);
  }

  function openUserModal(userType: UserType) {
    setModal(<UserModal user={userType} />);
  }

  return (
    <div id="connections-modal" className="subfollows-container">
      <header className="connections-header">
        <Avatar user={user} profile={profile} size={42} picOnly noClick />
        <div className="connections-title">
          <strong>{name}</strong>
          <span className="mono">{abbreviateHex(userString)}</span>
        </div>
        <ModalCloseButton onClick={() => setModal(null)} />
      </header>

      <div className="connections-tabs">
        <button className={type === "following" ? "active" : ""}>
          {type === "following" ? list.length : getFollowingCount(profile)} Following
        </button>
        <button className={type === "followers" ? "active" : ""}>
          {type === "followers" ? list.length : getFollowerCount(profile)} Followers
        </button>
      </div>

      <div className="connections-tools">
        <button
          className="subfollows-fetch-btn"
          onClick={handleFetchProfiles}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <img className="spinner-small" src={spinner} alt="" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Fetch profiles
            </>
          )}
        </button>
      </div>

      <div className="subfollows-list" id="follow-list">
        {list.map((user) => {
          const entryUserString = getUserId(user);
          const prof = profiles.get(entryUserString);
          const entryName = getDisplayName(user, prof, getHandleLabel(user, entryUserString));
          const idLabel = getHandleLabel(user, entryUserString);

          return (
            <div
              key={entryUserString}
              className="subfollows-entry"
              onClick={() => openUserModal(user)}
            >
              <Avatar
                picOnly={true}
                user={user}
                size={42}
                noClick={true}
                profile={prof}
              />
              <div className="subfollows-entry-info" title={entryUserString}>
                <span className="subfollows-entry-name">{entryName}</span>
                <span className="subfollows-entry-id mono">{idLabel}</span>
              </div>
              <button
                className="connections-follow-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal(null);
                  navigate(`/u/${entryUserString}`);
                }}
              >
                View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
