import type { FullNode } from "@/types/trill";

export type ThreadReplyItem = {
  node: FullNode;
  parent?: FullNode;
};

export function countThreadChildren(node: FullNode): number {
  return Object.values(node.children || {}).reduce(
    (count, child) => count + 1 + countThreadChildren(child),
    0,
  );
}

export function flattenThreadChildren(node: FullNode): ThreadReplyItem[] {
  const flatChildren: ThreadReplyItem[] = [];

  function walk(current: FullNode) {
    const kids = Object.values(current.children || {});
    kids.sort((a, b) => b.time - a.time);
    kids.forEach((child) => {
      flatChildren.push({ node: child, parent: current });
      walk(child);
    });
  }

  walk(node);
  return flatChildren;
}
