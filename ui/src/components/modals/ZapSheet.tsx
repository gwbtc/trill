import { useEffect, useState } from "react";
import { Check, LoaderCircle, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import Avatar from "@/components/Avatar";
import useLocalState from "@/state/state";
import { getZapAmountError, sanitizeSats, walletError } from "@/logic/wallet";
import type { UserProfile, UserType } from "@/types/nostrill";
import "@/styles/Wallet.css";

type ZapSheetProps = {
  targetName: string;
  targetHandle: string;
  targetUser: UserType;
  targetProfile?: UserProfile;
  // their nostr key: nutzaps (NIP-61) go to it. null: none we know
  pubkey: string | null;
  // the nostr event zapped, if the post is one
  eventId: string | null;
  onZapped: (amount: number, comment: string) => void;
  onClose: () => void;
};

type ZapStatus = "editing" | "sending" | "sent";

const ZAP_PRESETS = [
  { amount: 21, emoji: "👍" },
  { amount: 100, emoji: "🔥" },
  { amount: 500, emoji: "⚡" },
  { amount: 1_000, emoji: "🚀" },
  { amount: 5_000, emoji: "💜" },
  { amount: 21_000, emoji: "👑" },
];

const MAX_COMMENT_LENGTH = 180;

export default function ZapSheet({
  targetName,
  targetHandle,
  targetUser,
  targetProfile,
  pubkey,
  eventId,
  onZapped,
  onClose,
}: ZapSheetProps) {
  const { api, wallet } = useLocalState((s) => ({ api: s.api, wallet: s.wallet }));
  const balance = wallet?.balance ?? 0;
  // posts don't always carry their author's profile: ask for it
  const [looked, setLooked] = useState<string | null>(null);
  useEffect(() => {
    if (pubkey || !api) return;
    api.scryProfile(targetUser).then((r) => {
      if ("ok" in r && typeof r.ok?.pubkey === "string") setLooked(r.ok.pubkey);
    });
  }, [api, pubkey, targetUser]);
  const key = (pubkey || looked || "").toLowerCase();
  // an all-zero key is the backend's placeholder for none
  const to = /^[0-9a-f]{64}$/.test(key) && /[1-9a-f]/.test(key) ? key : null;
  const [preset, setPreset] = useState(21);
  const [customAmount, setCustomAmount] = useState("");
  const [comment, setComment] = useState("");
  const [sentAmount, setSentAmount] = useState<number | null>(null);
  const [status, setStatus] = useState<ZapStatus>("editing");
  const amount = customAmount ? Number(customAmount) : preset;
  const amountError = !to
    ? "They have no Nostr key to nutzap"
    : getZapAmountError(amount, balance);

  useEffect(() => {
    if (status !== "sent") return;
    const timeout = window.setTimeout(onClose, 1_800);
    return () => window.clearTimeout(timeout);
  }, [status, onClose]);

  // the wallet takes it from here: their 10019, locked ecash, a 9321.
  // how it ends comes as a toast (see the wallet sub in state.ts)
  async function sendZap(event: React.FormEvent) {
    event.preventDefault();
    if (amountError || status !== "editing" || !api || !to) return;
    setStatus("sending");
    const cleanComment = comment.trim();
    const res = await api.walletAction({
      zap: { to, amount, comment: cleanComment, about: eventId ? { id: eventId, kind: 1 } : null },
    });
    if ("error" in res) {
      toast.error(walletError(res.error));
      setStatus("editing");
      return;
    }
    onZapped(amount, cleanComment);
    setSentAmount(amount);
    setStatus("sent");
  }

  return (
    <section
      id="zap-sheet"
      className={`zap-sheet is-${status}`}
      aria-labelledby="zap-sheet-title"
    >
      {status !== "sent" ? (
        <>
          <header className="zap-sheet-header">
            <span className="zap-target-avatar" aria-hidden="true">
              <Avatar
                user={targetUser}
                profile={targetProfile}
                size={42}
                picOnly
                noClick
              />
              <span className="zap-target-badge">
                <Zap size={12} fill="currentColor" />
              </span>
            </span>
            <div>
              <h2 id="zap-sheet-title">Zap {targetName}</h2>
              <span className="mono">{targetHandle}</span>
            </div>
            <button
              type="button"
              className="wallet-icon-button"
              onClick={onClose}
              aria-label="Close Zap dialog"
            >
              <X size={19} />
            </button>
          </header>

          <form className="zap-sheet-body" onSubmit={sendZap}>
            <fieldset className="zap-amount-fieldset" disabled={status === "sending"}>
              <legend>Choose an amount</legend>
              <div className="zap-presets">
                {ZAP_PRESETS.map((option) => {
                  const active = !customAmount && option.amount === preset;
                  const unavailable = option.amount > balance;
                  return (
                    <button
                      type="button"
                      key={option.amount}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      aria-label={`${option.amount.toLocaleString()} sats${unavailable ? ", unavailable — more than your ecash" : ""}`}
                      disabled={unavailable}
                      onClick={() => {
                        setPreset(option.amount);
                        setCustomAmount("");
                      }}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                      <strong className="mono">{option.amount.toLocaleString()}</strong>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="zap-field-label" htmlFor="zap-custom-amount">
              Custom amount
            </label>
            <div className={`zap-custom-field${customAmount && amountError ? " invalid" : ""}`}>
              <input
                id="zap-custom-amount"
                className="mono"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Enter sats"
                value={customAmount}
                maxLength={8}
                disabled={status === "sending"}
                aria-invalid={Boolean(customAmount && amountError)}
                aria-describedby="zap-balance zap-amount-error"
                onChange={(event) =>
                  setCustomAmount(sanitizeSats(event.target.value).slice(0, 8))
                }
              />
              <span>sats</span>
            </div>
            <div id="zap-balance" className="zap-balance-row">
              <Zap size={15} fill="currentColor" />
              <span>Ecash balance</span>
              <strong className="mono">
                {balance.toLocaleString()} sats
              </strong>
            </div>
            <p
              id="zap-amount-error"
              className={`zap-amount-error${(customAmount || !to) && amountError ? " visible" : ""}`}
              role={(customAmount || !to) && amountError ? "alert" : undefined}
            >
              {(customAmount || !to) && amountError ? amountError : ""}
            </p>

            <div className="zap-comment-heading">
              <label htmlFor="zap-comment">Comment</label>
              <span>{comment.length}/{MAX_COMMENT_LENGTH}</span>
            </div>
            <textarea
              id="zap-comment"
              className="wallet-input zap-comment"
              placeholder="Add a note (optional)"
              value={comment}
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={status === "sending"}
              onChange={(event) => setComment(event.target.value)}
            />

            <button
              type="submit"
              className="zap-send-button"
              disabled={Boolean(amountError) || status === "sending"}
            >
              {status === "sending" ? (
                <>
                  <LoaderCircle className="zap-spinner" size={17} />
                  Starting the nutzap…
                </>
              ) : (
                <>
                  <Zap size={17} fill="currentColor" />
                  Zap {amount.toLocaleString()} sats
                </>
              )}
            </button>
          </form>
        </>
      ) : (
        <div className="zap-success" role="status" aria-live="polite">
          <span className="zap-success-mark">
            <Zap size={34} fill="currentColor" />
            <small aria-hidden="true">
              <Check size={13} strokeWidth={3} />
            </small>
          </span>
          <strong>Nutzapping {sentAmount?.toLocaleString()} sats</strong>
          <p>On its way to {targetName} as Cashu ecash</p>
        </div>
      )}
    </section>
  );
}
