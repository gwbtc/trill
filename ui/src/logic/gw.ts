import type { GroundwireID, UrbitID, UserType } from "@/types/nostrill";
import type IO from "./requests/nostrill";
import { isValidPatp, patp2bigint } from "urbit-ob";

export async function getPatp(api: IO, gwid: string) {
  const patp = await api.scryPatp(gwid);
  return patp
}
export async function getGwid(api: IO, patp: string) {
  const gwid = await api.scryGwid(patp);
  return gwid
}
export async function getOurGwid(api: IO) {
  const patp = api.airlock!.our!;
  return await getGwid(api, patp);
}

export function getPoint(patp: string) {
  return patp2bigint(patp);
}

export function fallbackGwid(patp: string): GroundwireID {
  return {
    english: {
      nym: patp,
      abridged: patp,
      foreshortened: patp,
    },
    hanzi: {
      nym: "",
      abridged: "",
      foreshortened: "",
    },
  };
}

export function patpToFallbackUID(patp: string): UrbitID {
  return {
    patp,
    point: getPoint(patp),
    gwid: fallbackGwid(patp),
  };
}

export async function patpToUID(api: IO, patp: string) {
  try {
    const point = getPoint(patp);
    const gwid = await getGwid(api, patp)
    if ("error" in gwid) return gwid
    const uid: UrbitID = { patp, point, gwid: gwid.ok }
    return { ok: uid };
  } catch (e) {
    console.error(e)
    return { error: `${e}` }
  }
}
export function nymToGwid(nym: string): GroundwireID {
  const split = nym.split(".").filter(s => s);
  if (split.length !== 12) throw new Error("invalid gwid")
  const first = split[0];
  const second = split[1];
  const pen = split[split.length - 2];
  const last = split[split.length - 1];
  const idx = nym.indexOf(first);
  const prefix = nym.slice(0, idx);
  const foreshortened = `${prefix}${first}.${second}..${pen}.${last}`;
  const abridged = `${prefix}$}{first}...${last}`;
  return {
    english: { nym, abridged, foreshortened },
    hanzi: { nym: "", abridged: "", foreshortened: "" }
  }
}

export async function gwidToUID(api: IO, gwidFull: string) {
  try {
    const upatp = await getPatp(api, gwidFull);
    if ("error" in upatp) return upatp
    const patp = upatp.ok;
    const point = getPoint(patp);
    const gwid: GroundwireID = nymToGwid(gwidFull);
    const uid: UrbitID = { patp, point, gwid }
    return { ok: uid };
  } catch (e) {
    console.error(e)
    return { error: `${e}` }
  }
}

export function parseGwid(s: string) {
  const GWID_REGEX = /^(?:\.[a-z]+){12}$/;
  const GWID_SHORT = /^(?:\.[a-z]+){2}\.(?:\.[a-z]+){2}$/;
  const GWID_SHORTER = /^(?:\.[a-z]+)\..(?:\.[a-z]+)$/;
  // tweaked
  const GWIDT_REGEX = /^\.(?:\.[a-z]+){12}$/;
  const GWIDT_SHORT = /^\.(?:\.[a-z]+){2}\.(?:\.[a-z]+){2}$/;
  const GWIDT_SHORTER = /^\.(?:\.[a-z]+)\..(?:\.[a-z]+)$/;
  //
  const regex = GWIDT_REGEX;
  return !!s.match(regex);
}

export function isOur(api: IO, pubkey: string, user: UserType) {
  return "urbit" in user
    ? user.urbit.patp === api?.airlock.our
    : "nostr" in user
      ? pubkey === user.nostr
      : false;
}
