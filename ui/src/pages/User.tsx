import Profile from "@/components/profile/Profile";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import useLocalState, { useStore } from "@/state/state";
import PageHeader from "@/components/layout/PageHeader";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { UrbitID, UserProfile, UserType } from "@/types/nostrill";
import type { FC } from "@/types/trill";
import { isValidPatp } from "urbit-ob";
import { ErrorPage } from "@/pages/Error";
import { useLocation, useParams } from "wouter";
import { decodeNostrKey } from "@/logic/nostr";
import TrillFeed, { Inner } from "@/components/trill/User";
import NostrFeed from "@/components/nostr/User";
import Post from "@/components/post/Post";
import { Images, Layers3, Link2, MessageCircle } from "lucide-react";
import { gwidToUID, isOur, parseGwid, patpToUID } from "@/logic/gw";
import {
  getProfileFeedPosts,
  getProfileMedia,
  getProfilePosts,
  getProfileReplies,
  getReplyTarget,
  type ProfileMediaItem,
} from "@/logic/profile";
import {
  getDisplayName,
  getHandleLabel,
} from "@/logic/userDisplay";
import { getThreadPath } from "@/logic/utils";

type ProfileTab = "posts" | "replies" | "media";

const PROFILE_TABS: TabItem<ProfileTab>[] = [
  { key: "posts", label: "Posts" },
  { key: "replies", label: "Replies" },
  { key: "media", label: "Media" },
];

function UserLoader() {
  const params = useParams();
  const userString = params.user;
  if (!userString) return <ErrorPage msg="no such user" />;
  
  const nostrKey = decodeNostrKey(userString);
  if (nostrKey)
    return <UserFeed user={{ nostr: nostrKey }} userString={userString} />;
  else return <UrbitUser userString={userString} />
}

function UrbitUser({ userString }: { userString: string }) {
  type DataType = { error: string } | { id: UrbitID } | null;
  const api = useLocalState(s => s.api);
  const [data, setData] = useState<DataType>(null);
  useEffect(() => {
    if (isValidPatp(userString))
      patpToUID(api!, userString).then(res => {
        if ("error" in res) setData({ error: "Error parsing @p" })
        else setData({ id: res.ok })
      })
    else if (parseGwid(userString))
      gwidToUID(api!, userString).then(res => {
        if ("error" in res) setData({ error: "Error parsing groundwire ID" })
        else setData({ id: res.ok })
      })
    else setData({error: "no such user"})
  }, [userString])
  if (!data)
    return <div className="spinner" />
  else if ("error" in data) return <ErrorPage msg={data.error} />
  else
    return (
      <UserFeed user={{ urbit: data.id }} userString={userString} />
    )
}
function UserFeed({
  user,
  userString,
}: {
  user: UserType;
  userString: string;
}) {
  const { api, pubkey, profiles } = useLocalState((s) => ({
    api: s.api,
    pubkey: s.pubkey,
    profiles: s.profiles,
  }));
  // auto updating on SSE doesn't work if we do shallow
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("posts");
  const { following, myFeed } = useStore();

  const isMe = isOur(api!, pubkey, user);
  const userId = "urbit" in user ? user.urbit.patp : user.nostr;
  const storedFeed = isMe ? myFeed : following.get(userId);
  const [resolvedFeed, setResolvedFeed] = useState<FC | undefined>(storedFeed);
  const profile = profiles.get(userId) || profiles.get(userString);
  const feedPosts = getProfileFeedPosts(resolvedFeed, userId);
  const rootPosts = getProfilePosts(resolvedFeed, userId);
  const title = getDisplayName(user, profile, getHandleLabel(user, userId));
  const onFeedChange = useCallback((nextFeed: FC) => setResolvedFeed(nextFeed), []);

  useEffect(() => {
    setResolvedFeed(storedFeed);
  }, [storedFeed, userId]);

  return (
    <div id="screen-profile" className="trill-screen">
      <PageHeader
        title={title}
        subtitle={`${feedPosts.length.toLocaleString()} ${feedPosts.length === 1 ? "post" : "posts"}`}
        back={!isMe}
      />
      <Profile user={user} userString={userId} isMe={isMe} />
      <TabStrip
        id="profile-tabs"
        items={PROFILE_TABS}
        active={profileTab}
        onChange={setProfileTab}
        className="profile-tabs trill-tabs"
        itemRole="tab"
      />
      <section className="profile-tab-panel" hidden={profileTab !== "posts"}>
        {isMe ? (
          rootPosts.length > 0 ? (
            <Inner feed={resolvedFeed!} refetch={() => {}} spine={false} />
          ) : (
            <ProfileEmptyState
              icon={<MessageCircle size={34} />}
              title="No posts yet"
              body="Posts you publish will appear here."
            />
          )
        ) : "urbit" in user ? (
          <TrillFeed
            patp={user.urbit.patp}
            feed={storedFeed}
            isFollowLoading={isFollowLoading}
            setIsFollowLoading={setIsFollowLoading}
            onFeedChange={onFeedChange}
          />
        ) : "nostr" in user ? (
          <NostrFeed
            pubkey={user.nostr}
            userString={userString}
            feed={storedFeed}
            isFollowLoading={isFollowLoading}
            setIsFollowLoading={setIsFollowLoading}
            isAccessLoading={isAccessLoading}
            setIsAccessLoading={setIsAccessLoading}
            onFeedChange={onFeedChange}
          />
        ) : null}
      </section>
      <section className="profile-tab-panel" hidden={profileTab !== "replies"}>
        <ProfileReplies feed={resolvedFeed} user={user} userId={userId} profile={profile} />
      </section>
      <section className="profile-tab-panel" hidden={profileTab !== "media"}>
        <ProfileMedia feed={resolvedFeed} userId={userId} />
      </section>
    </div>
  );
}

