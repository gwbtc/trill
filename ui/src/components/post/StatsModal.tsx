import type { Poast } from "@/types/trill";
import Modal from "../modals/Modal";
import { useState } from "react";
import TabStrip, { type TabItem } from "@/components/ui/TabStrip";
import Post from "./Post";
import RP from "./RP";
import Avatar from "../Avatar";
import { stringToReact } from "./Reactions";
import type { UserType } from "@/types/nostrill";
import { patpToFallbackUID } from "@/logic/gw";

type StatsTab = "replies" | "quotes" | "reposts" | "reacts";

const STATS_TABS: TabItem<StatsTab>[] = [
  { key: "replies", label: <h4>Replies</h4> },
  { key: "quotes", label: <h4>Quotes</h4> },
  { key: "reposts", label: <h4>Reposts</h4> },
  { key: "reacts", label: <h4>Reacts</h4> },
];

function StatsModal({
  poast,
  close,
  user,
}: {
  close: any;
  poast: Poast;
  user: UserType;
}) {
  const [tab, setTab] = useState<StatsTab>("replies");
  const replies = poast.children || [];
  const quotes = poast.engagement.quoted;
  const reposts = poast.engagement.shared;
  const reacts = poast.engagement.reacts;
  // TODO revise the global thingy here
  return (
    <Modal close={close}>
      <div id="stats-modal">
        <Post poast={poast} user={user} refetch={() => {}} />
        <TabStrip
          id="tabs"
          items={STATS_TABS}
          active={tab}
          onChange={setTab}
          className=""
          buttonClassName="tab"
          activeClassName="active-tab"
          itemElement="div"
          itemRole="link"
          stopPropagation
        />
        <div id="engagement">
          {tab === "replies" ? (
            <div id="replies">
              {replies.map((p) => (
                <div key={p} className="reply-stat">
                  <RP host={poast.host} id={p} />
                </div>
              ))}
            </div>
          ) : tab === "quotes" ? (
            <div id="quotes">
              {quotes.map((p) => (
                <div key={p.pid.id} className="quote-stat">
                  <RP host={p.pid.ship} id={p.pid.id} />
                </div>
              ))}
            </div>
          ) : tab === "reposts" ? (
            <div id="reposts">
              {reposts.map((p) => (
                <div key={p.pid.id} className="repost-stat">
                  <Avatar user={{ urbit: patpToFallbackUID(p.pid.ship) }} size={40} />
                </div>
              ))}
            </div>
          ) : tab === "reacts" ? (
            <div id="reacts">
              {Object.keys(reacts).map((p) => (
                <div key={p} className="react-stat btw">
                  <Avatar user={{ urbit: patpToFallbackUID(p) }} size={32} />
                  {stringToReact(reacts[p])}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
export default StatsModal;
