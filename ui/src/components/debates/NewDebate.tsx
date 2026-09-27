import { useState } from "react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import useLocalState from "@/state/state";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { newDebateProblem, parseShips, type NewDebate as NewDebateConfig } from "@/logic/debates";
import "@/styles/Debates.css";

// "2026-09-27T18:30" (a datetime-local value) as ms, or null
const toMs = (v: string) => (v ? new Date(v).getTime() : null);

// the form for starting a debate; the agent hosts it on our ship
export default function NewDebate() {
  const [, navigate] = useLocation();
  const { api, setModal } = useLocalState((s) => ({ api: s.api, setModal: s.setModal }));
  const [topic, setTopic] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [moderator, setModerator] = useState("");
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [debaters, setDebaters] = useState<"open" | "invite">("open");
  const [revote, setRevote] = useState(true);
  const [tally, setTally] = useState<"live" | "hidden">("live");
  const [invite, setInvite] = useState("");
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);

  const mod = parseShips(moderator)[0] ?? null;
  const config: NewDebateConfig = {
    topic: topic.trim(),
    sides: { a: a.trim(), b: b.trim() },
    moderator: mod,
    start: timing === "scheduled" ? toMs(start) : null,
    end: toMs(end),
    debaters,
    revote,
    tally,
    invite: parseShips(invite),
  };
  const problem =
    timing === "scheduled" && !start ? "Pick a start time" : newDebateProblem(config);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (problem || !api) return;
    setSending(true);
    const res = await api.createDebate(config);
    setSending(false);
    if ("error" in res) {
      toast.error("Couldn't create the debate");
      return;
    }
    toast.success("Debate created");
    setModal(null);
    navigate("/debates");
  }

  return (
    <form className="new-debate" onSubmit={submit}>
      <header className="new-debate-header">
        <h2>New debate</h2>
        <ModalCloseButton onClick={() => setModal(null)} />
      </header>

      <label className="new-debate-field">
        <span>Topic</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Should Urbit ship a mobile app first?"
          maxLength={300}
          autoFocus
        />
      </label>

      <div className="new-debate-sides">
        <label className="new-debate-field side-a">
          <span>Side A</span>
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="For" maxLength={60} />
        </label>
        <span className="debate-vs">vs</span>
        <label className="new-debate-field side-b">
          <span>Side B</span>
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Against" maxLength={60} />
        </label>
      </div>

      <fieldset className="new-debate-group">
        <legend>When</legend>
        <div className="new-debate-choices">
          <label>
            <input type="radio" checked={timing === "now"} onChange={() => setTiming("now")} />
            Start now
          </label>
          <label>
            <input
              type="radio"
              checked={timing === "scheduled"}
              onChange={() => setTiming("scheduled")}
            />
            Schedule it
          </label>
        </div>
        <div className="new-debate-times">
          {timing === "scheduled" && (
            <label className="new-debate-field">
              <span>Starts</span>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
          )}
          <label className="new-debate-field">
            <span>Ends (optional)</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <p className="new-debate-hint">With no end time, you end it yourself.</p>
      </fieldset>

      <fieldset className="new-debate-group">
        <legend>Who can take a side</legend>
        <div className="new-debate-choices">
          <label>
            <input type="radio" checked={debaters === "open"} onChange={() => setDebaters("open")} />
            Anyone who joins
          </label>
          <label>
            <input
              type="radio"
              checked={debaters === "invite"}
              onChange={() => setDebaters("invite")}
            />
            Only invited ships
          </label>
        </div>
        <p className="new-debate-hint">Everyone else can still watch and vote.</p>
      </fieldset>

      <fieldset className="new-debate-group">
        <legend>Voting</legend>
        <div className="new-debate-choices">
          <label>
            <input type="radio" checked={tally === "live"} onChange={() => setTally("live")} />
            Show the tally as it goes
          </label>
          <label>
            <input type="radio" checked={tally === "hidden"} onChange={() => setTally("hidden")} />
            Reveal it at the end
          </label>
        </div>
        <label className="new-debate-check">
          <input type="checkbox" checked={revote} onChange={(e) => setRevote(e.target.checked)} />
          Onlookers can change their vote
        </label>
      </fieldset>

      <label className="new-debate-field">
        <span>Invite (optional)</span>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          placeholder="~sampel-palnet, ~nec"
          className="mono"
        />
      </label>
      <label className="new-debate-field">
        <span>Moderator (optional)</span>
        <input
          value={moderator}
          onChange={(e) => setModerator(e.target.value)}
          placeholder="~sampel-palnet"
          className="mono"
        />
        <small>Can mute and remove people. You always can.</small>
      </label>

      {tried && problem && <p className="new-debate-problem">{problem}</p>}
      <div className="new-debate-actions">
        <button type="button" className="debate-btn" onClick={() => setModal(null)}>
          Cancel
        </button>
        <button type="submit" className="debate-btn primary" disabled={sending}>
          {sending ? "Creating…" : "Create debate"}
        </button>
      </div>
    </form>
  );
}
