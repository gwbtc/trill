::  debates: the rules. +apply is all a host does with an action
::
/-  sur=debates
=,  sur
|%
::  +apply: an action from src, at now, or why it's refused
::
++  apply
  |=  [d=debate src=ship now=@da act=action]
  ^-  (each debate @t)
  =/  host  host.key.d
  ?:  (~(has in removed.d) src)  [%| 'you were removed from this debate']
  ?-  -.act
      %join
    ?:  ?=(%ended stage.d)  [%| 'this debate is over']
    ?~  as.act
      :-  %&
      %=  d
        onlookers  (~(put in onlookers.d) src)
        debaters   (~(del by debaters.d) src)
      ==
    ?.  ?|  ?=(%open debaters.config.d)
            (~(has in invited.d) src)
            =(src host)
        ==
      [%| 'only invited ships can take a side']
    :-  %&
    %=  d
      debaters   (~(put by debaters.d) src u.as.act)
      onlookers  (~(del in onlookers.d) src)
      votes      (~(del by votes.d) src)
    ==
  ::
      %leave
    :-  %&
    %=  d
      debaters   (~(del by debaters.d) src)
      onlookers  (~(del in onlookers.d) src)
      votes      (~(del by votes.d) src)
    ==
  ::
      %say
    ?.  ?=(%live stage.d)  [%| 'the debate is not live']
    =/  side  (~(get by debaters.d) src)
    ?~  side  [%| 'only debaters can speak']
    ?:  (~(has in muted.d) src)  [%| 'you are muted']
    =/  text  (strip text.act)
    ?:  =('' text)  [%| 'empty message']
    ?:  (gth (met 3 text) 4.000)  [%| 'message too long']
    =/  mid  (fresh-id messages.d now)
    [%& d(messages (put:mon messages.d mid [mid src u.side text]))]
  ::
      %vote
    ?.  ?=(%live stage.d)  [%| 'voting is only open while the debate is live']
    ?.  (~(has in onlookers.d) src)  [%| 'only onlookers vote']
    ?:  &(!revote.config.d (~(has by votes.d) src))
      [%| 'votes are final in this debate']
    [%& d(votes (~(put by votes.d) src side.act))]
  ::
      %mute
    ?.  (moderates d src)  [%| 'only the host or moderator can mute']
    ?.  (~(has by debaters.d) who.act)  [%| 'not a debater']
    =/  muted
      ?:  on.act  (~(put in muted.d) who.act)
      (~(del in muted.d) who.act)
    [%& d(muted muted)]
  ::
      %remove
    ?.  (moderates d src)  [%| 'only the host or moderator can remove people']
    ?:  =(who.act host)  [%| 'the host can\'t be removed']
    :-  %&
    %=  d
      debaters   (~(del by debaters.d) who.act)
      onlookers  (~(del in onlookers.d) who.act)
      votes      (~(del by votes.d) who.act)
      muted      (~(del in muted.d) who.act)
      removed    (~(put in removed.d) who.act)
    ==
  ::
      %start
    ?.  =(src host)  [%| 'only the host starts a debate']
    ?.  ?=(%scheduled stage.d)  [%| 'already started']
    [%& d(stage %live)]
  ::
      %end
    ?.  =(src host)  [%| 'only the host ends a debate']
    ?:  ?=(%ended stage.d)  [%| 'already over']
    [%& d(stage %ended, ended `now)]
  ::
      %invite
    ?.  =(src host)  [%| 'only the host invites']
    [%& d(invited (~(uni in invited.d) who.act))]
  ==
::
::  +active: not over. a ship is in at most one active debate
::
++  active
  |=  d=debate
  ^-  ?
  !?=(%ended stage.d)
::  +presence-of: who's in debate d, as they tell others: a debater, an
::  onlooker, or its host; ~ if not in it or it's over
::
++  presence-of
  |=  [d=debate who=ship]
  ^-  (unit presence)
  ?.  (active d)  ~
  =/  role=(unit ?(side %onlooker %host))
    =/  side  (~(get by debaters.d) who)
    ?^  side  `u.side
    ?:  (~(has in onlookers.d) who)  `%onlooker
    ?:  =(who host.key.d)  `%host
    ~
  ?~  role  ~
  `[key.d topic.config.d sides.config.d stage.d u.role]
::
::  +action-id: the debate an action is for. it's every action's first
::  field, but id.act doesn't resolve through the union (find-fork), and
::  where it sits depends on the shape: [%end id] vs [%say id text]
::
++  action-id
  |=  a=action
  ^-  @da
  =/  tail=*  +.a
  ;;(@da ?@(tail tail -.tail))
::
++  moderates
  |=  [d=debate who=ship]
  ^-  ?
  |(=(who host.key.d) =(`who moderator.config.d))
