import type { Wevent } from "./nostr";
import type { UrbitID } from "./nostrill";
import type { Ship } from "./urbit";

export type SortugRef = {
  type: string; // could call it app... anyway
  ship: Ship;
  path: string; // `/${string}`
};

export type PostID = string; //
export type ID = string; //
export interface PID {
  ship: Ship;
  id: ID;
}

export type TrillNode = Poast | FullNode;
export type FullFeed = Record<ID, FullNode>;
export type FlatFeed = Record<ID, Poast>;

export interface Engagement {
  reacts: ReactMap;
  quoted: Array<{ pid: PID }>;
  shared: Array<{ pid: PID }>;
}
export type ReactMap = Record<Ship, string>;
export interface SentPoast {
  host: Ship;
  author: Ship;
  thread: ID | null;
  parent: ID | null;
  contents: string;
  perms: PostPerms;
  tags: string[];
}
export type Poast = {
  host: Ship;
  author: Ship;
  authorFull: {host: UrbitID; author: UrbitID};
  thread: ID | null;
  parent: ID | null;
  perms: PostPerms;
  tags: string[];
  contents: Content;
  id: string;
  time: number; // not in the backend
  hash: string;
  children: ID[];
  engagement: Engagement;
  tlonRumor?: boolean;
  json?: { origin: ExternalApp; content: string }; // for rumor quoting
  event?: Wevent;
};
export type FullNode = Omit<Poast, "children"> & {
  children: FullFeed;
  prov?: boolean;
};
export type Content = Block[];
export type Block =
  | Paragraph
  | Blockquote
  | Heading
  | ListBlock
  | Codeblock
  | Eval
  | Media
  | Reference
  | ExternalContent;

export type Paragraph = { paragraph: Inline[] };
export type Blockquote = { blockquote: Inline[] };
export type Heading = { heading: { text: string; num: number } };
export type Codeblock = { codeblock: { code: string; lang: string } };
export type Eval = { hoon: string };
export type ListBlock = { list: { ordered: boolean; text: Inline[] } };
export type Media = { media: PostImages | PostVideo | PostAudio };
export type PostImages = { images: string[] };
export type PostVideo = { video: string };
export type PostAudio = { audio: string };
export type Reference = { ref: { type: string; ship: Ship; path: string } };

export type Inline =
  | TextInline
  | Italic
  | Bold
  | Strike
  | Underline
  | Superscript
  | Subscript
  | Mention
  | Codespan
  | LinkInline
  | Break;
export type TextInline = { text: string };
export type Italic = { italic: string };
export type Bold = { bold: string };
export type Strike = { strike: string };
export type Underline = { underline: string };
export type Superscript = { sup: string };
export type Subscript = { sub: string };
export type Mention = { ship: Ship };
// TODO! export type Da = {date: number}
export type Codespan = { codespan: string };
export type LinkInline = { link: { href: string; show: string } };
export type Break = { break: null };

export type ExternalContent = {
  json: {
    origin: ExternalApp;
    content: string;
  };
};
export type ExternalApp = "twatter" | "insta" | "anon" | "rumors" | "nostr" | "card";
export interface TwatterReference {
  json: {
    origin: "twatter";
    content: string;
  };
}
// interface CodeContent {
//   code: {
//     expression: string;
//     output: string[][];
//   };
// }
// Notifications
export interface Notifications {
  engagement: EngagementNotification[];
  unread: Record<Ship, PID[]>;
}
export type Notification =
  | EngagementNotification
  | FollowNotification
  | UnfollowNotification;
export type EngagementNotification =
  | ReactNotification
  | ReplyNotification
  | QuoteNotification
  | RepostNotification
  | MentionNotification;
export type NotificationData = { ship: Ship; time: number };
export interface FollowNotification {
  follow: NotificationData;
}
export interface UnfollowNotification {
  unfollow: NotificationData;
}
export interface ReactNotification {
  react: {
    pid: PID;
    react: string;
  } & NotificationData;
}
export interface ReplyNotification {
  reply: {
    ab: PID;
    ad: PID;
  } & NotificationData;
}
export interface QuoteNotification {
  quote: {
    ab: PID;
    ad: PID;
  } & NotificationData;
}
export interface RepostNotification {
  share: {
    ab: PID;
    ad: PID;
  } & NotificationData;
}
export interface MentionNotification {
  mention: {
    pid: PID;
  } & NotificationData;
}
export interface UnreadDisplay {
  [s: Ship]: string[];
}

//  data fetching
export type MixFeedScry = MixFeed | { bucun: string };

export type Cursor = string | null;
export type FC = {
  feed: FlatFeed;
  start: Cursor;
  end: Cursor;
};
export type MixFeed = {
  mix: {
    name: string;
    fc: FC;
  };
};
export type PoastScry = { post: Poast } | Bucun | NotFollowScry;
export type Bucun = { bucun: PID };
// TODO bucun no-node come on
export type UserFeedScry = UserScry | NotFollowScry;
export type NotFollowScry = { bugen: Ship };
export interface UserScry {
  feed: {
    ship: Ship;
    fc: FC;
  };
}

export type FullNodeScry =
  | { fpost: FullNode }
  | { "no-node": { ship: Ship; id: ID } };

