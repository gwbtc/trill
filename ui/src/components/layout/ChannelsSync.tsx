import { useEffect } from "react";
import useLocalState from "@/state/state";
import { useChannelsStore } from "@/state/channels";
import { TlonChannelsClient } from "@/logic/tlon/channels";

export default function ChannelsSync() {
  const api = useLocalState((state) => state.api);
  useEffect(() => {
    if (!api?.airlock.our) return;
    useChannelsStore
      .getState()
      .connect(new TlonChannelsClient(api.airlock, api.airlock.our));
    return () => useChannelsStore.getState().disconnect();
  }, [api]);
  return null;
}
