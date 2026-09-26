import useLocalState from "@/state/state";
import { seededColorPair } from "@/logic/utils";
import GwIcon from "./GwIcon";
import Sigil from "./Sigil";
import { isValidPatp } from "urbit-ob";
import type { UrbitID, UserProfile, UserType } from "@/types/nostrill";
import Icon from "@/components/Icon";
import UserModal from "./modals/UserModal";

export default function({
  user,
  size,
  color,
  noClick,
  profile,
  picOnly = false,
  customClass,
}: {
  user: UserType;
  size: number;
  color?: string;
  noClick?: boolean;
  profile?: UserProfile;
  picOnly?: boolean;
  customClass?: string;
}) {
  const { setModal } = useLocalState((s) => ({ setModal: s.setModal }));
  // TODO revisit this when %whom updates
  const avatar = (
    <div className="avatar-pic cp" onClick={openModal}>
      <AvatarPic user={user} profile={profile} size={size} color={color}/>
    </div>
  );
  if (picOnly) return avatar;

  const tooLong = (s: string) => (s.length > 15 ? " too-long" : "");
  function openModal(e: React.MouseEvent) {
    if (noClick) return;
    e.stopPropagation();
    setModal(<UserModal user={user} />);
  }
  const name = (
    <div className="name cp" role="link" onClick={openModal}>
      {profile ? (
        <p>{profile.name}</p>
      ) : "urbit" in user ? (
        <p className={"p-only" + tooLong(user.urbit.gwid.english.foreshortened)}>
          {user.urbit.gwid.english.foreshortened}
        </p>
      ) : (
        <p className={"p-only" + tooLong(user.nostr)}>{user.nostr}</p>
      )}
    </div>
  );
  return (
    <div className={customClass ? customClass : "avatar"}>
      {avatar}
      {name}
    </div>
  );
}


export function UrbitAvatar({ uid, size, color }: { uid: UrbitID, size: number, color?: string }) {
  return <PatpAvatar patp={uid.patp} size={size} color={color} />
}



export function AvatarPic({ user, profile, size, color }: { profile?: UserProfile; user: UserType, size: number, color?: string }) {
    return (profile && profile.picture ? (
      <img src={profile.picture} width={size} height={size} />
    ) : "urbit" in user && isValidPatp(user.urbit.patp) ? (
      <UrbitAvatar uid={user.urbit} size={size} color={color} />
    ) : (
      <Icon name="comet" size={size} />
    )
  )
}
export function PatpAvatar({ patp , size, color }: { patp: string, size: number, color?: string }) {
  // TODO need to check for gw comets specifically not just any comet
  if (patp.length > 28) {
    const colors = seededColorPair(patp);
    return (
      <GwIcon size={size} fg={colors.foreground} bg={colors.background} />
    );
  }
  else return (
    <Sigil patp={patp} size={size} bg={color} />
  )
}
