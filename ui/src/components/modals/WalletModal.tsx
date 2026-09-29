import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Coins,
  Copy,
  Eye,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import QrCode from "@/components/wallet/QrCode";
import useLocalState from "@/state/state";
import {
  classifyPasted,
  invoiceSats,
  mintName,
  mintUrlProblem,
  sanitizeSats,
  stripScheme,
  walletError,
  type WalletMint,
} from "@/logic/wallet";
import { pickMint, useWalletPrefs } from "@/logic/walletPrefs";
import "@/styles/Wallet.css";

export type WalletModalMode = "receive" | "send" | "addmint" | "settings";

type Props = {
  initialMode: WalletModalMode;
  depositId?: number; // an open deposit to show the invoice of
  onClose: () => void;
};

const QUICK_AMOUNTS = [
  { value: "21", label: "21" },
  { value: "100", label: "100" },
  { value: "1000", label: "1k" },
  { value: "5000", label: "5k" },
];

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`);
  }
}

export default function WalletModal({ initialMode, depositId, onClose }: Props) {
  const [mode, setMode] = useState<WalletModalMode>(initialMode);
  const wallet = useLocalState((s) => s.wallet);
  const title =
    mode === "receive" ? "Receive" : mode === "send" ? "Send" : mode === "settings" ? "Wallet settings" : "Add a Cashu mint";
  const HeaderIcon = mode === "receive" ? ArrowDown : mode === "send" ? ArrowUp : mode === "settings" ? Settings : Coins;
  const needsMint = (mode === "receive" || mode === "send") && wallet && wallet.mints.length === 0;

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
      {!wallet ? (
        <div className="wallet-modal-body">
          <p className="wallet-trust-note">%trill-wallet isn't answering.</p>
        </div>
      ) : needsMint ? (
        <div className="wallet-modal-body">
          <p className="wallet-trust-note">Ecash lives at a mint. Add one first.</p>
          <button type="button" className="wallet-primary-button" onClick={() => setMode("addmint")}>
            Add a mint
          </button>
        </div>
      ) : mode === "receive" ? (
        <Receive mints={wallet.mints} depositId={depositId} onClose={onClose} />
      ) : mode === "send" ? (
        <Send mints={wallet.mints} onClose={onClose} />
      ) : mode === "addmint" ? (
        <AddMint mints={wallet.mints} onDone={onClose} />
      ) : (
        <WalletSettings onAddMint={() => setMode("addmint")} />
      )}
    </section>
  );
}

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="wallet-tabs" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? "active" : ""} onClick={() => onChange(v)}>
          {v === "lightning" ? <Zap size={14} fill="currentColor" /> : <Coins size={14} />} {label}
        </button>
      ))}
    </div>
  );
}

function MintSelect({ mints, value, onChange, id }: { mints: WalletMint[]; value: string; onChange: (url: string) => void; id: string }) {
  return (
    <>
      <label className="wallet-field-label" htmlFor={id}>
        Mint
      </label>
      <select id={id} className="wallet-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {mints.map((m) => (
          <option key={m.url} value={m.url}>
            {mintName(m.url)} · {m.balance.toLocaleString()} sats
          </option>
        ))}
      </select>
    </>
  );
}

function AmountField({ id, amount, setAmount }: { id: string; amount: string; setAmount: (a: string) => void }) {
  return (
    <>
      <label className="wallet-field-label" htmlFor={id}>
        Amount (sats)
      </label>
      <input
        id={id}
        className="wallet-input wallet-amount-input mono"
        inputMode="numeric"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(sanitizeSats(e.target.value))}
      />
      <div className="wallet-quick-amounts" aria-label="Quick amounts">
        {QUICK_AMOUNTS.map((q) => (
          <button type="button" key={q.value} onClick={() => setAmount(q.value)}>
            {q.label}
          </button>
        ))}
      </div>
    </>
  );
}

//  receiving: a Lightning invoice to pay, or a token someone gave us
function Receive({ mints, depositId, onClose }: { mints: WalletMint[]; depositId?: number; onClose: () => void }) {
  const { api, wallet } = useLocalState((s) => ({ api: s.api, wallet: s.wallet }));
  const defaultMint = useWalletPrefs((s) => s.defaultMint);
  const [tab, setTab] = useState<"lightning" | "cashu">("lightning");
  const [amount, setAmount] = useState("");
  const [mint, setMint] = useState(() => pickMint(mints, defaultMint));
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  // the deposit we're showing: one asked for, or the one we just made
  const [watching, setWatching] = useState<number | null>(depositId ?? null);
  const [known, setKnown] = useState<Set<number> | null>(null);

  // after asking for a deposit, find the new op it made
  useEffect(() => {
    if (!known || watching !== null || !wallet) return;
    const fresh = wallet.ops.find((o) => o.kind === "deposit" && !known.has(o.id));
    if (fresh) setWatching(fresh.id);
  }, [wallet, known, watching]);

  const op = watching === null ? undefined : wallet?.ops.find((o) => o.id === watching);
  const [since] = useState(() => Math.floor(Date.now() / 1000) - 5);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [lastOp, setLastOp] = useState(op);
  useEffect(() => {
    if (op) setLastOp(op);
    // gone: minted (a deposit entry) or failed (the log says)
    else if (lastOp && watching !== null) {
      const minted = wallet?.history.find(
        (e) => e.kind === "deposit" && e.at >= since && e.mint === lastOp.mint && e.amount === lastOp.amount,
      );
      if (minted) setPaidAmount(minted.amount);
      else onClose();
    }
  }, [op, lastOp, watching, wallet, onClose, since]);

  async function deposit() {
    if (!api || !wallet) return;
    setBusy(true);
    setKnown(new Set(wallet.ops.map((o) => o.id)));
    const res = await api.walletAction({ deposit: { mint, amount: Number(amount) } });
    setBusy(false);
    if ("error" in res) {
      setKnown(null);
      toast.error(walletError(res.error));
    }
  }

  async function receive() {
    if (!api) return;
    setBusy(true);
    const res = await api.walletAction({ receive: { token: stripScheme(token) } });
    setBusy(false);
    if ("error" in res) toast.error(walletError(res.error));
    else onClose();
  }

  if (paidAmount !== null) {
    return (
      <div className="wallet-modal-body wallet-done">
        <span className="wallet-done-mark">
          <Check size={28} />
        </span>
        <strong>{paidAmount.toLocaleString()} sats received</strong>
        <button type="button" className="wallet-primary-button" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  if (watching !== null || known) {
    const invoice = op?.invoice;
    return (
      <div className="wallet-modal-body">
        {invoice ? (
          <div className="wallet-invoice-preview">
            <QrCode value={`lightning:${invoice}`} label="Lightning invoice QR code" />
            <strong className="wallet-invoice-amount mono">{op?.amount?.toLocaleString()} sats</strong>
            <code className="mono">{invoice}</code>
            <button type="button" className="wallet-secondary-button" onClick={() => copyText(invoice, "Invoice")}>
              <Copy size={15} /> Copy invoice
            </button>
            <p className="wallet-waiting">
              <LoaderCircle className="zap-spinner" size={15} /> Waiting for payment at {mintName(op.mint)}
            </p>
          </div>
        ) : (
          <p className="wallet-waiting">
            <LoaderCircle className="zap-spinner" size={15} /> Asking the mint for an invoice…
          </p>
        )}
      </div>
    );
  }

  const kind = classifyPasted(token);
  return (
    <div className="wallet-modal-body">
      <Tabs value={tab} options={[["lightning", "Lightning"], ["cashu", "Ecash token"]]} onChange={setTab} />
      {tab === "lightning" ? (
        <>
          <AmountField id="wallet-receive-amount" amount={amount} setAmount={setAmount} />
          <MintSelect id="wallet-receive-mint" mints={mints} value={mint} onChange={setMint} />
          <button type="button" className="wallet-primary-button" disabled={busy || !amount || Number(amount) <= 0} onClick={deposit}>
            {busy ? <LoaderCircle className="zap-spinner" size={16} /> : null} Create invoice
          </button>
        </>
      ) : (
        <>
          <label className="wallet-field-label" htmlFor="wallet-receive-token">
            Cashu token
          </label>
          <textarea
            id="wallet-receive-token"
            className="wallet-input wallet-payment-input mono"
            placeholder="cashuB…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {token.trim() && kind !== "cashu" && <p className="wallet-field-error">That isn't a Cashu token</p>}
          <p className="wallet-trust-note">It's swapped at its mint for ecash of your own, so whoever gave it can't spend it again. Its mint has to be one of yours.</p>
          <button type="button" className="wallet-primary-button" disabled={busy || kind !== "cashu"} onClick={receive}>
            {busy ? <LoaderCircle className="zap-spinner" size={16} /> : null} Receive
          </button>
        </>
      )}
    </div>
  );
}

//  sending: paying a Lightning invoice, or a token to hand over
function Send({ mints, onClose }: { mints: WalletMint[]; onClose: () => void }) {
  const { api, wallet } = useLocalState((s) => ({ api: s.api, wallet: s.wallet }));
  const defaultMint = useWalletPrefs((s) => s.defaultMint);
  const [tab, setTab] = useState<"lightning" | "cashu">("lightning");
  const [mint, setMint] = useState(() => pickMint(mints, defaultMint));
  const [invoice, setInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentBefore, setSentBefore] = useState<number | null>(null);

  const balance = mints.find((m) => m.url === mint)?.balance ?? 0;
  const invoiceAmount = invoiceSats(invoice);
  const isInvoice = classifyPasted(invoice) === "lightning";
  // the token we just made: the newest, once there's one more than before
  const made = sentBefore !== null && wallet && wallet.sent.length > sentBefore ? wallet.sent[0] : null;

  async function pay() {
    if (!api) return;
    setBusy(true);
    const res = await api.walletAction({ withdraw: { mint, invoice: stripScheme(invoice) } });
    setBusy(false);
    if ("error" in res) toast.error(walletError(res.error));
    else {
      toast("Paying the invoice…", { icon: "⚡" });
      onClose();
    }
  }

  async function makeToken() {
    if (!api || !wallet) return;
    setBusy(true);
    setSentBefore(wallet.sent.length);
    const res = await api.walletAction({ send: { mint, amount: Number(amount), memo: memo.trim() || null } });
    setBusy(false);
    if ("error" in res) {
      setSentBefore(null);
      toast.error(walletError(res.error));
    }
  }

  if (made) {
    return (
      <div className="wallet-modal-body">
        <div className="wallet-invoice-preview">
          <QrCode value={made.token} label="Cashu token QR code" />
          <strong className="wallet-invoice-amount mono">{made.amount.toLocaleString()} sats</strong>
          <code className="mono">{made.token}</code>
          <button type="button" className="wallet-secondary-button" onClick={() => copyText(made.token, "Token")}>
            <Copy size={15} /> Copy token
          </button>
          <p className="wallet-trust-note">Anyone with this token can claim it. It stays under "Tokens you made" on the wallet page.</p>
        </div>
      </div>
    );
  }

  if (sentBefore !== null) {
    return (
      <div className="wallet-modal-body">
        <p className="wallet-waiting">
          <LoaderCircle className="zap-spinner" size={15} /> Making the token…
        </p>
      </div>
    );
  }

  return (
    <div className="wallet-modal-body">
      <Tabs value={tab} options={[["lightning", "Pay invoice"], ["cashu", "Ecash token"]]} onChange={setTab} />
      {tab === "lightning" ? (
        <>
          <label className="wallet-field-label" htmlFor="wallet-send-invoice">
            Lightning invoice
          </label>
          <textarea
            id="wallet-send-invoice"
            className="wallet-input wallet-payment-input mono"
            placeholder="lnbc…"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
          />
          {invoice.trim() && !isInvoice && <p className="wallet-field-error">That isn't a Lightning invoice</p>}
          {isInvoice && invoiceAmount === null && <p className="wallet-field-error">It names no amount; the mint needs one</p>}
          {isInvoice && invoiceAmount !== null && (
            <div className="wallet-decoded-payment">
              <span className="lightning">
                <Zap size={18} fill="currentColor" />
              </span>
              <div>
                <div>Lightning invoice</div>
                <strong className="mono">{invoiceAmount.toLocaleString()} sats + fees</strong>
              </div>
            </div>
          )}
          <MintSelect id="wallet-send-mint" mints={mints} value={mint} onChange={setMint} />
          {invoiceAmount !== null && invoiceAmount > balance && <p className="wallet-field-error">More than that mint holds</p>}
          <button
            type="button"
            className="wallet-primary-button"
            disabled={busy || invoiceAmount === null || invoiceAmount > balance}
            onClick={pay}
          >
            {busy ? <LoaderCircle className="zap-spinner" size={16} /> : null} Pay
          </button>
        </>
      ) : (
        <>
          <AmountField id="wallet-send-amount" amount={amount} setAmount={setAmount} />
          <MintSelect id="wallet-send-token-mint" mints={mints} value={mint} onChange={setMint} />
          <label className="wallet-field-label" htmlFor="wallet-send-memo">
            Memo (optional)
          </label>
          <input id="wallet-send-memo" className="wallet-input" value={memo} maxLength={120} onChange={(e) => setMemo(e.target.value)} />
          {Number(amount) > balance && <p className="wallet-field-error">More than that mint holds</p>}
          <button
            type="button"
            className="wallet-primary-button"
            disabled={busy || !amount || Number(amount) <= 0 || Number(amount) > balance}
            onClick={makeToken}
          >
            {busy ? <LoaderCircle className="zap-spinner" size={16} /> : null} Make token
          </button>
        </>
      )}
    </div>
  );
}

function AddMint({ mints, onDone }: { mints: WalletMint[]; onDone: () => void }) {
  const api = useLocalState((s) => s.api);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = url.trim().replace(/\/+$/, "");
  const problem = clean ? mintUrlProblem(clean) : null;
  const already = mints.some((m) => m.url === clean);

  async function connect() {
    if (!api) return;
    setBusy(true);
    const res = await api.walletAction({ "add-mint": { url: clean } });
    setBusy(false);
    if ("error" in res) toast.error(walletError(res.error));
    else {
      toast("Checking the mint's keys…", { icon: "🔑" });
      onDone();
    }
  }

  return (
    <div className="wallet-modal-body">
      <label className="wallet-field-label" htmlFor="wallet-mint-url">
        Mint URL
      </label>
      <input
        id="wallet-mint-url"
        className="wallet-input mono"
        inputMode="url"
        placeholder="https://mint.example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {problem && <p className="wallet-field-error">{problem}</p>}
      {already && <p className="wallet-field-error">You have that mint already</p>}
      <p className="wallet-trust-note">
        A mint holds the bitcoin behind your ecash. Only add mints you trust with what you'll keep there. If your seed was used there
        before, what it made is restored first.
      </p>
      <button type="button" className="wallet-primary-button" disabled={busy || !clean || !!problem || already} onClick={connect}>
        {busy ? <LoaderCircle className="zap-spinner" size={16} /> : null} Add mint
      </button>
    </div>
  );
}

function WalletSettings({ onAddMint }: { onAddMint: () => void }) {
  const { api, wallet } = useLocalState((s) => ({ api: s.api, wallet: s.wallet }));
  const prefs = useWalletPrefs();
  const [phrase, setPhrase] = useState<string[] | null>(null);
  if (!wallet) return null;

  async function act(action: Record<string, unknown>) {
    if (!api) return;
    const res = await api.walletAction(action);
    if ("error" in res) toast.error(walletError(res.error));
  }

  async function showPhrase() {
    if (!api) return;
    const res = await api.scryWalletPhrase();
    if ("error" in res || typeof res.ok !== "string") {
      toast.error("Couldn't get the phrase");
      return;
    }
    setPhrase(res.ok.split(" "));
  }

  return (
    <div className="wallet-settings-body">
      <div className="wallet-setting-row">
        <div>
          <strong>Hide balance</strong>
          <span>Blur amounts until tapped</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.hideBalance}
          aria-label="Hide balance"
          className={`wallet-switch${prefs.hideBalance ? " active" : ""}`}
          onClick={() => prefs.setHideBalance(!prefs.hideBalance)}
        >
          <span />
        </button>
      </div>

      <div className="wallet-setting-row wallet-setting-divider">
        <div>
          <strong>Back up to Nostr</strong>
          <span>Keep the wallet on your relays, encrypted to your key (NIP-60), so other Nostr wallets can open it</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={wallet.sync}
          aria-label="Back up to Nostr"
          className={`wallet-switch${wallet.sync ? " active" : ""}`}
          onClick={() => act({ sync: { on: !wallet.sync } })}
        >
          <span />
        </button>
      </div>

      <section className="wallet-settings-section" aria-labelledby="wallet-mint-manager-title">
        <div className="wallet-settings-section-header">
          <h3 id="wallet-mint-manager-title">Cashu mints</h3>
          <span>{wallet.mints.length}</span>
          <button type="button" onClick={onAddMint}>
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="wallet-mint-manager">
          {wallet.mints.length === 0 ? (
            <p className="wallet-empty-mints">No mints yet</p>
          ) : (
            wallet.mints.map((m) => {
              const isDefault = pickMint(wallet.mints, prefs.defaultMint) === m.url;
              return (
                <div key={m.url} className={`wallet-mint-manage-row${isDefault ? " default" : ""}`}>
                  <button
                    type="button"
                    className="wallet-mint-star"
                    title={isDefault ? "Default mint" : "Make it the default"}
                    aria-label={isDefault ? `${mintName(m.url)} is the default mint` : `Make ${mintName(m.url)} the default mint`}
                    onClick={() => prefs.setDefaultMint(m.url)}
                  >
                    <Star size={17} fill={isDefault ? "currentColor" : "none"} />
                  </button>
                  <div className="wallet-mint-copy">
                    <div>
                      <strong>{mintName(m.url)}</strong>
                      {isDefault && <span className="wallet-default-badge">Default</span>}
                    </div>
                    <span className="mono">{m.url}</span>
                  </div>
                  <span className="wallet-mint-balance mono">{m.balance.toLocaleString()} sats</span>
                  <button
                    type="button"
                    className="wallet-mint-remove"
                    title="Restore what your seed made at this mint"
                    aria-label={`Restore from ${mintName(m.url)}`}
                    onClick={() => act({ restore: { mint: m.url } })}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="wallet-setting-row wallet-setting-divider">
        <div>
          <strong>Recovery phrase</strong>
          <span>These words restore the wallet anywhere, at any of your mints</span>
        </div>
        {phrase ? (
          <button type="button" className="wallet-recovery-button" onClick={() => setPhrase(null)}>
            Hide
          </button>
        ) : (
          <button type="button" className="wallet-recovery-button" onClick={showPhrase}>
            <Eye size={14} /> Show
          </button>
        )}
      </div>
      {phrase && (
        <div className="wallet-phrase">
          <p className="wallet-phrase-warning">
            <AlertTriangle size={15} /> Anyone who sees these words can take your ecash. Write them down somewhere safe.
          </p>
          <ol className="mono">
            {phrase.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
