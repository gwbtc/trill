export type WalletMint = {
  id: string;
  name: string;
  url: string;
  balance: number;
  online: boolean;
};

export const LIGHTNING_BALANCE_SATS = 12_500;

export const INITIAL_WALLET_MINTS: WalletMint[] = [
  {
    id: "m1",
    name: "Minibits",
    url: "https://mint.minibits.cash/Bitcoin",
    balance: 8_420,
    online: true,
  },
  {
    id: "m2",
    name: "Coinos",
    url: "https://mint.coinos.io",
    balance: 3_140,
    online: true,
  },
  {
    id: "m3",
    name: "Stablenut",
    url: "https://stablenut.umint.cash",
    balance: 0,
    online: false,
  },
];

export function sanitizeSats(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function getZapAmountError(amount: number, balance: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter at least 1 sat";
  if (amount > balance) return "Amount exceeds your Lightning balance";
  return null;
}

export function getCashuBalance(mints: WalletMint[]) {
  return mints.reduce((total, mint) => total + mint.balance, 0);
}

export function getWalletTotal(mints: WalletMint[]) {
  return LIGHTNING_BALANCE_SATS + getCashuBalance(mints);
}

export function classifyWalletInput(input: string) {
  const value = input.trim().toLowerCase();
  if (value.length <= 6) return null;
  return value.startsWith("cashu") ? "cashu" : "lightning";
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDecodedWalletAmount(input: string) {
  return (hashString(input) % 9_000) + 100;
}

export function buildDemoInvoice(amount: number) {
  const fingerprint = hashString(`inv${amount}`).toString(36);
  return `lnbc${amount}n1p3k8x7upp5${fingerprint}qdq5xysxxatsyp3k7enxv4jsxqzpuaqcqz`;
}
