/-  wrap, sur=nostrill, nsur=nostr, comms=nostrill-comms, ui=nostrill-ui, noti=nostrill-notif,
    tf=trill-feed, tp=trill-post,
    wrap
/+  sr=sortug, common=json-common, trill=json-trill, nostr=json-nostr,
    gwid, gwidj=json-gwid
|%
++  en
=,  enjs:format
|%
  ::  UI comms
  ++  state  |=  state:sur  ^-  json
  %+  frond  %state
  %:  pairs
    relays+(en-relays relays)
    key+(hex:en:common pub.i.keys)
    profiles+(en-profiles profiles)
    :: TODO proper cursors
    feed+(feed-with-cursor:en:trill feed ~ ~)
    nostr+(en-nostr-feeds nostr-feeds)
    following+(enfollowing following)
    timeline+(global-with-cursor timeline ~ ~)
    ['followGraph' (engraph follow-graph)]
    lists+(en-lists bookmarks muted reported)
  ~
  ==

  ++  en-global  |=  gf=global-feed:sur  ^-  json
    %-  pairs
    %+  turn  (tap:uorm:sur gf)
    |=  [=upid:sur p=post:tp]
      ^-  [@ta json]
    :-  (crip (scow:sr %ud `@ud`id.upid))
        (poast:en:trill p)

  ++  global-with-cursor
    |=  [gf=global-feed:sur start=(unit @da) end=(unit @da)]  ^-  json
    %:  pairs
      global+(en-global gf)
      start+(cursor:en:trill start)
      end+(cursor:en:trill end)
    ~
    ==

  ++  en-nostr-feeds
  |=  feeds=nostr-feeds:nsur  ^-  json
    %-  pairs  %+  turn  ~(tap by feeds)
    |=  [name=@t sf=sourced-feeds:nsur]
      :-  name  (sourced-feeds sf)
  
  
  ++  sourced-feeds
  |=  sfs=sourced-feeds:nsur  ^-  json
    %-  pairs  %+  turn  ~(tap by sfs)
    |=  [url=@t sf=sourced-feed:nsur]
      :-  url  (sourced-feed sf)

  ++  sourced-feed
  |=  sf=sourced-feed:nsur  ^-  json
    %-  pairs
    :~  feed+(en-nostr-feed feed.sf)
        sub+(req-state sub.sf)
    ==

  ++  en-nostr-feed
  |=  feed=nostr-feed:nsur  ^-  json
    :-  %a  %+  turn  (tap:norm:nsur feed)  |=  [id=@ud ev=event:nsur]
      (event:en:nostr ev)

  ++  named-wfeed
  |=  [s=@t feed=wfeed:nsur]  ^-  json
    %-  pairs
    :~  name+s+s
        feed+(en-wfeed feed)
    ==

  ++  en-wfeed
  |=  feed=wfeed:nsur  ^-  json
    :-  %a  %+  turn  (tap:worm:nsur feed)  |=  [id=@ud ev=wevent:nsur]
      (wevent:en:nostr ev)

  +$  socket  [wid=@ud url=@t status=$?(%accepted %pending)]
  ++  all-relays
  |=  [ls=(list socket) rm=(map @t relay-stats:nsur)]
  ^-  json
    %-  pairs  :~
      relays+(en-relays rm)
      sockets+(en-sockets ls)
    ==
  ++  en-sockets
  |=  ls=(list socket)  ^-  json
    :-  %a  %+  turn  ls
      |=  s=socket
        %-  pairs  :~
          wid+(numb wid.s)
          url+s+url.s
          status+s+status.s
        ==
  ++  en-relays
  |=  r=(map @t relay-stats:nsur)  ^-  json
    %-  pairs  %+  turn  ~(tap by r)
    |=  [url=@t rs=relay-stats:nsur]
      :-  url
            %-  pairs
              :~  :-  %start   (time start.rs)
                  ::  null while disconnected/backing off
                  :-  %wid     ?~(wid.rs ~ (numb u.wid.rs))
                  :-  %reqs    (relay-reqs reqs.rs)
                  ::  null while a deliberate close is in flight
                  :-  %status  (en-conn status.rs)
              ==
  ++  en-conn
  |=  uc=(unit relay-conn:nsur)  ^-  json
    ?~  uc  ~
    %-  pairs  :~
      stage+s+stage.u.uc
      tries+(numb tries.u.uc)
      since+(time since.u.uc)
      next+?~(next.u.uc ~ (time u.next.u.uc))
      subs+a+(turn ~(tap by subs.u.uc) |=([name=@t *] s+name))
    ==

  ++  relay-reqs  |=  rm=(map @t req-state:nsur)
    %-  pairs  %+  turn  ~(tap by rm)  |=  [sub-id=@t rs=req-state:nsur]
      :-  sub-id  (req-state rs)

  ++  req-state  |=  rs=req-state:nsur
    %-  pairs
    :~  :+  'name'     %s  name.rs
        :+  'subId'    %s  sub-id.rs

        :-   'sent'    (time sent.rs)
        :-   'eose'  ?~  eose.rs  ~  (eose u.eose.rs)
        :+  'filters'  %a  (turn filters.rs filter:en:nostr)
        :: ::  TODO  chunks...
        :-  'eventsReceived'  (numb received.rs)
        :-  'ongoing'   [%b ongoing.rs]
    ==

  ++  eose  |=  e=eose:nsur  ^-  json
    %-  pairs
    :~  ts+(time ts.e)
        count+(numb event-count.e)
    ==
  ++  en-profiles  |=  m=(map user:sur user-profile:comms)
    %-  pairs
      %+  turn  ~(tap by m)  |=  [key=user:sur p=user-profile:comms]
        =/  jkey  (user-string key)
      ?>  ?=(%s -.jkey)
        :-  +.jkey  (en-profile p)

  ++  en-profile  |=  prof=user-profile:comms
    %-  pairs  %+  weld
    :~
      :-  'pubkey'  (hex:en:common pubkey.prof)
      :+  'following'  %a  %+  turn  ~(tap in following.prof)  user
      :-  'followingCount'  (numb following-count.prof)
      :+  'followers'  %a  %+  turn  ~(tap in followers.prof)  user
      :-  'followerCount'  (numb follower-count.prof)      
      :-  'urbitID'  (uurbit-id:en:gwidj urbit-id.prof)
      :-  'gwid'  (gwid:en:gwidj gwid.prof)
    ==
  (user-meta-pairs:en:nostr +>+>+<:prof)

  ++  enfollowing
  |=  m=(map user:sur feed:tf)
  ^-  json
    %-  pairs  %+  turn  ~(tap by m)  |=  [key=user:sur f=feed:tf]
      =/  jkey  (user-string key)
      ?>  ?=(%s -.jkey)
      :: TODO proper cursor stuff
      :-  +.jkey  (feed-with-cursor:en:trill f ~ ~)

  ++  engraph
  |=  m=(map user:sur (set user:sur))
    ^-  json
    %-  pairs  %+  turn  ~(tap by m)  |=  [key=user:sur s=(set user:sur)]
      =/  jkey  (user-string key)
      ?>  ?=(%s -.jkey)
      :-  +.jkey
      :-  %a   %+  turn  ~(tap in s)  user

  ++  user         user-tagged:en:common
  ++  user-string  user:en:common
  ::  ui facts
  ++  fact  |=  f=fact:ui  ^-  json
    %+  frond  %fact
    %+  frond  -.f
    ?-  -.f
      %nostr   (en-nostr +.f)
      %post    (postfact +.f)
      %prof    (en-profiles +.f)
      %fols    (folsfact +.f)
      %keys    (hex:en:common +.f)
      %lists   (en-lists +.f)
    ==
  ++  en-post-ref  |=  r=post-ref:sur  ^-  json
    ?-  -.r
      %urbit  %+  frond  %urbit
              (pairs ~[host+(patp:en:common host.r) id+(ud:en:common id.r)])
      %nostr  (frond %nostr (hex:en:common id.r))
    ==
  ++  en-lists
    |=  [b=(map post-ref:sur @da) m=(set user:sur) r=(set post-ref:sur)]
    ^-  json
    %:  pairs
      :-  %bookmarks
      :-  %a
      %+  turn  ~(tap by b)
      |=  [ref=post-ref:sur at=@da]
      (pairs ~[ref+(en-post-ref ref) at+(time at)])
      muted+a+(turn ~(tap in m) user)
      reported+a+(turn ~(tap in r) en-post-ref)
    ~
    ==
  ++  folsfact  |=  f=fols-fact:ui  ^-  json
    %+  frond  -.f
    ?-  -.f
      %new-urbit  (fols +.f)
      %new-nostr  (en-followed +.f)
      %quit  (user-string +.f)
    ==
  ++  en-nostr  |=  nf=nostr-fact:ui  ^-  json
    %+  frond  -.nf
    ?-  -.nf
      %feed    (named-wfeed +.nf)
      %user    (named-wfeed +.nf)
      %thread  (en-nostr-feed +.nf)
      %event   (event:en:nostr +.nf)
      %eose    (cord:en:common +.nf)
      %drop    (cord:en:common +.nf)
      %relays  (en-relays +.nf)
      ::
      %sent-post  (en-nostr-sent-post +.nf)
      %sent-prof  [%a (turn relays.nf cord:en:common)]
    ==
  ++  en-followed  |=  [pubkey=@ux profile=(unit user-profile:comms) relays=(list @t)]
    %-  pairs  :~
      pubkey+(hex:en:common pubkey)
      :-  %profile  ?~  profile  ~  (en-profile u.profile)
      relays+a+(turn relays cord:en:common)
    ==
  ++  en-nostr-sent-post  |=  [host=@p id=@ urls=(list @t) ev=event:nsur]  ^-  json
    %-  pairs  :~
      host+s+(scot %p host)
      id+(ud:en:common id)
      relays+a+(turn urls cord:en:common)
      event+(event:en:nostr ev)
    ==
  ++  user-data
    |=  ud=[=fc:tf profile=(unit user-meta:nsur)]
    %:  pairs
      feed+(feed-with-cursor:en:trill fc.ud)
      :-  %profile  ?~  profile.ud  ~  (user-meta:en:nostr u.profile.ud)
      ~
    ==
