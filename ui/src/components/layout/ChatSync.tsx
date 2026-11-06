import { useEffect } from "react";
import useLocalState from "@/state/state";
import { useChatStore } from "@/state/chat";

// One set of watches for the shell, shared by the inbox, routes and badge.
// Chat failure is separate from the main application's startup state.
export default function ChatSync() {
  const api = useLocalState((state) => state.api);
  useEffect(() => {
    if (!api?.airlock.our) return;
    try {
      return useChatStore
        .getState()
        .connect(api.getTlonChat(), api.airlock.our);
    } catch (error) {
      useChatStore.setState({ status: "error", error: String(error) });
    }
  }, [api]);
  return null;
}
