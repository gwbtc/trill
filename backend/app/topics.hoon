::  topics: fetches trending topics from configured sources on a timer
::  and keeps the latest snapshot of each, for other agents to scry
::
::    scries (all %noun; types in sur/topics.hoon):
::      /x/topics           (list topic), every source, newest first
::      /x/topics/<source>  (list topic) from one source
::      /x/category/<cat>   (list topic) in a category (%world, %sports..)
::      /x/sources          (map source-id source)
::      /x/prefs            prefs: country, language, categories
::      /x/status           [every next errors fetched]
::
::    e.g. .^((list topic:topics) %gx /=topics=/topics/noun)
::
::    :topics %print  logs the saved topics to the terminal
::
/-  sur=topics
/+  default-agent, dbug, lib=topics
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      =prefs:sur
      sources=(map source-id:sur source:sur)
      snapshots=(map source-id:sur snapshot:sur)
      errors=(map source-id:sur [at=@da msg=@t])  ::  last failed fetch
      every=@dr
      next=(unit @da)                             ::  pending timer
  ==
::
::  +default-prefs: english, the us, every category
::
++  default-prefs
  ^-  prefs:sur
  :+  'US'  'en'
  %-  silt
  ^-  (list category:sur)
  :~  %world  %technology  %business  %sports  %entertainment
      %internet-culture  %lifestyle  %other
  ==
::  +gnews-sections: google news topic -> our category
::
++  gnews-sections
  ^-  (list [@t category:sur])
  :~  ['WORLD' %world]
      ['NATION' %world]
      ['BUSINESS' %business]
      ['TECHNOLOGY' %technology]
      ['SCIENCE' %technology]
      ['ENTERTAINMENT' %entertainment]
      ['SPORTS' %sports]
      ['HEALTH' %lifestyle]
  ==
