import { useEffect } from "react";
import useLocalState from "@/state/state";
import { patpToFallbackUID } from "@/logic/gw";
import type IO from "@/logic/requests/nostrill";

// ships we've asked for a profile this session, and those waiting to be
// asked in the next batch (debaters are mostly ships we don't follow, so
// their profiles never arrive on their own)
const asked = new Set<string>();
let queued: string[] = [];

function ask(ship: string, api: IO) {
  if (asked.has(ship)) return;
  asked.add(ship);
  queued.push(ship);
  if (queued.length > 1) return;
  queueMicrotask(() => {
    const ships = queued;
    queued = [];
    void api.getProfiles(ships.map((s) => ({ urbit: patpToFallbackUID(s) })));
  });
}

// a ship by its profile name when we have one, else its @p
export default function ShipName({ ship }: { ship: string }) {
  const { name, known, api } = useLocalState((s) => ({
    name: s.profiles.get(ship)?.name,
    known: s.profiles.has(ship),
    api: s.api,
  }));
  useEffect(() => {
    if (api && !known) ask(ship, api);
  }, [ship, api, known]);
  return name ? (
    <span className="ship-name" title={ship}>
      {name}
    </span>
  ) : (
    <span className="mono">{ship}</span>
  );
}
