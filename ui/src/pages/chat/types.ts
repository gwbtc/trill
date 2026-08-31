import type { DM } from "@/types/nostrill";

export type ChatData = DM & { live: boolean };

export type DmPanel = "thread" | "search" | "media" | "links";

export type DmRichMessage = {
  id: string;
  mine: boolean;
  text: string;
  time: string;
  media: DmMediaItem[];
  links: DmLinkItem[];
};

export type DmMediaItem = {
  id: string;
  url: string;
  kind: "image" | "video" | "audio";
  messageId: string;
  time: string;
};

export type DmLinkItem = {
  id: string;
  href: string;
  label: string;
  messageId: string;
  time: string;
};
