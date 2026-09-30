// trending topics, as served by %nostrill's /j/topics scry (which reads the
// %topics agent): the owner's prefs, and each source's leading topics in
// the source's own order, already filtered to the prefs' categories

export type TopicItem = {
  source: string;
  title: string;
  url: string | null;
  // an image, google trends only
  pic: string | null;
  // hn points, google news articles in the story, google trends searches
  score: number | null;
  date: number;
  categories: string[];
  // the source's description; google trends' search term when it has none
  content: string;
  // its handle within its source, to ask for its related articles
  // (api.scryTopicLinks): they're left out here, being most of the weight
  id: string;
  // who published url, when known: google news urls are all its redirects
  publisher: string;
};
export type TopicLink = { title: string; url: string; publisher: string; pic: string | null };
export type TrendingData = Record<string, { fetched: number; topics: TopicItem[] }>;
// what %topics fetches: google trends' country, the google news edition
// (country and language), the categories to show
export type TopicPrefs = { country: string; lang: string; categories: string[] };
// spam: the %trill-ai-client provider judging it (null: no filter), and the
// topics Jev flagged or the owner marked, hidden or not, for review. hidden
// ones are already left out of sources
export type FlaggedTopic = TopicItem & {
  key: string;
  spam: number | null;
  override: boolean | null;
  hidden: boolean;
};
export type TopicSpam = { provider: string | null; threshold: number; flagged: FlaggedTopic[] };
export type Trending = { prefs: TopicPrefs | null; sources: TrendingData; spam: TopicSpam };

// fired on window by the settings page after it sends new prefs, so the
// trending card reloads
export const TOPIC_PREFS_EVENT = "trill:topic-prefs";

export const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: "world", label: "World" },
  { id: "technology", label: "Tech & science" },
  { id: "business", label: "Business" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
  { id: "internet-culture", label: "Internet culture" },
  { id: "lifestyle", label: "Lifestyle & health" },
  // what the keyword rules can't place; a lot of google trends
  { id: "other", label: "Uncategorized" },
];
// countries google trends and news both cover
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"],
  ["AU", "Australia"], ["NZ", "New Zealand"], ["IE", "Ireland"],
  ["IN", "India"], ["SG", "Singapore"], ["PH", "Philippines"],
  ["ZA", "South Africa"], ["NG", "Nigeria"], ["KE", "Kenya"],
  ["DE", "Germany"], ["AT", "Austria"], ["CH", "Switzerland"],
  ["FR", "France"], ["BE", "Belgium"], ["NL", "Netherlands"],
  ["ES", "Spain"], ["PT", "Portugal"], ["IT", "Italy"],
  ["PL", "Poland"], ["SE", "Sweden"], ["NO", "Norway"],
  ["UA", "Ukraine"], ["TR", "Türkiye"], ["IL", "Israel"],
  ["MX", "Mexico"], ["AR", "Argentina"], ["CO", "Colombia"],
  ["CL", "Chile"], ["PE", "Peru"], ["BR", "Brazil"],
  ["JP", "Japan"], ["KR", "South Korea"], ["TW", "Taiwan"],
  ["HK", "Hong Kong"], ["ID", "Indonesia"], ["VN", "Vietnam"],
].map(([code, label]) => ({ code, label }));
// google news languages. any country and language pair makes an edition
export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  ["en", "English"], ["es-419", "Spanish (Latin America)"], ["es", "Spanish (Spain)"],
  ["fr", "French"], ["de", "German"], ["it", "Italian"],
  ["pt-BR", "Portuguese (Brazil)"], ["pt-PT", "Portuguese (Portugal)"], ["nl", "Dutch"],
  ["pl", "Polish"], ["sv", "Swedish"], ["no", "Norwegian"],
  ["uk", "Ukrainian"], ["tr", "Turkish"], ["he", "Hebrew"],
  ["hi", "Hindi"], ["ja", "Japanese"], ["ko", "Korean"],
  ["zh-TW", "Chinese (Traditional)"], ["zh-CN", "Chinese (Simplified)"], ["id", "Indonesian"],
  ["vi", "Vietnamese"],
].map(([code, label]) => ({ code, label }));

