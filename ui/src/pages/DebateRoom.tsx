import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import toast from "react-hot-toast";
import { Link2, LogOut, MicOff, Play, Share2, Square, UserMinus, UserPlus, Volume2 } from "lucide-react";
import useLocalState from "@/state/state";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import ShipName from "@/components/debates/ShipName";
import ComposerModal from "@/components/modals/ComposerModal";
import {
  canSpeak,
  canTakeSide,
  canVote,
  debateCard,
  debateKey,
  debatePath,
  moderates,
  parseShips,
  presenceLabel,
  relativeTime,
  roleOf,
  tallyOf,
  type Debate,
  type DebateKey,
  type Side,
} from "@/logic/debates";
import "@/styles/Debates.css";

// how long to wait for a debate we asked to follow before calling it gone
const WATCH_TIMEOUT_MS = 12_000;

export default function DebateRoom() {
  const params = useParams();
  const key: DebateKey = { host: params.host ?? "", id: params.id ?? "" };
  const { api, debates, loaded } = useLocalState((s) => ({
    api: s.api,
    debates: s.debates,
    loaded: s.debatesLoaded,
  }));
  const our = ourShip(api?.airlock.our);
  const d = debates.get(debateKey(key));
  const [missing, setMissing] = useState(false);

  // opened from a link: follow it (the host sends it over), and give up
  // after a while: removed, or no such debate
  useEffect(() => {
    if (!api || !loaded || d || key.host === our) return;
    api.watchDebate(key);
    const t = setTimeout(() => setMissing(true), WATCH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [api, loaded, key.host, key.id, !!d]);

  if (!d)
    return (
      <div className="trill-screen">
        <div className="profile-tab-empty">
          {missing || (loaded && key.host === our) ? (
            <>
              <h3>This debate isn't available</h3>
              <p>It doesn't exist, or you were removed from it.</p>
            </>
          ) : (
            <p>Loading the debate from {key.host}…</p>
          )}
        </div>
      </div>
    );
  return <Room d={d} our={our} />;
}

const ourShip = (o: string | null | undefined) => (!o ? "" : o.startsWith("~") ? o : `~${o}`);

function Room({ d, our }: { d: Debate; our: string }) {
  const [, navigate] = useLocation();
  const api = useLocalState((s) => s.api);
  const role = roleOf(d, our);
  const isHost = d.key.host === our;
  const isMod = moderates(d, our);
  const act = async (action: Record<string, unknown>, failed: string) => {
    if (!api) return;
    // guests' actions are checked by the host: its refusals arrive as toasts
    const res = await api.debateAct(d.key, action);
    if ("error" in res) toast.error(failed);
  };
  const id = d.key.id;

  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [d.messages.length]);

  const status =
    d.stage === "live"
      ? d.end
        ? `Live · ends ${relativeTime(d.end)}`
        : "Live"
      : d.stage === "scheduled"
        ? `Starts ${d.start ? relativeTime(d.start) : "soon"}`
        : "Ended";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/apps/nostrill/debates/${d.key.host}/${id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }
  async function leave() {
    if (!api) return;
    await api.forgetDebate(d.key);
    navigate("/debates");
  }
  const setModal = useLocalState((s) => s.setModal);
  const setComposerData = useLocalState((s) => s.setComposerData);
  // into a post, as a card that opens the debate
  function share() {
    setComposerData({ type: "card", card: debateCard(d) });
    setModal(<ComposerModal />);
  }
  // the app's confirmation dialog, then the action
  const confirm: Confirm = (message, then) =>
    setModal(
      <ConfirmationDialog
        message={message}
        onConfirm={async () => {
          await then();
          setModal(null);
        }}
        onCancel={() => setModal(null)}
      />,
    );
  const [inviting, setInviting] = useState(false);
  const [inviteText, setInviteText] = useState("");
  async function sendInvites(e: React.FormEvent) {
    e.preventDefault();
    const who = parseShips(inviteText);
    if (who.length === 0) return;
    await act({ invite: { id, who } }, "Couldn't send the invitations");
    setInviteText("");
    setInviting(false);
    toast.success(who.length === 1 ? "Invitation sent" : `${who.length} invitations sent`);
  }

  return (
    <div id="screen-debate" className="trill-screen debate-room">
      <header className="debate-room-header trill-screen-header">
        <div className="debate-room-title">
          <h1>{d.topic}</h1>
          <p>
            <span className={`debate-stage ${d.stage}`}>{status}</span> · hosted by{" "}
            <ShipName ship={d.key.host} />
            {d.moderator && (
              <>
                {" "}
                · moderated by <ShipName ship={d.moderator} />
              </>
            )}
          </p>
        </div>
        <div className="debate-room-actions">
          {isHost && d.stage === "scheduled" && (
            <button type="button" className="debate-btn" onClick={() => act({ start: { id } }, "Couldn't start it")}>
              <Play size={15} /> Start now
            </button>
          )}
          {isHost && d.stage !== "ended" && (
            <button
              type="button"
              className="debate-btn"
              onClick={() =>
                confirm("End the debate? The vote closes and the tally is final.", () =>
                  act({ end: { id } }, "Couldn't end it"),
                )
              }
            >
              <Square size={14} /> End
            </button>
          )}
          {isHost && d.stage !== "ended" && (
            <button
              type="button"
              className={`debate-btn icon${inviting ? " active" : ""}`}
              title="Invite"
              aria-label="Invite"
              onClick={() => setInviting((v) => !v)}
            >
              <UserPlus size={16} />
            </button>
          )}
          <button type="button" className="debate-btn icon" title="Share in a post" aria-label="Share in a post" onClick={share}>
            <Share2 size={16} />
          </button>
          <button type="button" className="debate-btn icon" title="Copy link" aria-label="Copy link" onClick={copyLink}>
            <Link2 size={16} />
          </button>
          {!isHost && (
            <button type="button" className="debate-btn icon" title="Leave" aria-label="Leave" onClick={leave}>
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      {inviting && (
        <form className="debate-invite-row" onSubmit={sendInvites}>
          <input
            value={inviteText}
            onChange={(e) => setInviteText(e.target.value)}
            placeholder="~sampel-palnet, ~nec"
            className="mono"
            aria-label="Ships to invite"
            autoFocus
          />
          <button type="submit" className="debate-btn primary" disabled={parseShips(inviteText).length === 0}>
            Invite
          </button>
        </form>
      )}

      <div className="debate-arena">
        <SideColumn d={d} side="a" our={our} isMod={isMod} act={act} confirm={confirm} />
        <Tally d={d} our={our} />
        <SideColumn d={d} side="b" our={our} isMod={isMod} act={act} confirm={confirm} />
      </div>

      <div className="debate-log" ref={log}>
        {d.messages.length === 0 ? (
          <p className="debate-log-empty">
            {d.stage === "scheduled"
              ? "The floor opens when the debate starts."
              : d.stage === "live"
                ? "No arguments yet."
                : "Nobody spoke in this debate."}
          </p>
        ) : (
          d.messages.map((m) => (
            <div key={m.id} className={`debate-msg ${m.side}${m.author === our ? " mine" : ""}`}>
              <div className="debate-msg-head">
                <ShipName ship={m.author} />
                <time title={new Date(m.time).toLocaleString()}>
                  {new Date(m.time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <div className="debate-msg-text">{m.text}</div>
            </div>
          ))
        )}
      </div>

      <Footer d={d} our={our} role={role} act={act} />
    </div>
  );
}

type Act = (action: Record<string, unknown>, failed: string) => Promise<void>;
type Confirm = (message: string, then: () => Promise<void>) => void;

function SideColumn({
  d,
  side,
  our,
  isMod,
  act,
  confirm,
}: {
  d: Debate;
  side: Side;
  our: string;
  isMod: boolean;
  act: Act;
  confirm: Confirm;
}) {
  const members = Object.entries(d.members)
    .filter(([, s]) => s === side)
    .map(([ship]) => ship)
    .sort();
  const id = d.key.id;
  return (
    <div className={`debate-side ${side}`}>
      <h2 className="debate-side-title">{d.sides[side]}</h2>
      {members.length === 0 ? (
        <p className="debate-side-empty">No one yet</p>
      ) : (
        <ul className="debate-members">
          {members.map((ship) => {
            const muted = d.muted.includes(ship);
            return (
              <li key={ship} className={`debate-member${muted ? " muted" : ""}`}>
                <ShipName ship={ship} />
                {ship === our && <span className="debate-you">you</span>}
                {muted && <MicOff size={13} aria-label="muted" />}
                {isMod && ship !== our && d.stage !== "ended" && (
                  <span className="debate-mod-tools">
                    <button
                      type="button"
                      title={muted ? "Unmute" : "Mute"}
                      aria-label={muted ? `Unmute ${ship}` : `Mute ${ship}`}
                      onClick={() => act({ mute: { id, who: ship, on: !muted } }, "Couldn't change that")}
                    >
                      {muted ? <Volume2 size={13} /> : <MicOff size={13} />}
                    </button>
                    {ship !== d.key.host && (
                      <button
                        type="button"
                        title="Remove"
                        aria-label={`Remove ${ship}`}
                        onClick={() =>
                          confirm(`Remove ${ship} from the debate? They can't come back.`, () =>
                            act({ remove: { id, who: ship } }, "Couldn't remove them"),
                          )
                        }
                      >
                        <UserMinus size={13} />
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tally({ d, our }: { d: Debate; our: string }) {
  const t = tallyOf(d);
  const mine = d.votes[our];
  const shares = t.a + t.b > 0 ? { a: (t.a / (t.a + t.b)) * 100, b: (t.b / (t.a + t.b)) * 100 } : null;
  return (
    <div className="debate-tally" aria-label="Onlooker vote">
      <span className="debate-tally-label">
        {d.stage === "ended" ? "Final vote" : "Onlooker vote"}
      </span>
      {t.known ? (
        <>
          <div className="debate-tally-bar">
            <span className="a" style={{ width: `${shares ? shares.a : 50}%` }} />
            <span className="b" style={{ width: `${shares ? shares.b : 50}%` }} />
          </div>
          <div className="debate-tally-counts">
            <strong className="a">{t.a}</strong>
            <strong className="b">{t.b}</strong>
          </div>
        </>
      ) : (
        <p className="debate-tally-hidden">
          {t.total} {t.total === 1 ? "vote" : "votes"}
          <br />
          <small>revealed at the end</small>
        </p>
      )}
      {mine && <small className="debate-your-vote">You voted {d.sides[mine]}</small>}
      <small className="debate-onlookers">
        {d.onlookers.length} {d.onlookers.length === 1 ? "onlooker" : "onlookers"}
      </small>
    </div>
  );
}

function Footer({ d, our, role, act }: { d: Debate; our: string; role: ReturnType<typeof roleOf>; act: Act }) {
  const [text, setText] = useState("");
  const [, navigate] = useLocation();
  const current = useLocalState((s) => s.currentDebate);
  const id = d.key.id;

  if (d.stage === "ended") {
    const t = tallyOf(d);
    const winner = t.a === t.b ? null : t.a > t.b ? d.sides.a : d.sides.b;
    return (
      <div className="debate-footer ended">
        {t.total === 0 ? "The debate is over. Nobody voted." : winner ? `${winner} won the vote, ${Math.max(t.a, t.b)} to ${Math.min(t.a, t.b)}.` : `It's a tie, ${t.a} to ${t.b}.`}
      </div>
    );
  }

  if (role.kind === "debater") {
    if (d.muted.includes(our))
      return <div className="debate-footer note">You've been muted by the moderator.</div>;
    if (!canSpeak(d, our))
      return (
        <div className="debate-footer note">
          You're arguing for {d.sides[role.side]}. The floor opens when the debate starts.
        </div>
      );
    const send = async (e: React.FormEvent) => {
      e.preventDefault();
      const t = text.trim();
      if (!t) return;
      setText("");
      await act({ say: { id, text: t } }, "Couldn't send that");
    };
    return (
      <form className={`debate-footer compose ${role.side}`} onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Argue for ${d.sides[role.side]}…`}
          rows={2}
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
        />
        <button type="submit" className="debate-btn primary" disabled={!text.trim()}>
          Send
        </button>
      </form>
    );
  }

  if (role.kind === "onlooker") {
    const mine = d.votes[our];
    const open = canVote(d, our);
    return (
      <div className="debate-footer vote">
        <span>
          {d.stage === "scheduled"
            ? "Voting opens when the debate starts."
            : !open && mine
              ? "Your vote is in; it's final in this debate."
              : "Who's making the better case?"}
        </span>
        <div className="debate-vote-buttons">
          {(["a", "b"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`debate-vote ${s}${mine === s ? " chosen" : ""}`}
              disabled={!open || mine === s}
              onClick={() => act({ vote: { id, side: s } }, "Couldn't vote")}
            >
              {mine === s ? `Voted ${d.sides[s]}` : `Vote ${d.sides[s]}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // not in it yet. one debate at a time: in another one, you leave that
  // first (the agent refuses otherwise)
  if (current && debateKey(current.key) !== debateKey(d.key))
    return (
      <div className="debate-footer join">
        <span>
          You're {presenceLabel(current)} in <strong>{current.topic}</strong>. Leave it to join this
          one.
        </span>
        <button type="button" className="debate-btn" onClick={() => navigate(debatePath(current.key))}>
          Go to it
        </button>
      </div>
    );
  const sides = canTakeSide(d, our);
  return (
    <div className="debate-footer join">
      <span>{sides ? "Join the debate:" : "Only invited ships can take a side. You can watch and vote:"}</span>
      <div className="debate-vote-buttons">
        {sides &&
          (["a", "b"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`debate-vote ${s}`}
              onClick={() => act({ join: { id, as: s } }, "Couldn't join")}
            >
              Argue for {d.sides[s]}
            </button>
          ))}
        <button type="button" className="debate-btn" onClick={() => act({ join: { id, as: null } }, "Couldn't join")}>
          Watch &amp; vote
        </button>
      </div>
    </div>
  );
}

