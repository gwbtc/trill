::  json-topics: %topics data for the trending topics card, and its
::  settings
::
/-  tsur=topics
|%
++  en
=,  enjs:format
|%
::  +trending: the prefs, and each source's leading topics in the
::  source's own order, with when the source was last fetched
::
++  trending
  |=  $:  =prefs:tsur
          srcs=(list [id=source-id:tsur fetched=@da topics=(list topic:tsur)])
      ==
  ^-  json
  %-  pairs
  :~  prefs+(en-prefs prefs)
    :-  %sources
    %-  pairs
    %+  turn  srcs
    |=  [id=source-id:tsur fetched=@da topics=(list topic:tsur)]
    :-  id
    %-  pairs
    :~  fetched+(time fetched)
        topics+a+(turn topics topic)
    ==
  ==
::
++  en-prefs
  |=  p=prefs:tsur
  ^-  json
  %-  pairs
  :~  country+s+country.p
      lang+s+lang.p
      categories+a+(turn ~(tap in cats.p) |=(c=category:tsur s+c))
  ==
::  +topic: the fields the card shows. url falls back to the first
::  related link, for topics saved before google trends had urls
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
      content+s+content.t
      ::  the related articles, for the topic's modal
      links+a+(turn (scag 5 links.t) link)
  ==
::
++  link
  |=  l=link:tsur
  ^-  json
  %-  pairs
  :~  title+s+title.l
      url+s+url.l
      publisher+s+publisher.l
      pic+?~(pic.l ~ s+u.pic.l)
  ==
--
::  +de: the settings page's prefs. %topics checks the codes themselves
::
++  de
=,  dejs-soft:format
|%
++  prefs
  ^-  $-(json (unit prefs:tsur))
  %-  ot
  :~  country+so
      lang+so
      :-  %categories
      ::  dejs-soft has no +as
      %+  cu  |=(l=(list category:tsur) (silt l))
      %-  ar
      %-  su
      %-  perk
      :~  %world  %technology  %business  %sports  %entertainment
          %internet-culture  %lifestyle  %other
      ==
  ==
--
--
