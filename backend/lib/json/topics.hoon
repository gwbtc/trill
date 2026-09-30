::  json-topics: %topics data for the trending topics card, and its
::  settings
::
/-  tsur=topics
|%
++  en
=,  enjs:format
|%
::  +trending: the prefs, and each source's topics in the
::  source's own order, with when the source was last fetched
::
::    spam: who judges it, and the topics Jev flagged or the owner had
::    a word on, hidden or not, for the card's review list
::
++  trending
  |=  $:  =prefs:tsur
          srcs=(list [id=source-id:tsur fetched=@da topics=(list topic:tsur)])
          provider=(unit @tas)
          flagged=(list [key=@t t=topic:tsur v=verdict:tsur])
      ==
  ^-  json
  %-  pairs
  :~  prefs+(en-prefs prefs)
    :-  %spam
    %-  pairs
    :~  provider+?~(provider ~ s+u.provider)
        threshold+(real spam-threshold:tsur)
        flagged+a+(turn flagged flagged-topic)
    ==
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
  ::  who published the url: google news' are all its own redirects
  =/  by=(unit link:tsur)
    ?~  url  ~
    (find-link links.t u.url)
  %-  pairs
  ::  no related articles: they're most of the weight (google news
  ::  urls run to 270 characters). the topic's modal asks for them by id
  :~  source+s+source.t
      id+s+(topic-id:tsur title.t)
      title+s+title.t
      url+?~(url ~ s+u.url)
      publisher+s+?~(by '' publisher.u.by)
      pic+?~(pic.t ~ s+u.pic.t)
      score+?~(score.t ~ (numb u.score.t))
      date+(time date.t)
      categories+a+(turn ~(tap in categories.t) |=(c=category:tsur s+c))
      content+s+content.t
  ==
::
++  find-link
  |=  [ls=(list link:tsur) url=@t]
  ^-  (unit link:tsur)
  ?~  ls  ~
  ?:  =(url url.i.ls)  `i.ls
  $(ls t.ls)
::  +links: a topic's related articles, for its modal, but the one it
::  links to itself
::
++  links
  |=  t=topic:tsur
  ^-  json
  =/  url=(unit @t)  ?^(url.t url.t ?~(links.t ~ `url.i.links.t))
  :-  %a
  %+  turn
    %+  scag  5
    (skip links.t |=(l=link:tsur =(`url.l url)))
  link
::
++  flagged-topic
  |=  [key=@t t=topic:tsur v=verdict:tsur]
  ^-  json
  =/  j  (topic t)
  ?>  ?=([%o *] j)
  :-  %o
  %-  ~(gas by p.j)
  :~  key+s+key
      spam+?~(spam.v ~ (real u.spam.v))
      override+?~(override.v ~ b+u.override.v)
      hidden+b+(hidden:tsur v)
  ==
::  +real: '.~0.97' is how @rd prints
::
++  real  |=(r=@rd `json`n+(rsh [3 2] (scot %rd r)))
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
::  +de: what the settings page and the trending card may ask of %topics,
::  forwarded by %nostrill. %topics checks the codes themselves
::
++  de
=,  dejs-soft:format
|%
++  action
  ^-  $-(json (unit action:tsur))
  %-  of
  :~  set-prefs+prefs
      set-spam-provider+(ot ~[provider+(mu (su sym))])
      mark+(ot ~[key+so spam+(mu bo)])
  ==
::
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
