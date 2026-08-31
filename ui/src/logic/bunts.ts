import type { Engagement, Gate, List, Lock, PostPerms } from "@/types/trill";

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

export const pushStateBunt = {
  followers: [],
  gate: {
    lock: openLock,
    mute: openLock,
    begs: [],
    "post-begs": [],
    backlog: 0,
  },
};

export const harkStateBunt = {
  unread: {},
  engagement: [],
};

export const pullStateBunt = {
  following: [],
  begs: [],
  "post-begs": [],
};
export const listBunt: List = {
  symbol: "",
  name: "",
  desc: "",
  icon: "",
  cover: "",
  members: [],
  public: true,
};

// export const palsBunt: Pals = {
//   incoming: {},
//   outgoing: {}
// }
