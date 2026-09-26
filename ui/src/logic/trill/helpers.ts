import type { Wevent } from "@/types/nostr";
import type { FullFeed, FullNode, Poast } from "@/types/trill";
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
