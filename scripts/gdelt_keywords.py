#!/usr/bin/env python3
"""Collect labeled GDELT articles and derive category keywords from them.

Three subcommands:

  collect   fetch recent English articles from the GDELT DOC API, labeled by
            category two ways:
              - GDELT's own themes (world, business, technology), e.g.
                theme:ELECTION
              - the publisher's section in the article URL (/sport/,
                /entertainment/, /lifestyle/...) for articles from big
                general news sites
            GDELT rate-limits hard (nominally one request per 5s, in practice
            much less), so every 429 is retried forever with growing waits.
            Everything is logged: each response, each wait, and the machine's
            public IP and region, so runs from different boxes can be compared.

  analyze   rank the words and two-word phrases in each category's titles by
            how distinctive they are against all other titles (log-odds with
            an informative Dirichlet prior), and write the candidates.

  compare   one row per collect run: IP, location, provider, share of 429s,
            latency, total time waited.

Standard library only; Python 3.8+.

  python3 gdelt_keywords.py collect                  # writes ./gdelt-run-<host>-<time>/
  python3 gdelt_keywords.py collect --out DIR        # resumes DIR if it exists
  python3 gdelt_keywords.py analyze DIR [DIR ...]    # pools several runs
  python3 gdelt_keywords.py compare DIR [DIR ...]    # throttling per machine/IP

On NixOS without python3 on PATH:  nix-shell -p python3 --run "python3 gdelt_keywords.py collect"
"""

import argparse
import json
import math
import os
import random
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

API = "https://api.gdeltproject.org/api/v2/doc/doc"
USER_AGENT = "nostrill-topics-keywords/0.1 (research script)"

# Labels from GDELT's theme tagger. Only these three categories have usable
# themes; see bulk/gdelt-gkg-themes.tsv.
THEMES = {
    "world": ["ELECTION", "ARMEDCONFLICT", "GENERAL_GOVERNMENT"],
    "business": ["ECON_STOCKMARKET", "ECON_INFLATION", "ECON_INTEREST_RATES"],
    "technology": ["SCIENCE", "SOC_EMERGINGTECH", "TECH_AUTOMATION", "CYBER_ATTACK"],
}

# General news sites whose URLs carry the section. Regions match the
# Google Trends sources (US, GB, IN, CA, AU).
DOMAINS = [
    "theguardian.com", "bbc.co.uk", "independent.co.uk",
    "nytimes.com", "cnn.com", "usatoday.com", "latimes.com",
    "hindustantimes.com", "thehindu.com",
    "cbc.ca", "abc.net.au",
]

# URL path segment -> category. Checked in order; first match wins.
SECTIONS = [
    ("sports", r"sports?|football|soccer|cricket|tennis|nfl|nba|mlb|nhl|golf|rugby|formula-?1|f1|olympics"),
    ("entertainment", r"entertainment|entertainment-arts|arts|culture|film|films|movies?|music|tv|television|tv-and-radio|celebrity|celebrities|showbiz|stage|books"),
    ("lifestyle", r"lifestyle|life-?and-?style|life|style|fashion|food|dining|recipes?|travel|wellness|well|home-?and-?garden|beauty"),
    ("internet-culture", r"internet-?culture|viral|trending|social-?media|memes?"),
    ("technology", r"technology|tech|science|science-environment|gadgets|games|gaming"),
    ("business", r"business|money|markets?|economy|finance|personal-?finance"),
    ("world", r"world(-[a-z]+)*|politics|uk-politics|us-news|uk-news|australia-news|india-news|nation|national"),
]
SECTION_RES = [(cat, re.compile(r"^(%s)$" % pat, re.I)) for cat, pat in SECTIONS]

STOPWORDS = set("""
a about above after again against all am an and any are as at be because been
before being below between both but by can could did do does doing down during
each few for from further had has have having he her here hers herself him
himself his how i if in into is it its itself just me more most my myself no nor
not now of off on once only or other our ours ourselves out over own same she
should so some such than that the their theirs them themselves then there these
they this those through to too under until up very was we were what when where
which while who whom why will with would you your yours yourself yourselves
says said say new news video watch live latest update updates first last one two
three year years day days week time us s t amp vs via get gets got will
""".split())


