import type {
  Content,
  Notification,
  ID,
  ExternalContent,
  Poast,
  Reference,
  Inline,
  PID,
  SortugRef,
} from "@/types/trill";
import type { Ship } from "@/types/urbit";
import anyAscii from "any-ascii";
import type { ReactGrouping, SPID } from "@/types/ui";
import { defaultPerms, openLock } from "./bunts";
import { isValidPatp, patp2dec } from "urbit-ob";
import { REF_REGEX } from "./constants";
import type { DM, DMRaw, DMRequest, DMRequests, DMs, PeekDMsRes, UserType } from "@/types/nostrill";
import { patpToFallbackUID } from "./gw";

export function parseSortugLink(link: string): SortugRef {
  const s = link.replace("urbit://", "").split("/");
  const [type, ship, ...pat] = s;
  const path = `/${pat.join("/")}`;
  return { type, ship, path };
}
export function sortugRefTolink(r: SortugRef): string {
  return `urbit://${r.type}/${r.ship}${r.path}`;
}
// TODO

export function createReference(ship: Ship, id: ID) {
  return {
    reference: {
      feed: { id: id, ship: ship },
    },
  };
}

export function addScheme(url: string) {
  if (url.includes("localhost")) {
    return `http://${url.replace("http://", "")}`;
  } else {
    return `https://${url.replace("http://", "")}`;
  }
}

export function easyCode(code: string) {
  const string = code.replace(/-/g, "");
  const matches = string.match(/.{1,6}/g);
  if (matches) return matches.join("-");
}

export function tilde(patp: Ship) {
  if (patp[0] == "~") {
    return patp;
  } else {
    return "~" + patp;
  }
}

export function color_to_hex(color: string) {
  let hex = "#" + color.replace(".", "").replace("0x", "").toUpperCase();
  if (hex == "#0") {
    hex = "#000000";
  }
  return hex;
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

export function regexes() {
  const IMAGE_REGEX = new RegExp(/(jpg|img|png|gif|tiff|jpeg|webp|webm|svg)$/i);
  const AUDIO_REGEX = new RegExp(/(mp3|wav|ogg)$/i);
  const VIDEO_REGEX = new RegExp(/(mov|mp4|ogv)$/i);
  return { img: IMAGE_REGEX, aud: AUDIO_REGEX, vid: VIDEO_REGEX };
}

export function stringToSymbol(str: string) {
  const ascii = anyAscii(str);
  let result = "";
  for (let i = 0; i < ascii.length; i++) {
    const n = ascii.charCodeAt(i);
    if ((n >= 97 && n <= 122) || (n >= 48 && n <= 57)) {
      result += ascii[i];
    } else if (n >= 65 && n <= 90) {
      result += String.fromCharCode(n + 32);
    } else {
      result += "-";
    }
  }
  result = result.replace(/^[\-\d]+|\-+/g, "-");
  result = result.replace(/^\-+|\-+$/g, "");
  return result;
}
export function buildDM(author: Ship, recipient: Ship, contents: Content[]) {
  const node: any = {};
  const point = patp2dec(recipient);
  const index = `/${point}/${makeIndex()}`;
  node[index] = {
    children: null,
    post: {
      author: author,
      contents: contents,
      hash: null,
      index: index,
      signatures: [],
      "time-sent": Date.now(),
    },
  };
  return {
    app: "dm-hook",
    mark: "graph-update-3",
    json: {
      "add-nodes": {
        resource: { name: "dm-inbox", ship: author },
        nodes: node,
      },
    },
  };
}

export function makeIndex(): string {
  const DA_UNIX_EPOCH = BigInt("170141184475152167957503069145530368000");
  const DA_SECOND = BigInt("18446744073709551616");
  const timeSinceEpoch = (BigInt(Date.now()) * DA_SECOND) / BigInt(1000);
  return (DA_UNIX_EPOCH + timeSinceEpoch).toString();
}
export function makeDottedIndex() {
  const DA_UNIX_EPOCH = BigInt("170141184475152167957503069145530368000");
  const DA_SECOND = BigInt("18446744073709551616");
  const timeSinceEpoch = (BigInt(Date.now()) * DA_SECOND) / BigInt(1000);
  const index = (DA_UNIX_EPOCH + timeSinceEpoch).toString();
  return index.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

export function getNotificationTime(n: Notification): number {
  if ("follow" in n) {
    return n.follow.time;
  } else if ("unfollow" in n) {
    return n.unfollow.time;
  } else if ("mention" in n) {
    return n.mention.time;
  } else if ("react" in n) {
    return n.react.time;
  } else if ("reply" in n) {
    return n.reply.time;
  } else if ("quote" in n) {
    return n.quote.time;
  } else if ("share" in n) {
    return n.share.time;
  } else {
    return Date.now();
  }
}
export function abbreviateChat(s: string): string {
  const plist = s.trim().split(" ");
  if (isValidPatp(plist[0]) && plist.length > 1) {
    return `${plist[0]} & ${plist.length - 1}+`;
  } else if (s.length < 25) return s;
  else return `${s.substring(0, 25)}...`;
}

export function timestring(n: number): string {
  const nn = new Date(n);
  return nn.toTimeString().slice(0, 5);
}
export function wait(ms: number) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, ms);
  });
}