::  en-CMMS
  ++  deferred  |*  [p=(deferred:wrap) fn=$-(* json)]
    ^-  json
    %-  pairs  :~  msg+s+msg.p
      :-  'data'  ?@  p.p  [%s 'maybe']
                           (approval +.p.p fn)
    ==
  ++  approval  |*  [p=(approval:wrap) fn=$-(* json)]
    ^-  json
    ?@  p  ~  (fn data.p)

  ++  enbowl  |*  [p=(enbowl:wrap) fn=$-(* json)]
    ^-  json
    %-  pairs
    :~  user+(user user.p)
        ts+(time ts.p)
        data+(fn p.p)
    ==

  ++  res  |=  =res:comms  ^-  json
    %+  frond  -.res
    ?-  -.res
      %feed  (deferred +.res feed-data)
      %thread  %-  pairs
        :~  id+(ud:en:common id.res)
            data+(deferred +>.res thread:en:trill)
        ==
    ==
  ++  en-fols  |=  p=fols-res:comms  ^-  json
    (deferred p feed-data)

  ++  fols  |=  a=(enbowl:wrap fols-res:comms)  ^-  json
    (enbowl a en-fols)

  ++  postfact  |=  pf=post-fact:comms  ^-  json
    %+  frond  -.pf
    (post-wrapper +.pf)

  ++  feed-data
    |=  fd=feed-data:comms
    %:  pairs
      feed+(feed-with-cursor:en:trill fc.fd)
      profile+(en-profile profile.fd)
      ~
    ==

  ++  post-wrapper  |=  p=post-wrapper:comms
    %-  pairs
    :~  post+(poast:en:trill post.p)
        ['nostrMeta' (nostr-meta nostr-meta.p)]
    ==
  ++  nostr-meta  |=  p=nostr-meta:comms  ^-  json
    %-  pairs
    :~  ['pubkey' (hex:en:common pub.p)]
        :-  'profile'  ?~  prof.p  ~  (en-profile u.prof.p)
        :-  'eventId'  ?~  ev-id.p  ~  (hex:en:common u.ev-id.p)
        :+  'relay'  %a  %+  turn  relays.p  cord:en:common
    ==
    