# --- logging -------------------------------------------------------------------

class Log:
    """Human-readable lines to stdout and log.txt; one JSON object per request
    attempt to requests.jsonl."""

    def __init__(self, out):
        self.text = open(os.path.join(out, "log.txt"), "a", buffering=1)
        self.jsonl = open(os.path.join(out, "requests.jsonl"), "a", buffering=1)

    def line(self, msg):
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        text = "%s %s" % (stamp, msg)
        print(text, flush=True)
        self.text.write(text + "\n")

    def record(self, obj):
        obj = dict(obj, ts=datetime.now(timezone.utc).isoformat())
        self.jsonl.write(json.dumps(obj) + "\n")


def human(seconds):
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return "%dh%02dm%02ds" % (h, m, s)
    if m:
        return "%dm%02ds" % (m, s)
    return "%ds" % s


# --- http ----------------------------------------------------------------------

def http_get(url, timeout):
    """-> (status, headers, body_text, elapsed_s, error). Never raises."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, dict(resp.headers), body, time.monotonic() - started, None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        return e.code, dict(e.headers or {}), body, time.monotonic() - started, None
    except Exception as e:  # timeouts, DNS, resets
        return None, {}, "", time.monotonic() - started, "%s: %s" % (type(e).__name__, e)


def whereami(log, timeout):
    """Public IP and location, for comparing runs. Best effort."""
    info = {"hostname": socket.gethostname()}
    for url in ("https://ipinfo.io/json", "https://ipapi.co/json/"):
        status, _, body, _, err = http_get(url, timeout)
        if status == 200:
            try:
                data = json.loads(body)
                info.update({k: data.get(k) for k in
                             ("ip", "city", "region", "country", "org", "country_name", "timezone")
                             if data.get(k)})
                info["ip_source"] = url
                break
            except ValueError:
                pass
        log.line("  (could not reach %s: %s)" % (url, err or "http %s" % status))
    log.line("machine: %s" % json.dumps(info))
    return info


# --- gdelt ---------------------------------------------------------------------

def is_throttled(status, body):
    return status == 429 or "Please limit requests" in body


class Fetcher:
    """GDELT requests with adaptive pacing and unlimited retries.

    Pacing: requests start at least `gap` seconds apart, whatever happened.
    `gap` starts at --min-gap and adapts:
      - learn: when a request gets through after one or more 429s, the time
        since the previous successful request (start to start) is an
        interval that worked; gap becomes that, if it's longer
      - probe: after a success with no 429 before it, gap shrinks by
        --shrink (default 0.9), never below --min-gap, so one unlucky long
        wait doesn't slow the rest of the run. --shrink 1 disables this
    Retries: on a 429 (or GDELT's rate-limit text), network errors and 5xx,
      wait and retry the same request, forever. The wait starts at
      --backoff-start and grows by --backoff-factor per consecutive failure,
      up to --backoff-max per wait (retries are unlimited). A longer
      Retry-After header is honored. Jitter +-10%. The wait resets after any
      answer that isn't throttled.
    Other 4xx (a bad query) are logged and not retried.
    """

    def __init__(self, args, log, stats):
        self.args, self.log, self.stats = args, log, stats
        self.last_start = 0.0
        self.wait = args.backoff_start
        self.gap = args.min_gap
        self.last_ok_start = None     # start time of the last accepted request
        self.throttled_since_ok = 0   # 429s since then

    def adapt(self, started):
        """An answer that wasn't throttled: update the gap from it."""
        old = self.gap
        if self.last_ok_start is not None:
            interval = started - self.last_ok_start
            if self.throttled_since_ok:
                if interval > self.gap:
                    self.gap = min(interval, self.args.backoff_max)
                    self.log.line("  gap %s -> %s: learned from the last success, %s after the "
                                  "previous one with %d 429(s) in between"
                                  % (human(old), human(self.gap), human(interval),
                                     self.throttled_since_ok))
            else:
                self.gap = max(self.args.min_gap, self.gap * self.args.shrink)
                if round(self.gap) != round(old):
                    self.log.line("  gap %s -> %s: no 429 since the last success, probing faster"
                                  % (human(old), human(self.gap)))
        self.last_ok_start = started
        self.throttled_since_ok = 0
        self.stats["gap_s"] = round(self.gap, 1)

    def get(self, label, url):
        attempt = 0
        while True:
            attempt += 1
            pause = self.gap - (time.monotonic() - self.last_start)
            if pause > 0:
                time.sleep(pause)
            started = self.last_start = time.monotonic()
            status, headers, body, elapsed, err = http_get(url, self.args.timeout)
            self.stats["attempts"] += 1

            excerpt = re.sub(r"\s+", " ", body[:160]).strip()
            rec = {"label": label, "attempt": attempt, "url": url, "status": status,
                   "elapsed_ms": int(elapsed * 1000), "bytes": len(body), "error": err,
                   "gap_s": round(self.gap, 1)}

            if err or (status and status >= 500) or is_throttled(status, body):
                kind = "throttled" if is_throttled(status, body) else "error"
                self.stats[kind] += 1
                if kind == "throttled":
                    self.throttled_since_ok += 1
                wait = self.wait * random.uniform(0.9, 1.1)
                retry_after = headers.get("Retry-After") or headers.get("retry-after")
                if retry_after and retry_after.isdigit():
                    wait = max(wait, float(retry_after))
                self.stats["waited_s"] += wait
                self.log.record(dict(rec, outcome=kind, wait_s=round(wait, 1), excerpt=excerpt))
                self.log.line(
                    "  [%s] attempt %d -> %s in %dms (%d B)%s%s; waiting %s before retrying "
                    "(gap %s, total waited %s)"
                    % (label, attempt, status or err, elapsed * 1000, len(body),
                       ' "%s"' % excerpt[:70] if excerpt else "",
                       "; Retry-After %s" % retry_after if retry_after else "",
                       human(wait), human(self.gap), human(self.stats["waited_s"])))
                time.sleep(wait)
                self.wait = min(self.wait * self.args.backoff_factor, self.args.backoff_max)
                continue

            self.wait = self.args.backoff_start
            self.adapt(started)
            if status != 200:
                self.stats["failed"] += 1
                self.log.record(dict(rec, outcome="failed", excerpt=excerpt))
                self.log.line("  [%s] attempt %d -> %s in %dms: %s -- not retrying (query problem?)"
                              % (label, attempt, status, elapsed * 1000, excerpt))
                return None
            try:
                data = json.loads(body) if body.strip() else {}
            except ValueError:
                self.stats["failed"] += 1
                self.log.record(dict(rec, outcome="not-json", excerpt=excerpt))
                self.log.line("  [%s] attempt %d -> 200 in %dms but not JSON: %s -- not retrying"
                              % (label, attempt, elapsed * 1000, excerpt))
                return None
            articles = data.get("articles") or []
            self.stats["ok"] += 1
            self.log.record(dict(rec, outcome="ok", articles=len(articles)))
            self.log.line("  [%s] attempt %d -> 200 in %dms (%d B), %d articles%s"
                          % (label, attempt, elapsed * 1000, len(body), len(articles),
                             "" if articles else " (empty: {} means no matches)"))
            return data


def doc_url(query, start, end, maxrecords):
    params = {
        "query": query, "mode": "artlist", "format": "json",
        "maxrecords": str(maxrecords), "sort": "datedesc",
        "startdatetime": start.strftime("%Y%m%d%H%M%S"),
        "enddatetime": end.strftime("%Y%m%d%H%M%S"),
    }
    return API + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)