// export function quoteToReference(d: SPID): Reference | ExternalContent {
//   if (d.service === "twatter")
//     return {
//       json: {
//         origin: "twatter",
//         content: JSON.stringify(d.post),
//       },
//     };
//   else
//     return {
//       ref: {
//         type: "trill",
//         ship: d.post.host,
//         path: `/${d.post.id}`,
//       },
//     };
// }

export function trillPermalink(t: Poast) {
  return `urbit://trill/${t.host}/${t.id}`;
}
export function isFeedRef(c: Content): boolean {
  return "ref" in c && (c as Reference).ref.type === "trill";
}

export function checkTilde(s: string) {
  if (s[0] === "~") return s;
  else return "~" + s;
}

export function addDots(s: string, num: number): string {
  const reversed = s.split("").reverse().join("");
  const reg = new RegExp(`.{${num}}`, "g");
  const withCommas = reversed.replace(reg, "$&.");
  return withCommas.split("").reverse().join("").slice(1);
}
export function addDots5(s: string): string {
  const reversed = s.split("").reverse().join("");
  const withCommas = reversed.replace(/.{5}/g, "$&.");
  return withCommas.split("").reverse().join("");
}
// TODO
export function getTrillText(c: Content): string {
  if (!c) return "";
  const reducePara = (acc: string, item: Inline) => {
    let t = "";
    if ("text" in item) t = item.text + " ";
    if ("italic" in item) t = item.italic + " ";
    if ("bold" in item) t = item.bold + " ";
    if ("strike" in item) t = item.strike + " ";
    if ("ship" in item) t = item.ship + " ";
    if ("codespan" in item) t = item.codespan + " ";
    if ("link" in item) t = item.link.href + " ";
    if ("break" in item) t = "\n";
    return acc + t;
  };
  return c.reduce((acc, item) => {
    if ("paragraph" in item) {
      const text = item.paragraph.reduce(reducePara, "");
      return acc + text + "\n";
    } else return acc;
  }, "");
}
export function isTwatterLink(s: string) {
  const sp = s
    .replace("https://", "")
    .split("/")
    .filter((s) => s);
  return sp.length === 4 && sp[0] === "twitter.com" && sp[2] === "status";
}
export const isSortugLink = (s: string) => !!s.match(REF_REGEX);
export function parseOutSortugLinks(s: string): [SortugRef[], string] {
  const matches = s.match(REF_REGEX);
  let refs = [];
  let rest = s;
  for (let m of matches || []) {
    rest = rest.replace(m, "");
    refs.push(parseSortugLink(m));
  }
  return [refs, rest];
}

export function isTrillLink(s: string): boolean {
  if (!isSortugLink(s)) return false;
  const r = parseSortugLink(s);
  if (r.type !== "trill") return false;
  return isValidPatp(r.ship) && !isNaN(Number(r.path.slice(1)));
}

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

