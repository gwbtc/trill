import {
  ArrowDown,
  ArrowUp,
  Coins,
  Copy,
  LoaderCircle,
  Settings as SettingsIcon,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "@/components/layout/PageHeader";
import WalletModal, { type WalletModalMode } from "@/components/modals/WalletModal";
import useLocalState from "@/state/state";
import {
  mintName,
  relativeTime,
  shortKey,
  walletError,
  type WalletEntry,
  type WalletOp,
} from "@/logic/wallet";
import { useWalletPrefs } from "@/logic/walletPrefs";
import "@/styles/Wallet.css";

export default function Wallet() {
  const { wallet, api, setModal } = useLocalState((s) => ({
    wallet: s.wallet,
    api: s.api,
    setModal: s.setModal,
  }));
  const prefs = useWalletPrefs();
  const [revealed, setRevealed] = useState(false);
  const hidden = prefs.hideBalance && !revealed;

  function open(mode: WalletModalMode, depositId?: number) {
    setModal(<WalletModal initialMode={mode} depositId={depositId} onClose={() => setModal(null)} />);
  }

  async function removeMint(url: string) {
    if (!api) return;
    const res = await api.walletAction({ "del-mint": { url } });
    if ("error" in res) toast.error(walletError(res.error));
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}`);
    }
  }

  if (!wallet) {
    return (
      <div id="screen-wallet" className="wallet-page trill-screen">
        <PageHeader title="Wallet" />
        <div className="wallet-page-content">
          <div className="wallet-list-empty">
            <LoaderCircle className="zap-spinner" size={18} /> Waiting for %trill-wallet…
          </div>
        </div>
      </div>
    );
  }

  const busy = new Set(wallet.ops.map((o) => o.mint));
  const ln = wallet.lightning;
  const lnSats = ln?.balance ?? 0;

  return (
    <div id="screen-wallet" className="wallet-page trill-screen">
      <PageHeader
        title="Wallet"
        right={
          <button
            type="button"
            className="wallet-page-settings wallet-icon-button"
            onClick={() => open("settings")}
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
            <div id="wallet-balance-title" className="wallet-balance-label">{ln ? "Total balance" : "Ecash balance"}</div>
            <button
              type="button"
              className={`wallet-total${hidden ? " hidden" : ""}${prefs.hideBalance ? " revealable" : ""}`}
              onClick={() => prefs.hideBalance && setRevealed((r) => !r)}
              aria-label={hidden ? "Reveal wallet balance" : "Wallet balance"}
            >
              <strong>{(wallet.balance + lnSats).toLocaleString()}</strong>
              <span>sats</span>
            </button>
            {ln && (
              <div className="wallet-balance-split">
                <div>
                  <Zap size={17} fill="currentColor" />
                  <span>
                    <small>Lightning{ln.link === "open" ? "" : ln.link === "down" ? " · offline" : " · connecting"}</small>
                    <strong className={`mono${hidden ? " hidden" : ""}`}>
                      {ln.balance === null ? "…" : ln.balance.toLocaleString()}
                    </strong>
                  </span>
                </div>
                <div>
                  <Coins size={17} />
                  <span>
                    <small>Cashu ecash</small>
                    <strong className={`mono${hidden ? " hidden" : ""}`}>{wallet.balance.toLocaleString()}</strong>
                  </span>
                </div>
              </div>
            )}
            <div className="wallet-balance-meta">
              {wallet.mints.length === 1 ? "1 mint" : `${wallet.mints.length} mints`}
              {" · "}
              {wallet.sync ? (wallet.syncing ? "ecash backing up to Nostr…" : "ecash backed up to Nostr") : "ecash not backed up to Nostr"}
              {ln && ln.paying > 0 ? " · a Lightning payment is out" : ""}
            </div>
          </div>
        </section>

        <div className="wallet-actions">
          <button type="button" className="primary" onClick={() => open("receive")}>
            <ArrowDown size={18} /> Receive
          </button>
          <button type="button" onClick={() => open("send")}>
            <ArrowUp size={18} /> Send
          </button>
        </div>

        {wallet.ops.length > 0 && (
          <section className="wallet-section" aria-labelledby="wallet-ops-title">
            <div className="wallet-section-heading activity-heading">
              <h2 id="wallet-ops-title">In progress</h2>
            </div>
            <div className="wallet-list">
              {wallet.ops.map((o) => (
                <OpRow key={o.id} op={o} onShowInvoice={() => open("receive", o.id)} />
              ))}
            </div>
          </section>
        )}

        <section className="wallet-section" aria-labelledby="cashu-mints-title">
          <div className="wallet-section-heading">
            <Coins size={18} />
            <h2 id="cashu-mints-title">Cashu mints</h2>
            <span>{wallet.mints.length}</span>
            <button type="button" onClick={() => open("addmint")}>
              <span aria-hidden="true">＋</span> Add mint
            </button>
          </div>
          <div className="wallet-list">
            {wallet.mints.length === 0 ? (
              <div className="wallet-list-empty">No mints yet. Add one to hold ecash.</div>
            ) : (
              wallet.mints.map((m) => {
                const canRemove = m.balance === 0 && !busy.has(m.url);
                return (
                  <div className="wallet-mint-row" key={m.url}>
                    <span className="wallet-mint-status online" />
                    <div className="wallet-mint-copy">
                      <strong>
                        {mintName(m.url)}
                        {prefs.defaultMint === m.url && <span className="wallet-default-badge">Default</span>}
                      </strong>
                      <span className="mono">{m.url}</span>
                    </div>
                    <strong className={`wallet-mint-balance mono${hidden ? " hidden" : ""}`}>
                      {m.balance.toLocaleString()} sats
                    </strong>
                    <button
                      type="button"
                      disabled={!canRemove}
                      title={canRemove ? "Remove mint" : "Only a mint you hold nothing at can be removed"}
                      onClick={() => removeMint(m.url)}
                      aria-label={`Remove ${mintName(m.url)}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {wallet.sent.length > 0 && (
          <section className="wallet-section" aria-labelledby="wallet-tokens-title">
            <div className="wallet-section-heading activity-heading">
              <h2 id="wallet-tokens-title">Tokens you made</h2>
            </div>
            <div className="wallet-list">
              {wallet.sent.slice(0, 5).map((t) => (
                <div className="wallet-activity-row" key={t.token}>
                  <span className="wallet-activity-icon mint">
                    <Coins size={18} />
                  </span>
                  <div className="wallet-activity-copy">
                    <strong className="mono">{t.token.slice(0, 22)}…</strong>
                    <span>{mintName(t.mint)} · {relativeTime(t.at)}</span>
                  </div>
                  <div className="wallet-activity-amount">
                    <strong className={`mono${hidden ? " hidden" : ""}`}>{t.amount.toLocaleString()} sats</strong>
                    <button type="button" className="wallet-inline-button" onClick={() => copy(t.token, "Token")}>
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="wallet-section" aria-labelledby="wallet-activity-title">
          <div className="wallet-section-heading activity-heading">
            <h2 id="wallet-activity-title">Activity</h2>
          </div>
          <div className="wallet-list">
            {wallet.history.length === 0 ? (
              <div className="wallet-list-empty">Nothing yet</div>
            ) : (
              wallet.history.map((e, i) => <EntryRow key={`${e.at}-${i}`} entry={e} hidden={hidden} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const OP_LABEL: Record<string, string> = {
  "add-mint": "Adding a mint",
  deposit: "Lightning deposit",
  receive: "Receiving a token",
  send: "Making a token",
  withdraw: "Paying an invoice",
  check: "Checking proofs",
  restore: "Restoring from your seed",
  zap: "Nutzapping",
};

function OpRow({ op, onShowInvoice }: { op: WalletOp; onShowInvoice: () => void }) {
  const waiting = op.kind === "deposit" && op.step === "waiting" && op.invoice;
  return (
    <div className="wallet-activity-row">
      <span className="wallet-activity-icon zap">
        <LoaderCircle className="zap-spinner" size={18} />
      </span>
      <div className="wallet-activity-copy">
        <strong>
          {OP_LABEL[op.kind] ?? op.kind}
          {op.kind === "zap" && op.to ? ` ${shortKey(op.to)}` : ""}
        </strong>
        <span>
          {op.mint ? mintName(op.mint) : "finding their mints"}
          {op.step ? ` · ${waiting ? "waiting for payment" : op.step}` : ""}
        </span>
      </div>
      <div className="wallet-activity-amount">
        {op.amount !== null && <strong className="mono">{op.amount.toLocaleString()} sats</strong>}
        {waiting && (
          <button type="button" className="wallet-inline-button" onClick={onShowInvoice}>
            Show invoice
          </button>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry: e, hidden }: { entry: WalletEntry; hidden: boolean }) {
  const incoming = e.kind === "deposit" || e.kind === "receive" || e.kind === "zap-in" || e.kind === "ln-in";
  const title =
    e.kind === "deposit"
      ? "Lightning deposit"
      : e.kind === "withdraw"
        ? "Paid an invoice"
        : e.kind === "send"
          ? "Made a token"
          : e.kind === "receive"
            ? "Received a token"
            : e.kind === "zap-in"
              ? `Nutzap from ${e.who ? shortKey(e.who) : "someone"}`
              : e.kind === "zap-out"
                ? `Nutzapped ${e.who ? shortKey(e.who) : "someone"}`
                : e.kind === "ln-in"
                  ? "Received over Lightning"
                  : "Paid over Lightning";
  const icon =
    e.kind === "zap-in" || e.kind === "zap-out" || e.kind === "withdraw" || e.kind.startsWith("ln") ? (
      <Zap size={18} fill="currentColor" />
    ) : incoming ? (
      <ArrowDown size={18} />
    ) : (
      <ArrowUp size={18} />
    );
  const iconClass =
    e.kind.startsWith("zap") || e.kind.startsWith("ln") || e.kind === "withdraw" ? "zap" : incoming ? "in" : "out";
  return (
    <div className="wallet-activity-row">
      <span className={`wallet-activity-icon ${iconClass}`}>{icon}</span>
      <div className="wallet-activity-copy">
        <strong>{title}</strong>
        <span>{mintName(e.mint)} · {relativeTime(e.at)}</span>
      </div>
      <div className="wallet-activity-amount">
        <strong className={`mono${incoming ? " incoming" : ""}${hidden ? " hidden" : ""}`}>
          {incoming ? "+" : "−"}
          {e.amount.toLocaleString()} sats
        </strong>
        {e.fee > 0 && <span>fee {e.fee.toLocaleString()}</span>}
      </div>
    </div>
  );
}