::  +sources-for: google trends in the prefs' country, the google news
::  sections of the prefs' categories (fetched in the prefs' edition, see
::  +url:lib), hacker news
::
++  sources-for
  |=  =prefs:sur
  ^-  (map source-id:sur source:sur)
  %-  ~(gas by *(map source-id:sur source:sur))
  ^-  (list [source-id:sur source:sur])
  ;:  weld
    :~  :-  (rap 3 ~['gtrends-' (crip (cass (trip country.prefs)))])
        [%gtrends country.prefs ~ %.y]
    ==
  ::
    %+  murn  gnews-sections
    |=  [topic=@t c=category:sur]
    ^-  (unit [source-id:sur source:sur])
    ?.  (~(has in cats.prefs) c)  ~
    :-  ~
    :-  (rap 3 ~['gnews-' (crip (cass (trip topic)))])
    [%gnews topic `c %.y]
  ::
    `(list [source-id:sur source:sur])`~[[%hn [%hn '' ~ %.y]]]
  ==
::  +valid-prefs: an ISO country code, a plausible google language code
::  ('en', 'es-419', 'zh-Hans'), at least one category
::
++  valid-prefs
  |=  p=prefs:sur
  ^-  ?
  ?&  ?=(^ (rush country.p ;~(plug hig hig)))
      ?=(^ (rush lang.p ;~(plug low low (star ;~(pose low hig nud hep)))))
      (lte (met 3 lang.p) 12)
      ?=(^ cats.p)
  ==
::
++  fetch-card
  |=  [id=source-id:sur =source:sur =prefs:sur]
  ^-  card
  [%pass /fetch/[id] %arvo %i %request (request:lib source prefs) *outbound-config:iris]
::
++  fetch-all
  |=  [sources=(map source-id:sur source:sur) =prefs:sur]
  ^-  (list card)
  %+  murn  ~(tap by sources)
  |=  [id=source-id:sur src=source:sur]
  ?.  enabled.src  ~
  `(fetch-card id src prefs)
::  +stamp: parsed topics tagged with their source and categories. a
::  google news topic takes its section's category; the rest are
::  classified by keyword
::
++  stamp
  |=  [id=source-id:sur =source:sur raws=(list raw:lib)]
  ^-  (list topic:sur)
  %+  turn  raws
  |=  r=raw:lib
  ^-  topic:sur
  =/  section=(unit category:sur)
    ?.(?=(%gnews kind.source) ~ hint.source)
  ?^  section  [id (silt ~[u.section]) %source r]
  =/  [cats=(set category:sur) how=?(%rules %hint %unclassified)]
    (classify:lib [title.r (turn links.r |=(l=link:sur title.l))] hint.source)
  [id cats how r]
::  +location: a redirect's target, whatever the header's case
::
++  location
  |=  headers=header-list:http
  ^-  (unit @t)
  ?~  headers  ~
  ?:  =('location' (crip (cass (trip key.i.headers))))  `value.i.headers
  $(headers t.headers)
::  +timer-card: the wire carries the time, so a wake from a timer that
::  was replaced (see %set-interval) can be told apart and ignored
::
++  timer-card
  |=  at=@da
  ^-  card
  [%pass /timer/(scot %da at) %arvo %b %wait at]
::
::  +in-category: out here rather than inline in +on-peek, where a gate
::  over the refined pole fails with fuse-loop
::
++  in-category
  |=  [cat=@tas topics=(list topic:sur)]
  ^-  (list topic:sur)
  (skim topics |=(t=topic:sur (~(has in `(set @tas)`categories.t) cat)))
::  +saved: every source's topics, newest first
::
++  saved
  |=  snapshots=(map source-id:sur snapshot:sur)
  ^-  (list topic:sur)
  ::  typed before sorting: sort over the bare zing fails with fuse-loop
  =/  all=(list topic:sur)
    (zing (turn ~(val by snapshots) |=(s=snapshot:sur topics.s)))
  (sort all |=([a=topic:sur b=topic:sur] (gth date.a date.b)))
::  +print-topics: one line per topic, for :topics %print
::
::    ~2026.9.26..05.47.04  gnews-sports  sports  Title
::
++  print-topics
  |=  topics=(list topic:sur)
  ^-  tang
  :-  leaf+"%topics: {<(lent topics)>} saved"
  %+  turn  topics
  |=  t=topic:sur
  ^-  tank
  =/  cats=tape
    %-  zing
    %+  join  ","
    (turn ~(tap in categories.t) |=(c=category:sur (trip c)))
  :-  %leaf
  ;:  weld
    (scow %da (sub date.t (mod date.t ~s1)))
    "  "  (trip source.t)
    "  "  cats
    "  "  (trip title.t)
  ==
--
::
=|  state-0
=*  state  -
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  =/  at  (add now.bowl ~h1)
  =/  srcs  (sources-for default-prefs)
  :_  this(prefs default-prefs, sources srcs, every ~h1, next `at)
  [(timer-card at) (fetch-all srcs default-prefs)]
