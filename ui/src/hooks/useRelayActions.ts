import { useState } from "react";
import toast from "react-hot-toast";
import useLocalState from "@/state/state";
import type { RelayStats } from "@/types/nostrill";
import { isValidRelayUrl } from "@/logic/relayDisplay";

export function useRelayActions() {
  const { api, relays } = useLocalState((s) => ({
    api: s.api,
    relays: s.relays,
  }));
  const [isAddingRelay, setIsAddingRelay] = useState(false);
  const [isDeletingRelay, setIsDeletingRelay] = useState(false);
  const [isSyncingRelays, setIsSyncingRelays] = useState(false);

  async function addRelay(url: string) {
    const trimmed = url.trim();
    if (!api || !trimmed) return false;
    if (!isValidRelayUrl(trimmed)) {
      toast.error("Relay URL must start with wss:// or ws://");
      return false;
    }

    setIsAddingRelay(true);
    try {
      const res = await api.addRelay(trimmed);
      if (res && "error" in res) {
        toast.error(res.error || "Failed to add relay");
        return false;
      }
      toast.success("Relay added");
      return true;
    } catch (_error) {
      toast.error("Failed to add relay");
      return false;
    } finally {
      setIsAddingRelay(false);
    }
  }

  async function deleteRelay(url: string) {
    if (!api) return false;

    setIsDeletingRelay(true);
    try {
      const res = await api.deleteRelayUrl(url);
      if (res && "error" in res) {
        toast.error(res.error || "Failed to remove relay");
        return false;
      }
      toast.success("Relay removed");
      return true;
    } catch (_error) {
      toast.error("Failed to remove relay");
      return false;
    } finally {
      setIsDeletingRelay(false);
    }
  }

  async function syncRelays(targets = Object.values(relays)) {
    const wids = targets
      .map((relay) => relay.wid)
      .filter((w): w is number => w != null);
    if (!api || wids.length === 0) return false;

    setIsSyncingRelays(true);
    try {
      const res = await api.syncRelays(wids);
      if (res && "error" in res) {
        toast.error(res.error || "Failed to sync");
        return false;
      }
      toast.success("Sync initiated");
      return true;
    } catch (_error) {
      toast.error("Failed to sync");
      return false;
    } finally {
      setIsSyncingRelays(false);
    }
  }

  return {
    addRelay,
    deleteRelay,
    syncRelays,
    isAddingRelay,
    isDeletingRelay,
    isSyncingRelays,
  };
}
