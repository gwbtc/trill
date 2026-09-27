import { useLocation } from "wouter";
import toast from "react-hot-toast";
import { MessagesSquare, Plus, X } from "lucide-react";
import useLocalState from "@/state/state";
import PageHeader from "@/components/layout/PageHeader";
import NewDebate from "@/components/debates/NewDebate";
import Sides from "@/components/debates/Sides";
import {
  debateKey,
  debatePath,
  groupDebates,
  relativeTime,
  type Debate,
  type Invitation,
} from "@/logic/debates";
import "@/styles/Debates.css";

export default function Debates() {
  const [, navigate] = useLocation();
  const { debates, invites, loaded, api, setModal } = useLocalState((s) => ({
    debates: s.debates,
    invites: s.debateInvites,
    loaded: s.debatesLoaded,
    api: s.api,
    setModal: s.setModal,
  }));
  const { live, scheduled, ended } = groupDebates([...debates.values()]);
  // an invitation to a debate we already follow is just the debate
  const pending = [...invites.values()]
    .filter((i) => !debates.has(debateKey(i.key)))
    .sort((a, b) => b.at - a.at);
  const empty = debates.size === 0 && pending.length === 0;

  async function dismiss(i: Invitation) {
    if (!api) return;
    const res = await api.dismissDebateInvite(i.key);
    if ("error" in res) toast.error("Couldn't dismiss the invitation");
  }

  return (
    <div id="screen-debates" className="trill-screen">
      <PageHeader
        title="Debates"
        subtitle="Two sides argue, onlookers vote"
        right={
          <button type="button" className="debate-new-btn" onClick={() => setModal(<NewDebate />)}>
            <Plus size={16} /> New debate
          </button>
        }
      />
      {!loaded ? (
        <div className="route-loading">Loading…</div>
      ) : empty ? (
        <div className="profile-tab-empty">
          <span className="profile-tab-empty-icon" aria-hidden="true">
            <MessagesSquare size={34} />
          </span>
          <h3>No debates yet</h3>
          <p>Start one, or open a debate someone shares with you.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="debate-section">
              <h2>Invitations</h2>
              {pending.map((i) => (
                <div key={debateKey(i.key)} className="debate-card invite">
                  <button
                    type="button"
                    className="debate-card-main"
                    onClick={() => navigate(debatePath(i.key))}
                  >
                    <span className="debate-card-topic">{i.topic}</span>
                    <Sides a={i.sides.a} b={i.sides.b} />
                    <span className="debate-card-meta">
                      <span className="mono">{i.key.host}</span> invited you ·{" "}
                      {relativeTime(i.at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="debate-card-dismiss"
                    aria-label="Dismiss invitation"
                    onClick={() => dismiss(i)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </section>
          )}
          <Section title="Live" debates={live} />
          <Section title="Upcoming" debates={scheduled} />
          <Section title="Ended" debates={ended} />
        </>
      )}
    </div>
  );
}

function Section({ title, debates }: { title: string; debates: Debate[] }) {
  if (debates.length === 0) return null;
  return (
    <section className="debate-section">
      <h2>{title}</h2>
      {debates.map((d) => (
        <DebateCard key={debateKey(d.key)} d={d} />
      ))}
    </section>
  );
}

function DebateCard({ d }: { d: Debate }) {
  const [, navigate] = useLocation();
  const debaters = Object.keys(d.members).length;
  const when =
    d.stage === "live"
      ? d.end
        ? `ends ${relativeTime(d.end)}`
        : "open ended"
      : d.stage === "scheduled"
        ? `starts ${d.start ? relativeTime(d.start) : "soon"}`
        : `ended ${d.ended ? relativeTime(d.ended) : ""}`;
  return (
    <div className="debate-card">
      <button type="button" className="debate-card-main" onClick={() => navigate(debatePath(d.key))}>
        <span className="debate-card-topic">
          {d.stage === "live" && <span className="debate-live-dot" aria-label="Live" />}
          {d.topic}
        </span>
        <Sides a={d.sides.a} b={d.sides.b} />
        <span className="debate-card-meta">
          <span className="mono">{d.key.host}</span> · {when} · {debaters}{" "}
          {debaters === 1 ? "debater" : "debaters"} · {d.onlookers.length}{" "}
          {d.onlookers.length === 1 ? "onlooker" : "onlookers"}
        </span>
      </button>
    </div>
  );
}