::  /en-COMMS
  --
++  de
=,  dejs-soft:format
|%
++  user  user:de:common
  :: ui
++  ui
  %-  of  :~
    keys+ul
    fols+ui-fols
    begs+ui-begs
    prof+ui-prof
    post+ui-post
    rela+ui-relay
    lists+ui-lists
  ==
++  ui-lists
  %-  of  :~
    bookmark+(ot ~[add+bo ref+post-ref])
    mute+(ot ~[add+bo user+user])
    report+(ot ~[ref+post-ref reason+so])
  ==
++  post-ref
  %-  of  :~
    urbit+(ot ~[host+(se:de:common %p) id+de-post-id])
    nostr+hex:de:common
  ==
++  ui-fols
  %-  of  :~
    add+user
    del+user
  ==
++  ui-begs
  %-  of  :~
    feed+(se:de:common %p)
    thread+pid:de:trill
  ==
++  ui-prof
  %-  of  :~
    add+ui-meta
    del+ul
    fetch+(ar user)
  ==
++  ui-meta
  %-  ot  :~
    name+so
    about+so
    picture+so
    other+other-meta
  ==
:: ++  urbit-id  |=  jon=json  ^-  (unit urbit-id:comms)
::   ?.  ?=(%o -.jon)  ~
::   %.  jon
::   %-  ot  :~
::     patp+(se:de:common %p)
::     point+ni
::     gwid+degwid
::   ==
:: ++  de-unit-patp  |=  jon=json  ^-  (unit (unit @p))
::   ?.  ?=(%s -.jon)  ~
::   %-  some  ((se:de:common %p) jon)
::   ::  we have this for type economy but a user does not get to change their profile's @p in the UI

