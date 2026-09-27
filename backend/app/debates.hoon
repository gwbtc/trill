::  debates: two sides argue, onlookers vote
::
::    the ship that creates a debate hosts it. guests subscribe to
::    /debate/<id> on the host and poke it their actions (%noun, $msg);
::    the host checks each with +apply:lib and relays the result.
::    our own UI pokes $command (%json) and watches /ui
::
::    scries: /x/debates  every debate we host or follow, and our
::    invitations, as json
::
/-  sur=debates, hark
/+  default-agent, dbug, lib=debates, dj=json-debates
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      hosting=(map @da debate:sur)
      joined=(map key:sur [=debate:sur total=@ud])   ::  mirrors
      invites=(map key:sur invitation:sur)
      ::  others' presence: the ships the UI asked us to track
      tracked=(set ship)
      presences=(map ship presence:sur)
  ==
--
::
=|  state-0
=*  state  -
%-  agent:dbug
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    hc    ~(. +> bowl)
::
++  on-init   `this
++  on-save   !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ::  no migrations before launch: change state-0 in place and |nuke
  `this(state !<(state-0 old))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %json
    ?>  =(our src):bowl
    =/  cmd  (command:de:dj !<(json vase))
    ?~  cmd  ~|(%bad-debates-json !!)
    =^  cards  state  (command:hc u.cmd)
    [cards this]
  ::
      %noun
    ?:  =(our src):bowl
      =^  cards  state  (command:hc ;;(command:sur q.vase))
      [cards this]
    =/  m  ((soft msg:sur) q.vase)
    ?~  m  ~|(%bad-debates-msg !!)
    =^  cards  state
      ?-  -.u.m
        %action   (host-act:hc src.bowl action.u.m)
        %invited  (invited:hc invitation.u.m)
      ==
    [cards this]
  ==
::
++  on-watch
  |=  =(pole knot)
  ^-  (quip card _this)
  ?+  pole  (on-watch:def pole)
      [%ui ~]
    ?>  =(our src):bowl
    :_  this
    ~[[%give %fact ~ %json !>((frond:enjs:format %all all:hc))]]
  ::
      ::  the debate we're in, for anyone who asks (profiles, feeds)
      [%presence ~]
    :_  this
    ~[[%give %fact ~ %noun !>(current:hc)]]
  ::
      [%debate id=@ ~]
    =/  id  `@da`(slav %ud id.pole)
    =/  d  (~(get by hosting) id)
    ?~  d  ~|(%no-such-debate !!)
    ?<  (~(has in removed.u.d) src.bowl)
    :_  this
    ~[[%give %fact ~ %noun !>(`update:sur`[%init (redact:lib u.d) ~(wyt by votes.u.d)])]]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  (on-agent:def wire sign)
      [%debate @ @ ~]
    =/  =key:sur  [(slav %p i.t.wire) `@da`(slav %ud i.t.t.wire)]
    ?-  -.sign
        %poke-ack  `this
        %watch-ack
      ?~  p.sign  `this
      ::  refused: removed, or no such debate
      =/  before  current:hc
      =.  joined  (~(del by joined) key)
      :_  this
      [(ui-card:hc key [%gone ~]) (presence-cards:hc before)]
    ::
        %kick
      ?.  (~(has by joined) key)  `this
      :_  this
      ~[(watch-card:hc key)]
    ::
        %fact
      ::  from another ship: an untyped noun, so clammed, not !<
      =/  upd  ;;(update:sur q.q.cage.sign)
      =/  before  current:hc
      =.  joined  (mirror:hc key upd)
      :_  this
      [(ui-card:hc key upd) (presence-cards:hc before)]
    ==
  ::
      [%act @ @ ~]
    ?.  ?=(%poke-ack -.sign)  `this
    ?~  p.sign  `this
    ::  the host refused an action: tell the UI why
    =/  =key:sur  [(slav %p i.t.wire) `@da`(slav %ud i.t.t.wire)]
    :_  this
    ~[(ui-error:hc key (tang-text:hc u.p.sign))]
  ::
      [%invite *]  `this
  ::
      ::  a tracked ship's presence
      [%presence @ ~]
    =/  who  (slav %p i.t.wire)
    ?-  -.sign
      %poke-ack   `this
      %watch-ack  `this                       ::  a nack: no %debates there
        %kick
      ?.  (~(has in tracked) who)  `this
      :_  this
      ~[[%pass wire %agent [who %debates] %watch /presence]]
    ::
        %fact
      =/  p  ;;((unit presence:sur) q.q.cage.sign)
      =.  presences
        ?~  p  (~(del by presences) who)
        (~(put by presences) who u.p)
      :_  this
      :~  %-  ui-fact:hc
          %+  frond:enjs:format  %presence
          (pairs:enjs:format ~[ship+s+(scot %p who) presence+(presence:en:dj p)])
      ==
    ==
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%timer ?(%start %end) @ ~]
    ?.  ?=([%behn %wake *] sign-arvo)  `this
    =/  id  `@da`(slav %ud i.t.t.wire)
    =/  d  (~(get by hosting) id)
    ?~  d  `this
    =/  act=action:sur  ?:(?=(%start i.t.wire) [%start id] [%end id])
    =/  res  (apply:lib u.d our.bowl now.bowl act)
    ::  already started or ended by hand
    ?:  ?=(%| -.res)  `this
    =^  cards  state  (hosted:hc id u.d p.res act)
    [cards this]
  ==
