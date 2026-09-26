# %topics API

`%topics` is a Gall agent on the `%nostrill` desk. It collects trending topics
from the web, keeps the latest batch from each source, and lets other agents
on the same ship read them via scries.

- **Sources**, chosen by the ship owner's preferences (see [Preferences](#preferences)):
  - Google Trends: trending searches in the chosen country.
  - Google News: the topic sections for the chosen categories, in the chosen
    country and language.
  - Hacker News: the front page.

  None needs an API key. The default is the US, English, every category.
- **Schedule:** every source is fetched when the agent starts, then every hour
  (adjustable).
- **Storage:** only the latest successful fetch per source is kept. A failed
  fetch keeps the previous topics and records an error.
- **Categories:** Google News topics take their section's category. Google
  Trends and Hacker News topics are classified by keyword rules, falling back
  to `%other`.

Code: `backend/sur/topics.hoon` (types), `backend/lib/topics.hoon` (fetching,
parsing, classification), `backend/app/topics.hoon` (the agent).

## Scries

All scries are `%gx`, return `%noun`, and are local to the ship.

| Path | Type | Contents |
|---|---|---|
| `/topics` | `(list topic)` | every source's topics, newest first |
| `/topics/<source-id>` | `(list topic)` | one source's topics, in the source's order; `[~ ~]` if it hasn't been fetched yet |
| `/category/<category>` | `(list topic)` | topics in one category, newest first |
| `/sources` | `(map source-id source)` | the configured sources |
| `/prefs` | `prefs` | country, language and categories (see [Preferences](#preferences)) |
| `/status` | see below | fetch schedule, last fetch per source, last error per source |

`/status` returns:

```hoon
$:  every=@dr                                  ::  fetch interval
    next=(unit @da)                            ::  next scheduled fetch
    errors=(map source-id [at=@da msg=@t])     ::  last failed fetch, per source
    fetched=(map source-id @da)                ::  last successful fetch, per source
==
```

### Example

```hoon
/-  topics
::  ...
=/  all=(list topic:topics)
  .^((list topic:topics) %gx /(scot %p our.bowl)/topics/(scot %da now.bowl)/topics/noun)
=/  sports=(list topic:topics)
  .^((list topic:topics) %gx /(scot %p our.bowl)/topics/(scot %da now.bowl)/category/sports/noun)
=/  hn=(list topic:topics)
  .^((list topic:topics) %gx /(scot %p our.bowl)/topics/(scot %da now.bowl)/topics/hn/noun)
```

`/-  topics` resolves only on the `%nostrill` desk. An agent on another desk
needs a copy of `sur/topics.hoon`, or its own mold with the same shape.

## Types

From `sur/topics.hoon`:

```hoon
+$  source-id  @tas
+$  category
  $?  %world  %technology  %business  %sports
      %entertainment  %internet-culture  %lifestyle  %other
  ==
+$  kind  ?(%gtrends %hn %gnews)
+$  source
  $:  =kind
      param=@t              ::  %gtrends: region ('US'); %gnews: topic ('SPORTS'); %hn: unused
      hint=(unit category)  ::  %gnews: its section's category; otherwise a fallback
      enabled=?
  ==
+$  link  [title=@t url=@t pic=(unit @t) publisher=@t]
+$  topic
  $:  source=source-id
      categories=(set category)
      classification=?(%source %rules %hint %unclassified)
      date=@da              ::  the source's date for the item (fetch time if none)
      title=@t
      content=@t            ::  description; Google Trends: the search term
      url=(unit @t)
      pic=(unit @t)         ::  an image url; only Google Trends has them
      score=(unit @ud)      ::  meaning depends on the source, see below
      links=(list link)     ::  related articles
  ==
+$  snapshot  [fetched=@da topics=(list topic)]
+$  prefs
  $:  country=@t            ::  ISO 3166 code: 'US'
      lang=@t               ::  Google News language code: 'en', 'es-419', 'pt-BR'
      cats=(set category)
  ==
```

`classification` records how `categories` were chosen:

- `%source`: the source's own section (Google News)
- `%rules`: keywords found in the title and link titles
- `%hint`: no keyword matched, so the source's `hint` was used
- `%unclassified`: none of the above; the category is `%other`

### Sources and what their topics contain

| Source ids | Items | `score` | `url` | `links` | Categories |
|---|---|---|---|---|---|
| `gtrends-<country>`, e.g. `gtrends-us` | ~10 trending searches | approximate searches (`2K+` → 2000) | the news article behind the search's picture, else the first one | news articles about the search | keyword rules |
| `gnews-world` `-nation` `-business` `-technology` `-science` `-entertainment` `-sports` `-health` | ~55–70 stories per section | number of articles in the story cluster | Google News link to the lead article | every article in the cluster, with its publisher | the section |
| `hn` | 30 front-page stories | points | the story (or its HN thread) | the story, plus the HN discussion | keyword rules |

Google News sections map to categories as follows:

| Section | Category |
|---|---|
| WORLD, NATION | `%world` |
| BUSINESS | `%business` |
| TECHNOLOGY, SCIENCE | `%technology` |
| ENTERTAINMENT | `%entertainment` |
| SPORTS | `%sports` |
| HEALTH | `%lifestyle` |

Google News links are `news.google.com` redirects, not publisher URLs.

A Google Trends item's own title is only the search term ("peyton manning
son"). Its picture comes from one of its news articles, so that article's
headline becomes the topic's `title` and its link the `url`; the search term
goes in `content`. With no matching article, the title is the search term.

## Preferences

The ship owner's `prefs` decide the sources:

- **Country:** Google Trends' region (`gtrends-<country>`), and the country of
  the Google News edition.
- **Language:** the Google News edition's language. Any country and language
  pair works (`US` + `es-419` is Spanish-language news for the US). Google
  Trends ignores the language, and Hacker News is English only.
- **Categories:** only the Google News sections in these categories are
  fetched. Google Trends and Hacker News topics are fetched regardless; readers
  (Trill's card) hide topics outside the chosen categories. The scries here
  never filter.

Setting prefs replaces every source, including ones added with
`%add-source`. If the country or language changed, the old Google topics are
dropped too. Then everything is fetched again.

## Pokes

`%noun` mark, accepted only from our own ship:

| Poke | Effect |
|---|---|
| `[%fetch ~]` | fetch every enabled source now; the hourly schedule is unchanged |
| `[%add-source id source]` | add or replace a source, and fetch it now if enabled |
| `[%del-source id]` | remove a source along with its topics and error |
| `[%set-interval @dr]` | change the fetch interval (minimum `~m1`) |
| `[%set-prefs prefs]` | replace the prefs and rebuild the sources from them (see [Preferences](#preferences)); crashes on a bad country or language code, or no categories |
| `%print` | log the saved topics to the terminal, one line each |

From dojo:

```
:topics %print
:topics [%fetch ~]
:topics [%set-interval ~h2]
:topics [%set-prefs 'MX' 'es-419' (silt `(list @tas)`~[%world %sports])]
:topics [%add-source %gtrends-de [%gtrends 'DE' ~ %.y]]
:topics [%del-source %gtrends-de]
```

## Notes

- **No subscriptions or remote scries yet.** Other ships can't read the data,
  and local agents have to scry again to see new topics. There is no push.
- **No JSON here.** All scries are `%noun`. Trill's UI goes through
  `%nostrill`: its `/j/topics` scry returns the prefs and each source's leading
  topics as JSON (filtered to the chosen categories), and its `{topics: prefs}`
  UI poke forwards `%set-prefs`.
- **Unreleased state.** Its shape may still change without migration. After a
  change the agent is reset with `|nuke %topics, =hard &` and restarts from the
  default prefs (US, English, every category).
