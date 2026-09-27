import "@/styles/Profile.css";
import type { UserProfile, UserType } from "@/types/nostrill";
import useLocalState from "@/state/state";
import Avatar from "../Avatar";
import ProfileEditor from "./Editor";
import { ProfValue } from "../modals/UserModal";
import ConnectionsModal, { type ConnectionTab } from "./ConnectionsModal";
import { getProfileGalaxy } from "@/logic/profile";
import { Copy, Orbit } from "lucide-react";
import { npubEncode } from "nostr-tools/nip19";
import toast from "react-hot-toast";
import { middleTruncate } from "@/logic/utils";

async function copyNpub(pubkey: string) {
  try {
    await navigator.clipboard.writeText(npubEncode(pubkey));
    toast.success("npub copied");
  } catch {
    toast.error("Couldn't copy the npub");
  }
}
import { getCustomProfileFields, getDisplayName, getFollowerCount, getFollowingCount, getProfileBanner } from "@/logic/userDisplay";

interface Props {
  user: UserType;
  userString: string;
  isMe: boolean;
  onSave?: () => void;
}

const Loader: React.FC<Props> = (props) => {
  const { profiles } = useLocalState((s) => ({
    profiles: s.profiles,
  }));
  const profile = profiles.get(props.userString);
  return <Profile profile={profile} {...props} />;
};
function Profile({
  user,
  userString,
  profile,
  isMe,
  onSave,
}: {
  user: UserType;
  userString: string;
  profile: UserProfile | undefined;
  isMe: boolean;
  onSave?: () => void;
}) {
  const { followers, following, setModal } = useLocalState((s) => ({
    followers: s.followers,
    following: s.following,
    setModal: s.setModal,
  }));
  const bannerImage = getProfileBanner(profile);
  const customFields = getCustomProfileFields(profile);
  const displayName = getDisplayName(user, profile, "");
  const followingCount = Math.max(getFollowingCount(profile), isMe ? following.size : 0);
  const followerCount = Math.max(getFollowerCount(profile), isMe ? followers.length : 0);
  const galaxy = getProfileGalaxy(user);

  function openEditor() {
    setModal(<ProfileEditor user={user} userString={userString} profile={profile} onSave={onSave} />);
  }

  function openConnections(initialTab: ConnectionTab) {
    setModal(
      <ConnectionsModal
        user={user}
        profile={profile}
        initialTab={initialTab}
      />,
    );
  }

  return (
    <div className="profile">
      {bannerImage ? (
        <div className="profile-banner image">
          <img src={bannerImage} alt="Profile banner" />
        </div>
      ) : (
        <div className="profile-banner generated" aria-hidden="true">
          <div />
        </div>
      )}

      <div className="profile-main">
        <div className="profile-avatar-row">
          <div className="profile-picture">
            <Avatar user={user} size={96} picOnly={true} profile={profile} />
          </div>
          {isMe && (
            <button className="profile-edit-button" onClick={openEditor}>
              Edit profile
            </button>
          )}
        </div>

        <div className="profile-info">
          <h2>{displayName}</h2>
          {"nostr" in user ? (
            // nostr users go by their npub, not the hex key in the url
            <button
              type="button"
              className="profile-handle profile-npub mono"
              title="Copy npub"
              onClick={() => copyNpub(user.nostr)}
            >
              {middleTruncate(npubEncode(user.nostr), 14, 8)}
              <Copy size={13} aria-hidden="true" />
            </button>
          ) : (
            <div className="profile-handle mono">{userString}</div>
          )}
          {profile?.about && <p className="profile-about">{profile.about}</p>}
          {galaxy && (
            <div className="profile-meta">
              <span>
                <Orbit size={15} strokeWidth={1.9} aria-hidden="true" />
                galaxy <span className="mono">{galaxy}</span>
              </span>
            </div>
          )}
          <div className="profile-stats">
            <button type="button" onClick={() => openConnections("following")}>
              <b>{followingCount.toLocaleString()}</b> Following
            </button>
            <button type="button" onClick={() => openConnections("followers")}>
              {/* a nostr user's followers aren't in their own data; the
                  list loads from a relay when opened */}
              {"nostr" in user && followerCount === 0 ? (
                "Followers"
              ) : (
                <>
                  <b>{followerCount.toLocaleString()}</b> Followers
                </>
              )}
            </button>
          </div>

          {customFields.length > 0 && (
            <div className="profile-custom-fields">
              <h4>Additional Info</h4>
              {customFields.map(([key, value], index) => (
                <div key={index} className="custom-field-view">
                  <span className="field-key">{key}:</span>
                  <ProfValue value={value} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Loader;