def section_label(url):
    """Category from the article URL's first three non-date path segments,
    or None. Trailing ids are dropped (bbc: /news/entertainment-arts-68123456)."""
    try:
        path = urllib.parse.urlparse(url).path
    except ValueError:
        return None
    segments = [re.sub(r"-\d+$", "", s) for s in path.lower().split("/")
                if s and not re.fullmatch(r"[\d-]+", s)][:3]
    for seg in segments:
        for cat, rx in SECTION_RES:
            if rx.match(seg):
                return cat
    return None


def tasks(days):
    """(label, query, kind, category) for every request, per day window."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    out = []
    for d in range(days):
        end = now - timedelta(days=d)
        start = end - timedelta(days=1)
        tag = start.strftime("%Y%m%d%H")
        for cat, themes in THEMES.items():
            for th in themes:
                out.append(("theme-%s-%s" % (th, tag), "theme:%s sourcelang:english" % th,
                            "theme", cat, start, end))
        for dom in DOMAINS:
            out.append(("domain-%s-%s" % (dom, tag), "domain:%s sourcelang:english" % dom,
                        "domain", None, start, end))
    return out


def collect(args):
    host = re.sub(r"[^A-Za-z0-9.-]", "_", socket.gethostname())
    out = args.out or "gdelt-run-%s-%s" % (host, datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    log = Log(out)
    stats = Counter()
    run_started = time.monotonic()

    log.line("=" * 72)
    log.line("gdelt_keywords collect -> %s" % os.path.abspath(out))
    log.line("settings: days=%d maxrecords=%d min-gap=%ss (adaptive, shrink x%s) backoff=%ss x%s "
             "up to %ss per wait, unlimited retries"
             % (args.days, args.maxrecords, args.min_gap, args.shrink, args.backoff_start,
                args.backoff_factor, args.backoff_max))
    machine = whereami(log, args.timeout)

    todo = tasks(args.days)
    fetcher = Fetcher(args, log, stats)
    articles_file = open(os.path.join(out, "articles.jsonl"), "a", buffering=1)

    for n, (label, query, kind, cat, start, end) in enumerate(todo, 1):
        raw_path = os.path.join(out, "raw", label + ".json")
        if os.path.exists(raw_path):
            log.line("[%d/%d] %s: already fetched, skipping" % (n, len(todo), label))
            continue
        log.line("[%d/%d] %s  query=%r  %s..%s" % (n, len(todo), label, query,
                                                   start.strftime("%m-%d %H:%M"), end.strftime("%m-%d %H:%M")))
        data = fetcher.get(label, doc_url(query, start, end, args.maxrecords))
        if data is None:
            continue
        with open(raw_path, "w") as f:
            json.dump(data, f)
        labeled = Counter()
        for a in data.get("articles") or []:
            if (a.get("language") or "").lower() not in ("", "english"):
                continue
            url, title = a.get("url") or "", (a.get("title") or "").strip()
            if not url or not title:
                continue
            label_by = "theme" if kind == "theme" else "section"
            category = cat if kind == "theme" else section_label(url)
            labeled[category or "unlabeled"] += 1
            articles_file.write(json.dumps({
                "url": url, "title": title, "domain": a.get("domain"),
                "seendate": a.get("seendate"), "sourcecountry": a.get("sourcecountry"),
                "category": category, "label_by": label_by, "query": query,
            }) + "\n")
        if labeled:
            log.line("  labels: %s" % ", ".join("%s=%d" % kv for kv in labeled.most_common()))

    elapsed = time.monotonic() - run_started
    summary = {
        "machine": machine, "out": os.path.abspath(out),
        "finished": datetime.now(timezone.utc).isoformat(),
        "elapsed_s": round(elapsed), "requests": len(todo), "stats": dict(stats),
        "settings": {k: getattr(args, k) for k in
                     ("days", "maxrecords", "min_gap", "shrink", "backoff_start", "backoff_factor",
                      "backoff_max")},
    }
    with open(os.path.join(out, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    log.line("done in %s: %d ok, %d throttled (429), %d errors, %d failed, waited %s in total"
             % (human(elapsed), stats["ok"], stats["throttled"], stats["error"], stats["failed"],
                human(stats["waited_s"])))
    log.line("summary: %s" % os.path.join(out, "summary.json"))


# --- analyze -------------------------------------------------------------------

def terms(title):
    """Words and two-word phrases; phrases don't cross punctuation."""
    uni, bi = [], []
    for clause in re.split(r"[;:,.!?|()\"–—‘’“”]+|\s-\s", title.lower()):
        words = [re.sub(r"'s$", "", w).strip("'-")
                 for w in re.findall(r"[a-z0-9][a-z0-9'+-]*", clause)]
        words = [w for w in words if w]
        uni += [w for w in words if w not in STOPWORDS and not w.isdigit() and len(w) > 1]
        bi += ["%s %s" % (a, b) for a, b in zip(words, words[1:])
               if a not in STOPWORDS and b not in STOPWORDS and not a.isdigit() and not b.isdigit()]
    return uni + bi