:: ++  de-unit-urbit-id  |=  jon=json  ^-  (unit (unit urbit-id:comms))
::   ?.  ?=(%o -.jon)  ~
::   %-  some  (urbit-id:de:nostr jon)

++  other-meta  |=  jon=json
  ?.  ?=(%o -.jon)  ~  (some p.jon)
++  ui-post
  %-  of  :~
    add+postadd
    reply+reply
    quote+quote
    card+(ot ~[content+so card+so])
    rp+upid
    :: rt+de-rt
    reaction+reaction
    del-reaction+upid
    del+upid
  ==
++  postadd
  %-  ot  :~
    content+so
    global+bo
    anon+bo
    reply+(su (perk %everyone %following %mentioned ~))
  ==
++  reply
  %-  ot  :~
    content+so
    host+user
    id+de-post-id
    thread+de-post-id
  ==
++  quote
  %-  ot  :~
    content+so
    host+user
    id+de-post-id
  ==
++  upid
  %-  ot  :~
    host+user
    id+string-ud:de:common
  ==
++  reaction
  %-  ot  :~
    host+user
    id+de-post-id
    reaction+so
  ==
++  rt
  %-  ot  :~
    id+hex:de:common
    pubkey+hex:de:common
    relay+so
  ==
++  ui-relay
  %-  of  :~
    add+so
    del+ni
    del-url+so
    do+de-relay-do
  ==
++  de-relay-do
  %-  ot
  :~  relays+(ar ni)
      action+de-relay-action
  ==

  ++  de-relay-action
    %-  of  :~
      get+de-relay-get
      send-post+pid:de:trill
      send-prof+ul
      ==
  ++  de-relay-get
    %-  ot
    :~  name+so
    :-  %p
      %-  of  :~
        sync+ul
        prof+ul
        user+hex:de:common
        thread+hex:de:common
        custom+custom-rg
      ==
    ==
++  custom-rg
  %-  ot  :~
    name+so
    filters+(ar filter:de:nostr)
    ongoing+bo
  ==
++  de-post-id
  |=  jon=json  ^-  (unit @)
  ?.  ?=([%s @t] jon)  ~
  =/  tryatom  (rush p.jon dem)
  ?^  tryatom  tryatom
  ^-  (unit @)  (hex:de:common jon)

  --
      
--

