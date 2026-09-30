// Fetch Google News topic feeds and print what they contain.
//
//   bun scripts/google-news.ts                      # all topics, US English
//   bun scripts/google-news.ts SPORTS WORLD         # some topics
//   bun scripts/google-news.ts --gl GB --hl en-GB   # another edition
//   bun scripts/google-news.ts --limit 5            # items shown per topic
//   bun scripts/google-news.ts --json > out.json    # everything, parsed
//
// Every run also saves each topic to scripts/google-news/: <topic>.json (the
// request, response info and parsed items) and <topic>.xml (the raw body).
//
// No dependencies. The feeds are undocumented; their <copyright> limits them
// to personal, non-commercial feed readers.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dir, "google-news");

const TOPICS = ["WORLD", "NATION", "BUSINESS", "TECHNOLOGY", "ENTERTAINMENT", "SPORTS", "SCIENCE", "HEALTH"];

interface Related { title: string; url: string; publisher: string }
interface Item {
  title: string;        // headline, " - Publisher" suffix removed
  rawTitle: string;
  link: string;         // news.google.com redirect
  publisher: string;
  publisherUrl: string;
  published: string;    // ISO, UTC
  related: Related[];   // other articles in the same story cluster
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]!).trim() : "";
}

function parseItem(xml: string): Item {
  const rawTitle = tag(xml, "title");
  const publisher = tag(xml, "source");
  const publisherUrl = xml.match(/<source url="([^"]*)"/)?.[1] ?? "";
  const suffix = ` - ${publisher}`;
  const title = publisher && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
  // description is HTML: <ol><li><a href="...">title</a>&nbsp;&nbsp;<font ...>publisher</font></li>...
  const description = tag(xml, "description");
  const related = [...description.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:&nbsp;|\s)*<font[^>]*>([\s\S]*?)<\/font>/g)]
    .map(([, url, t, p]) => ({ url: decode(url!), title: decode(t!).trim(), publisher: decode(p!).trim() }));
  const date = new Date(tag(xml, "pubDate"));
  return {
    title, rawTitle, link: tag(xml, "link"), publisher, publisherUrl,
    published: Number.isNaN(date.getTime()) ? "" : date.toISOString(), related,
  };
}

async function fetchTopic(topic: string, hl: string, gl: string) {
  const url = `https://news.google.com/rss/headlines/section/topic/${topic}?hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
  const started = performance.now();
  const res = await fetch(url, { headers: { "user-agent": "nostrill-topics/0.1" } });
  const body = await res.text();
  const ms = Math.round(performance.now() - started);
  const items = [...body.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => parseItem(m[1]!));
  const result = {
    topic, url, finalUrl: res.url, status: res.status, ms, bytes: body.length,
    fetchedAt: new Date().toISOString(), edition: { gl, hl },
    headers: Object.fromEntries(res.headers), items,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${topic}.xml`), body);
  writeFileSync(join(OUT_DIR, `${topic}.json`), JSON.stringify(result, null, 2));
  return result;
}

const flags = new Set(["--gl", "--hl", "--limit"]);
const topics = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !flags.has(all[i - 1]!));
const gl = arg("--gl", "US");
const hl = arg("--hl", "en-US");
const limit = Number(arg("--limit", "3"));
const json = process.argv.includes("--json");

const results = [];
for (const topic of topics.length ? topics.map(t => t.toUpperCase()) : TOPICS) {
  const r = await fetchTopic(topic, hl, gl);
  results.push(r);
  if (json) continue;
  console.log(`\n== ${r.topic}: HTTP ${r.status} in ${r.ms}ms, ${r.bytes} B, ${r.items.length} items`);
  if (r.finalUrl !== r.url) console.log(`   (redirected to ${r.finalUrl})`);
  for (const it of r.items.slice(0, limit)) {
    console.log(`  ${it.published}  [${it.publisher}]  ${it.title}`);
    for (const rel of it.related.slice(1, 4)) console.log(`      + [${rel.publisher}] ${rel.title}`);
    if (it.related.length > 4) console.log(`      + ${it.related.length - 4} more in cluster`);
  }
}

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const all = results.flatMap(r => r.items);
  const clustered = all.filter(i => i.related.length > 1).length;
  const publishers = new Set(all.map(i => i.publisher)).size;
  console.log(`\n${all.length} items across ${results.length} topics, ${publishers} publishers, ${clustered} with related articles`);
  console.log(`saved <topic>.json and <topic>.xml to ${OUT_DIR}`);
}