export default UserLoader;

function ProfileReplies({
  feed,
  user,
  userId,
  profile,
}: {
  feed: FC | undefined;
  user: UserType;
  userId: string;
  profile: UserProfile | undefined;
}) {
  const replies = getProfileReplies(feed, userId);
  if (replies.length === 0) {
    return (
      <ProfileEmptyState
        icon={<Link2 size={34} />}
        title="No replies yet"
        body="Replies from this profile will appear here."
      />
    );
  }

  return (
    <div className="profile-replies-list">
      {replies.map((reply) => (
        <div className="profile-reply-row" key={reply.hash || reply.id}>
          <div className="profile-reply-context">
            <Link2 size={14} aria-hidden="true" />
            Replying to <span className="mono">{formatReplyTarget(getReplyTarget(reply))}</span>
          </div>
          <Post
            poast={reply}
            user={user}
            profile={profile}
            spine={false}
          />
        </div>
      ))}
    </div>
  );
}

function ProfileMedia({ feed, userId }: { feed: FC | undefined; userId: string }) {
  const [, navigate] = useLocation();
  const media = getProfileMedia(feed, userId);
  if (media.length === 0) {
    return (
      <ProfileEmptyState
        icon={<Images size={34} />}
        title="No media yet"
        body="Images published by this profile will appear here."
      />
    );
  }

  return (
    <div id="profile-media-grid" className="trill-media-grid profile-media-grid">
      {media.map((item) => (
        <ProfileMediaTile
          key={item.id}
          item={item}
          onOpen={() => navigate(getThreadPath(item.post))}
        />
      ))}
    </div>
  );
}

function ProfileMediaTile({ item, onOpen }: { item: ProfileMediaItem; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className={`profile-media-tile${failed ? " failed" : ""}`}
      onClick={onOpen}
      aria-label={`Open post containing ${item.label}`}
    >
      {!failed && <img src={item.url} alt="" loading="lazy" onError={() => setFailed(true)} />}
      <span className="profile-media-label mono">{item.label}</span>
      {item.multi && (
        <span className="profile-media-multi" title="Multiple images">
          <Layers3 size={16} aria-hidden="true" />
          <span className="sr-only">Multiple images</span>
        </span>
      )}
    </button>
  );
}

function ProfileEmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="profile-tab-empty">
      <span className="profile-tab-empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function formatReplyTarget(target: string) {
  if (target.length <= 24) return target;
  return `${target.slice(0, 10)}…${target.slice(-6)}`;
}
