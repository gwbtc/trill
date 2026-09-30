import TopicThumb from "@/components/TopicThumb";
import { topicMeta, topicPublisher, type TopicItem } from "@/logic/topics";
import "@/styles/Topics.css";

// a trending topic in brief: the composer's preview of what gets quoted
export default function TopicSnippet({ topic }: { topic: TopicItem }) {
  return (
    <div className="topic-snippet">
      <div className="topic-snippet-text">
        <div className="topic-snippet-title">{topic.title}</div>
        <div className="topic-snippet-meta">
          {topicMeta(topic)}
          {topic.url && <> · {topicPublisher(topic)}</>}
        </div>
      </div>
      {topic.pic && <TopicThumb src={topic.pic} className="topic-snippet-pic" />}
    </div>
  );
}