::  +fresh-id: now, or the next free instant after it
::
++  fresh-id
  |=  [ms=((mop @da message) lth) id=@da]
  ^-  @da
  |-
  ?.  (has:mon ms id)  id
  $(id +(id))
::  +shown-votes: who voted for what, as others may see it: all of it
::  when the tally is live or the debate is over, else nothing (the
::  total is sent on its own)
::
++  shown-votes
  |=  d=debate
  ^-  (map ship side)
  ?:  |(?=(%live tally.config.d) ?=(%ended stage.d))  votes.d
  ~
::  +page: up to page-size messages before `before` (~: the latest),
::  oldest first, and whether there are older ones
::
++  page-size  100
++  page
  |=  [ms=((mop @da message) lth) before=(unit @da)]
  ^-  [(list message) ?]
  =/  older=(list message)
    %+  murn  (bap:mon ms)
    |=  [k=@da m=message]
    ?~  before  `m
    ?:((lth k u.before) `m ~)
  :-  (flop (scag page-size older))
  (gth (lent older) page-size)
::  +trim: a debate with only its latest page of messages, and whether
::  it had more
::
++  trim
  |=  d=debate
  ^-  [debate ?]
  =/  [ms=(list message) more=?]  (page messages.d ~)
  :_  more
  d(messages (gas:mon *((mop @da message) lth) (turn ms |=(m=message [id.m m]))))
::  +redact: the debate as subscribers get it
::
++  redact
  |=  d=debate
  ^-  debate
  d(votes (shown-votes d))
::  +new-debate: a fresh one, hosted by us
::
++  new-debate
  |=  [=key =config]
  ^-  debate
  =/  stg=stage
    ?~  start.config  %live
    ?:  (lte u.start.config id.key)  %live
    %scheduled
  :*  key  config  stg
      ~  ~  ~  ~  ~  ~
      *((mop @da message) lth)
      ~
  ==
::  +valid-config: a topic, two named sides, times that make sense
::
++  valid-config
  |=  [c=config now=@da]
  ^-  (unit @t)
  ?:  =('' (strip topic.c))  `'a debate needs a topic'
  ?:  |(=('' (strip a.sides.c)) =('' (strip b.sides.c)))  `'both sides need a name'
  ?:  (gth (met 3 topic.c) 300)  `'the topic is too long'
  ?:  ?&  ?=(^ start.c)  ?=(^ end.c)  (lte u.end.c u.start.c)  ==
    `'it has to end after it starts'
  ?:  &(?=(^ end.c) (lte u.end.c now))  `'the end time has passed'
  ~
::  +strip: without leading and trailing whitespace
::
++  strip
  |=  t=@t
  ^-  @t
  =/  ws  |=(c=@t |(=(c ' ') =(c '\0a') =(c '\09') =(c '\0d')))
  =/  ltrim
    |=  s=tape
    |-  ^-  tape
    ?~  s  ~
    ?.  (ws i.s)  s
    $(s t.s)
  (crip (flop (ltrim (flop (ltrim (trip t))))))
--
