import { useCallback } from "react";
import useLocalState from "@/state/state";
import { userFromPost } from "@/logic/trill/helpers";
import type { Poast } from "@/types/trill";

// userFromPost, knowing who we are: our own nostr notes (e.g. global posts)
// show as our ship instead of our npub
export function usePostUser() {
  const { pubkey, our } = useLocalState((s) => ({ pubkey: s.pubkey, our: s.our }));
  return useCallback((poast: Poast) => userFromPost(poast, { pubkey, our }), [pubkey, our]);
}
