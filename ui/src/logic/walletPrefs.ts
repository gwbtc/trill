import { create } from "zustand";

// per-browser wallet conveniences, kept in localStorage: whether amounts
// are blurred, and the mint deposits and sends start from. the wallet
// itself lives on the ship
type WalletPrefs = {
  hideBalance: boolean;
  defaultMint: string | null;
  setHideBalance: (hide: boolean) => void;
  setDefaultMint: (url: string | null) => void;
};

const KEY = "trill-wallet-prefs";

function load(): Pick<WalletPrefs, "hideBalance" | "defaultMint"> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      hideBalance: raw.hideBalance === true,
      defaultMint: typeof raw.defaultMint === "string" ? raw.defaultMint : null,
    };
  } catch {
    return { hideBalance: false, defaultMint: null };
  }
}

function save(p: Pick<WalletPrefs, "hideBalance" | "defaultMint">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // private window, storage off: it holds for this visit only
  }
}

export const useWalletPrefs = create<WalletPrefs>((set, get) => ({
  ...load(),
  setHideBalance: (hideBalance) => {
    set({ hideBalance });
    save({ hideBalance, defaultMint: get().defaultMint });
  },
  setDefaultMint: (defaultMint) => {
    set({ defaultMint });
    save({ hideBalance: get().hideBalance, defaultMint });
  },
}));

// the mint to start from: the default if we still have it, else the one
// holding the most
export function pickMint(mints: { url: string }[], preferred: string | null): string {
  if (preferred && mints.some((m) => m.url === preferred)) return preferred;
  return mints[0]?.url ?? "";
}
