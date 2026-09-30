
export const FeedPostCount = 50;

export const MOBILE_BROWSER_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry/i;

export const REF_REGEX = new RegExp(
  /urbit:\/\/[a-z0-9-]+\/~[a-z-_]+\/[a-z0-9-_]+/gim,
);

// export const URL_REGEX = new RegExp(
//   /^(https?:\/\/)?((localhost)|([\w-]+(\.[\w-]+)+)|(\d{1,3}(\.\d{1,3}){3}))(:\d{2,5})?(\/[^\s?#]*)?(\?[^#\s]*)?(#[^\s]*)?$/gim,
// );
export const URL_REGEX = new RegExp(
  /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
);
export const IMAGE_REGEX = new RegExp(
  /https:\/\/.+\.(jpg|img|png|gif|tiff|jpeg|webp|webm|svg)\b/gi,
);
export const IMAGE_SUBREGEX = new RegExp(
  /.*(jpg|img|png|gif|tiff|jpeg|webp|webm|svg)$/,
);
export const VIDEO_SUBREGEX = new RegExp(/.*(mov|mp4|ogv|mkv|m3uv)$/);

// canonical sub names for relay subscriptions we fire; the backend files
// events under these names in nostr-feeds
export const SYNC_SUB_NAME = "timeline";
export const PROFILES_SUB_NAME = "profiles";
// notes per "load older" request; relays cap a req at a few hundred anyway
export const NOSTR_PAGE_SIZE = 200;
export const GLOBAL_RELAY_URL = "wss://nostr.sortug.com";
// export const GLOBAL_RELAY_URL = "ws://192.168.1.110:8080";
