import { useState } from "react";
import useLocalState from "@/state/state";
import toast from "react-hot-toast";
import type { FC } from "@/types/trill";
import type { Ship } from "@/types/urbit";
import type { UserProfile } from "@/types/nostrill";

interface AccessResult {
  feed: FC;
  profile?: UserProfile;
}

interface RequestAccessResult {
  requestAccess: (patp: Ship) => Promise<AccessResult | null>;
  isLoading: boolean;
  feed: FC | null;
  profile: UserProfile | null;
}

export function useRequestAccess(): RequestAccessResult {
  const [isLoading, setIsLoading] = useState(false);
  const [feed, setFeed] = useState<FC | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { api, addProfile } = useLocalState((s) => ({
    api: s.api,
    addProfile: s.addProfile,
  }));

  const requestAccess = async (patp: Ship): Promise<AccessResult | null> => {
    if (!api) return null;
    setIsLoading(true);
    try {
      const res = await api.peekFeed(patp);
      if ("error" in res) {
        toast.error(res.error);
        return null;
      }

      if (res.ok.data === "maybe") {
        const toastMsg = `${patp} will review your access request manually.`;
        const msg = res.ok.msg
          ? toastMsg + `\nThey added: ${res.ok.msg}.`
          : toastMsg;
        toast.success(msg, { duration: 5000 });
        return null;
      }

      if (!res.ok.data) {
        const toastMsg = `${patp} denied your access request.`;
        const msg = res.ok.msg
          ? toastMsg + `\nThey added: ${res.ok.msg}.`
          : toastMsg;
        toast.error(msg, { duration: 5000 });
        return null;
      }

      // Access granted
      const toastMsg = `${patp} granted your access request.`;
      const msg = res.ok.msg
        ? toastMsg + `\nThey added: ${res.ok.msg}.`
        : toastMsg;
      toast.success(msg);

      const grantedFeed = res.ok.data.feed;
      const grantedProfile = res.ok.data.profile;
      setFeed(grantedFeed);
      if (grantedProfile) {
        setProfile(grantedProfile);
        addProfile(patp, grantedProfile);
      }
      return { feed: grantedFeed, profile: grantedProfile ?? undefined };
    } catch (error) {
      toast.error(`Failed to request access from ${patp}`);
      console.error("Access request error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { requestAccess, isLoading, feed, profile };
}
