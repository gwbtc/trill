import Urbit from "urbit-api";

export const URL = import.meta.env.PROD ? "" : "http://localhost:8080";
export const WS_URL = !import.meta.env.PROD
  ? "ws://localhost:8080"
  : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;


export async function start(): Promise<Urbit> {
  const airlock = new Urbit(URL, "");
  const res = await fetch(URL + "/~/host");
  const ship = await res.text();
  airlock.ship = ship.slice(1);
  airlock.our = ship;
  airlock.desk = "nostrill";
  await airlock.poke({ app: "hood", mark: "helm-hi", json: "opening airlock" });
  await airlock.eventSource();
  return airlock;
}
