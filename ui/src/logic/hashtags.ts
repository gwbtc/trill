// hashtags in the posts we have: "#word" in the text, and nostr "t" tags.
// counted once per post, case-insensitively, most used first

export type HashtagCount = { tag: string; count: number };

const HASHTAG = /(?:^|[^\p{L}\p{N}_&#/])#([\p{L}\p{N}_]{2,40})/gu;

export function postHashtags(text: string, tTags: string[] = []): Set<string> {
  const tags = new Set<string>();
  for (const m of text.matchAll(HASHTAG)) tags.add(m[1].toLowerCase());
  for (const t of tTags) {
    const tag = t.replace(/^#/, "").trim().toLowerCase();
    if (/^[\p{L}\p{N}_]{2,40}$/u.test(tag)) tags.add(tag);
  }
  // "#1", "#2024": numbers, not topics
  for (const tag of tags) if (/^\d+$/.test(tag)) tags.delete(tag);
  return tags;
}

export function countHashtags(posts: { text: string; tTags?: string[] }[]): HashtagCount[] {
  const counts = new Map<string, number>();
  for (const p of posts)
    for (const tag of postHashtags(p.text, p.tTags))
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
