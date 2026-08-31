import {
  ArrowDown,
  ArrowUp,
  Coins,
  Copy,
  EyeOff,
  Plus,
  Settings,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  buildDemoInvoice,
  classifyWalletInput,
  getDecodedWalletAmount,
  sanitizeSats,
  type WalletMint,
} from "@/logic/wallet";
import "@/styles/Wallet.css";

export type WalletModalMode = "receive" | "send" | "addmint" | "settings";

type WalletModalProps = {
  initialMode: WalletModalMode;
  mints: WalletMint[];
  defaultMintId: string;
  hideBalance: boolean;
  currency: string;
  onMintsChange: (mints: WalletMint[]) => void;
  onDefaultMintChange: (id: string) => void;
  onHideBalanceChange: (hidden: boolean) => void;
  onCurrencyChange: (currency: string) => void;
  onClose: () => void;
};

const CURRENCIES = ["USD", "EUR", "GBP", "JPY"];
const QUICK_AMOUNTS = [
  { value: "1000", label: "1k" },
  { value: "5000", label: "5k" },
  { value: "21000", label: "21k" },
  { value: "100000", label: "100k" },
];

export default function WalletModal({
  initialMode,
  mints,
  defaultMintId,
  hideBalance,
  currency,
  onMintsChange,
  onDefaultMintChange,
  onHideBalanceChange,
  onCurrencyChange,
  onClose,
}: WalletModalProps) {
  const [mode, setMode] = useState<WalletModalMode>(initialMode);
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");
  const [mintUrl, setMintUrl] = useState("");
  const [localMints, setLocalMints] = useState(mints);
  const [localDefaultMintId, setLocalDefaultMintId] = useState(defaultMintId);
  const [localHideBalance, setLocalHideBalance] = useState(hideBalance);
  const [localCurrency, setLocalCurrency] = useState(currency);

  const paymentType = classifyWalletInput(paymentInput);
  const title =
    mode === "receive"
      ? "Receive"
      : mode === "send"
        ? "Send"
        : mode === "settings"
          ? "Wallet settings"
          : "Add Cashu mint";
  const HeaderIcon =
    mode === "receive"
      ? ArrowDown
      : mode === "send"
        ? ArrowUp
        : mode === "settings"
          ? Settings
          : Coins;

  function updateMints(next: WalletMint[]) {
    setLocalMints(next);
    onMintsChange(next);
  }

  function removeMint(id: string) {
    const next = localMints.filter((mint) => mint.id !== id);
    updateMints(next);
    if (localDefaultMintId === id) {
      const nextDefault = next[0]?.id ?? "";
      setLocalDefaultMintId(nextDefault);
      onDefaultMintChange(nextDefault);
    }
  }

  function setDefaultMint(id: string) {
    setLocalDefaultMintId(id);
    onDefaultMintChange(id);
  }

  function toggleHideBalance() {
    const next = !localHideBalance;
    setLocalHideBalance(next);
    onHideBalanceChange(next);
  }

  function cycleCurrency() {
    const index = CURRENCIES.indexOf(localCurrency);
    const next = CURRENCIES[(index + 1) % CURRENCIES.length];
    setLocalCurrency(next);
    onCurrencyChange(next);
  }

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoice);
      setInvoiceCopied(true);
    } catch {
      toast.error("Could not copy invoice");
    }
  }

  function submitPayment() {
    if (!paymentType) return;
    toast.success(
      paymentType === "cashu" ? "Cashu token redeemed" : "Invoice paid",
    );
    onClose();
  }

  function connectMint() {
    let url: URL;
    try {
      url = new URL(mintUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Unsupported mint URL");
      }
    } catch {
      toast.error("Enter a valid mint URL");
      return;
    }

    if (localMints.some((mint) => mint.url === url.toString())) {
      toast.error("That mint is already connected");
      return;
    }

    const hostLabel = url.hostname.split(".")[0] || "Cashu";
    const mint: WalletMint = {
      id: `mint-${Date.now()}`,
      name: hostLabel.charAt(0).toUpperCase() + hostLabel.slice(1),
      url: url.toString(),
      balance: 0,
      online: true,
    };
    const next = [...localMints, mint];
    updateMints(next);
    if (!localDefaultMintId) setDefaultMint(mint.id);
    toast.success("Mint connected");
    onClose();
  }

  return (
    <section
      id="wallet-modal"
      className={`wallet-modal${mode === "settings" ? " wallet-modal-wide" : ""}`}
      aria-labelledby="wallet-modal-title"
    >
      <header className="wallet-modal-header">
        <span className="wallet-modal-icon">
          <HeaderIcon size={18} strokeWidth={2} />
        </span>
        <h2 id="wallet-modal-title">{title}</h2>
        <button type="button" className="wallet-icon-button" onClick={onClose} aria-label="Close wallet dialog">
          <X size={19} />
        </button>
      </header>

      {mode === "receive" && (
        <div className="wallet-modal-body">
          <label className="wallet-field-label" htmlFor="wallet-receive-amount">
            Amount (sats)
          </label>
          <input
            id="wallet-receive-amount"
            className="wallet-input wallet-amount-input mono"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(event) => {
              setAmount(sanitizeSats(event.target.value));
              setInvoice("");
            }}
          />
          <div className="wallet-quick-amounts" aria-label="Quick amounts">
            {QUICK_AMOUNTS.map((quickAmount) => (
              <button
                type="button"
                key={quickAmount.value}
                onClick={() => {
                  setAmount(quickAmount.value);
                  setInvoice("");
                }}
              >
                {quickAmount.label}
              </button>
            ))}
          </div>
          {invoice ? (
            <div className="wallet-invoice-preview">
              <div className="wallet-qr-placeholder" aria-label="Invoice QR code preview" />
              <code className="mono">{invoice}</code>
              <button type="button" className="wallet-secondary-button" onClick={copyInvoice}>
                <Copy size={15} />
                {invoiceCopied ? "Copied!" : "Copy invoice"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="wallet-primary-button"
              disabled={!amount || Number(amount) <= 0}
              onClick={() => setInvoice(buildDemoInvoice(Number(amount)))}
            >
              Generate invoice
            </button>
          )}
        </div>
      )}

      {mode === "send" && (
        <div className="wallet-modal-body">
          <label className="wallet-field-label" htmlFor="wallet-payment-input">
            Invoice or Cashu token
          </label>
          <textarea
            id="wallet-payment-input"
            className="wallet-input wallet-payment-input mono"
            placeholder="lnbc… or cashuA…"
            value={paymentInput}
            onChange={(event) => setPaymentInput(event.target.value)}
          />
          {paymentType && (
            <div className="wallet-decoded-payment">
              <span className={paymentType === "cashu" ? "cashu" : "lightning"}>
                {paymentType === "cashu" ? <Coins size={18} /> : <Zap size={18} fill="currentColor" />}
              </span>
              <div>
                <div>{paymentType === "cashu" ? "Cashu token" : "Lightning invoice"}</div>
                <strong className="mono">{getDecodedWalletAmount(paymentInput).toLocaleString()} sats</strong>
              </div>
            </div>
          )}
          <button
            type="button"
            className="wallet-primary-button"
            disabled={!paymentType}
            onClick={submitPayment}
          >
            {paymentType === "cashu" ? "Redeem token" : "Pay invoice"}
          </button>
        </div>
      )}

      {mode === "addmint" && (
        <div className="wallet-modal-body">
          <label className="wallet-field-label" htmlFor="wallet-mint-url">
            Mint URL
          </label>
          <input
            id="wallet-mint-url"
            className="wallet-input mono"
            inputMode="url"
            placeholder="https://mint.example.com"
            value={mintUrl}
            onChange={(event) => setMintUrl(event.target.value)}
          />
          <p className="wallet-trust-note">
            A Cashu mint provides the liquidity backing your e-cash. Only connect mints you trust — they custody the sats backing your tokens.
          </p>
          <button
            type="button"
            className="wallet-primary-button"
            disabled={mintUrl.trim().length < 8}
            onClick={connectMint}
          >
            Connect mint
          </button>
        </div>
      )}

      {mode === "settings" && (
        <div className="wallet-settings-body">
          <div className="wallet-setting-row">
            <div>
              <strong>Hide balance</strong>
              <span>Blur amounts until tapped</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localHideBalance}
              aria-label="Hide balance"
              className={`wallet-switch${localHideBalance ? " active" : ""}`}
              onClick={toggleHideBalance}
            >
              <span />
            </button>
          </div>

          <section className="wallet-settings-section" aria-labelledby="wallet-mint-manager-title">
            <div className="wallet-settings-section-header">
              <h3 id="wallet-mint-manager-title">Cashu mints</h3>
              <span>{localMints.length}</span>
              <button type="button" onClick={() => setMode("addmint")}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="wallet-mint-manager">
              {localMints.length === 0 ? (
                <p className="wallet-empty-mints">No mints connected</p>
              ) : (
                localMints.map((mint) => {
                  const isDefault = mint.id === localDefaultMintId;
                  return (
                    <div key={mint.id} className={`wallet-mint-manage-row${isDefault ? " default" : ""}`}>
                      <button
                        type="button"
                        className="wallet-mint-star"
                        title={isDefault ? "Default mint" : "Set as default"}
                        aria-label={isDefault ? `${mint.name} is the default mint` : `Make ${mint.name} the default mint`}
                        onClick={() => setDefaultMint(mint.id)}
                      >
                        <Star size={17} fill={isDefault ? "currentColor" : "none"} />
                      </button>
                      <div className="wallet-mint-copy">
                        <div>
                          <strong>{mint.name}</strong>
                          {isDefault && <span className="wallet-default-badge">Default</span>}
                        </div>
                        <span className="mono">{mint.url}</span>
                      </div>
                      <span className="wallet-mint-balance mono">{mint.balance.toLocaleString()} sats</span>
                      <button
                        type="button"
                        className="wallet-mint-remove"
                        aria-label={`Remove ${mint.name} mint`}
                        onClick={() => removeMint(mint.id)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <div className="wallet-setting-row wallet-setting-divider">
            <div>
              <strong>Display currency</strong>
              <span>Fiat estimate on your balance</span>
            </div>
            <button type="button" className="wallet-currency-button mono" onClick={cycleCurrency}>
              {localCurrency}
            </button>
          </div>

          <div className="wallet-setting-row">
            <div>
              <strong>Recovery phrase</strong>
              <span>Back up access to your wallet</span>
            </div>
            <button
              type="button"
              className="wallet-recovery-button"
              onClick={() => toast("Recovery phrase hidden in this UI preview", { icon: <EyeOff size={16} /> })}
            >
              View phrase
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