::
++  on-save  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ::  no migrations before launch: change state-0 in place and |nuke %topics
  `this(state !<(state-0 old))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?.  ?=(%noun mark)  (on-poke:def mark vase)
  ::  :topics %print  logs the saved topics to the terminal
  ?@  q.vase
    ?.  =(%print q.vase)  (on-poke:def mark vase)
    %-  (slog (print-topics (saved snapshots)))
    `this
  =/  act  ;;(action:sur q.vase)
  ?-  -.act
      %fetch  [(fetch-all sources prefs) this]
  ::
      %add-source
    :_  this(sources (~(put by sources) id.act source.act))
    ?.  enabled.source.act  ~
    ~[(fetch-card id.act source.act prefs)]
  ::
  ::  new prefs replace the sources, and any added by hand. a new country
  ::  or language changes every google feed, so their old topics go;
  ::  otherwise only the dropped sources' do. then everything is fetched
      %set-prefs
    ~|  %bad-topics-prefs
    ?>  (valid-prefs prefs.act)
    =/  srcs  (sources-for prefs.act)
    =/  same-edition=?
      &(=(country.prefs country.prefs.act) =(lang.prefs lang.prefs.act))
    =/  keep
      |=  [id=source-id:sur *]
      ?&  (~(has by srcs) id)
          |(same-edition =(%hn id))
      ==
    :-  (fetch-all srcs prefs.act)
    %=  this
      prefs      prefs.act
      sources    srcs
      snapshots  (malt (skim ~(tap by snapshots) keep))
      errors     (malt (skim ~(tap by errors) keep))
    ==
  ::
      %del-source
    :-  ~
    %=  this
      sources    (~(del by sources) id.act)
      snapshots  (~(del by snapshots) id.act)
      errors     (~(del by errors) id.act)
    ==
  ::
      %set-interval
    ~|  %interval-under-a-minute
    ?>  (gte every.act ~m1)
    =/  at  (add now.bowl every.act)
    :_  this(every every.act, next `at)
    %+  weld
      ?~  next  ~
      ~[[%pass /timer/(scot %da u.next) %arvo %b %rest u.next]]
    ~[(timer-card at)]
  ==
::
++  on-peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  ~
    [%x %sources ~]  ``noun+!>(sources)
    [%x %prefs ~]    ``noun+!>(prefs)
  ::
      [%x %status ~]
    =/  fetched  (~(run by snapshots) |=(s=snapshot:sur fetched.s))
    ``noun+!>([every=every next=next errors=errors fetched=fetched])
  ::
      [%x %topics ~]
    ``noun+!>((saved snapshots))
  ::
      [%x %topics id=@ ~]
    =/  s  (~(get by snapshots) id.pole)
    ?~  s  [~ ~]
    ``noun+!>(topics.u.s)
  ::
      [%x %category cat=@ ~]
    ``noun+!>((in-category cat.pole (saved snapshots)))
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%timer @ ~]
    ?.  ?=([%behn %wake *] sign-arvo)  `this
    ?.  =(next (slaw %da i.t.wire))  `this
    =/  at  (add now.bowl every)
    :_  this(next `at)
    [(timer-card at) (fetch-all sources prefs)]
  ::
      [%fetch @ *]
    ?.  ?=([%iris %http-response *] sign-arvo)  `this
    =/  res=client-response:iris  +>.sign-arvo
    ?:  ?=(%progress -.res)  `this
    =/  id=source-id:sur  i.t.wire
    =/  src  (~(get by sources) id)
    ::  deleted while the request was in flight
    ?~  src  `this
    ::  follow redirects ourselves (google news topic urls redirect): iris
    ::  handed this 302 back. the hop count rides on the wire
    =/  hops=@ud  ?.(?=([%fetch @ @ ~] wire) 0 (fall (slaw %ud i.t.t.wire) 0))
    =/  moved=(unit @t)
      ?.  ?=(%finished -.res)  ~
      ?.  (~(has in (silt ~[301 302 303 307 308])) status-code.response-header.res)  ~
      (location headers.response-header.res)
    ?:  &(?=(^ moved) (lth hops 3))
      =/  req  (request:lib u.src prefs)
      :_  this
      :~  :*  %pass  /fetch/[id]/(scot %ud +(hops))  %arvo  %i  %request
              req(url u.moved)  *outbound-config:iris
      ==  ==
    =/  out=(each (list topic:sur) @t)
      ?.  ?=(%finished -.res)  [%| 'request cancelled']
      =/  status  status-code.response-header.res
      =/  body=@t  ?~(full-file.res '' q.data.u.full-file.res)
      ?.  =(200 status)
        [%| (crip "http {<status>}: {(scag 600 (trip body))}")]
      ?~  full-file.res  [%| 'empty body']
      =/  parsed  (parse:lib kind.u.src now.bowl q.data.u.full-file.res)
      ?:  ?=(%| -.parsed)  [%| p.parsed]
      [%& (stamp id u.src p.parsed)]
    ?:  ?=(%| -.out)
      ~&  [%topics-fetch-failed id p.out]
      `this(errors (~(put by errors) id [now.bowl p.out]))
    :-  ~
    %=  this
      snapshots  (~(put by snapshots) id [now.bowl p.out])
      errors     (~(del by errors) id)
    ==
  ==
::
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
