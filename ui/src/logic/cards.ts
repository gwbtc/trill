// shareable cards: a snapshot of a UI card (e.g. trending topics), posted
// as a %json block with origin "card" and rendered as a card in the feed.
// the JSON comes from other ships, so parsing trusts nothing

export type CardItem = {
  title: string;
  url: string | null;
  meta: string;
  // optional thumbnail; cards shared before pictures have none
  pic?: string | null;
};
export type SharedCard = {
  v: 1;
  // which card it came from, e.g. "trending"
  kind: string;
  title: string;
  // e.g. the tab it was shared from
  subtitle: string;
  // when it was shared, ms
  at: number;
  items: CardItem[];
};

const MAX_ITEMS = 10;
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
// only web links: the url is rendered as an href
const safeUrl = (x: unknown) =>
  typeof x === "string" && /^https?:\/\//i.test(x.trim()) ? x.trim() : null;

export function parseSharedCard(content: string): SharedCard | null {
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (!raw || raw.v !== 1 || !Array.isArray(raw.items)) return null;
  const items = raw.items
    .slice(0, MAX_ITEMS)
    .map((i: any) => ({
      title: str(i?.title, 300),
      url: safeUrl(i?.url),
      meta: str(i?.meta, 120),
      pic: safeUrl(i?.pic),
    }))
    .filter((i: CardItem) => i.title !== "");
  const title = str(raw.title, 80);
  if (!title || items.length === 0) return null;
  return {
    v: 1,
    kind: str(raw.kind, 40),
    title,
    subtitle: str(raw.subtitle, 80),
    at: Number(raw.at) || 0,
    items,
  };
}

export function encodeSharedCard(card: SharedCard): string {
  return JSON.stringify(card);
}
