::  topics: trending topics fetched from the web, for other agents to scry
::
::    sources, categories and classification rules follow trend-collector
::
|%
+$  source-id  @tas
::
+$  category
  $?  %world
      %technology
      %business
      %sports
      %entertainment
      %internet-culture
      %lifestyle
      %other
  ==
::  +kind: which fetcher/parser a source uses
::
+$  kind  ?(%gtrends %hn %gnews)
::  +source: a configured feed
::
::    param: %gtrends a region ('US'), %gnews a google news topic
::    ('SPORTS', in the edition from the prefs), %hn unused
::    hint: for %gnews, the category of its section, which every topic
::    from it gets. otherwise a fallback for topics the keyword rules
::    can't place
::
+$  source
  $:  =kind
      param=@t
      hint=(unit category)
      enabled=?
  ==
::  +link: a related article
::
+$  link  [title=@t url=@t pic=(unit @t) publisher=@t]
::  +topic: one trending item
::
::    classification: how categories were picked. %source: the source's
::    own section (google news); %rules: keywords in the title and links;
::    %hint: the source's fallback; %unclassified: %other
::    date: when the source dated it (fetch time if it didn't)
::    title: for google trends, the headline of the news item behind the
::    search's picture, else the first news item's
::    content: the source's description; for google trends, the search
::    term when there is none
::    url: google trends' is that news item's (else the first one's)
::    pic: an image url; only google trends has them
::    score: google trends' approximate searches, hn points, the number
::    of articles in a google news story cluster
::    links: google trends' news items, the hn story and thread, the
::    articles in a google news cluster
::
+$  topic
  $:  source=source-id
      categories=(set category)
      classification=?(%source %rules %hint %unclassified)
      date=@da
      title=@t
      content=@t
      url=(unit @t)
      pic=(unit @t)
      score=(unit @ud)
      links=(list link)
  ==
::  +snapshot: a source's topics as of its last successful fetch
::
+$  snapshot  [fetched=@da topics=(list topic)]
::  +prefs: what the ship's owner wants to see. setting them rebuilds the
::  sources (see +sources-for in app/topics.hoon)
::
::    country: ISO 3166 code, 'US'. google trends' region and the google
::    news edition's country
::    lang: google news language code, 'en', 'es-419', 'pt-BR'. google
::    trends and hacker news ignore it
::    cats: which google news sections are fetched, and which topics
::    readers should show; topics are never dropped here
::
+$  prefs
  $:  country=@t
      lang=@t
      cats=(set category)
  ==
::  +verdict: whether a topic is spam, by its +topic-key
::
::    spam: Jev's yes, 0 to 1, from the spam provider (%trill-ai-client);
::    ~ until it answers
::    override: what the ship's owner said, which wins over Jev's
::
+$  verdict
  $:  spam=(unit @rd)
      override=(unit ?)
  ==
::  +spam-threshold: from this yes on, a topic is hidden as spam
::
++  spam-threshold  .~0.9
::
++  hidden
  |=  v=verdict
  ^-  ?
  ?^  override.v  u.override.v
  ?~  spam.v  |
  (gte:rd u.spam.v spam-threshold)
::  +topic-key: the same story from any source, or on any day, is judged
::  once
::
++  topic-key
  |=  title=@t
  ^-  @t
  (crip (cass (trip title)))
::  +topic-id: a short handle on a topic within its source, for asking
::  for its links later (%nostrill's /j/topic-links/<source>/<id>)
::
++  topic-id
  |=  title=@t
  ^-  @t
  (crip ((x-co:co 8) (end [3 4] (sham title))))
::  +action: pokes, %noun mark, from our own ship only
::
+$  action
  $%  [%add-source id=source-id =source]  ::  add or replace
      [%del-source id=source-id]
      [%set-interval every=@dr]
      [%set-prefs =prefs]                 ::  replaces the sources
      [%fetch ~]                          ::  fetch every enabled source now
      ::  which %trill-ai-client provider judges spam; ~: none, and
      ::  nothing is hidden
      [%set-spam-provider provider=(unit @tas)]
      ::  the owner's word on a topic: spam or not; ~ leaves it to Jev
      [%mark key=@t spam=(unit ?)]
  ==
--
