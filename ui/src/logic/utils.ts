import type { Poast, PID, SortugRef } from "@/types/trill";
import { REF_REGEX } from "./constants";
import type { DM, DMRaw, DMRequest, DMRequests, DMs, PeekDMsRes } from "@/types/nostrill";

export function parseSortugLink(link: string): SortugRef {
  const s = link.replace("urbit://", "").split("/");
  const [type, ship, ...pat] = s;
  const path = `/${pat.join("/")}`;
  return { type, ship, path };
}

export function date_diff(date: number | Date, type: "short" | "long") {
  const now = new Date().getTime();
  const diff = now - new Date(date).getTime();
  if (type == "short") {
    return to_string(diff / 1000);
  } else {
    return to_string_long(diff / 1000);
  }
}

function to_string(s: number) {
  if (s < 60) {
    return "now";
  } else if (s < 3600) {
    return `${Math.ceil(s / 60)}m`;
  } else if (s < 86400) {
    return `${Math.ceil(s / 60 / 60)}h`;
  } else if (s < 2678400) {
    return `${Math.ceil(s / 60 / 60 / 24)}d`;
  } else if (s < 32140800) {
    return `${Math.ceil(s / 60 / 60 / 24 / 30)}mo`;
  } else {
    return `${Math.ceil(s / 60 / 60 / 24 / 30 / 12)}y`;
  }
}

function to_string_long(s: number) {
  if (s < 60) {
    return "right now";
  } else if (s < 3600) {
    return `${Math.ceil(s / 60)} minutes ago`;
  } else if (s < 86400) {
    return `${Math.ceil(s / 60 / 60)} hours ago`;
  } else if (s < 2678400) {
    return `${Math.ceil(s / 60 / 60 / 24)} days ago`;
  } else if (s < 32140800) {
    return `${Math.ceil(s / 60 / 60 / 24 / 30)} months ago`;
  } else {
    return `${Math.ceil(s / 60 / 60 / 24 / 30 / 12)} years ago`;
  }
}

export function repostData(p: Poast): PID | null {
  if (
    p.contents.length === 1 &&
    "ref" in p.contents[0] &&
    p.contents[0].ref.type === "trill"
  )
    return {
      id: p.contents[0].ref.path.slice(1),
      ship: p.contents[0].ref.ship,
    };
  else return null;
}
export function wait(ms: number) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, ms);
  });
}
export const isSortugLink = (s: string) => !!s.match(REF_REGEX);

export function auraToHex(s: string): string {
  if (s.startsWith("0x")) {
    let numbers = s.replace("0x", "").replace(".", "");
    while (numbers.length < 6) {
      numbers = "0" + numbers;
    }
    return "#" + numbers;
  } else if (s.startsWith("#")) return s;
  else {
    // console.log(s, "weird hex");
    return "black";
  }
}

export function displayCount(c: number): string {
  if (c <= 0) return "";
  if (c < 1_000) return `${c}`;
  if (c >= 1_000 && c < 1_000_000) return `${Math.round(c / 1_00) / 10}K`;
  if (c >= 1_000_000) return `${Math.round(c / 100_000) / 10}M`;
  else return "";
}
export function padString(s: string, size: number) {
  if (s.length >= size) return s;
  else return padString(`0${s}`, size);
}

export function abbreviateHex(hex: string): string {
  if (hex.length <= 11) return hex;
  return `${hex.slice(0, 4)}...${hex.slice(-4)}`;
}
export function abbreviatePatp(p: string): string {
  const isComet = p.match(/--/);
  if (!isComet) return p;
  const left = p.slice(0, 7);
  const right = p.slice(44, 50);
  return `${left}_${right}`;
}
// export function segmentPatp(p: string){
//   const p2 = p.replace("~", "");

// }

// vibed

export function seededColorPair(seed: string): {
  background: string;
  foreground: string;
} {
  // FNV-1a 32-bit hash
  let hash = 0x811c9dc5;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const h = (hash >>> 0) % 360;
  const s = 55 + ((hash >>> 8) % 21); // 55–75
  const l = 35 + ((hash >>> 16) % 31); // 35–65

  const background = hslToHex(h, s, l);
  const foreground = getReadableTextColor(background);

  return { background, foreground };
}

function getReadableTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);

  // WCAG relative luminance
  const luminance = [r, g, b]
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);

  // Pick black or white depending on contrast
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const num = parseInt(clean, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
export function getThreadPath(post: Poast): string {
  if (post.event) return `/t/n/${post.event.id}`;
  else return `/t/u/${post.host}/${post.id}`;
}

export function fixDMs(dms: PeekDMsRes): DMs {
  const ret: DMs  = {};
  const entries = Object.entries(dms);

  for (const [key, dm] of entries) {
    const cooked = parseBigint(dm);
    ret[key] = cooked;
  }
  return ret
}

export function fixDMRequests(requests: DMRequests): DMRequests {
  const ret: DMRequests = {};
  Object.entries(requests).forEach(([key, request]) => {
    ret[key] = parseDMRequest(request);
  });
  return ret;
}

export function parseDMRequest(request: DMRequest): DMRequest {
  return {
    ...request,
    peer: {
      ...request.peer,
      point:
        typeof request.peer.point === "bigint"
          ? request.peer.point
          : BigInt(request.peer.point),
    },
  };
}

export function parseBigint(dm: DMRaw): DM {
  const point = BigInt(dm.peer.point)
  const peer = { ...dm.peer, point };
  const lastId = dm.lastId  === null ? dm.lastId: BigInt(dm.lastId)
  const lastRead = dm.lastRead  === null ? dm.lastRead : BigInt(dm.lastRead);
  return { ...dm, peer, lastId, lastRead, delivery: dm.delivery || {} };
}

// the text of a link: a bare url is cut to `max` characters with an
// ellipsis, since long ones only take up space (the href keeps it whole).
// other link text is left alone
export function linkLabel(show: string, max = 30): string {
  const s = show.trim();
  if (!/^(https?:\/\/|www\.)/i.test(s) || s.length <= max) return show;
  return `${s.slice(0, max)}…`;
}

// only http(s) urls from remote content (posts, profiles, DMs) may become
// hrefs; javascript:, data: etc. are dropped
export function safeHref(url: string): string | undefined {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// "npub1abcdefgh…stuvwxyz": keeps both ends of a long identifier
export function middleTruncate(s: string, head: number, tail: number): string {
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}
