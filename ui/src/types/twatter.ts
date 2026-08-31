import type { Ship } from "./urbit";
import type { Content as TrillContent } from "@/types/trill";

export interface APITweet {
  core: APITweetCore;
  legacy: APITweetLegacy;
  rest_id?: string; // number
  __typename?: string;
  card?: any;
  quoted_status_result?: { result: APIQuoteTweet };
}
export interface APIQuoteTweet extends APITweet {
  quotedRefResult: { result: { rest_id: string; __typename: string } };
}
export interface APITwitterPoll {
  binding_values: any[];
  card_platform: any;
  name: string;
  url: string;
  user_refs_results: any[];
}
export interface UserEntities {
  description: {
    urls: any[];
  };
  url: {
    urls: URLEntity[];
  };
}
export interface TweetEntities {
  user_mentions: UserMentionEntity[];
  urls: URLEntity[];
  hashtags: HashtagEntity[];
  symbols: any[];
  media?: MediaEntity[];
}
export interface UserMentionEntity {
  id_str: string; // "144930676"
  indices: [number, number];
  name: string; // "Naninizhoni"
  screen_name: string; // "naninizhoni"
}
export interface HashtagEntity {
  indices: [number, number];
  text: string;
}
export interface URLEntity {
  url: string;
  display_url: string;
  expanded_url: string;
  indices: [number, number];
}
export interface MediaEntity {
  display_url: string; // "pic.twitter.com/0qkz8kpFPQ"
  expanded_url: string; // "https://twitter.com/ThaiNewsReports/status/1476368702924898304/photo/1"
  media_url_https: string; // "https://pbs.twimg.com/media/FH0dgqeXEAEHVgI.jpg"
  url: string; // "https://t.co/0qkz8kpFPQ"
  features: {
    large: { faces: any[] };
    medium: { faces: any[] };
    orig: { faces: any[] };
    small: { faces: any[] };
  };
  id_str: string;
  indices: [number, number];
  original_info: {
    height: number;
    width: number;
    focus_rects?: { x: number; y: number; w: number; h: number }[];
  };
  sizes: {
    large: MediaSize;
    medium: MediaSize;
    small: MediaSize;
    thumb: MediaSize;
  };
  type: "photo"; //"photo" | ??
}
export interface ExtendedEntity {
  media: ExtendedMediaEntity[] | VideoEntity[];
}
export interface ExtendedMediaEntity {
  display_url: string; // "pic.twitter.com/0qkz8kpFPQ"
  expanded_url: string; // "https://twitter.com/ThaiNewsReports/status/1476368702924898304/photo/1"
  media_url_https: string; // "https://pbs.twimg.com/media/FH0dgqeXEAEHVgI.jpg"
  url: string; // "https://t.co/0qkz8kpFPQ"
  features: {
    large: { faces: any[] };
    medium: { faces: any[] };
    orig: { faces: any[] };
    small: { faces: any[] };
  };
  id_str: string;
  media_key: string; // "3_1476368699842039809"
  indices: [number, number];
  original_info: {
    height: number;
    width: number;
    focus_rects?: { x: number; y: number; w: number; h: number }[];
  };
  sizes: {
    large: MediaSize;
    medium: MediaSize;
    small: MediaSize;
    thumb: MediaSize;
  };
  type: "photo" | "video"; // ??
  ext_media_availability: { status: string }; // "Available"
  ext_media_color: {
    palette: {
      percentage: number;
      rgb: { red: number; blue: number; green: number };
    }[];
  };
}
export interface VideoEntity extends ExtendedMediaEntity {
  original_info: { height: number; width: number };
  additional_media_info: { monetizable: boolean };
  mediaStats: { viewCount: number };
  video_info: {
    aspect_ratio: [number, number];
    duration_millis: number;
    variants: VideoVariant[];
  };
}
export interface VideoVariant {
  bitrate?: number;
  content_type: string; // "video/mp4" "application/x-mpegURL"
  url: string; // "https://video.twimg.com/ext_tw_video/1476257027378888711/pu/vid/640x360/KwFE_5vWD7hAVtu4.mp4?tag=12"
}
export interface MediaSize {
  h: number;
  w: number;
  resize: "crop" | "fit";
}
export interface APITweetLegacy {
  conversation_id_str: string; // thread id
  created_at: string; // "Wed Dec 15 14:02:32 +0000 2021"
  display_text_range: [number, number]; // [0, 96]
  entities: TweetEntities;
  favorite_count: number;
  favorited: boolean;
  full_text: string; //
  id_str: string; // "1471118482095943680"
  is_quote_status: boolean;
  lang: string; // "en"
  possibly_sensitive: boolean;
  possibly_sensitive_editable: boolean;
  quote_count: number;
  reply_count: number;
  retweet_count: number;
  retweeted: boolean;
  source: string; // "<a href=\"https://mobile.twitter.com\" rel=\"nofollow\">Twitter Web App</a>"
  user_id_str: string; // "368897808"
  retweeted_status_result?: { result: APITweet };
  quoted_status_id_str?: string;
  quoted_status_permalink?: {
    display: string; //"twitter.com/lijukic/status…"
    expanded: string; //"https://twitter.com/lijukic/status/1476284640826736640"
    url: string; //"https://t.co/1yLiM97600"
  };
  in_reply_to_screen_name?: string;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id_str?: string;
  self_thread?: { id_str: string };
  extended_entities?: ExtendedEntity;
}
export interface Tweet {
  index: string; // number
  parent: string | null; // number
  thread: string; // number
  time: number;
  author: TweetAuthor;
  contents: TwatterToken[];
  text: string;
  media: TweetMedia[];
  poll: TwatterPoll | null;
  rt_by: TweetAuthor | null;
  rt_time: number | null;
  language: string;
  quoting: Tweet | null;
  replies: number;
  rts: number;
  likes: number;
  quotes: number;
}
export type TweetMedia = TweetPic | TweetVideo;
export interface TweetPic {
  url: string; //url
  thumbnail?: string; //url
}
export interface TweetVideo {
  url: string; //url
  thumbnail: string; //url
}

