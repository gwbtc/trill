import { useEffect, useState } from "react";
import useLocalState from "@/state/state";
import Router from "./Router";
import "@/styles/styles.css";
import { ThemeProvider } from "@/styles/ThemeProvider";
import spinner from "@/assets/crowspinner.gif";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import NostrSignals from "@/components/NostrSignals";
const queryClient = new QueryClient();

// const isMobile = MOBILE_BROWSER_REGEX.test(navigator.userAgent);

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { init } = useLocalState((s) => ({
    init: s.init,
  }));
  useEffect(() => {
    init()
      .then(() => setLoading(false))
      // e.g. not logged in to the ship, or the ship is down
      .catch((e) => setError(`${e}`));
  }, []);
  if (error)
    return (
      <div className="global-center">
        <h3 style={{ textAlign: "center" }}>Couldn't connect to your Urbit</h3>
        <p style={{ textAlign: "center" }}>{error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  if (loading)
    return (
      <div className="global-center">
        <img id="global-spinner" src={spinner} alt="" />
        <h3 style={{ textAlign: "center" }}>Syncing with your Urbit...</h3>
      </div>
    );
  else
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {/* {isMobile ? <MobileUI /> : <DesktopUI />} */}
          <Router />
          <Toaster position="top-center" />
          <NostrSignals />
        </QueryClientProvider>
      </ThemeProvider>
    );
}

export default App;
