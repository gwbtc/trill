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
+$  kind  ?(%gtrends %hn %gdelt)
::  +source: a configured feed
::
::    param: %gtrends a region ('US'), %gdelt its OR'd search terms
::    ('football OR cricket'), %hn unused
::    hint: category for topics the keyword rules can't place; gdelt
::    sources take their query's category
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
::    classification: how categories were picked. %rules: keywords in
::    the title and links; %hint: the source's hint; %unclassified: %other
::    date: when the source dated it (fetch time if it didn't)
::    score: google trends' approximate searches, hn points
::    links: google trends' news items, the hn thread
::
+$  topic
  $:  source=source-id
      categories=(set category)
      classification=?(%rules %hint %unclassified)
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
