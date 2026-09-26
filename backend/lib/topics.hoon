::  topics: requests to, parsers for, and classification of trending
::  sources. filters and keyword rules follow trend-collector
::
/-  sur=topics
|%
::  +raw: a parsed topic, before the agent stamps source and categories
::
+$  raw
  $:  date=@da
      title=@t
      content=@t
      url=(unit @t)
      score=(unit @ud)
      links=(list link:sur)
  ==
::
++  user-agent  'nostrill-topics/0.1 (urbit)'
::
++  request
  |=  =source:sur
  ^-  request:http
  :^  %'GET'  (url source)
    ~[['user-agent' user-agent] ['accept' '*/*']]
  ~
::
++  url
  |=  =source:sur
  ^-  @t
  ?-  kind.source
      %gtrends
    (rap 3 ~['https://trends.google.com/trending/rss?geo=' (query-value param.source)])
  ::
      %hn
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30'
  ::
      %gdelt
    ::  twenty records over a day: larger scans are slow and are what
    ::  gdelt sheds with 429
    %+  rap  3
    :~  'https://api.gdeltproject.org/api/v2/doc/doc?query='
        (query-value (rap 3 ~['(' param.source ') sourcelang:english']))
        '&mode=artlist&format=json&maxrecords=20&timespan=1d&sort=datedesc'
    ==
  ==
