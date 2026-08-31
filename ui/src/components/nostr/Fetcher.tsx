import { NRelay1 } from "@nostrify/nostrify";
import useLocalState from "@/state/state";
import spinner from "@/assets/triangles.svg";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Wevent } from "@/types/nostr";
import { createCache } from "@/logic/cache";
import NostrThread from "./Thread";

const cache = createCache({ dbName: "nostrill", storeName: "nosted" });

export default function Thread({ id }: { id: string }) {
  const { api, relays, composerData, setComposerData, setModal, lastFact } =
    useLocalState((s) => ({
      api: s.api,
      relays: s.relays,
      nostrFeed: s.nostrFeed,
      lastFact: s.lastFact,
      composerData: s.composerData,
      setComposerData: s.setComposerData,
      setModal: s.setModal,
    }));
  const relayRef = useRef<NRelay1>(undefined);
  const [data, setData] = useState<Wevent>();
  useEffect(() => {
    const relayUrls = Object.keys(relays);
    // TODO iterate
    const relay = relayUrls[0];
    if (!relay) return;
    const r = new NRelay1(relay);
    relayRef.current = r;
    fetchThread();
  }, [relays]);

  const fetchThread = async () => {
    setIsLoading(true);
    // TODO
    if (!relayRef.current) return;
    const relay = relayRef.current;
    const req = relay.req([{ ids: [id] }]);
    for await (const msg of req) {
      if (msg[0] === "EVENT") {
        const event = msg[2];
        const wevent = { ...event, relays: [relay.socket.url] };
        setData(wevent);
      }
      if (msg[0] === "EOSE") {
        setIsLoading(false);
        break; //closes the subscription
      }
    }
  };
  const [isLoading, setIsLoading] = useState(false);

  // useEffect(() => {
  //   if (!lastFact) return;
  //   if (!("nostr" in lastFact)) return;
  //   if (!("thread" in lastFact.nostr)) return;
  //   const thread = lastFact.nostr.thread;
  //   console.log({ thread, id });
  //   // TODO
  //   // thread can be an empty array. relays are unreliable like that
  //   // nevent to hex conversion works well, that's not the issue
  //   // might want to track which relay is providing what nostr data in the UI too so we can juggle different ones

  //   // toast.success("thread fetched succesfully, rendering");
  //   // cache.set("evs", lastFact.nostr.thread);
  //   // const nodes = lastFact.nostr.thread.map(eventToFn);
  //   // const ff = eventsToFF(nodes);
  //   // setData(ff);
  // }, [lastFact]);

  if (data) return <NostrThread event={data} relays={data.relays ?? []} />;
  // else return <Loader {...props} />;
}
type LoaderProps = { id: string };
function Loader(props: LoaderProps) {
  const { id } = props;
  const { api, relays } = useLocalState((s) => ({
    api: s.api,
    nostrFeed: s.nostrFeed,
    lastFact: s.lastFact,
    composerData: s.composerData,
    setComposerData: s.setComposerData,
    setModal: s.setModal,
    relays: s.relays,
  }));
  const [error, setError] = useState("");

  async function tryAgain() {
    if (!api) return;
    const rels = Object.values(relays)
      .map((r) => r.wid)
      .filter((w): w is number => w != null);
    setError("");
    const res = await api.nostrThread(id, rels);
    if (res) toast.success("Sent request to relay");
  }

  return !error ? (
    <div className="text-center m-10 text-2xl">
      <h2>Error Loading Thread</h2>
      <p className="error">{error}</p>
      <button className="cycle-btn mx-auto my-8" onClick={tryAgain}>
        Try Again
      </button>
    </div>
  ) : (
    <>
      <h2 className="text-center my-8">Loading Thread...</h2>
      <div className="loading-container">
        <img className="x-center" src={spinner} alt="Loading" />
      </div>
      <button onClick={() => setError("timeout")}>Give Up </button>
    </>
  );
}