export interface TwatterPoll {
  card_url: string;
  api: string;
  last_updated_datetime_utc: Date;
  end_datetime_utc: Date;
  counts_are_final: boolean;
  choice1_label: string;
  choice1_count: string;
  choice2_label: string;
  choice2_count: string;
  choice3_label?: string;
  choice3_count?: string;
  choice4_label?: string;
  choice4_count?: string;
}

export interface TweetAuthor {
  suspended?: boolean;
  username: string;
  name: string;
  id: string; // number
  created: number; // date
  bio: string;
  avatar: string;
  avatar_big: string;
  cover_img: string;
  following: number;
  followers: number;
  location: string;
  url: string;
  bluecheck: boolean;
  locked: boolean;
  withheld_in_countries: string[];
  post_count: number;
  media_count: number;
  listed_count: number;
  patp: Ship | null;
}
export type EntityType =
  | "user_mentions"
  | "hashtags"
  | "urls"
  | "media"
  | "symbol";
export type tokenizerData = [string, taggedContent[]];
export type taggedContent = [string, TwatterToken];
export type TwatterToken = TwatterContent | EmojiContent | HashtagContent;
export type TwatterContent =
  | { text: string }
  | { mention: string }
  | { url: string }
  | { hashtag: string };
export interface EmojiContent {
  emoji: string;
}
export interface HashtagContent {
  hashtag: string;
}
export interface TwatterThread {
  thread: TweetsWithCursor;
  replyThreads: TweetsWithCursor[];
  cursor: string;
}
export interface TweetsWithCursor {
  tweets: Tweet[];
  cursor: string;
  cursorBottom?: string;
  type?: string;
}
export interface APITweetCore {
  user: APIUserProfile;
}
export interface APIUserProfile {
  affiliates_highlighted_label?: any;
  id?: string; // base64
  rest_id: string; // number
  legacy: {
    created_at: string; // "Tue Sep 06 12:23:27 +0000 2011"
    default_profile: boolean;
    default_profile_image: boolean;
    description: string;
    entities: UserEntities;
    fast_followers_count: number;
    favourites_count: number;
    followers_count: number;
    friends_count: number;
    has_custom_timelines: boolean;
    is_translator: boolean;
    listed_count: number;
    location: string;
    media_count: number;
    name: string;
    normal_followers_count: number;
    pinned_tweet_ids_str: string[]; // ['1471118482095943680']
    profile_banner_extensions: any; //{mediaColor: {…}}
    profile_banner_url: string; // "https://pbs.twimg.com/profile_banners/368897808/1398230281"
    profile_image_extensions: any; // {mediaColor: {…}}
    profile_image_url_https: string; //"https://pbs.twimg.com/profile_images/1193225494994571264/So4axAeC_normal.jpg"
    profile_interstitial_type: string; // ""
    protected: boolean;
    screen_name: string;
    statuses_count: number;
    translator_type: string; // "none"
    url?: string; // "https://t.co/uaINnItg4d"
    verified: boolean;
    withheld_in_countries: string[];
  };
}

// return types of our Urbit fetcher
export type NoCokiRes = { "no-coki": null };
export type BadRequestRes = { fail: string };
export type TwatterSearchRes = TwatterSearchResOK | NoCokiRes | BadRequestRes;
export type TwatterUserRes = TwatterUserResOK | NoCokiRes | BadRequestRes;
export type TwatterThreadRes = TwatterThreadResOK | NoCokiRes | BadRequestRes;
export type TwatterUserResOK = {
  user: {
    profile: string;
    feed: string;
  };
};
export type TwatterThreadResOK = TwatterLoggedThreadRes | TwatterLurkThreadRes;
export type TwatterLurkThreadRes = {
  "thread-lurk": string;
};
export type TwatterLoggedThreadRes = {
  thread: string;
};
export type TwatterSearchResOK = {
  search: {
    query: string;
    data: string;
  }
}
export type TwatterNotification = {
  type: string;
  user: string;
  post?: string;
  text: string;
}