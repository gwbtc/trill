import type { Engagement, Gate, Lock, PostPerms } from "@/types/trill";

export const openLock: Lock = {
  rank: { caveats: [], locked: false, public: true },
  luk: { caveats: [], locked: false, public: true },
  ship: { caveats: [], locked: false, public: true },
  tags: { caveats: [], locked: false, public: true },
  pass: null,
  custom: { fn: null, public: false },
};
export const defaultGate: Gate = {
  lock: openLock,
  manual: false,
  mute: openLock,
  begs: {},
  backlog: 50,
};
export const defaultPerms: PostPerms = {
  read: defaultGate,
  write: defaultGate,
};

export const engagementBunt: Engagement = {
  reacts: {},
  quoted: [],
  shared: [],
};

// export const palsBunt: Pals = {
//   incoming: {},
//   outgoing: {}
// }
