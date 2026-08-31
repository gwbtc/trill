/-  sur=chat, tp=trill-post
/+  dbug, chatlib=chat, postlib=trill-post
|%
+$  versioned-state  $%(state-0:sur)
::
+$  card  card:agent:gall
::
--
%-  agent:dbug
=|  versioned-state
=*  state  -
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    chat  ~(. +> bowl)
    lib   ~(. chatlib [state bowl])
::
++  on-init
  ^-  (quip card _this)
  `this
::
++  on-save
  ^-  vase
  !>(state)
::
++  on-load
|=  old=vase
^-  (quip card _this)
  =/  old-state  !<(versioned-state old)
  ?-  -.old-state
    %0  `this(state old-state)
  ==
::
++  on-peek
|=  =(pole knot)
^-  (unit (unit cage))
  ?+  pole  ~
    [%x %noun %dms ~]
      ``[%noun !>(dms)]
    [%x %noun %dm peer=@t ~]
      =/  who  (slaw %p peer.pole)
      ?~  who  ~
      =/  feed  (dm-feed:lib u.who)
      ``[%noun !>(feed)]
    [%x %j %dms ~]
      =/  jdms  scry-all:lib
      ``[%json !>(jdms)]
    [%x %j %dm peer=@t ~]
      =/  who  (slaw %p peer.pole)
      ?~  who  ~
      =/  jfeed  (scry-chat:lib u.who '' '')
      ``[%json !>(jfeed)]
    [%x %j %dm peer=@t start=@ end=@ ~]
      =/  who  (slaw %p peer.pole)
      ?~  who  ~
      =/  jfeed  (scry-chat:lib u.who start.pole end.pole)
      ``[%json !>(jfeed)]
  ==
::
++  on-poke
|=  [=mark =vase]
^-  (quip card _this)
|^
  ?+  mark  `this
    %noun
      =/  pok  %-  (soft poke:sur)  +.vase
      ?~  pok  `this
      =^  cards  state
        ?-  -.u.pok
          %recv     (recv:lib post.u.pok)
          %req      (req:lib accepted.u.pok)
          %block    (block-in:lib msg.u.pok)
          %dbug     (debug:chat +.u.pok)
          %send     (send:lib +.u.pok)
          %accept   (accept:lib +.u.pok)
        ==
      [cards this]
    %json  on-ui
  ==
++  on-ui
  =/  jon=json  !<(json vase)
  =^  cards  state  (handle-ui:lib jon)
  [cards this]
--
::
++  on-watch
|=  =(pole knot)
^-  (quip card _this)
  ::  UI only
  ?>  .=(src.bowl our.bowl)
  ?+  pole  `this
    [%ui ~]
      :_  this
      :~  init-fact-all:lib
      ==
    [%dm peer=@t ~]
      =/  who  (slaw %p peer.pole)
      ?~  who  `this
      :_  this
      :~  (peer-fact:lib u.who)
      ==
  ==
::
++  on-leave
|=  =(pole knot)
^-  (quip card _this)
  `this
::
++  on-agent
|=  [=(pole knot) =sign:agent:gall]
^-  (quip card _this)
  ?+  -.sign  `this
    %poke-ack
      =^  cards  state  (poke-ack:lib pole p.sign)
      ?~  p.sign
        [cards this]
      %-  (slog leaf+"chat peer poke failed on wire {<pole>}" u.p.sign)
      [cards this]
  ==
::
++  on-arvo
|=  [=(pole knot) =sign-arvo]
^-  (quip card _this)
  `this
::
++  on-fail
|=  [=term =tang]
^-  (quip card _this)
  %-  (slog leaf+"error in %chat" tang)
  `this
--
|_  =bowl:gall
::
++  debug
  |=  noun=*
  =/  lib  ~(. chatlib [state bowl])
  ^-  [(list card) _state]
  ?+  noun  [~ state]
    %seed
      =.  state  seed:lib
      [~ state]
    %seed-requests
      =.  state  seed-requests:lib
      [~ state]
    %chats
      =/  nothing  print-chats:lib
      [~ state]
    [%chat @]
      =/  nothing  (print-chat:lib +.noun)
      [~ state]
    [%nuke @]
      =.  dms  (~(del by dms) +.noun)
      =.  outbox  (~(del by outbox) +.noun)
      =.  requests  (~(del by requests) +.noun)
      [~ state]
    %outbox
      =/  nothing  print-outbox:lib
      [~ state]
    %reqs
      =/  nothing  print-reqs:lib
      [~ state]
  ==
--
