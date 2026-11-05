import useLocalState from "@/state/state";

// Our Nostr key represents us even when a view keeps the Nostr identity for
// protocol actions. Prefer our local profile over separately cached metadata.
export function usePostProfile(userId: string) {
  return useLocalState(s => {
    const ownShip = s.our?.patp ?? s.api?.airlock.our;
    if (userId === s.pubkey && ownShip) {
      return s.profiles.get(ownShip) ?? s.profiles.get(userId);
    }
    return s.profiles.get(userId);
  });
}