::
++  on-peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  (on-peek:def pole)
    [%x %debates ~]  ``json+!>(all:hc)
  ==
::
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
::
|_  =bowl:gall
++  command
  |=  cmd=command:sur
  ^-  (quip card _state)
  ?-  -.cmd
      %create
    =/  bad  (valid-config:lib config.cmd now.bowl)
    ?^  bad  ~|(u.bad !!)
    ::  one debate at a time: hosting counts until it ends
    ?:  (busy ~)  ~|('you are already in a debate' !!)
    =/  before  current
    =/  id  (fresh-host-id now.bowl)
    =/  d  (new-debate:lib [our.bowl id] config.cmd)
    =.  invited.d  (~(del in invite.cmd) our.bowl)
    =.  hosting  (~(put by hosting) id d)
    =/  init=(list card)  ~[(ui-card [our.bowl id] [%init (redact:lib d) 0])]
    :_  state
    ;:  weld
      init
      (timer-cards id config.cmd)
      (invite-cards d invited.d)
      (presence-cards before)
    ==
  ::
      %act
    ::  one debate at a time: no joining another while in one
    ?:  &(?=(%join -.action.cmd) (busy `key.cmd))
      ~|('you are already in a debate' !!)
    ?:  =(host.key.cmd our.bowl)
      (host-act our.bowl action.cmd)
    ::  a guest: to the host, and follow the debate if we weren't
    =/  poke
      :*  %pass  /act/(scot %p host.key.cmd)/(scot %ud id.key.cmd)
          %agent  [host.key.cmd %debates]  %poke
          %noun  !>(`msg:sur`[%action action.cmd])
      ==
    ::  a hidden tally never tells us our own vote: keep it ourselves
    =?  joined  &(?=(%vote -.action.cmd) (~(has by joined) key.cmd))
      =/  [d=debate:sur t=@ud]  (~(got by joined) key.cmd)
      ?>  ?=(%vote -.action.cmd)
      (~(put by joined) key.cmd [d(votes (~(put by votes.d) our.bowl side.action.cmd)) t])
    :_  state
    ?:  (~(has by joined) key.cmd)  ~[poke]
    ~[(watch-card key.cmd) poke]
  ::
      %watch
    ?:  |(=(host.key.cmd our.bowl) (~(has by joined) key.cmd))  `state
    [~[(watch-card key.cmd)] state]
  ::
      %forget
    ?:  =(host.key.cmd our.bowl)  `state
    =/  before  current
    =.  joined  (~(del by joined) key.cmd)
    :_  state
    :*  :*  %pass  /act/(scot %p host.key.cmd)/(scot %ud id.key.cmd)
            %agent  [host.key.cmd %debates]  %poke
            %noun  !>(`msg:sur`[%action [%leave id.key.cmd]])
        ==
        :*  %pass  (debate-wire key.cmd)
            %agent  [host.key.cmd %debates]  %leave  ~
        ==
        (ui-card key.cmd [%gone ~])
        (presence-cards before)
    ==
  ::
      %track
    =/  who  (~(del in who.cmd) our.bowl)
    =/  new=(list ship)  ~(tap in (~(dif in who) tracked))
    =/  old=(list ship)  ~(tap in (~(dif in tracked) who))
    =/  watches=(list card)
      %+  turn  new
      |=  s=ship
      [%pass /presence/(scot %p s) %agent [s %debates] %watch /presence]
    =/  leaves=(list card)
      %+  turn  old
      |=  s=ship
      [%pass /presence/(scot %p s) %agent [s %debates] %leave ~]
    =.  tracked  who
    =.  presences
      %-  malt
      ^-  (list [ship presence:sur])
      %+  skim  ~(tap by presences)
      |=([s=ship *] (~(has in who) s))
    [(weld watches leaves) state]
  ::
      %dismiss
    =.  invites  (~(del by invites) key.cmd)
    [~[(ui-fact (frond:enjs:format %dismissed (key:en:dj key.cmd)))] state]
  ==
::  +current: the debate we're in, as others see it: the active one we
::  host, argue in or watch as an onlooker (one at a time)
::
++  current
  ^-  (unit presence:sur)
  =/  ds=(list debate:sur)
    (weld ~(val by hosting) (turn ~(val by joined) |=([d=debate:sur *] d)))
  |-
  ?~  ds  ~
  =/  p  (presence-of:lib i.ds our.bowl)
  ?^  p  p
  $(ds t.ds)
::  +busy: whether we're in some other active debate than k
::
++  busy
  |=  k=(unit key:sur)
  ^-  ?
  =/  c  current
  ?~  c  %.n
  !=(`key.u.c k)
::  +presence-cards: tell our /presence watchers and our UI, if what we're
::  in changed since before
::
++  presence-cards
  |=  before=(unit presence:sur)
  ^-  (list card)
  =/  now  current
  ?:  =(now before)  ~
  :~  [%give %fact ~[/presence] %noun !>(now)]
      (ui-fact (frond:enjs:format %current (presence:en:dj now)))
  ==
::  +host-act: an action on a debate we host, from src
::
++  host-act
  |=  [src=ship act=action:sur]
  ^-  (quip card _state)
  =/  id=@da  (action-id:lib act)
  =/  d  (~(get by hosting) id)
  ?~  d  ~|(%no-such-debate !!)
  =/  res  (apply:lib u.d src now.bowl act)
  ?:  ?=(%| -.res)  ~|(p.res !!)
  (hosted id u.d p.res act)
::  +hosted: store a changed debate and tell everyone what changed
::
++  hosted
  |=  [id=@da old=debate:sur new=debate:sur act=action:sur]
  ^-  (quip card _state)
  =/  before  current
  =.  hosting  (~(put by hosting) id new)
  =/  total  ~(wyt by votes.new)
  =/  meta=update:sur
    [%meta stage.new debaters.new onlookers.new invited.new muted.new ended.new]
  =/  tally=update:sur  [%tally (shown-votes:lib new) total]
  =/  updates=(list update:sur)
    ?-  -.act
      %say   =/  m  (ram:mon:sur messages.new)
             ?~(m ~ ~[[%said val.u.m]])
      %vote  ~[tally]
      %mute  ~[meta]
      %invite  ~[meta]
      ?(%join %leave %remove %start %end)  ~[meta tally]
    ==
  ::  each list typed on its own: welding the untyped ones fuse-loops
  =/  sends=(list card)
    (zing `(list (list card))`(turn updates |=(u=update:sur (send id u))))
  ::  a removed ship is kicked; its resubscription is refused
  =/  kicks=(list card)
    ?.  ?=(%remove -.act)  ~
    ~[[%give %kick ~[(debate-path id)] `who.act]]
  =/  invs=(list card)
    ?.  ?=(%invite -.act)  ~
    (invite-cards new (~(dif in invited.new) invited.old))
  [:(weld sends kicks invs (presence-cards before)) state]
::  +send: an update to the debate's subscribers and our UI
::
++  send
  |=  [id=@da u=update:sur]
  ^-  (list card)
  :~  [%give %fact ~[(debate-path id)] %noun !>(u)]
      (ui-card [our.bowl id] u)
  ==
::  +mirror: a host's update applied to our copy of the debate. a
::  hidden tally doesn't say how we voted, so our own vote is kept
::
++  mirror
  |=  [=key:sur u=update:sur]
  ^+  joined
  ?:  ?=(%init -.u)
    (~(put by joined) key [debate.u total.u])
  =/  cur  (~(get by joined) key)
  ?~  cur  joined
  =/  d  debate.u.cur
  ?-  -.u
      %gone  (~(del by joined) key)
      %said
    %+  ~(put by joined)  key
    [d(messages (put:mon:sur messages.d id.message.u message.u)) total.u.cur]
  ::
      %meta
    %+  ~(put by joined)  key
    :_  total.u.cur
    %=  d
      stage      stage.u
      debaters   debaters.u
      onlookers  onlookers.u
      invited    invited.u
      muted      muted.u
      ended      ended.u
    ==
  ::
      %tally
    =/  mine  (~(get by votes.d) our.bowl)
    =/  votes
      ?~  mine  votes.u
      ::  a live tally says it all; a hidden one says nothing
      ?.  =(~ votes.u)  votes.u
      (~(put by votes.u) our.bowl u.mine)
    (~(put by joined) key [d(votes votes) total.u])
  ==
::  +invited: a host inviting us
::
++  invited
  |=  i=invitation:sur
  ^-  (quip card _state)
  ?>  =(src.bowl host.key.i)
  =.  invites  (~(put by invites) key.i i)
  :_  state
  :~  (ui-fact (frond:enjs:format %invited (invitation:en:dj i)))
      (hark-card i)
  ==
::
++  invite-cards
  |=  [d=debate:sur who=(set ship)]
  ^-  (list card)
  =/  i=invitation:sur  [key.d topic.config.d sides.config.d now.bowl]
  %+  turn  ~(tap in (~(del in who) our.bowl))
  |=  s=ship
  :*  %pass  /invite/(scot %p s)/(scot %ud id.key.d)
      %agent  [s %debates]  %poke
      %noun  !>(`msg:sur`[%invited i])
  ==
::
++  timer-cards
  |=  [id=@da c=config:sur]
  ^-  (list card)
  %+  weld
    ?~  start.c  ~
    ?:  (lte u.start.c now.bowl)  ~
    ~[[%pass /timer/start/(scot %ud id) %arvo %b %wait u.start.c]]
  ?~  end.c  ~
  ~[[%pass /timer/end/(scot %ud id) %arvo %b %wait u.end.c]]
::
++  fresh-host-id
  |=  id=@da
  ^-  @da
  |-
  ?.  (~(has by hosting) id)  id
  $(id +(id))
::
++  debate-path  |=(id=@da `path`/debate/(scot %ud id))
++  debate-wire
  |=  =key:sur
  ^-  wire
  /debate/(scot %p host.key)/(scot %ud id.key)
::
++  watch-card
  |=  =key:sur
  ^-  card
  :*  %pass  (debate-wire key)
      %agent  [host.key %debates]
      %watch  (debate-path id.key)
  ==
::
++  ui-fact
  |=  j=json
  ^-  card
  [%give %fact ~[/ui] %json !>(j)]
::
++  ui-card
  |=  [=key:sur u=update:sur]
  ^-  card
  %-  ui-fact
  %+  frond:enjs:format  %update
  (pairs:enjs:format ~[key+(key:en:dj key) update+(update:en:dj u)])
::
++  ui-error
  |=  [=key:sur msg=@t]
  ^-  card
  %-  ui-fact
  %+  frond:enjs:format  %error
  (pairs:enjs:format ~[key+(key:en:dj key) msg+s+msg])
::  +all: what the UI starts from
::
++  all
  ^-  json
  =/  hosted=(list json)
    %+  turn  ~(val by hosting)
    |=(d=debate:sur (debate:en:dj (redact:lib d) ~(wyt by votes.d)))
  =/  followed=(list json)
    %+  turn  ~(val by joined)
    |=([d=debate:sur t=@ud] (debate:en:dj d t))
  =/  invs=(list json)  (turn ~(val by invites) invitation:en:dj)
  =/  others=(list [@t json])
    %+  turn  ~(tap by presences)
    |=([s=ship p=presence:sur] [(scot %p s) (presence:en:dj `p)])
  %-  pairs:enjs:format
  :~  debates+a+(weld hosted followed)
      invites+a+invs
      current+(presence:en:dj current)
      presences+(pairs:enjs:format others)
  ==
::  +hark-card: a notification for an invitation
::
++  hark-card
  |=  i=invitation:sur
  ^-  card
  =/  pat=path  /debates/invite/(scot %p host.key.i)/(scot %ud id.key.i)
  =/  =yarn:hark
    :*  (sham i)
        [~ ~ q.byk.bowl pat]
        now.bowl
        ~[[%ship host.key.i] ' invited you to a debate: ' [%emph topic.i]]
        pat
        ~
    ==
  [%pass /hark %agent [our.bowl %hark] %poke %hark-action !>(`action:hark`[%add-yarn & & yarn])]
::  +tang-text: a nack's trace as one line
::
++  tang-text
  |=  t=tang
  ^-  @t
  =/  lines=(list tape)
    (zing (turn t |=(k=tank (wash [0 80] k))))
  ?~  lines  'refused'
  ::  the reason from ~|(reason !!) comes first
  (crip i.lines)
--
