::  json-topics: %topics data for the trending topics card
::
/-  tsur=topics
|%
++  en
=,  enjs:format
|%
::  +trending: each source's leading topics, in the source's own order,
::  with when the source was last fetched
::
++  trending
  |=  srcs=(list [id=source-id:tsur fetched=@da topics=(list topic:tsur)])
  ^-  json
  %-  pairs
  %+  turn  srcs
  |=  [id=source-id:tsur fetched=@da topics=(list topic:tsur)]
  :-  id
  %-  pairs
  :~  fetched+(time fetched)
      topics+a+(turn topics topic)
  ==
::  +topic: the fields the card shows. url falls back to the first
::  related link: google trends searches have no url of their own
::
++  topic
  |=  t=topic:tsur
  ^-  json
  =/  url=(unit @t)  ?^(url.t url.t ?~(links.t ~ `url.i.links.t))
  %-  pairs
  :~  source+s+source.t
      title+s+title.t
      url+?~(url ~ s+u.url)
      pic+?~(pic.t ~ s+u.pic.t)
      score+?~(score.t ~ (numb u.score.t))
      date+(time date.t)
      categories+a+(turn ~(tap in categories.t) |=(c=category:tsur s+c))
  ==
--
--
