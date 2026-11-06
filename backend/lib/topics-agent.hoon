::  Durable topics scheduling; the Gall agent only dispatches events.
/-  sur=topics, ai=ai-client, spider
/+  lib=topics, jev
=>
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
      spam-provider=(unit @tas)                   ::  ~: no spam filter
      verdicts=(map @t verdict:sur)               ::  by +topic-key:sur
      judging=(map @tas (list @t))                ::  batches out, their keys
  ==
::
+$  state-1
  $:  %1
      =prefs:sur
      sources=(map source-id:sur source:sur)
      snapshots=(map source-id:sur snapshot:sur)
      errors=(map source-id:sur [at=@da msg=@t])  ::  last failed fetch
      every=@dr
      next=(unit @da)                             ::  pending timer
      spam-provider=(unit @tas)                   ::  ~: no spam filter
      verdicts=(map @t verdict:sur)               ::  by +topic-key:sur
      judging=(map @tas (list @t))                ::  batches out, their keys
      pending=(list source-id:sur)
      active=(unit [tid=@ta input=job:sur])
      timings=(map source-id:sur timing:sur)
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
::  spam: new topics go to %trill-ai-client as Jev evaluations, a yes/no
::  question per topic, batch-size to a request. answers come back on
::  /spam/<request id>; see +on-agent
::
++  batch-size  50
::
++  spam-question
  |=  t=topic:sur
  ^-  question:ai
  :*  %noul
      %-  pairs:enjs:format
      :~  :-  'topic'
          %-  pairs:enjs:format
          :~  title+s+title.t
              description+s+(crip (scag 400 (trip content.t)))
              source+s+source.t
          ==
          question+s+'Is `topic` spam, rather than genuine news or discussion?'
      ==
      `s+'Spam: gambling or betting promotions, scams, SEO filler, ads, or junk posing as news'
      `s+'A genuine news story, event, or discussion people are following'
  ==
::  +question-id: a batch's questions are t0, t1..: its keys, in order
::
++  question-id  |=(i=@ud `@t`(cat 3 't' (crip ((d-co:co 1) i))))
::  +judge: batches asking about the topics not judged yet, nor out
::
++  judge
  |=  [=bowl:gall provider=@tas topics=(list topic:sur) known=(set @t)]
  ^-  (list [rid=@tas keys=(list @t) cards=(list card)])
  =/  fresh=(list [@t topic:sur])
    =|  seen=(set @t)
    =|  out=(list [@t topic:sur])
    |-
    ?~  topics  (flop out)
    =/  k  (topic-key:sur title.i.topics)
    ?:  |((~(has in known) k) (~(has in seen) k))  $(topics t.topics)
    $(topics t.topics, seen (~(put in seen) k), out [[k i.topics] out])
  =|  batches=(list [rid=@tas keys=(list @t) cards=(list card)])
  =/  n=@ud  0
  |-
  ?~  fresh  (flop batches)
  =/  batch  (scag batch-size `(list [@t topic:sur])`fresh)
  =/  rid=@tas
    %+  rap  3
    :~  'topics-'
        (crip ((x-co:co 8) (end [3 4] eny.bowl)))
        '-'
        (crip ((d-co:co 1) n))
    ==
  =/  questions=(map @t question:ai)
    %-  malt
    %+  turn  (gulf 0 (dec (lent batch)))
    |=  i=@ud
    [(question-id i) (spam-question +:(snag i batch))]
  =/  args=evaluate-args:ai
    :+  'jev-latest'
      s+'Topics trending on news sites and search engines, for readers of a social app'
    questions
  =/  =action:ai  [%evaluate rid provider args]
  =/  cards=(list card)
    :~  [%pass /spam/[rid] %agent [our.bowl %trill-ai-client] %poke %noun !>(action)]
        [%pass /spam/[rid] %agent [our.bowl %trill-ai-client] %watch /response/[rid]]
    ==
  %=  $
    fresh    (slag batch-size `(list [@t topic:sur])`fresh)
    n        +(n)
    batches  [[rid (turn batch head) cards] batches]
  ==