//  Facts
export type PostFact = {
  post: ThreadFact | GossipFact;
};
export type ThreadFact = { thread: FullNode };
export type GossipFact = { gossip: { post: FullNode; feeds: string[] } };

export type PullFact = PeekFact | BegFact;
export type PeekFact = { peek: any };
export type BegFact = { beg: any };
export type HarkFact = any;
export type ListsFact = any;

export type TrillProfile = {};

export type TrillPostPermisssion =
  | "everyone"
  | "planets"
  | "followers"
  | "pals"
  | "tag";

// Lists

export type List = {
  name: string;
  symbol: string; // @tas
  public: boolean;
  desc: string;
  members: ListEntry[];
  icon: string;
  cover: string;
};
export type ListEntry = {
  service: "trill" | "twatter" | "twitter";
  username: string;
};

export type PostPerms = { read: Gate; write: Gate };
export type Gate = {
  lock: Lock;
  manual: boolean;
  begs: Record<Ship, Array<{ time: number; msg: string }>>;
  mute: Lock;
  backlog: number;
};

export type Lock = {
  rank: { caveats: Rank[]; locked: boolean; public: boolean };
  luk: { caveats: Ship[]; locked: boolean; public: boolean };
  ship: { caveats: Ship[]; locked: boolean; public: boolean };
  tags: { caveats: string[]; locked: boolean; public: boolean };
  pass: string | null;
  custom: { fn: null; public: boolean };
};
export type Rank = "czar" | "king" | "duke" | "earl" | "pawn";
// Fetch return types
export type PushState = {
  followers: Ship[];
  gate: {
    lock: Lock;
    begs: Ship[];
    postBegs: PID[];
    mute: Lock;
    backlog: number;
  };
};

export type PullState = {
  begs: Ship[];
  postBegs: PID[];
  following: Ship[];
};
export type TrillSearchResponse = {
  search: {
    query: string;
    fc: FC;
  };
};
export type ListsResponse = {
  lists: List[];
};
export type MetaPeek = {
  posts: number;
  inc: Ship[];
  out: Ship[];
  lock: Lock;
  ship: Ship;
};
export type NodePeek = {};
export type FeedPeek = {
  ship: Ship;
  feed: FlatFeed;
};
export interface FollowAttempt {
  ship: Ship;
  timestamp: number;
}
export interface Key {
  ship: Ship;
  name: string;
}
// pals stuff
// TODO
// export interface SocialData {
//   groups: any | null;
//   clubs: any | null;
//   lists: List[];
//   pals: Pals | null;
//   contacts: Contacts;
// }

export type Poll = {
  host: Ship;
  id: string; // atom id
  expiry: number;
  text: string;
  options: string[];
  votes: PollVotes;
  // TODO locks
};
export type PollVotes = HiddenVotes | OpenExcVotes | OpenIncVotes;
export type HiddenVotes = {
  type: "hid";
  exc: boolean;
  votes: Record<number, number>;
};
export type OpenExcVotes = {
  type: "exc";
  votes: Record<Ship, VoteComment>;
};
export type OpenIncVotes = {
  type: "inc";
  votes: Record<number, Ship[]>;
};
export type VoteComment = { option: number; comment: string };

export type PollPoke =
  | CreatePoll
  | CancelPoll
  | ChangeExpiry
  | VotePoke
  | CancelVote
  | PeekPoll;
export type PeekPoll = { peek: PID };
export type SentPoll = {
  text: string;
  expiry: number;
  options: string[];
  exc: boolean;
  hidden: boolean;
  private: boolean;
  id: string;
};
export type CreatePoll = {
  propose: SentPoll;
};
export type CancelPoll = {
  cancel: ID;
};
export type ChangeExpiry = {
  "change-expiry": {
    pid: PID;
    expiry: number;
  };
};
export type VotePoke = {
  vote: {
    pid: PID;
    option: number;
    comment: string;
  };
};
export type CancelVote = {
  "cancel-vote": { pid: PID; option: number };
};
export type PollScry = OnePoll | DonePolls | CurrentPolls | BadPoll;
export type OnePoll = { poll: Poll };
export type DonePolls = { done: Poll[] };
export type CurrentPolls = { cur: Poll[] };
export type BadPoll = { ng: null };
export type TombPoll = { tomb: null };

export type PollUpdate = NewPollU | DedPollU | OldPollU | PollPeekRes;
export type DedPollU = { "ded-poll": PID };
export type OldPollU = { pid: PID } & (
  | NewVoteU
  | PollExpiryChanged
  | VoteCanceled
  | PollPeekRes
);
export type PollPeekRes = {
  "peek-res": PollPeekOK | PollPeekNG | PollPeekNF;
};
export type PollPeekOK = {
  "peek-ok": Poll;
};
export type PollPeekNG = { "peek-ng": string };
export type PollPeekNF = { "no-poll": null };

export type NewPollU = {
  "new-poll": Poll;
};
export type NewVoteU = {
  type: "new-vote";
  update: {
    option: number;
    ship: Ship;
    comment: string;
  };
};
export type PollExpiryChanged = {
  type: "expiry-changed";
  update: {
    expiry: number;
  };
};
export type VoteCanceled = {
  type: "vote-canceled";
  update: { option: number; ship: Ship };
};
