import type { UserProfile, UserType } from "@/types/nostrill";
import { abbreviateHex } from "./utils";

export function getUserId(user: UserType) {
  return "urbit" in user ? user.urbit.patp : user.nostr;
}

export function getUserKind(user: UserType): "urbit" | "nostr" {
  return "urbit" in user ? "urbit" : "nostr";
}

export function getDisplayName(
  user: UserType,
  profile: UserProfile | undefined,
  fallback?: string,
) {
  if (profile?.name) return profile.name;
  if (fallback) return fallback;
  return "urbit" in user ? user.urbit.patp.length > 28 ? user.urbit.gwid.english.foreshortened :
    user.urbit.patp
    : "Anon";
}

export function getHandleLabel(user: UserType, fallback?: string) {
  if ("urbit" in user) return user.urbit.gwid.english.foreshortened || fallback || user.urbit.patp;
  const id = user.nostr;
  return fallback || (id.length > 20 ? abbreviateHex(id) : id);
}

export function getProfileBanner(profile: UserProfile | undefined) {
  return profile?.other?.banner || profile?.other?.Banner || "";
}

export function getCustomProfileFields(profile: UserProfile | undefined) {
  return profile?.other
    ? Object.entries(profile.other).filter(([key]) => key.toLowerCase() !== "banner")
    : [];
}

export function getFollowingCount(profile: UserProfile | undefined) {
  return profile?.followingCount ?? profile?.following?.length ?? 0;
}

export function getFollowerCount(profile: UserProfile | undefined) {
  return profile?.followerCount ?? profile?.followers?.length ?? 0;
}
