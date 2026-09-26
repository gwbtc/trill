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
::    ('SPORTS'; the US edition), %hn unused
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
+$  link  [title=@t url=@t publisher=@t]
::  +topic: one trending item
::
::    classification: how categories were picked. %source: the source's
::    own section (google news); %rules: keywords in the title and links;
::    %hint: the source's fallback; %unclassified: %other
::    date: when the source dated it (fetch time if it didn't)
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
      score=(unit @ud)
      links=(list link)
  ==
::  +snapshot: a source's topics as of its last successful fetch
::
+$  snapshot  [fetched=@da topics=(list topic)]
::  +action: pokes, %noun mark, from our own ship only
::
+$  action
  $%  [%add-source id=source-id =source]  ::  add or replace
      [%del-source id=source-id]
      [%set-interval every=@dr]
      [%fetch ~]                          ::  fetch every enabled source now
  ==
--
