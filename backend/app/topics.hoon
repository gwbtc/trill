::  topics: fetches trending topics from configured sources on a timer
::  and keeps the latest snapshot of each, for other agents to scry
::
::    scries (all %noun; types in sur/topics.hoon):
::      /x/topics           (list topic), every source, newest first
::      /x/topics/<source>  (list topic) from one source
::      /x/category/<cat>   (list topic) in a category (%world, %sports..)
::      /x/sources          (map source-id source)
::      /x/status           [every next errors fetched gdelt]
::
::    e.g. .^((list topic:topics) %gx /=topics=/topics/noun)
::
::    :topics %print  logs the saved topics to the terminal
::
/-  sur=topics
/+  default-agent, dbug, lib=topics
|%
+$  card  card:agent:gall
+$  state-2
  $:  %2
      sources=(map source-id:sur source:sur)
      snapshots=(map source-id:sur snapshot:sur)
      errors=(map source-id:sur [at=@da msg=@t])  ::  last failed fetch
      every=@dr
      next=(unit @da)                             ::  pending timer
      gdelt=gdelt-queue
  ==
::  +gdelt-queue: gdelt allows one request every five seconds and counts
::  slow requests still in flight, so its sources are fetched one at a
::  time, each starting +gdelt-gap after the previous one answered.
::  busy: a request is in flight or the gap hasn't passed
::
+$  gdelt-queue  [queue=(list source-id:sur) busy=?]
++  gdelt-gap  ~s10
::
+$  state-1
  $:  %1
      sources=(map source-id:sur source:sur)
      snapshots=(map source-id:sur snapshot:sur)
      errors=(map source-id:sur [at=@da msg=@t])
      every=@dr
      next=(unit @da)
  ==