export type TopicTab = { id: string; label: string };
export const TOPIC_TABS: TopicTab[] = [
  { id: "all", label: "All" },
  { id: "world", label: "World" },
  { id: "technology", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
  { id: "internet-culture", label: "Internet" },
  { id: "lifestyle", label: "Lifestyle" },
];

// scores mean different things per source, so topics are never ranked
// against each other: kinds of source take turns in this order, and within
// a kind its sources do, in SOURCE_ORDER (unknown ones last)
const KIND_ORDER = ["gnews", "gtrends", "hn"];
const SOURCE_ORDER = [
  "gnews-world",
  "gnews-technology",
  "gnews-business",
  "gnews-sports",
  "gnews-entertainment",
  "gnews-science",
  "gnews-nation",
  "gnews-health",
];

export const sourceKind = (id: string) => id.split("-")[0];
// only web links: urls are rendered as hrefs and image srcs
const webUrl = (x: unknown) =>
  typeof x === "string" && /^https?:\/\//i.test(x) ? x : null;

// null when %topics isn't running (the scry answers null)
export function parseTrending(raw: unknown): Trending | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { prefs, sources, spam } = raw as { prefs?: any; sources?: any; spam?: any };
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return null;
  const data: TrendingData = {};
  for (const [id, src] of Object.entries(sources as Record<string, any>)) {
    if (!src || !Array.isArray(src.topics)) continue;
    data[id] = {
      fetched: Number(src.fetched) || 0,
      topics: src.topics.flatMap((t: any) => {
        const topic = parseTopic(t, id);
        return topic ? [topic] : [];
      }),
    };
  }
  const goodPrefs =
    prefs &&
    typeof prefs.country === "string" &&
    typeof prefs.lang === "string" &&
    Array.isArray(prefs.categories);
  return {
    prefs: goodPrefs
      ? { country: prefs.country, lang: prefs.lang, categories: prefs.categories }
      : null,
    sources: data,
    spam: parseSpam(spam),
  };
}

function parseTopic(t: any, source: string): TopicItem | null {
  if (!t || typeof t.title !== "string" || t.title.trim() === "") return null;
  return {
    source: String(t.source ?? source),
    title: t.title,
    url: webUrl(t.url),
    pic: webUrl(t.pic),
    score: typeof t.score === "number" ? t.score : null,
    date: Number(t.date) || 0,
    categories: Array.isArray(t.categories) ? t.categories : [],
    content: typeof t.content === "string" ? t.content : "",
    id: typeof t.id === "string" ? t.id : "",
    publisher: typeof t.publisher === "string" ? t.publisher : "",
  };
}

// a topic's related articles, from api.scryTopicLinks; [] when it's gone
export function parseTopicLinks(raw: unknown): TopicLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l: any) => {
    const url = webUrl(l?.url);
    if (!url || typeof l.title !== "string") return [];
    const publisher = typeof l.publisher === "string" ? l.publisher : "";
    return [{ title: l.title, url, publisher, pic: webUrl(l.pic) }];
  });
}

// no spam part (an older %nostrill): no filter
function parseSpam(x: any): TopicSpam {
  const threshold = typeof x?.threshold === "number" ? x.threshold : 0.9;
  if (!x || typeof x !== "object") return { provider: null, threshold, flagged: [] };
  const flagged = (Array.isArray(x.flagged) ? x.flagged : []).flatMap((t: any) => {
    const topic = parseTopic(t, "");
    if (!topic || typeof t.key !== "string") return [];
    return [
      {
        ...topic,
        key: t.key,
        spam: typeof t.spam === "number" ? t.spam : null,
        override: typeof t.override === "boolean" ? t.override : null,
        hidden: t.hidden === true,
      },
    ];
  });
  return { provider: typeof x.provider === "string" ? x.provider : null, threshold, flagged };
}

