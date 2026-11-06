::  Topics persistence and Gall event dispatch.
/-  sur=topics, ai=ai-client
/+  default-agent, dbug, ops=topics-agent, jev
=,  ops
=|  state-1
=*  state  -
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    work  ~(. ops [state bowl])
::
++  on-init
  ^-  (quip card _this)
  =/  at  (add now.bowl ~h1)
  =/  srcs  (sources-for default-prefs)
  =.  state  state(prefs default-prefs, sources srcs, every ~h1, next `at)
  =^  cards  state  (refresh:work ~[(timer-card at)])
  [cards this]
::
++  on-save  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  saved=*  q.old
  ?+  -.saved  ~|(%unknown-topics-state !!)
    %0
      =/  prior=state-0  !<(state-0 old)
      =/  upgraded=state-1
        :*  %1  prefs.prior  sources.prior  snapshots.prior  errors.prior
            every.prior  next.prior  spam-provider.prior  verdicts.prior
            judging.prior  ~  ~  *(map source-id:sur timing:sur)
        ==
      `this(state upgraded)
    %1
      =.  state  !<(state-1 old)
      ::  Stop old code before starting a replacement. Never reset snapshots.
      =/  running  active
      ?~  running  `this
      =/  tid  tid.u.running
      =.  pending  [id.input.u.running pending]
      =.  active  ~
      =^  cards  state  (next-job:work (stop-job:work tid))
      [cards this]
  ==
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
    =/  running  active
    ?^  running  `this
    =^  cards  state  (refresh:work ~)
    [cards this]
  ::
      %add-source
    =.  sources  (~(put by sources) id.act source.act)
    ?.  enabled.source.act  `this
    =^  cards  state  (enqueue:work id.act)
    [cards this]
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
    =.  state
      %=  state
        prefs      prefs.act
        sources    srcs
        snapshots  (malt (skim ~(tap by snapshots) keep))
        errors     (malt (skim ~(tap by errors) keep))
      ==
    =^  cards  state  (refresh:work ~)
    [cards this]
  ::
      %del-source
    :-  ~
    %=  this
      sources    (~(del by sources) id.act)
      snapshots  (~(del by snapshots) id.act)
      errors     (~(del by errors) id.act)
      timings    (~(del by timings) id.act)
    ==
  ::
  ::  a new spam provider judges what's saved now, not at the next fetch
      %set-spam-provider
    =.  spam-provider  provider.act
    ?~  provider.act  `this
    =/  batches
      (judge bowl u.provider.act (saved snapshots) (known-keys verdicts judging))
    =.  judging
      (~(gas by judging) (turn batches |=([r=@tas k=(list @t) *] [r k])))
    =/  cards=(list (list card))  (turn batches |=([* * c=(list card)] c))
    =/  cs=(list card)  (zing cards)
    [cs this]
  ::
      %mark
    =/  old  (~(get by verdicts) key.act)
    =/  said=(unit @rd)  ?~(old ~ spam.u.old)
    :-  ~
    %=  this
      verdicts
        ?:  &(?=(~ spam.act) ?=(~ said))  (~(del by verdicts) key.act)
        (~(put by verdicts) key.act [said spam.act])
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
      [%x %diagnostics ~]
    ``noun+!>([active=active pending=pending timings=timings])
  ::
      [%x %spam ~]
    ``noun+!>([provider=spam-provider verdicts=verdicts])
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
    =/  running  active
    ?^  running  [~[(timer-card at)] this]
    =^  cards  state  (refresh:work ~[(timer-card at)])
    [cards this]
  ::
      [%fetch @ *]
    ::  Ignore responses from the pre-worker agent after an upgrade.
    `this
  ::
      [%job-deadline tid=@ @ ~]
    =/  running  active
    ?~  running  `this
    ?.  =(i.t.wire tid.u.running)  `this
    =/  id  id.input.u.running
    =.  errors  (~(put by errors) id [now.bowl 'worker timed out'])
    =.  active  ~
    =^  cards  state  (next-job:work (stop-job:work i.t.wire))
    [cards this]
  ==
::
++  on-watch  on-watch:def
++  on-leave  on-leave:def
::  /spam/<request id>: a batch's evaluation from %trill-ai-client. a
::  refusal (no such provider) or a failed call drops the batch: its
::  topics are asked again after the next fetch
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  (on-agent:def wire sign)
      [%job tid=@ ~]
    =/  running  active
    ?~  running  `this
    ?.  =(i.t.wire tid.u.running)  `this
    ?-  -.sign
      ?(%poke-ack %watch-ack)
        ?~  p.sign  `this
        ~&  [%topics-worker-refused -.sign u.p.sign]
        =/  message=@t
          (crip (scag 1.000 ~(ram re [%rose [" " "" ""] u.p.sign])))
        =^  cards  state  (finish-job:work [[%| message] *timing:sur] %.y)
        [cards this]
      %kick
        =^  cards  state  (finish-job:work [[%| 'worker ended without a result'] *timing:sur] %.n)
        [cards this]
      %fact
        ?:  =(%thread-fail p.cage.sign)
          =/  failure  ((soft (pair term tang)) q.q.cage.sign)
          =/  message=@t
            ?~(failure 'worker failed' (crip "worker failed: {<p.u.failure>}"))
          =^  cards  state  (finish-job:work [[%| message] *timing:sur] %.n)
          [cards this]
        ?.  =(%thread-done p.cage.sign)  `this
        =/  result  ((soft job-result:sur) q.q.cage.sign)
        ?~  result
          =^  cards  state  (finish-job:work [[%| 'invalid worker result'] *timing:sur] %.n)
          [cards this]
        =^  cards  state  (finish-job:work u.result %.n)
        [cards this]
    ==
  ::
      [%spam @ ~]
    =/  rid=@tas  i.t.wire
    ?+  -.sign  `this
        ?(%poke-ack %watch-ack)
      ?~  p.sign  `this
      ~&  [%topics-spam-refused rid]
      `this(judging (~(del by judging) rid))
    ::
        %fact
      =/  keys  (~(get by judging) rid)
      ?~  keys  `this
      =.  judging  (~(del by judging) rid)
      ::  facts arrive untyped: clam, not !<
      =/  =outcome:ai  ;;(outcome:ai q.q.cage.sign)
      ?.  ?=([%response %ok *] outcome)
        ~&  [%topics-spam-failed rid -.outcome]
        `this
      =/  e  (evaluation:jev value.outcome)
      ?~  e
        ~&  [%topics-spam-unparsed rid]
        `this
      `this(verdicts (record verdicts u.keys answers.u.e))
    ==
  ==
++  on-fail   on-fail:def
--
