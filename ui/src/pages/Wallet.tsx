import {
  ArrowDown,
  ArrowUp,
  Coins,
  ScanLine,
  Settings as SettingsIcon,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "@/components/layout/PageHeader";
import WalletModal, {
  type WalletModalMode,
} from "@/components/modals/WalletModal";
import useLocalState from "@/state/state";
import {
  getCashuBalance,
  getWalletTotal,
  INITIAL_WALLET_MINTS,
  LIGHTNING_BALANCE_SATS,
  type WalletMint,
} from "@/logic/wallet";
import "@/styles/Wallet.css";

type WalletActivity = {
  kind: "zap" | "in" | "out" | "mint";
  title: string;
  via: string;
  time: string;
  amount: string;
  status: string;
  incoming: boolean;
};

const WALLET_ACTIVITY: WalletActivity[] = [
  { kind: "zap", title: "Zap from ~litzod", via: "Lightning", time: "2m", amount: "+500", status: "received", incoming: true },
  { kind: "in", title: "Received", via: "Minibits mint", time: "1h", amount: "+8,420", status: "minted", incoming: true },
  { kind: "out", title: "Sent to pith", via: "Cashu token", time: "3h", amount: "-1,200", status: "spent", incoming: false },
  { kind: "zap", title: "Zapped a post", via: "Lightning", time: "5h", amount: "-100", status: "sent", incoming: false },
  { kind: "in", title: "Lightning deposit", via: "Coinos", time: "1d", amount: "+10,000", status: "settled", incoming: true },
];

const CURRENCY_FORMAT: Record<string, { symbol: string; satsRate: number }> = {
  USD: { symbol: "$", satsRate: 0.00062 },
  EUR: { symbol: "€", satsRate: 0.00057 },
  GBP: { symbol: "£", satsRate: 0.00049 },
  JPY: { symbol: "¥", satsRate: 0.092 },
};

export default function Wallet() {
  const setModal = useLocalState((state) => state.setModal);
  const [mints, setMints] = useState<WalletMint[]>(INITIAL_WALLET_MINTS);
  const [defaultMintId, setDefaultMintId] = useState("m1");
  const [hideBalance, setHideBalance] = useState(false);
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const cashuBalance = getCashuBalance(mints);
  const totalBalance = getWalletTotal(mints);
  const fiat = CURRENCY_FORMAT[currency] ?? CURRENCY_FORMAT.USD;
  const amountsHidden = hideBalance && !balanceRevealed;

  function changeHideBalance(hidden: boolean) {
    setHideBalance(hidden);
    setBalanceRevealed(false);
  }

  function changeMints(next: WalletMint[]) {
    setMints(next);
    if (!next.some((mint) => mint.id === defaultMintId)) {
      setDefaultMintId(next[0]?.id ?? "");
    }
  }

  function openWalletModal(mode: WalletModalMode) {
    setModal(
      <WalletModal
        initialMode={mode}
        mints={mints}
        defaultMintId={defaultMintId}
        hideBalance={hideBalance}
        currency={currency}
        onMintsChange={changeMints}
        onDefaultMintChange={setDefaultMintId}
        onHideBalanceChange={changeHideBalance}
        onCurrencyChange={setCurrency}
        onClose={() => setModal(null)}
      />,
    );
  }

  function removeMint(id: string) {
    changeMints(mints.filter((mint) => mint.id !== id));
  }

  function scanCode() {
    openWalletModal("send");
    toast("Camera unavailable — paste a code instead", { icon: "⌁" });
  }

  return (
    <div id="screen-wallet" className="wallet-page trill-screen">
      <PageHeader
        title="Wallet"
        right={
          <button
            type="button"
            className="wallet-page-settings wallet-icon-button"
            onClick={() => openWalletModal("settings")}
            aria-label="Wallet settings"
          >
            <SettingsIcon size={20} strokeWidth={1.9} />
          </button>
        }
      />

      <div className="wallet-page-content">
        <section className="wallet-balance-card" aria-labelledby="wallet-balance-title">
          <div className="wallet-balance-pattern" />
          <div className="wallet-balance-content">
            <div id="wallet-balance-title" className="wallet-balance-label">Total balance</div>
            <button
              type="button"
              className={`wallet-total${amountsHidden ? " hidden" : ""}${hideBalance ? " revealable" : ""}`}
              onClick={() => hideBalance && setBalanceRevealed((revealed) => !revealed)}
              aria-label={amountsHidden ? "Reveal wallet balance" : "Wallet balance"}
            >
              <strong>{totalBalance.toLocaleString()}</strong>
              <span>sats</span>
            </button>
            <div className={`wallet-fiat${amountsHidden ? " hidden" : ""}`}>
              ≈ {fiat.symbol}{(totalBalance * fiat.satsRate).toFixed(currency === "JPY" ? 0 : 2)}
            </div>
            <div className="wallet-balance-split">
              <div>
                <Zap size={17} fill="currentColor" />
                <span>
                  <small>Lightning</small>
                  <strong className={`mono${amountsHidden ? " hidden" : ""}`}>
                    {LIGHTNING_BALANCE_SATS.toLocaleString()}
                  </strong>
                </span>
              </div>
              <div>
                <Coins size={17} />
                <span>
                  <small>Cashu e-cash</small>
                  <strong className={`mono${amountsHidden ? " hidden" : ""}`}>
                    {cashuBalance.toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="wallet-actions">
          <button type="button" className="primary" onClick={() => openWalletModal("receive")}>
            <ArrowDown size={18} /> Receive
          </button>
          <button type="button" onClick={() => openWalletModal("send")}>
            <ArrowUp size={18} /> Send
          </button>
          <button type="button" className="scan" onClick={scanCode} aria-label="Scan or paste invoice">
            <ScanLine size={19} />
          </button>
        </div>

        <section className="wallet-section" aria-labelledby="cashu-mints-title">
          <div className="wallet-section-heading">
            <Coins size={18} />
            <h2 id="cashu-mints-title">Cashu mints</h2>
            <span>{mints.length} connected</span>
            <button type="button" onClick={() => openWalletModal("addmint")}>
              <span aria-hidden="true">＋</span> Add mint
            </button>
          </div>
          <div className="wallet-list">
            {mints.length === 0 ? (
              <div className="wallet-list-empty">No mints connected</div>
            ) : (
              mints.map((mint) => (
                <div className="wallet-mint-row" key={mint.id}>
                  <span className={`wallet-mint-status${mint.online ? " online" : ""}`} />
                  <div className="wallet-mint-copy">
                    <strong>{mint.name}</strong>
                    <span className="mono">{mint.url}</span>
                  </div>
                  <strong className="wallet-mint-balance mono">{mint.balance.toLocaleString()} sats</strong>
                  <button type="button" onClick={() => removeMint(mint.id)} aria-label={`Remove ${mint.name} mint`}>
                    <X size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="wallet-section" aria-labelledby="wallet-activity-title">
          <div className="wallet-section-heading activity-heading">
            <h2 id="wallet-activity-title">Activity</h2>
          </div>
          <div className="wallet-list">
            {WALLET_ACTIVITY.map((activity, index) => (
              <div className="wallet-activity-row" key={`${activity.title}-${index}`}>
                <span className={`wallet-activity-icon ${activity.kind}`}>
                  {activity.kind === "zap" ? (
                    <Zap size={18} fill="currentColor" />
                  ) : activity.kind === "out" ? (
                    <ArrowUp size={18} />
                  ) : activity.kind === "mint" ? (
                    <Coins size={18} />
                  ) : (
                    <ArrowDown size={18} />
                  )}
                </span>
                <div className="wallet-activity-copy">
                  <strong>{activity.title}</strong>
                  <span>{activity.via} · {activity.time}</span>
                </div>
                <div className="wallet-activity-amount">
                  <strong className={`mono${activity.incoming ? " incoming" : ""}`}>
                    {activity.amount} sats
                  </strong>
                  <span>{activity.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
