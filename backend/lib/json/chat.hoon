/-  sur=chat, tf=trill-feed, comms=nostrill-comms
/+  trill=json-trill, json-nostrill, sr=sortug,
    gwid, gwidj=json-gwid, common=json-common
|%
++  en
=,  enjs:format
|%
++  init
  |=  $:  dms=(map @p chat-fact:sur)
          requests=(map @p request:sur)
          =policy:sur
      ==
  ^-  json
  %:  pairs
    dms+(dm-map dms)
    requests+(request-map requests)
    jail+(jail policy)
  ~
  ==
++  jail
  |=  =policy:sur  ^-  json
  %:  pairs
    :-  %muted    (uid-set muted.policy)
    :-  %blocked  (uid-set blocked.policy)
  ~
  ==
++  uid-set  |=  s=(set @p)  ^-  json
  :-  %a  %+  turn  ~(tap in s)
    |=  p=@p
      =/  uid  (make-urbit-id p)
      (urbit-id:en:gwidj uid)
::
++  dm-map
  |=  m=(map @p chat-fact:sur)
  ^-  json
  %-  pairs
  %+  turn  ~(tap by m)
  |=  [peer=@p cf=chat-fact:sur]
  ^-  [@ta json]
  :-  (scot %p peer)
      (dm peer cf)
::
++  dm
  |=  [peer=@p =fc:tf last-read=(unit @da) unread=@ud muted=? blocked=? delivery=(map @da delivery:sur)]
  ^-  json
  =/  uid  (make-urbit-id peer)
  =/  last-id  (pry:orm:tf feed.fc)
  =/  last-idj  ?~  last-id  ~  (ud:en:common -.u.last-id)
  =/  last-ts   ?~  last-id  ~  (time:en:trill -.u.last-id)
  %:  pairs
    ['peer' (urbit-id:en:gwidj uid)]
    ['fc' (feed-with-cursor:en:trill fc)]
    ['lastId' last-idj]
    ['lastTs' last-ts]
    ['lastRead' (string-cursor:en:trill last-read)]
    ['unread' n+(scot:sr %ud unread)]
    muted+b+muted
    blocked+b+blocked
    delivery+(delivery-map delivery)
  ~
  ==
::
++  delivery-map
  |=  statuses=(map @da delivery:sur)
  ^-  json
  %-  pairs
  %+  turn  ~(tap by statuses)
  |=  [id=@da status=delivery:sur]
  ^-  [@ta json]
  :-  cord:(ud:en:common id)
      (delivery-status status)
::
++  delivery-status
  |=  status=delivery:sur
  ^-  json
  ?-  status
    %sending  s+'sending'
    %pending  s+'pending'
    %failed   s+'failed'
  ==
::
++  request-map
  |=  m=(map @p request:sur)
  ^-  json
  %-  pairs
  %+  turn  ~(tap by m)
  |=  [peer=@p req=request:sur]
  ^-  [@ta json]
  :-  (scot %p peer)
      (request peer req)
::
++  request
  |=  [peer=@p req=request:sur]
  ^-  json
  =/  uid  (make-urbit-id peer)
  %:  pairs
    ['peer' (urbit-id:en:gwidj uid)]
    post+(poast:en:trill req)
  ~
  ==
::
++  fact
|=  =fact:sur  ^-  json
  %+  frond  -.fact
  ?-  -.fact
    %init      (init [dms.fact requests.fact jail.fact])
    %peer      (dm +.fact)
    %requests  (request-map requests.fact)
    %err       s+msg.fact
  ==
--
::  helpers
::  TODO move this somewhere else
++  make-urbit-id  |=  =ship  ^-  urbit-id:comms
  =/  gwid  (make:b:gwid ship)
  [`@p`ship `@`ship gwid]
::
++  de
=,  dejs-soft:format
|%
++  ui
  %-  of  :~
    send+send
    read+read
    mute+patp
    unmute+patp
    block+patp
    unblock+patp
    gtfo+gtfo
    accept+patp
    reject+patp
  ==
++  send
  %-  ot
  :~  peer+patp
      content+so
  ==
++  read
  %-  ot
  :~  peer+patp
      id+maybe-id
  ==
++  gtfo
  %-  ot
  :~  peer+patp
      msg+so
  ==
++  patp  (se:de:common %p)
++  maybe-id
  |=  jon=json  ^-  (unit (unit @da))
  ?~  jon  ~
  =/  id  (string-ud:de:common jon)
  `id
--
--
