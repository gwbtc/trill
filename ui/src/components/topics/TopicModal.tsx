import { useLocation } from "wouter";
import { ExternalLink, PenLine } from "lucide-react";
import useLocalState from "@/state/state";
import ComposerModal from "@/components/modals/ComposerModal";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import TopicThumb from "@/components/TopicThumb";
import {
  CATEGORY_OPTIONS,
  topicMeta,
  topicPublisher,
  type TopicItem,
} from "@/logic/topics";
import "@/styles/Topics.css";

// a trending topic, opened from the trending card: what we know about it,
// and either reading it or posting about it
export default function TopicModal({ topic }: { topic: TopicItem }) {
  const [location] = useLocation();
  const { setModal, setComposerData } = useLocalState((s) => ({
    setModal: s.setModal,
    setComposerData: s.setComposerData,
  }));
  const close = () => setModal(null);

  function postAboutIt() {
    setComposerData({ type: "topic", topic });
    // as quoting a post: the feed's inline composer, else the modal one
    const onFeed = location === "/f" || location.startsWith("/f/");
    if (onFeed) {
      close();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setModal(<ComposerModal />);
  }

  const isSearch = topic.source.startsWith("gtrends");
  // google trends' content is the search term (its feed has no
  // descriptions); the others' is a description, if any
  const about = topic.content !== topic.title ? topic.content : "";
  const categories = topic.categories
    .map((c) => CATEGORY_OPTIONS.find((o) => o.id === c)?.label)
    .filter((c): c is string => !!c);
  const related = topic.links.filter((l) => l.url !== topic.url).slice(0, 4);
  const when = topic.date
    ? new Date(topic.date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="topic-modal">
      <div className="topic-modal-top">
        <span className="topic-modal-source">{topicMeta(topic)}</span>
        <ModalCloseButton onClick={close} />
      </div>
      {topic.pic && <TopicThumb src={topic.pic} className="topic-modal-pic" />}
      <h3 className="topic-modal-title">{topic.title}</h3>
      <div className="topic-modal-meta">
        {topic.url && topicPublisher(topic)}
        {topic.url && when && " · "}
        {when}
      </div>
      {about && (
        <p className="topic-modal-about">
          {isSearch && <span className="topic-modal-label">Trending search: </span>}
          {about}
        </p>
      )}
      {categories.length > 0 && (
        <div className="topic-modal-cats">
          {categories.map((c) => (
            <span key={c} className="topic-modal-cat">
              {c}
            </span>
          ))}
        </div>
      )}
      {related.length > 0 && (
        <div className="topic-modal-related">
          <div className="topic-modal-label">More coverage</div>
          {related.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="topic-modal-related-row"
            >
              <span className="topic-modal-related-title">{l.title}</span>
              <span className="topic-modal-related-pub">{l.publisher}</span>
            </a>
          ))}
        </div>
      )}
      <div className="topic-modal-actions">
        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="topic-modal-btn"
          >
            <ExternalLink size={16} /> Open link
          </a>
        )}
        <button type="button" className="topic-modal-btn primary" onClick={postAboutIt}>
          <PenLine size={16} /> Post about it
        </button>
      </div>
    </div>
  );
}