::  +query-value: percent-encoded twice. the runtime's http client
::  (vere's cttp.c) parses the url with de-purl, which decodes the query,
::  and writes it back out without re-encoding, so a single %20 goes on
::  the wire as a bare space and the server answers 400
::
++  query-value
  |=  v=@t
  ^-  @t
  (crip (en-urlt:html (en-urlt:html (trip v))))
::  +parse: a response body into topics, or an error message
::
++  parse
  |=  [=kind:sur now=@da body=@t]
  ^-  (each (list raw) @t)
  ?-  kind
    %gtrends  (parse-gtrends now body)
    %hn       (parse-hn now body)
    %gdelt    (parse-gdelt now body)
  ==
::  +parse-gtrends: google trends' rss, one <item> per search term.
::  terms without a usable news link are dropped
::
++  parse-gtrends
  |=  [now=@da body=@t]
  ^-  (each (list raw) @t)
  =/  doc  (de-xml:html body)
  ?~  doc  [%| 'google trends: not xml']
  =/  chan  (kids u.doc 'channel')
  ?~  chan  [%| 'google trends: no channel']
  :-  %&
  %+  murn  (kids i.chan 'item')
  |=  item=manx
  ^-  (unit raw)
  =/  title  (plain (field item 'title'))
  ?:  |(=('' title) (spam title))  ~
  =/  links=(list link:sur)
    %+  murn  (kids item 'ht:news_item')
    |=  n=manx
    (evidence (field n 'ht:news_item_title') (field n 'ht:news_item_url') (field n 'ht:news_item_source'))
  ?~  links  ~
  :-  ~
  :*  (fall (rfc822 (field item 'pubDate')) now)
      title
      (plain (field item 'description'))
      ~
      (traffic (field item 'ht:approx_traffic'))
      links
  ==
::  +parse-hn: hacker news' front page, from the algolia api
::
++  parse-hn
  |=  [now=@da body=@t]
  ^-  (each (list raw) @t)
  =/  jon  (de:json:html body)
  ?~  jon  [%| 'hacker news: not json']
  ?.  (~(has by (obj u.jon)) 'hits')  [%| 'hacker news: no hits']
  :-  %&
  %+  murn  (get-a (obj u.jon) 'hits')
  |=  hit=json
  ^-  (unit raw)
  =/  o  (obj hit)
  =/  title  (plain (fall (get-s o 'title') ''))
  ?:  |(=('' title) (spam title))  ~
  =/  thread
    (rap 3 ~['https://news.ycombinator.com/item?id=' (fall (get-s o 'objectID') '')])
  ::  ask/show hn posts have no url; their thread is the story
  =/  story  (fall (bind (get-s o 'url') trim-url) thread)
  =?  story  !(web story)  thread
  =/  publisher  ?:(=(story thread) 'Hacker News' (host story))
  :-  ~
  :*  (fall (bind (get-n o 'created_at_i') from-unix:chrono:userlib) now)
      title
      ''
      `story
      (get-n o 'points')
      ?:  =(story thread)  ~[[title story publisher]]
      ~[[title story publisher] ['Hacker News discussion' thread 'Hacker News']]
  ==
::  +parse-gdelt: the gdelt doc api's article list, english only. it
::  answers errors, like its rate limit, as plain text, and no matches
::  as {}
::
++  parse-gdelt
  |=  [now=@da body=@t]
  ^-  (each (list raw) @t)
  =/  jon  (de:json:html body)
  =/  excerpt  (rap 3 ~['gdelt: ' (crip (scag 200 (trip body)))])
  ?~  jon  [%| excerpt]
  ?.  (~(has by (obj u.jon)) 'articles')  [%| excerpt]
  :-  %&
  %+  murn  (get-a (obj u.jon) 'articles')
  |=  art=json
  ^-  (unit raw)
  =/  o  (obj art)
  =/  lang  (get-s o 'language')
  ?:  &(?=(^ lang) !=('english' (crip (cass (trip u.lang)))))  ~
  =/  date  (biff (get-s o 'seendate') gdelt-date)
  ?~  date  ~
  =/  link
    (evidence (fall (get-s o 'title') '') (fall (get-s o 'url') '') (fall (get-s o 'domain') ''))
  ?~  link  ~
  `[u.date title.u.link '' `url.u.link ~ ~[u.link]]
::  +evidence: a related-article link, or ~ if it's empty, spam or not
::  on the web
::
++  evidence
  |=  [title=@t url=@t publisher=@t]
  ^-  (unit link:sur)
  =/  title  (plain title)
  =/  url  (trim-url url)
  ?:  |(=('' title) !(web url) (spam title))  ~
  =/  publisher  (plain publisher)
  `[title url ?:(=('' publisher) (host url) publisher)]
::
::  classification
::
::  +rules: keywords per category, matched as whole words in the title
::  and link titles. plurals are spelled out
::
++  rules
  ^-  (list [category:sur (list tape)])
  :~  :-  %world
      :~  "election"  "elections"  "president"  "prime minister"  "parliament"
          "senate"  "diplomacy"  "diplomatic"  "geopolitics"  "sanctions"
          "ceasefire"  "missile"  "missiles"  "invasion"  "military"
          "government"  "politics"  "refugee"  "refugees"  "earthquake"
          "hurricane"
      ==
      :-  %technology
      :~  "technology"  "science"  "scientist"  "scientists"  "researcher"
          "researchers"  "software"  "artificial intelligence"  "ai"
          "semiconductor"  "semiconductors"  "spacecraft"  "nasa"  "robotic"
          "robotics"  "astronomer"  "astronomers"  "quantum"
      ==
      :-  %business
      :~  "economy"  "economic"  "inflation"  "stock"  "stocks"  "finance"
          "financial"  "earnings"  "banking"  "interest rate"  "interest rates"
          "tariff"  "tariffs"  "merger"  "market"  "markets"  "bitcoin"
      ==
      :-  %sports
      :~  "football"  "cricket"  "tennis"  "basketball"  "olympic"  "olympics"
          "soccer"  "baseball"  "rugby"  "hockey"  "ufc"  "wrestling"
          "quarterback"  "touchdown"  "championship"  "grand slam"  "us open"
          "running back"  "running backs"  "nfl"  "nba"  "f1"
      ==
      :-  %entertainment
      :~  "celebrity"  "celebrities"  "actor"  "actress"  "singer"  "music"
          "musician"  "movie"  "cinema"  "concert"  "album"  "box office"
          "hollywood"  "netflix"  "grammy"  "grammys"  "oscar"  "oscars"
          "wedding"  "divorce"
      ==
      :-  %internet-culture
      :~  "tiktok"  "instagram"  "meme"  "memes"  "viral"  "influencer"
          "influencers"  "youtuber"  "streamer"  "internet challenge"
          "social media trend"
      ==
      :-  %lifestyle
      :~  "fashion"  "food"  "recipe"  "recipes"  "travel"  "tourism"
          "wellness"  "gardening"  "skincare"  "fitness"  "cooking"
          "restaurant"
      ==
  ==
::  +classify: categories from the rules, else the source's hint, else
::  %other
::
++  classify
  |=  [texts=(list @t) hint=(unit category:sur)]
  ^-  [(set category:sur) ?(%rules %hint %unclassified)]
  =/  ws  (zing (turn texts words))
  =/  hits=(list category:sur)
    %+  murn  rules
    |=  [c=category:sur phrases=(list tape)]
    ?.  (lien phrases |=(p=tape (has-phrase ws p)))  ~
    `c
  ?^  hits  [(silt hits) %rules]
  ?^  hint  [(silt ~[u.hint]) %hint]
  [(silt `(list category:sur)`~[%other]) %unclassified]
::  +spam: pirate-stream headlines ("watch free live stream ...")
::
++  spam
  |=  t=@t
  ^-  ?
  =/  ws  (words t)
  ?&  %+  lien  `(list tape)`~["livestream" "livestreams" "live stream" "live streams" "free stream" "free streams"]
      |=(p=tape (has-phrase ws p))
    ::
      %+  lien  `(list tape)`~["free" "watch" "tv" "channel"]
      |=(p=tape (has-phrase ws p))
  ==
::  +words: lowercase ascii letters and digits; anything else splits
::
++  words
  |=  t=@t
  ^-  (list tape)
  =/  cs  (cass (trip t))
  =|  cur=tape
  =|  out=(list tape)
  |-
  ?~  cs
    (flop ?~(cur out [(flop cur) out]))
  ?:  ?|  &((gte i.cs 'a') (lte i.cs 'z'))
          &((gte i.cs '0') (lte i.cs '9'))
      ==
    $(cs t.cs, cur [i.cs cur])
  $(cs t.cs, cur ~, out ?~(cur out [(flop cur) out]))
::  +has-phrase: whether the words of a phrase appear consecutively
::
++  has-phrase
  |=  [ws=(list tape) phrase=tape]
  ^-  ?
  =/  ph  (words (crip phrase))
  ?~  ph  %.n
  =/  n  (lent ph)
  |-
  ?~  ws  %.n
  ?:  =(`(list tape)`ph (scag n `(list tape)`ws))  %.y
  $(ws t.ws)
::
::  text and urls
::
::  +plain: tags stripped, whitespace collapsed, at most 500 bytes
::
++  plain
  |=  t=@t
  ^-  @t
  =/  cs  (trip t)
  =|  out=tape
  =/  tag=?  %.n
  =/  gap=?  %.n
  |-
  ?~  cs
    =/  res  (scag 500 (flop out))
    ::  don't end on a cut multi-byte character
    =?  res  =(500 (lent res))
      |-
      ?~  res  res
      ?:  (lth (rear res) 0x80)  res
      $(res (snip `tape`res))
    (crip res)
  ?:  tag  $(cs t.cs, tag !=('>' i.cs))
  ?:  =('<' i.cs)  $(cs t.cs, tag %.y, gap %.y)
  ?:  |((lte i.cs ' ') =(0x7f i.cs))  $(cs t.cs, gap %.y)
  =?  out  &(gap ?=(^ out))  [' ' out]
  $(cs t.cs, gap %.n, out [i.cs out])
::
::  +trim-url: whitespace and control characters dropped, no length cap
::
++  trim-url
  |=  u=@t
  ^-  @t
  (crip (skip (trip u) |=(c=@t (lte c ' '))))
::
++  web
  |=  u=@t
  ^-  ?
  ?|  =('https://' (end [3 8] u))
      =('http://' (end [3 7] u))
  ==
::  +host: a url's hostname, without www.
::
++  host
  |=  u=@t
  ^-  @t
  =/  cs  (trip u)
  =/  i  (find "://" cs)
  ?~  i  u
  =/  rest  (slag (add u.i 3) cs)
  =/  h  (scag (fall (find "/" rest) (lent rest)) rest)
  =?  h  =("www." (scag 4 h))  (slag 4 h)
  (crip h)
::
::  xml helpers. de-xml keeps tag names as written, so they're
::  compared as cords ('pubDate', 'ht:news_item')
::
++  tag
  |=  m=manx
  ^-  @t
  ?@  n.g.m  n.g.m
  (rap 3 ~[-.n.g.m ':' +.n.g.m])
::
++  kids
  |=  [m=manx t=@t]
  ^-  (list manx)
  (skim c.m |=(k=manx =(t (tag k))))
::  +text: an element's text, from the %$ text nodes among its children
::
++  text
  |=  m=manx
  ^-  @t
  %-  crip
  %-  zing
  %+  turn  c.m
  |=  k=manx
  ^-  tape
  ?.  ?=(%$ n.g.k)  ~
  ?~  a.g.k  ~
  v.i.a.g.k
::  +field: the text of the first child with this tag, or ''
::
++  field
  |=  [m=manx t=@t]
  ^-  @t
  =/  k  (kids m t)
  ?~(k '' (text i.k))
::
::  json helpers: missing or mistyped fields become ~
::
++  obj
  |=  j=json
  ^-  (map @t json)
  ?.(?=([%o *] j) ~ p.j)
::
++  get-s
  |=  [o=(map @t json) k=@t]
  ^-  (unit @t)
  =/  v  (~(get by o) k)
  ?.(?=([~ %s *] v) ~ `p.u.v)
::
++  get-n
  |=  [o=(map @t json) k=@t]
  ^-  (unit @ud)
  =/  v  (~(get by o) k)
  ?.(?=([~ %n *] v) ~ (rush p.u.v dem))
::
++  get-a
  |=  [o=(map @t json) k=@t]
  ^-  (list json)
  =/  v  (~(get by o) k)
  ?.(?=([~ %a *] v) ~ p.u.v)
::
::  field formats
::
::  +traffic: google trends' approximate searches: '1000+', '2K+', '5M+'
::
++  traffic
  |=  t=@t
  ^-  (unit @ud)
  %+  rush  t
  ;~  sfix
    ;~  pose
      (cook |=(n=@ud (mul n 1.000.000)) ;~(sfix dem (just 'M')))
      (cook |=(n=@ud (mul n 1.000)) ;~(sfix dem (just 'K')))
      dem
    ==
    (star lus)
  ==
::  +rfc822: 'Fri, 25 Sep 2026 20:50:00 -0700' to utc. stud reads the
::  date but ignores the offset, so it's applied here
::
++  rfc822
  |=  t=@t
  ^-  (unit @da)
  =/  d  (stud:chrono:userlib t)
  ?~  d  ~
  =/  base=@da  (year u.d)
  =/  tt  (trip t)
  =/  off
    %+  rush  (crip (slag (sub (lent tt) (min 5 (lent tt))) tt))
    ;~(plug ;~(pose (cold %.y lus) (cold %.n hep)) dem)
  ?~  off  `base
  =/  shift=@dr
    (add (mul (div +.u.off 100) ~h1) (mul (mod +.u.off 100) ~m1))
  ?:  -.u.off
    `(sub base shift)
  `(add base shift)
::  +gdelt-date: '20260925T123000Z'
::
++  gdelt-date
  |=  t=@t
  ^-  (unit @da)
  =/  two  (bass 10 (stun [2 2] dit))
  %+  rush  t
  %+  cook
    |=  [y=@ud m=@ud d=@ud h=@ud n=@ud s=@ud]
    (year [[%.y y] m [d h n s ~]])
  ;~  plug
    (bass 10 (stun [4 4] dit))
    two
    two
    ;~(pfix (just 'T') two)
    two
    ;~(sfix two (just 'Z'))
  ==
--