::  +record: a batch's answers, onto the verdicts. an owner's word stays
::
++  record
  |=  $:  verdicts=(map @t verdict:sur)
          keys=(list @t)
          answers=(map @t answer:ai)
      ==
  ^-  (map @t verdict:sur)
  =/  i=@ud  0
  |-
  ?~  keys  verdicts
  =/  a  (~(get by answers) (question-id i))
  =?  verdicts  ?=([~ %noul *] a)
    =/  old  (~(get by verdicts) i.keys)
    (~(put by verdicts) i.keys [`p.u.a ?~(old ~ override.u.old)])
  $(keys t.keys, i +(i))
::  +prune: verdicts on topics no source has any more go, unless the
::  owner had a word on them
::
++  prune
  |=  [verdicts=(map @t verdict:sur) snapshots=(map source-id:sur snapshot:sur)]
  ^-  (map @t verdict:sur)
  =/  live=(set @t)
    %-  silt
    (turn (saved snapshots) |=(t=topic:sur (topic-key:sur title.t)))
  %-  malt
  %+  skim  ~(tap by verdicts)
  |=  [k=@t v=verdict:sur]
  |((~(has in live) k) ?=(^ override.v))
::
++  known-keys
  |=  [verdicts=(map @t verdict:sur) judging=(map @tas (list @t))]
  ^-  (set @t)
  ::  a plain loop: silt and zing over these fuse-loop
  =/  out=(list (list @t))  ~(val by judging)
  =/  ks=(set @t)  ~(key by verdicts)
  |-
  ?~  out  ks
  $(out t.out, ks (~(gas in ks) i.out))
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
|_  [state=state-1 =bowl:gall]
+*  prefs  prefs.state
    sources  sources.state
    snapshots  snapshots.state
    errors  errors.state
    spam-provider  spam-provider.state
    verdicts  verdicts.state
    judging  judging.state
    pending  pending.state
    active  active.state
    timings  timings.state
::  Only one worker runs at a time. Refresh triggers are coalesced.
++  refresh
  |=  cards=(list card)
  ^-  (quip card state-1)
  =.  pending
    %+  murn  ~(tap by sources)
    |=  [id=source-id:sur src=source:sur]
    ?:(enabled.src `id ~)
  (next-job cards)
::
++  enqueue
  |=  id=source-id:sur
  ^-  (quip card state-1)
  =/  queued=?  (lien pending |=(other=source-id:sur =(id other)))
  =?  pending  !queued  (snoc pending id)
  (next-job ~)
::
++  next-job
  |=  cards=(list card)
  ^-  (quip card state-1)
  =/  running  active
  ?^  running  [cards state]
  =/  queue  pending
  ?~  queue  [cards state]
  =/  id  i.queue
  =.  pending  t.queue
  =/  src  (~(get by sources) id)
  ?~  src  (next-job cards)
  ?.  enabled.u.src  (next-job cards)
  =/  tid=@ta  (rap 3 ~['topics-' (scot %uv eny.bowl) '-' id])
  =/  input=job:sur  [id u.src prefs]
  =.  active  `[tid input]
  =/  until  (add now.bowl ~m2)
  =/  more=(list card)
      :~
        [%pass /job/[tid] %agent [our.bowl %spider] %watch /thread-result/[tid]]
        [%pass /job/[tid] %agent [our.bowl %spider] %poke %spider-start !>(`start-args:spider`[~ `tid [p.byk.bowl q.byk.bowl da+now.bowl] %topics-fetch !>(input)])]
        [%pass /job-deadline/[tid]/(scot %da until) %arvo %b %wait until]
      ==
  [(weld cards more) state]
::
++  stop-job
  |=  tid=@ta
  ^-  (list card)
  :~  [%pass /job/[tid] %agent [our.bowl %spider] %leave ~]
      [%pass /job-stop/[tid] %agent [our.bowl %spider] %poke %spider-stop !>(`[tid:spider ?]`[tid %.n])]
  ==
::
++  leave-job
  |=  tid=@ta
  ^-  (list card)
  ~[[%pass /job/[tid] %agent [our.bowl %spider] %leave ~]]
::
++  finish-job
  |=  [result=job-result:sur cancel=?]
  ^-  (quip card state-1)
  =/  running  active
  ?~  running  `state
  =/  [tid=@ta input=job:sur]  u.running
  =.  active  ~
  =/  cs=(list card)  ?:(cancel (stop-job tid) (leave-job tid))
  =/  src  (~(get by sources) id.input)
  ?~  src  (next-job cs)
  ?.  &(=(u.src source.input) enabled.u.src =(prefs prefs.input))
    (next-job cs)
  =.  timings  (~(put by timings) id.input timing.result)
  ?:  ?=(%| -.out.result)
    ~&  [%topics-fetch-failed id.input p.out.result]
    =.  errors  (~(put by errors) id.input [now.bowl p.out.result])
    (next-job cs)
  =.  snapshots  (~(put by snapshots) id.input [now.bowl p.out.result])
  =.  errors  (~(del by errors) id.input)
  =.  verdicts  (prune verdicts snapshots)
  ?~  spam-provider  (next-job cs)
  =/  batches
    (judge bowl u.spam-provider p.out.result (known-keys verdicts judging))
  =.  judging
    (~(gas by judging) (turn batches |=([r=@tas k=(list @t) *] [r k])))
  =/  extra=(list card)  (zing (turn batches |=([* * c=(list card)] c)))
  =/  cards=(list card)  (weld cs extra)
  (next-job cards)
::
--