export function buildPost(
  author: Ship,
  id: string,
  time: number,
  s: string,
  content: string,
): Poast {
  const authorFull = patpToFallbackUID(author);
  return {
    host: author,
    author: author,
    authorFull: { host: authorFull, author: authorFull },
    thread: null,
    parent: null,
    contents: [{ paragraph: [{ text: s }] }],
    perms: defaultPerms,
    hash: "",
    tags: [],
    id,
    time,
    children: [],
    engagement: { reacts: {}, quoted: [], shared: [] },
    json: { origin: "rumors", content },
  };
}

// default cursors
export function makeNewestIndex() {
  const DA_UNIX_EPOCH = BigInt("170141184475152167957503069145530368000");
  const DA_SECOND = BigInt("18446744073709551616");
  const timeSinceEpoch = (BigInt(Date.now()) * DA_SECOND) / BigInt(1000);
  return (DA_UNIX_EPOCH + timeSinceEpoch).toString();
}
export const startCursor = makeNewestIndex();
export const endCursor = "0";

export function displayCount(c: number): string {
  if (c <= 0) return "";
  if (c < 1_000) return `${c}`;
  if (c >= 1_000 && c < 1_000_000) return `${Math.round(c / 1_00) / 10}K`;
  if (c >= 1_000_000) return `${Math.round(c / 100_000) / 10}M`;
  else return "";
}
export function isWhiteish(hex: string): boolean {
  if (hex.indexOf("#") === 0) hex = hex.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r > 200 && g > 200 && b > 200;
}

export function localISOString(date: Date) {
  const offset = new Date().getTimezoneOffset();
  const localts = date.getTime() - offset * 60_000;
  return new Date(localts).toISOString().slice(0, 16);
}

export function goback() {
  window.history.back();
}

export function groupReacts(reacts: Record<Ship, string>): ReactGrouping {
  const byReact = Object.entries(reacts).reduce(
    (acc: Record<string, Ship[]>, item) => {
      const shipList = acc[item[1]];
      if (!shipList) acc[item[1]] = [item[0]];
      else acc[item[1]] = [...shipList, item[0]];
      return acc;
    },
    {},
  );
  return Object.entries(byReact)
    .reduce((acc: ReactGrouping, item) => {
      const pair = { react: item[0], ships: item[1] };
      return [...acc, pair];
    }, [])
    .sort((a, b) => b.ships.length - a.ships.length);
}

export function reverseRecord(
  a: Record<string, string>,
): Record<string, string> {
  return Object.entries(a).reduce((acc: Record<string, string>, [k, v]) => {
    acc[v] = k;
    return acc;
  }, {});
}

export function getColorHex(color: string): string {
  if (color.startsWith("0x"))
    return `#${padString(stripFuckingDots(color), 6)}`;
  else if (color.startsWith("#") && color.length === 7) return color;
  else if (color.length === 6) return `#${color}`;
  else {
    return "#FFFFFF";
  }
}

export function stripFuckingDots(hex: string) {
  return hex.replace("0x", "").replaceAll(".", "");
}
export function padString(s: string, size: number) {
  if (s.length >= size) return s;
  else return padString(`0${s}`, size);
}
export function isDark(hexColor: string): boolean {
  const r = parseInt(hexColor.substring(1, 2), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);

  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  const rSrgb =
    sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
  const gSrgb =
    sg <= 0.03928 ? sg / 12.92 : Math.pow((sg + 0.055) / 1.055, 2.4);
  const bSrgb =
    sb <= 0.03928 ? sb / 12.92 : Math.pow((sb + 0.055) / 1.055, 2.4);

  // Calculate luminance
  const luminance = 0.2126 * rSrgb + 0.7152 * gSrgb + 0.0722 * bSrgb;
  return luminance < 0.12;
}

export function checkIfClickedOutside(
  e: React.MouseEvent,
  el: HTMLElement,
  close: any,
) {
  e.stopPropagation();
  if (el.contains(e.currentTarget)) close();
}

export function abbreviateHex(hex: string): string {
  if (hex.length <= 11) return hex;
  return `${hex.slice(0, 4)}...${hex.slice(-4)}`;
}
export function abbreviateUser(user: UserType): string {
  if ("urbit" in user) return abbreviatePatp(user.urbit.patp);
  else return abbreviateHex(user.nostr);
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
