import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, X, Zap } from "lucide-react";
import Avatar from "@/components/Avatar";
import {
  getZapAmountError,
  LIGHTNING_BALANCE_SATS,
  sanitizeSats,
} from "@/logic/wallet";
import type { UserProfile, UserType } from "@/types/nostrill";
import "@/styles/Wallet.css";

type ZapSheetProps = {
  targetName: string;
  targetHandle: string;
  targetUser: UserType;
  targetProfile?: UserProfile;
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
  onZapped,
  onClose,
}: ZapSheetProps) {
  const [preset, setPreset] = useState(21);
  const [customAmount, setCustomAmount] = useState("");
  const [comment, setComment] = useState("");
  const [sentAmount, setSentAmount] = useState<number | null>(null);
  const [status, setStatus] = useState<ZapStatus>("editing");
  const sendingTimer = useRef<number | null>(null);
  const amount = customAmount ? Number(customAmount) : preset;
  const amountError = getZapAmountError(amount, LIGHTNING_BALANCE_SATS);

  useEffect(() => {
    return () => {
      if (sendingTimer.current !== null) window.clearTimeout(sendingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "sent") return;
    const timeout = window.setTimeout(onClose, 1_800);
    return () => window.clearTimeout(timeout);
  }, [status, onClose]);

  function sendZap(event: React.FormEvent) {
    event.preventDefault();
    if (amountError || status !== "editing") return;

    setStatus("sending");
    sendingTimer.current = window.setTimeout(() => {
      const cleanComment = comment.trim();
      onZapped(amount, cleanComment);
      setSentAmount(amount);
      setStatus("sent");
      sendingTimer.current = null;
    }, 520);
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
                  const unavailable = option.amount > LIGHTNING_BALANCE_SATS;
                  return (
                    <button
                      type="button"
                      key={option.amount}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      aria-label={`${option.amount.toLocaleString()} sats${unavailable ? ", unavailable — exceeds Lightning balance" : ""}`}
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
              <span>Lightning balance</span>
              <strong className="mono">
                {LIGHTNING_BALANCE_SATS.toLocaleString()} sats
              </strong>
            </div>
            <p
              id="zap-amount-error"
              className={`zap-amount-error${customAmount && amountError ? " visible" : ""}`}
              role={customAmount && amountError ? "alert" : undefined}
            >
              {customAmount && amountError ? amountError : ""}
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
                  Sending zap…
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
          <strong>Zapped {sentAmount?.toLocaleString()} sats</strong>
          <p>Sent to {targetName} via Lightning</p>
        </div>
      )}
    </section>
  );
}