def analyze(args):
    seen, rows = set(), []
    for d in args.dirs:
        path = os.path.join(d, "articles.jsonl")
        with open(path) as f:
            for line in f:
                a = json.loads(line)
                key = (a["url"], a.get("category"))
                if key in seen:
                    continue
                seen.add(key)
                rows.append(a)
    print("%d labeled-or-not article rows from %d run(s)" % (len(rows), len(args.dirs)))

    by_cat = defaultdict(Counter)   # document frequency per category
    docs = Counter()
    for a in rows:
        cat = a.get("category") or "unlabeled"
        docs[cat] += 1
        for t in set(terms(a["title"])):
            by_cat[cat][t] += 1
    print("articles per label: %s" % ", ".join("%s=%d" % kv for kv in docs.most_common()))
    if len(docs) < 2:
        print("WARNING: only one label present, so there's nothing to contrast it with; "
              "scores below are meaningless. Collect more (other themes/domains) first.")
    for cat, n in docs.items():
        if cat != "unlabeled" and n < 100:
            print("WARNING: only %d titles for %s; its keywords will be noisy" % (n, cat))

    total = Counter()
    for c in by_cat.values():
        total.update(c)
    n_total = sum(total.values())
    prior_scale = args.prior

    results = {}
    for cat in sorted(c for c in by_cat if c != "unlabeled"):
        mine, n_mine = by_cat[cat], sum(by_cat[cat].values())
        rest = total - mine
        n_rest = sum(rest.values())
        scored = []
        for t, y_i in mine.items():
            if y_i < args.min_count:
                continue
            a_w = prior_scale * total[t] / n_total  # informative Dirichlet prior
            a_0 = prior_scale
            y_j = rest[t]
            delta = (math.log((y_i + a_w) / (n_mine + a_0 - y_i - a_w))
                     - math.log((y_j + a_w) / (n_rest + a_0 - y_j - a_w)))
            var = 1.0 / (y_i + a_w) + 1.0 / (y_j + a_w)
            scored.append((delta / math.sqrt(var), t, y_i, y_j))
        scored.sort(reverse=True)
        results[cat] = [{"term": t, "z": round(z, 2), "in_category": yi, "elsewhere": yj}
                        for z, t, yi, yj in scored[:args.top]]

    out = args.out or os.path.join(args.dirs[0], "keywords")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "keywords.json"), "w") as f:
        json.dump({"articles": dict(docs), "keywords": results}, f, indent=2)
    with open(os.path.join(out, "keywords.md"), "w") as f:
        f.write("# Candidate keywords per category\n\n")
        f.write("Articles per label: %s\n\n" % ", ".join("%s=%d" % kv for kv in docs.most_common()))
        f.write("z: log-odds z-score vs all other titles (higher = more distinctive). "
                "Counts are titles containing the term.\n")
        for cat, items in results.items():
            f.write("\n## %s (%d titles)\n\n| term | z | in category | elsewhere |\n|---|---|---|---|\n"
                    % (cat, docs[cat]))
            for it in items:
                f.write("| %s | %s | %d | %d |\n" % (it["term"], it["z"], it["in_category"], it["elsewhere"]))
    for cat, items in results.items():
        print("\n%s (%d titles): %s" % (cat, docs[cat], ", ".join(i["term"] for i in items[:15])))
    print("\nwritten: %s" % os.path.join(out, "keywords.md"))