::
::  +default-sources: trend-collector's set. five google trends regions,
::  one gdelt query per category, hacker news
::
++  default-sources
  ^-  (map source-id:sur source:sur)
  =/  regions=(list @t)  ~['US' 'GB' 'IN' 'CA' 'AU']
  =/  gdelt=(list [category:sur @t])
    :~  [%world 'election OR diplomacy OR conflict OR sanctions OR summit']
        [%technology 'technology OR science OR research OR spacecraft OR software']
        [%business 'economy OR inflation OR stocks OR business OR finance']
        [%sports 'football OR cricket OR tennis OR basketball OR Olympics']
        [%entertainment 'celebrity OR music OR movie OR cinema OR concert']
        [%internet-culture 'TikTok OR Instagram OR meme OR viral']
        [%lifestyle 'fashion OR food OR travel OR wellness OR gardening']
    ==
  %-  ~(gas by *(map source-id:sur source:sur))
  ^-  (list [source-id:sur source:sur])
  ;:  weld
    %+  turn  regions
    |=  r=@t
    ^-  [source-id:sur source:sur]
    :-  (rap 3 ~['gtrends-' (crip (cass (trip r)))])
    [%gtrends r ~ %.y]
  ::
    %+  turn  gdelt
    |=  [c=category:sur terms=@t]
    ^-  [source-id:sur source:sur]
    [(rap 3 ~['gdelt-' c]) [%gdelt terms `c %.y]]
  ::
    `(list [source-id:sur source:sur])`~[[%hn [%hn '' ~ %.y]]]
  ==
::  +fetch-card: gdelt fetches are marked on the wire, so their answer
::  starts the gap even if the source was deleted meanwhile
::
++  fetch-card
  |=  [id=source-id:sur =source:sur]
  ^-  card
  =/  =wire  ?:(?=(%gdelt kind.source) /fetch/[id]/gdelt /fetch/[id])
  [%pass wire %arvo %i %request (request:lib source) *outbound-config:iris]
::  +fetch-all: every enabled source; gdelt ones through the queue
::
++  fetch-all
  |=  s=state-2
  ^-  (quip card state-2)
  =/  now=(list card)
    %+  murn  ~(tap by sources.s)
    |=  [id=source-id:sur src=source:sur]
    ?:  |(!enabled.src ?=(%gdelt kind.src))  ~
    `(fetch-card id src)
  =/  ids=(list source-id:sur)
    %-  sort  :_  aor
    %+  murn  ~(tap by sources.s)
    |=  [id=source-id:sur src=source:sur]
    ?.  &(enabled.src ?=(%gdelt kind.src))  ~
    `id
  =^  later  s  (pump (enqueue s ids))
  [(weld now later) s]
::  +enqueue: add gdelt sources to the queue, skipping queued ones
::
++  enqueue
  |=  [s=state-2 ids=(list source-id:sur)]
  ^-  state-2
  =/  queued  (silt queue.gdelt.s)
  =.  queue.gdelt.s
    (weld queue.gdelt.s (skip ids |=(i=source-id:sur (~(has in queued) i))))
  s
::  +pump: start the next queued gdelt source, unless one is in flight or
::  within the gap. skips sources deleted or disabled since queued
::
++  pump
  |=  s=state-2
  ^-  (quip card state-2)
  ?:  busy.gdelt.s  `s
  |-
  ?~  queue.gdelt.s  `s
  =/  src  (~(get by sources.s) i.queue.gdelt.s)
  ?.  &(?=(^ src) enabled.u.src ?=(%gdelt kind.u.src))
    $(queue.gdelt.s t.queue.gdelt.s)
  :-  ~[(fetch-card i.queue.gdelt.s u.src)]
  s(gdelt [t.queue.gdelt.s %.y])
::  +stamp: parsed topics tagged with their source and categories
::
++  stamp
  |=  [id=source-id:sur =source:sur raws=(list raw:lib)]
  ^-  (list topic:sur)
  %+  turn  raws
  |=  r=raw:lib
  ^-  topic:sur
  =/  [cats=(set category:sur) how=?(%rules %hint %unclassified)]
    (classify:lib [title.r (turn links.r |=(l=link:sur title.l))] hint.source)
  [id cats how r]
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
::
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
::    ~2026.9.26..05.47.04  gdelt-sports  sports  Title
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
=|  state-2
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
  =.  state  state(sources default-sources, every ~h1, next `at)
  =^  cards  state  (fetch-all state)
  [[(timer-card at) cards] this]
::
++  on-save  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  ver  -:;;(^ q.old)
  ::  %0 was a pre-release shape (per-source categories); start over
  ?:  =(%0 ver)  on-init
  ?:  =(%1 ver)
    =/  o  !<(state-1 old)
    `this(state [%2 sources.o snapshots.o errors.o every.o next.o [~ %.n]])
  `this(state !<(state-2 old))
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
      %fetch
    =^  cards  state  (fetch-all state)
    [cards this]
  ::
      %add-source
    =.  sources  (~(put by sources) id.act source.act)
    ?.  enabled.source.act  `this
    ?.  ?=(%gdelt kind.source.act)
      [~[(fetch-card id.act source.act)] this]
    =^  cards  state  (pump (enqueue state ~[id.act]))
    [cards this]
  ::
      %del-source
    :-  ~
    %=  this
      sources      (~(del by sources) id.act)
      snapshots    (~(del by snapshots) id.act)
      errors       (~(del by errors) id.act)
      queue.gdelt  (skip queue.gdelt |=(i=source-id:sur =(i id.act)))
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
  ::
      [%x %status ~]
    =/  fetched  (~(run by snapshots) |=(s=snapshot:sur fetched.s))
    ``noun+!>([every=every next=next errors=errors fetched=fetched gdelt=gdelt])
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
    =.  next  `at
    =^  cards  state  (fetch-all state)
    [[(timer-card at) cards] this]
  ::
  ::  the gap after a gdelt answer has passed
      [%gdelt-gap ~]
    ?.  ?=([%behn %wake *] sign-arvo)  `this
    =.  busy.gdelt  %.n
    =^  cards  state  (pump state)
    [cards this]
  ::
  ::  state-1's gdelt spacing timers, possibly still pending
      [%stagger @ ~]  `this
  ::
      [%fetch @ *]
    ?.  ?=([%iris %http-response *] sign-arvo)  `this
    =/  res=client-response:iris  +>.sign-arvo
    ?:  ?=(%progress -.res)  `this
    ::  a gdelt answer, whatever the outcome, starts the gap
    =/  gap=(list card)
      ?.  ?=([%fetch @ %gdelt ~] wire)  ~
      ~[[%pass /gdelt-gap %arvo %b %wait (add now.bowl gdelt-gap)]]
    =/  id=source-id:sur  i.t.wire
    =/  src  (~(get by sources) id)
    ::  deleted while the request was in flight
    ?~  src  [gap this]
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
      [gap this(errors (~(put by errors) id [now.bowl p.out]))]
    :-  gap
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
