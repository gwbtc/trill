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
      %gnews
    ::  redirects to an opaque /rss/topics/<id> url; iris follows it
    %+  rap  3
    :~  'https://news.google.com/rss/headlines/section/topic/'
        (query-value param.source)
        '?hl=en-US&gl=US&ceid='
        (query-value 'US:en')
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
    %gnews    (parse-gnews now body)
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
::  +parse-gnews: a google news topic feed, one <item> per story. the
::  headline ends in " - <publisher>", which is dropped. the item's
::  description lists the story's articles as html (see +cluster); they
::  become its links, and their number its score
::
++  parse-gnews
  |=  [now=@da body=@t]
  ^-  (each (list raw) @t)
  =/  doc  (de-xml:html body)
  ?~  doc  [%| 'google news: not xml']
  =/  chan  (kids u.doc 'channel')
  ?~  chan  [%| 'google news: no channel']
  :-  %&
  %+  murn  (kids i.chan 'item')
  |=  item=manx
  ^-  (unit raw)
  =/  publisher  (plain (field item 'source'))
  =/  title  (drop-suffix (plain (field item 'title')) publisher)
  ?:  |(=('' title) (spam title))  ~
  =/  link  (trim-url (field item 'link'))
  =/  links=(list link:sur)
    =/  articles  (cluster (field item 'description'))
    ?^  articles  articles
    (drop (evidence title link publisher))
  :-  ~
  :*  (fall (rfc822 (field item 'pubDate')) now)
      title
      ''
      ?:((web link) `link ~)
      `(lent links)
      links
  ==
::  +cluster: the articles in a google news item's description. it's
::  html, in one of three shapes: <ol> of <li><a>title</a> <font>
::  publisher</font></li>; a single <a> and <font>; or plain text. any
::  <a> directly followed by a <font> is an article, which skips the
::  "see more headlines" link
::
++  cluster
  |=  desc=@t
  ^-  (list link:sur)
  ::  &nbsp; isn't an xml entity
  =/  fixed=@t
    %-  crip
    (rash desc (star ;~(pose (cold ' ' (jest '&nbsp;')) next)))
  =/  doc  (de-xml:html (rap 3 ~['<div>' fixed '</div>']))
  ?~  doc  ~
  (articles u.doc)
::
::  +articles: every article link in the tree. plain recursion: passing
::  this arm to turn from inside itself fails with fuse-loop
::
++  articles
  |=  m=manx
  ^-  (list link:sur)
  =/  out=(list link:sur)  (pairs c.m)
  =/  cs=marl  c.m
  |-  ^-  (list link:sur)
  ?~  cs  out
  $(cs t.cs, out (weld out (articles i.cs)))
::  +pairs: article links among siblings: an <a> directly followed by a
::  <font> naming the publisher
::
++  pairs
  |=  cs=marl
  ^-  (list link:sur)
  ?~  cs  ~
  ?.  &(=('a' (tag i.cs)) ?=(^ t.cs) =('font' (tag i.t.cs)))
    $(cs t.cs)
  =/  l  (evidence (text i.cs) (attr i.cs 'href') (text i.t.cs))
  ?~  l  $(cs t.t.cs)
  [u.l $(cs t.t.cs)]
::  +drop-suffix: 'Headline - Publisher' to 'Headline'
::
++  drop-suffix
  |=  [t=@t publisher=@t]
  ^-  @t
  ?:  =('' publisher)  t
  =/  suffix  (rap 3 ~[' - ' publisher])
  =/  n  (met 3 suffix)
  =/  m  (met 3 t)
  ?.  &((gth m n) =(suffix (rsh [3 (sub m n)] t)))  t
  (end [3 (sub m n)] t)
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
  (name n.g.m)
::
++  name
  |=  n=mane
  ^-  @t
  ?@  n  n
  (rap 3 ~[-.n ':' +.n])
::  +attr: an attribute's value, or ''
::
++  attr
  |=  [m=manx n=@t]
  ^-  @t
  =/  as  a.g.m
  |-
  ?~  as  ''
  ?:  =(n (name n.i.as))  (crip v.i.as)
  $(as t.as)
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
::  +rfc822: an rss date to utc: 'Fri, 25 Sep 2026 20:50:00 -0700' (google
::  trends), 'Sat, 26 Sep 2026 08:52:37 GMT' (google news). stud rejects
::  GMT and ignores offsets, so this parses them itself
::
++  rfc822
  |=  t=@t
  ^-  (unit @da)
  =/  tt  (trip t)
  ::  the weekday is redundant
  =/  comma  (find ", " tt)
  =?  tt  ?=(^ comma)  (slag (add 2 u.comma) tt)
  =/  two  (bass 10 (stun [2 2] dit))
  =/  zone
    ;~  pose
      (cold `[? @ud]`[%.y 0] ;~(pose (jest 'GMT') (jest 'UTC') (just 'Z')))
      ;~(plug ;~(pose (cold %.y lus) (cold %.n hep)) (bass 10 (stun [4 4] dit)))
    ==
  =/  parsed
    %+  rust  tt
    ;~  plug
      (bass 10 (stun [1 2] dit))
      ;~(pfix ace (stun [3 3] alf))
      ;~(pfix ace (bass 10 (stun [4 4] dit)))
      ;~(pfix ace two)
      ;~(pfix col two)
      ;~(pfix col two)
      ;~(pfix ace zone)
    ==
  ?~  parsed  ~
  =/  [d=@ud mon=tape y=@ud h=@ud n=@ud s=@ud plus=? off=@ud]  u.parsed
  =/  months=(list tape)
    ~["jan" "feb" "mar" "apr" "may" "jun" "jul" "aug" "sep" "oct" "nov" "dec"]
  =/  m  (find ~[(cass mon)] months)
  ?~  m  ~
  =/  base=@da  (year [[%.y y] +(u.m) [d h n s ~]])
  =/  shift=@dr  (add (mul (div off 100) ~h1) (mul (mod off 100) ~m1))
  ::  -0700 is seven hours behind utc
  `?:(plus (sub base shift) (add base shift))
--