def compare(args):
    """One row per collect run, from its requests.jsonl and log header, to
    see whether some IPs or regions get throttled less."""
    rows = []
    for d in args.dirs:
        machine = {}
        summary_path = os.path.join(d, "summary.json")
        if os.path.exists(summary_path):
            with open(summary_path) as f:
                machine = json.load(f).get("machine", {})
        else:  # unfinished run: machine line from the log
            with open(os.path.join(d, "log.txt")) as f:
                for line in f:
                    if " machine: " in line:
                        machine = json.loads(line.split(" machine: ", 1)[1])
        recs = []
        with open(os.path.join(d, "requests.jsonl")) as f:
            recs = [json.loads(l) for l in f if l.strip()]
        ok = [r for r in recs if r.get("outcome") == "ok"]
        thr = [r for r in recs if r.get("outcome") == "throttled"]
        lat = sorted(r["elapsed_ms"] for r in ok)
        gap_seq = [r["gap_s"] for r in recs if "gap_s" in r]
        gaps = sorted(gap_seq)
        rows.append({
            "run": os.path.basename(os.path.normpath(d)),
            "ip": machine.get("ip", "?"),
            "where": ", ".join(x for x in (machine.get("city"), machine.get("country")) if x) or "?",
            "org": (machine.get("org") or "?")[:28],
            "attempts": len(recs), "ok": len(ok), "429": len(thr),
            "429%": "%d%%" % (100 * len(thr) / len(recs)) if recs else "-",
            "median ok ms": lat[len(lat) // 2] if lat else "-",
            # the learned interval: what pacing actually worked on this machine
            "median gap": human(gaps[len(gaps) // 2]) if gaps else "-",
            "last gap": human(gap_seq[-1]) if gap_seq else "-",
            "waited": human(sum(r.get("wait_s", 0) for r in recs)),
        })
    cols = list(rows[0]) if rows else []
    widths = {c: max(len(c), *(len(str(r[c])) for r in rows)) for c in cols}
    print("  ".join(c.ljust(widths[c]) for c in cols))
    for r in rows:
        print("  ".join(str(r[c]).ljust(widths[c]) for c in cols))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("collect", help="fetch labeled articles from GDELT")
    c.add_argument("--out", help="output directory (resumed if it exists)")
    c.add_argument("--days", type=int, default=3, help="one-day windows to fetch, going back (default 3)")
    c.add_argument("--maxrecords", type=int, default=250, help="articles per request, GDELT max 250")
    c.add_argument("--min-gap", type=float, default=10,
                   help="starting and lowest seconds between request starts (default 10); adapts upward")
    c.add_argument("--shrink", type=float, default=0.9,
                   help="gap multiplier after a success with no 429 before it (default 0.9; 1 = never shrink)")
    c.add_argument("--backoff-start", type=float, default=15, help="first wait after a 429, seconds")
    c.add_argument("--backoff-factor", type=float, default=1.6, help="wait growth per consecutive 429")
    c.add_argument("--backoff-max", type=float, default=1800, help="longest single wait, seconds; retries are unlimited")
    c.add_argument("--timeout", type=float, default=90, help="per-request timeout, seconds")

    a = sub.add_parser("analyze", help="rank distinctive terms per category")
    a.add_argument("dirs", nargs="+", help="one or more collect output directories")
    a.add_argument("--out", help="where to write keywords.md/.json (default <first dir>/keywords)")
    a.add_argument("--top", type=int, default=40, help="terms per category")
    a.add_argument("--min-count", type=int, default=3, help="ignore terms in fewer titles than this")
    a.add_argument("--prior", type=float, default=500, help="strength of the background prior")

    m = sub.add_parser("compare", help="throttling per run: IP, region, 429 rate, latency")
    m.add_argument("dirs", nargs="+", help="collect output directories")

    args = p.parse_args()
    try:
        {"collect": collect, "analyze": analyze, "compare": compare}[args.cmd](args)
    except KeyboardInterrupt:
        print("\ninterrupted; rerun with --out <same dir> to resume", file=sys.stderr)
        sys.exit(130)


if __name__ == "__main__":
    main()
