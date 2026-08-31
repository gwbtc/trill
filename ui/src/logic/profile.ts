import { clan, sein } from "urbit-ob";
import type { UserType } from "@/types/nostrill";
import type { FC, Poast } from "@/types/trill";

export interface ProfileMediaItem {
  id: string;
  url: string;
  label: string;
  multi: boolean;
  post: Poast;
}

function belongsToUser(post: Poast, userId?: string) {
  if (!userId) return true;
  return (
    post.author === userId ||
    post.event?.pubkey === userId ||
    post.authorFull?.author?.patp === userId
  );
}

export function getProfileFeedPosts(feed: FC | undefined, userId?: string) {
  if (!feed) return [];
  return Object.values(feed.feed)
    .filter((post) => belongsToUser(post, userId))
    .sort((a, b) => b.time - a.time);
}

export function getProfilePosts(feed: FC | undefined, userId?: string) {
  return getProfileFeedPosts(feed, userId).filter((post) => !post.parent);
}

export function getProfileReplies(feed: FC | undefined, userId?: string) {
  return getProfileFeedPosts(feed, userId).filter((post) => Boolean(post.parent));
}

export function getReplyTarget(post: Poast) {
  const taggedTarget = post.event?.tags.find((tag) => tag[0] === "p")?.[1];
  return taggedTarget || post.host;
}

export function getProfileMedia(feed: FC | undefined, userId?: string) {
  return getProfileFeedPosts(feed, userId).flatMap((post) =>
    post.contents.flatMap((block, blockIndex) => {
      if (!("media" in block) || !("images" in block.media)) return [];
      const images = block.media.images.filter(Boolean);
      return images.map((url, imageIndex) => ({
        id: `${post.hash || post.id}-${blockIndex}-${imageIndex}`,
        url,
        label: imageLabel(url),
        multi: images.length > 1,
        post,
      }));
    }),
  );
}

export function getProfileGalaxy(user: UserType) {
  if (!("urbit" in user)) return null;

  try {
    let sponsor = user.urbit.patp;
    for (let depth = 0; depth < 3 && clan(sponsor) !== "galaxy"; depth += 1) {
      sponsor = sein(sponsor);
    }
    return clan(sponsor) === "galaxy" ? sponsor : null;
  } catch {
    return null;
  }
}

function imageLabel(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).pop();
    return filename ? decodeURIComponent(filename) : "image";
  } catch {
    const filename = url.split(/[/?#]/).filter(Boolean).pop();
    return filename || "image";
  }
}
