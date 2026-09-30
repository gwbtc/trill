// the Cashu ecash wallet, kept by %trill-wallet (backend/app/trill-wallet.hoon):
// what its /x/wallet scry and /ui facts carry, parsed, and helpers for the
// wallet screens. amounts are sats; times unix seconds

export type WalletMint = { url: string; balance: number; proofs: number; keysets: number };

export type WalletOpKind =
  | "add-mint"
  | "deposit"
  | "receive"
  | "send"
  | "withdraw"
  | "check"
  | "restore"
  | "zap";

// an operation in flight: which fields it has depends on its kind
export type WalletOp = {
  id: number;
  kind: WalletOpKind;
  mint: string;
  amount: number | null;
  step: string | null;
  invoice: string | null; // a deposit's to pay, or a withdrawal's being paid
  to: string | null; // a nutzap's recipient
};

export type WalletEntryKind =
  | "deposit"
  | "withdraw"
  | "send"
  | "receive"
  | "zap-in"
  | "zap-out"
  | "ln-in" // over the NWC Lightning wallet
  | "ln-out";
export type WalletEntry = {
  at: number;
  kind: WalletEntryKind;
  mint: string;
  amount: number;
  fee: number;
  who: string | null; // a nutzap's other side, a hex pubkey
};

// a Lightning wallet over Nostr Wallet Connect (NIP-47): what the agent
// shows of it (never its secret)
export type WalletLightning = {
  link: "connecting" | "open" | "down";
  balance: number | null; // sats
  relay: string;
  service: string;
  lud16: string | null;
  methods: string[]; // what it says it does; [] until it's said
  nip04Only: boolean;
  paying: number; // payments with no answer yet
  invoices: { hash: string; invoice: string; amount: number; expires: number }[];
};

export type SentToken = { at: number; mint: string; amount: number; token: string };
export type WalletNote = { at: number; what: string };

export type WalletState = {
  balance: number;
  mints: WalletMint[];
  ops: WalletOp[];
  history: WalletEntry[];
  sent: SentToken[];
  log: WalletNote[];
  sync: boolean; // mirrored to relays (NIP-60)
  lightning: WalletLightning | null;
  syncing: boolean;
};

const num = (x: unknown) => (typeof x === "number" ? x : 0);
const str = (x: unknown) => (typeof x === "string" ? x : "");
const optNum = (x: unknown) => (typeof x === "number" ? x : null);
const optStr = (x: unknown) => (typeof x === "string" && x ? x : null);
const list = (x: unknown): any[] => (Array.isArray(x) ? x : []);

export function parseWallet(x: any): WalletState | null {
  if (!x || typeof x !== "object" || !Array.isArray(x.mints)) return null;
  return {
    balance: num(x.balance),
    mints: list(x.mints)
      .map((m) => ({
        url: str(m.url),
        balance: num(m.balance),
        proofs: num(m.proofs),
        keysets: num(m.keysets),
      }))
      .sort((a, b) => b.balance - a.balance || a.url.localeCompare(b.url)),
    ops: list(x.ops)
      .map((o) => ({
        id: num(o.id),
        kind: str(o.kind) as WalletOpKind,
        mint: str(o.mint ?? o.url),
        amount: optNum(o.amount),
        step: optStr(o.step),
        invoice: optStr(o.invoice),
        to: optStr(o.to),
      }))
      .sort((a, b) => b.id - a.id),
    history: list(x.history).map((e) => ({
      at: num(e.at),
      kind: str(e.kind) as WalletEntryKind,
      mint: str(e.mint),
      amount: num(e.amount),
      fee: num(e.fee),
      who: optStr(e.who),
    })),
    sent: list(x.sent).map((s) => ({
      at: num(s.at),
      mint: str(s.mint),
      amount: num(s.amount),
      token: str(s.token),
    })),
    log: list(x.log).map((l) => ({ at: num(l.at), what: str(l.what) })),
    sync: x.nostr?.sync === true,
    lightning: parseLightning(x.lightning),
    syncing: x.nostr?.syncing === true,
  };
}

function parseLightning(l: any): WalletLightning | null {
  if (!l || typeof l !== "object") return null;
  return {
    link: l.link === "open" || l.link === "down" ? l.link : "connecting",
    balance: optNum(l.balance),
    relay: str(l.relay),
    service: str(l.service),
    lud16: optStr(l.lud16),
    methods: list(l.methods).filter((m): m is string => typeof m === "string"),
    nip04Only: l["nip04-only"] === true,
    paying: num(l.paying),
    invoices: list(l.invoices).map((i) => ({
      hash: str(i.hash),
      invoice: str(i.invoice),
      amount: num(i.amount),
      expires: num(i.expires),
    })),
  };
}

// whether the Lightning wallet will do this: it's said so, or not said yet
export function lightningCan(l: WalletLightning | null, method: string) {
  return !!l && !l.nip04Only && (l.methods.length === 0 || l.methods.includes(method));
}

// a mint as people know it: its host, and its path if it has one
export function mintName(url: string) {
  if (url === "lightning") return "Lightning wallet";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path ? `${u.host}${path}` : u.host;
  } catch {
    return url;
  }
}

export function sanitizeSats(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function mintUrlProblem(url: string): string | null {
  const u = url.trim();
  if (!/^https?:\/\/[^/\s]/.test(u)) return "A mint url starts with https://";
  if (/\s/.test(u)) return "A mint url can't contain spaces";
  return null;
}

// what a pasted string is: a Cashu token, or a Lightning invoice
export type PastedKind = "cashu" | "lightning";
export function classifyPasted(input: string): PastedKind | null {
  const v = stripScheme(input).toLowerCase();
  if (/^cashu[ab][a-z0-9_\-=+/]{20,}$/i.test(v)) return "cashu";
  if (/^ln(bc|tb|tbs|bcrt)[0-9a-z]{20,}$/.test(v)) return "lightning";
  return null;
}

export function stripScheme(input: string) {
  return input.trim().replace(/^(lightning:|cashu:(\/\/)?)/i, "");
}

// a BOLT11 invoice's amount in sats, from its human-readable part:
// ln<network><amount><multiplier>1... null when it names none (the mint
// needs one) or it isn't whole sats
export function invoiceSats(invoice: string): number | null {
  const v = stripScheme(invoice).toLowerCase();
  const m = /^ln(?:bcrt|bc|tbs|tb)(\d+)([munp]?)1[02-9ac-hj-np-z]+$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "m": return n * 100_000;
    case "u": return n * 100;
    case "n": return n % 10 === 0 ? n / 10 : null;
    case "p": return n % 10_000 === 0 ? n / 10_000 : null;
    default: return n * 100_000_000;
  }
}

export function getZapAmountError(amount: number, balance: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter at least 1 sat";
  if (amount > balance) return "More than your ecash balance";
  return null;
}

// a poke's refusal as a person reads it: the agent's own message (the
// quoted cord in its crash trace) where it gave one
export function walletError(e: string): string {
  const quoted = /'([^']{4,200})'/.exec(e);
  if (quoted) return quoted[1].replace(/\\'/g, "'");
  return "The wallet refused that";
}

export function relativeTime(at: number, now = Date.now() / 1000) {
  const s = Math.max(0, Math.round(now - at));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function shortKey(hex: string) {
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

// the backend's own words for the log, as-is: notes like "deposited 100
// sats at …" or "withdrawing failed: …"
export function isFailure(note: string) {
  return /fail|refus|lost|won't|isn't|no kind 10019|lack|said no|no answer|only speaks/i.test(note);
}
