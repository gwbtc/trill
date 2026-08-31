import type { NostrEvent, Wevent } from "@/types/nostr";
import type { FlatFeed, FullFeed, FullNode, Poast } from "@/types/trill";
import { eventToPoast } from "../nostrill";
import { isValidPatp } from "urbit-ob";
import type { UserType } from "@/types/nostrill";
import { decodeNostrKey } from "../nostr";
import { patpToFallbackUID } from "../gw";

export function toFlat(n: FullNode): Poast {
  const r = {
    ...n,
    children: !n.children
      ? []
      : Object.keys(n.children).map((c) => n.children[c].id),
  };
  return r;
  // return {
  //   ...n,
  //   children: !n.children
  //     ? []
  //     : Object.keys(n.children).map((c) => n.children[c].id),
  // };
}

type res = { threadChildren: FullNode[]; replies: FullNode[] };
const bunt: res = { threadChildren: [], replies: [] };
export function extractThread(node: FullNode): res {
  if (!node.children) return bunt;
  const r = Object.keys(node.children)
    .sort()
    .reduce((acc, index) => {
      const n = node.children[index];
      // if (typeof n.post === "string") return acc;
      const nn = n as FullNode;
      return n.author !== node.author
        ? { ...acc, replies: [...acc.replies, nn] }
        : {
            ...acc,
            threadChildren: [
              ...acc.threadChildren,
              nn,
              ...extractThread(nn).threadChildren,
            ],
          };
    }, bunt);
  return r;
}

export function findReplies(n: Poast, f: FlatFeed): Poast[] {
  const posts = Object.values(f);
  const kids: Poast[] = [];
  for (const p of posts) {
    if (p.parent === n.id) kids.push(p);
  }
  return kids;
}

export function eventToFn(ev: Wevent) {
  const p = eventToPoast(ev)!;
  const fn: FullNode = { ...p, children: {} };
  return fn;
}
export function eventsToFF(nodes: FullNode[]): FullFeed {
  // Step 1: Create a map with all nodes having empty children
  const nodeMap: Record<string, FullNode> = {};
  nodes.forEach((node) => {
    nodeMap[node.hash] = node;
  });

  // Step 2: Build relationships by adding each node to its parent's children
  const rootNodes: FullFeed = {};
  nodes.forEach((node) => {
    const currentNode = nodeMap[node.hash];

    if (!node.parent) {
      rootNodes[node.hash] = currentNode; // It's a root
    } else if (nodeMap[node.parent]) {
      nodeMap[node.parent].children[node.hash] = currentNode; // Add to parent
    } else {
      rootNodes[node.hash] = currentNode; // Parent missing, treat as root
    }
  });

  return rootNodes;
}

export function getDescendants(node: FullNode): FullNode[] {
  const descendants: FullNode[] = [];

  function traverse(currentNode: FullNode) {
    Object.values(currentNode.children).forEach((child) => {
      descendants.push(child);
      traverse(child);
    });
  }

  traverse(node);
  return descendants;
}

/**
 * Alternative implementation that handles orphaned nodes differently
 * Orphaned nodes (whose parents aren't in the array) are collected separately
 */
export function buildTreeWithOrphans(nodes: FullNode[]): {
  tree: FullFeed;
  orphans: FullFeed;
} {
  const nodeMap: Record<string, FullNode> = {};

  // Initialize all nodes
  nodes.forEach((node) => {
    nodeMap[node.hash] = node;
  });

  const rootNodes: FullFeed = {};
  const orphanNodes: FullFeed = {};

  nodes.forEach((node) => {
    const currentNode = nodeMap[node.id];

    if (!node.parent) {
      // Root node
      rootNodes[node.id] = currentNode;
    } else if (nodeMap[node.parent]) {
      // Parent exists, add to parent's children
      nodeMap[node.parent].children[node.id] = currentNode;
    } else {
      // Parent doesn't exist, it's an orphan
      orphanNodes[node.id] = currentNode;
    }
  });

  return { tree: rootNodes, orphans: orphanNodes };
}

export function findNodeById(
  tree: FullFeed,
  targetId: string,
): FullNode | null {
  function search(nodes: FullFeed): FullNode | null {
    for (const node of Object.values(nodes)) {
      if (node.id === targetId) {
        return node;
      }

      const found = search(node.children);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return search(tree);
}

export function getPathToNode(
  tree: FullFeed,
  targetId: string,
): FullNode[] | null {
  function search(nodes: FullFeed, path: FullNode[]): FullNode[] | null {
    for (const node of Object.values(nodes)) {
      const currentPath = [...path, node];

      if (node.id === targetId) {
        return currentPath;
      }

      const found = search(node.children, currentPath);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return search(tree, []);
}

export function flattenTree(tree: FullFeed): FullNode[] {
  const result: FullNode[] = [];

  function traverse(nodes: FullFeed) {
    Object.values(nodes).forEach((node) => {
      result.push(node);
      traverse(node.children);
    });
  }

  traverse(tree);
  return result;
}

export function getTreeDepth(tree: FullFeed): number {
  function getDepth(nodes: FullFeed, currentDepth: number): number {
    if (Object.keys(nodes).length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    Object.values(nodes).forEach((node) => {
      const childDepth = getDepth(node.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    });

    return maxDepth;
  }

  return getDepth(tree, 0);
}

/**
 * Count total nodes in the tree
 */
export function countNodes(tree: FullFeed): number {
  let count = 0;

  function traverse(nodes: FullFeed) {
    count += Object.keys(nodes).length;
    Object.values(nodes).forEach((node) => {
      traverse(node.children);
    });
  }

  traverse(tree);
  return count;
}

export function userFromPost(poast: Poast) {
  const user: UserType = poast.event
    ? { nostr: poast.event.pubkey }
    : isValidPatp(poast.author)
      ? { urbit: poast.authorFull?.author ?? patpToFallbackUID(poast.author) }
      : { nostr: poast.author };
  return user;
}
export function userFromAuthor(userString: string): UserType {
  if (isValidPatp(userString)) return { urbit: patpToFallbackUID(userString) };
  else {
    const nostrKey = decodeNostrKey(userString);
    if (nostrKey) return { nostr: nostrKey };
    else throw new Error("bad user");
  }
}

// http://localhost:5173/apps/nostrill/t/nevent1qqsp3faj5jy9fpc6779rcs9kdccc0mxwlv2pnhymwqtjmletn72u5echttguv
//
// nevent1qqszs4v3a8n9rupfskuucczkv7kp2rmu7c2r2s0zahcm64g67ppvz0qj4c2ka
