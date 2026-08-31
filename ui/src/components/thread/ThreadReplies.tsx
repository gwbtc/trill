import { useState } from "react";
import Post from "@/components/post/Post";
import useLocalState from "@/state/state";
import { toFlat } from "@/logic/trill/helpers";
import { countThreadChildren, type ThreadReplyItem } from "@/logic/threadTree";
import type { FullNode } from "@/types/trill";
import type { UserType } from "@/types/nostrill";
import { ChevronDown, ChevronRight } from "lucide-react";

type UserForNode = (node: FullNode) => UserType;
type NodeKey = (node: FullNode) => string;

const defaultNodeKey: NodeKey = (node) => node.hash || node.id;

export function NestedThreadReplies({
  nodes,
  userForNode,
  nodeKey = defaultNodeKey,
}: {
  nodes: FullNode[];
  userForNode: UserForNode;
  nodeKey?: NodeKey;
}) {
  const profiles = useLocalState((s) => s.profiles);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggleCollapsed(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      {nodes.map((node) => {
        const key = nodeKey(node);
        const childCount = countThreadChildren(node);
        const isCollapsed = collapsed.has(key);
        return (
          <div key={key} className="minithread">
            <Post
              user={userForNode(node)}
              poast={toFlat(node)}
              profile={profiles.get(node.author)}
            />
            {childCount > 0 && (
              <button
                type="button"
                className="thread-collapse-toggle"
                onClick={(e) => toggleCollapsed(e, key)}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight size={15} />
                ) : (
                  <ChevronDown size={15} />
                )}
                {isCollapsed ? `Show ${childCount}` : `Hide ${childCount}`}
              </button>
            )}
            {!isCollapsed && (
              <div className="tail">
                <NestedThreadReplies
                  nodes={Object.values(node.children || {})}
                  userForNode={userForNode}
                  nodeKey={nodeKey}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function LinearThreadReplies({
  nodes,
  userForNode,
}: {
  nodes: ThreadReplyItem[];
  userForNode: UserForNode;
}) {
  const profiles = useLocalState((s) => s.profiles);

  if (nodes.length === 0) {
    return <p className="thread-empty-replies">No replies yet.</p>;
  }

  return (
    <>
      {nodes.map(({ node, parent }) => (
        <div key={defaultNodeKey(node)} className="thread-linear-reply">
          {parent && (
            <div className="thread-linear-context">
              replying to <span className="mono">{parent.author}</span>
            </div>
          )}
          <Post
            user={userForNode(node)}
            poast={toFlat(node)}
            profile={profiles.get(node.author)}
            spine={false}
          />
        </div>
      ))}
    </>
  );
}