// take turns across kinds of source (google news, google trends, hn), and
// within a kind across its sources, so no one source fills the card. drops
// repeated titles
export function pickTopics(data: TrendingData, tab: string, count = 5): TopicItem[] {
  const rankIn = (list: string[], x: string) => {
    const i = list.indexOf(x);
    return i === -1 ? list.length : i;
  };
  const ids = Object.keys(data).sort(
    (a, b) =>
      rankIn(KIND_ORDER, sourceKind(a)) - rankIn(KIND_ORDER, sourceKind(b)) ||
      rankIn(SOURCE_ORDER, a) - rankIn(SOURCE_ORDER, b) ||
      a.localeCompare(b),
  );
  const queues = new Map<string, TopicItem[][]>();
  for (const id of ids) {
    const topics = data[id].topics.filter(
      (t) => tab === "all" || t.categories.includes(tab),
    );
    if (topics.length === 0) continue;
    const kind = sourceKind(id);
    queues.set(kind, [...(queues.get(kind) ?? []), [...topics]]);
  }
  const picked: TopicItem[] = [];
  const seen = new Set<string>();
  const kinds = [...queues.values()];
  const nextOfKind = kinds.map(() => 0);
  while (picked.length < count && kinds.some((k) => k.some((q) => q.length > 0))) {
    kinds.forEach((sources, k) => {
      if (picked.length >= count) return;
      // this kind's next source that still has topics
      for (let tries = 0; tries < sources.length; tries++) {
        const queue = sources[nextOfKind[k] % sources.length];
        nextOfKind[k]++;
        const topic = queue.shift();
        if (!topic) continue;
        const key = topic.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(topic);
        return;
      }
    });
  }
  return picked;
}

// tabs worth showing: "all", plus categories that have topics
export function availableTabs(data: TrendingData): TopicTab[] {
  const cats = new Set(Object.values(data).flatMap((s) => s.topics.flatMap((t) => t.categories)));
  return TOPIC_TABS.filter((t) => t.id === "all" || cats.has(t.id));
}

export function sourceLabel(id: string): string {
  const kind = sourceKind(id);
  if (kind === "hn") return "Hacker News";
  if (kind === "gnews") return "Google News";
  if (kind === "gtrends") {
    const region = id.split("-")[1];
    return region ? `Google Trends ${region.toUpperCase()}` : "Google Trends";
  }
  return id;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return `${n}`;
}

// "Hacker News · 312 points"
export function topicMeta(t: TopicItem): string {
  const label = sourceLabel(t.source);
  if (t.score === null) return label;
  const kind = sourceKind(t.source);
  const unit =
    kind === "hn"
      ? "points"
      : kind === "gnews"
        ? t.score === 1
          ? "article"
          : "articles"
        : kind === "gtrends"
          ? "searches"
          : "";
  return `${label} · ${compact(t.score)}${kind === "gtrends" ? "+" : ""}${unit ? ` ${unit}` : ""}`;
}

// a headline as literal text for the backend's markdown parser, which only
// honors these escapes. backticks can't be escaped, so they become
// apostrophes instead of opening code spans
export function escapeMarkdown(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\[\]()!*_&]/g, (c) => `\\${c}`)
    .replace(/`/g, "'");
}

// "post about it": a normal post, with the topic as a blockquoted headline
// and its link after the author's own text
export function topicPostContent(text: string, topic: Pick<TopicItem, "title" | "url">): string {
  const parts = [text.trim(), `> ${escapeMarkdown(topic.title)}`];
  if (topic.url) parts.push(topic.url);
  return parts.filter((p) => p !== "").join("\n\n");
}

// "example.com", for showing where a link goes
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// who published the topic's link: as %topics found it among its related
// articles (google news urls are all news.google.com redirects), else the
// link's host
export function topicPublisher(t: Pick<TopicItem, "url" | "publisher">): string {
  if (!t.url) return "";
  return t.publisher || hostOf(t.url);
}
