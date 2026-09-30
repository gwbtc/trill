/-  sur=nostrill, nsur=nostr, comms=nostrill-comms, ui=nostrill-ui
/+  lib=nostrill, sr=sortug, scri, nostr-keys,
    ws=websockets,
    nreq=nostr-req,
    nostr-client,
    dbug,
    relay-lib=nostrill-relay,
    posts-lib=nostrill-posts,
    lists-lib=nostrill-lists,
    reqs-lib=nostrill-reqs,
    profile-lib=nostrill-profile,
    jsonlib=json-nostrill,
    followlib=nostrill-follows,
    dbuglib=nostrill-dbug
|%
+$  versioned-state  $%(state-0:sur)
--
=|  state:sur
=*  state  -
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    cards  ~(. cards:lib bowl)
    relay  ~(. relay-lib [state bowl])
    posts  ~(. posts-lib [state bowl])
    lists  ~(. lists-lib [state bowl])
    reqs   ~(. reqs-lib [state bowl])
    prof   ~(. profile-lib [state bowl])
    scry   ~(. scri [state bowl])
    fols   ~(. followlib [state bowl])
    dbg    ~(. dbuglib [state bowl])
++  on-init
  ^-  (quip card:agent:gall agent:gall)
  =/  default  (default-state:lib bowl)
  :_  this(state default)
  init:cards
::
++  on-save
  ^-  vase
  !>(state)
::
++  on-load
  |~  old-state=vase
  ^-  (quip card:agent:gall agent:gall)
  ::  no soft-cast-or-bunt fallback: when the old state doesn't fit, that
  ::  silently replaced everything (feed, follows, profiles) with the bunt,
  ::  including a zero keypair that can't sign. crash instead, so gall keeps
  ::  the running agent and its state; add a migration when state changes
  =/  old-state  !<(versioned-state old-state)
  ?-  -.old-state
    %0
      =.  state  old-state
      ::  heal ships that went through that fallback: schnorr rejects a
      ::  zero secret key, so every signed (global/relay) post crashed
      =?  keys.state  =(0 priv.i.keys.state)
        [(gen-keys:nostr-keys eny.bowl) t.keys.state]
      ::  heal relays whose socket vanished while we were down
      =^  cs  state  reconcile:relay
      :_  this
      (weld init:cards cs)
  ==
::
++  on-poke
  |~  [=mark =vase]
  ^-  (quip card:agent:gall agent:gall)
  |^
  ?+  mark  `this
    %noun                        handle-comms
    %json                        on-ui
    %nostrill-ted                on-ted
    %websocket-client-message    handle-relay-ws
    %websocket-handshake         handle-ws-handshake
    %websocket-server-message    handle-ws-msg
  ==
  ::  +on-ted: thread-relayed relay requests from the frontend
  ::
  ++  on-ted
    =/  pok  !<(ted:ui vase)
    =^  cards  state  (handle-ted:relay pok)
    [cards this]
  ::
  +$  ws-msg  [@ud websocket-message:eyre]
  ::  +handle-relay-ws: message from a nostr relay we are connected to
  ::
  ++  handle-relay-ws
    ^-  (quip card:agent:gall agent:gall)
    =/  msg  !<(ws-msg vase)
    =/  wid  -.msg
    =/  stats  (relay-by-wid:relay wid)
    ?~  stats  ~&  >>>  "wid not found in relays state"  `this
    =/  m=websocket-message:eyre  +.msg
    ?~  message.m  `this
    =/  =octs  u.message.m
    =/  urelay-msg  (parse-body:nostr-client q.octs)
    ?~  urelay-msg  ~&  >>>  ws-msg-parse-error=q.octs  `this
    =^  cards  state  (handle-ws:relay wid u.stats u.urelay-msg)
    [cards this]
  ::  +handle-ws-handshake: incoming websocket connections to us
  ::
  ++  handle-ws-handshake
    ^-  (quip card:agent:gall agent:gall)
    =/  order  !<([@ inbound-request:eyre] vase)
    =/  url  url.request.order
    =/  pat=(unit path)  (rush url stap)
    ?~  pat  ~&  >>>  ws-handshake-bad-url=url  `this
    =/  ok=?  ?+  u.pat  .n
      [%nostrill-ui ~]  authenticated.order
      [%nostrill ~]     .y  ::  TODO which nostr clients do we filter
    ==
    :_  this
    ?:  ok  (accept-handshake:ws -.order)  (refuse-handshake:ws -.order)
  ::  +handle-ws-msg: we behave like a server here.
  ::    messages from clients, not relays
  ::
  ++  handle-ws-msg
    ^-  (quip card:agent:gall agent:gall)
    =/  order  !<([wid=@ =path msg=websocket-message:eyre] vase)
    =/  msg  message.msg.order
    ?~  msg  `this
    =/  wsdata=@t  q.data.u.msg
    |^
    ?+  path.order  `this
      [%nostrill-ui ~]  handle-ui-ws
      [%nostrill ~]     handle-nostr-client-ws
    ==
    ::  echo stub: the /nostrill-ui ws server path is experimental
    ::
    ++  handle-ui-ws
      ^-  (quip card:agent:gall agent:gall)
      =/  resmsg  (cat 3 wsdata (cat 3 '---' wsdata))
      =/  cs  (ui-ws-res:lib -.order resmsg)
      [cs this]
    ::
    ++  handle-nostr-client-ws
      ^-  (quip card:agent:gall agent:gall)
      =/  jsonm  (de:json:html wsdata)
      ?~  jsonm  `this
      =/  client-msg  (parse-client-msg:nreq u.jsonm)
      ?~  client-msg  ~&  >>>  bad-nostr-client-ws-msg=wsdata  `this
      =^  cs  state  ?-  -.u.client-msg
        %req    `state
        %event  (handle-client-event:relay -.order event.u.client-msg)
        %auth   `state
        %close  `state
      ==
      [cs this]
    --
  ::  +handle-comms: %noun pokes: peer engagement, ws proxy, debug
  ::
  ++  handle-comms
    =/  pok  %-  (soft poke:comms)  +.vase
    ?~  pok  ~&  >>>  bad-comms-poke=+.vase  `this
    =/  pok  u.pok
    ?:  ?=(%dbug -.pok)
      =^  cs  state  (handle:dbg +.pok)
      [cs this]
    ?:  ?=(%ted -.pok)  (ws-proxy +.pok)
    ?:  ?=(%sign -.pok)
      [(sign-drafts:relay +.pok) this]
    ?:  ?=(%watch -.pok)
      =^  cs  state  (watch:relay name.pok filters.pok &)
      [cs this]
    ?:  ?=(%fetch -.pok)
      =^  cs  state  (watch:relay name.pok filters.pok |)
      [cs this]
    =^  cs  state  (handle-eng:posts +.pok)
    [cs this]
  ::  +on-ui: JSON pokes from our own frontend
  ::
  ++  on-ui
    =/  jon=json  !<(json vase)
    =/  upoke=(unit poke:ui)  (ui:de:jsonlib jon)
    ?~  upoke  ~&  >>>  bad-ui-poke=jon  `this
    ::  %begs pokes arrive through ted/beg, not here
    ?+  -.u.upoke  ~&  >>>  unhandled-ui-poke=-.u.upoke  `this
      %keys  =^  cs  state  cycle-keys:prof
             [cs this]
      %fols  (handle-fols +.u.upoke)
      %prof  =^  cs  state  (handle-prof:prof +.u.upoke)
             [cs this]
      %rela  (handle-rela +.u.upoke)
      %lists  =^  cs  state  (handle:lists +.u.upoke)
              [cs this]
      %post  =^  cs  state  (handle-post:posts +.u.upoke)
             [cs this]
      ::  trending topics settings and spam marks: %topics keeps them
      %topics
        :_  this
        :~  :*  %pass  /topics/prefs  %agent  [our.bowl %topics]
                %poke  %noun  !>(act.u.upoke)
        ==  ==
    ==
  ::
  ++  handle-fols
    |=  poke=fols-poke:ui
    =^  cs  state
      ?-  -.poke
        %add  (handle-add:fols +.poke)
        %del  (handle-del:fols +.poke)
      ==
    [cs this]
  ::
  ++  handle-rela
    |=  poke=relay-poke:ui
    =^  cs  state
      ?-  -.poke
        %add      (want-relay:relay +.poke)
        %del      (unset-relay:relay +.poke)
        %del-url  (unset-relay-url:relay +.poke)
        %do       (handle-rela:relay +.poke)
      ==
    [cs this]
  ::  +ws-proxy: relay a ws message on behalf of a thread
  ::
  ++  ws-proxy
    |=  [wid=@ud w=ws-proxy:comms]
    ?-  -.w
      %msg
        :_  this
        :~  (give-ws-payload-client:ws wid +.w)
        ==
      %disconnect
        :_  this
        :~  (disconnect:ws wid)
        ==
    ==
  --
::
++  on-watch
  |~  =(pole knot)
  ?+  pole  !!
    [%http-response *]  `this
    [%websocket-client wids=@t ~]
      =^  cs  state  (set-relay:relay (slav %ud wids.pole))
      [cs this]
    [%websocket-server *]  `this
    [%ui ~]
      ?>  .=(our.bowl src.bowl)
      :_  this
      =/  jon  (state:en:jsonlib state)
      [%give %fact ~[/ui] [%json !>(jon)]]^~
    ::
    [%follow rest=*]
      =/  msg  ?~  rest.pole  ''  -.rest.pole
      =^  cs  state  (handle-req:reqs [msg %fols] pole)
      [cs this]
    [%profile ~]  [give-prof:prof this]
    [%beg %feed rest=*]
      =/  msg  ?~  rest.pole  ''  -.rest.pole
      =^  cs  state  (handle-req:reqs [msg %begs %feed] pole)
      [cs this]
    [%beg %thread ids=@t rest=*]
      =/  id  (slaw:sr %uw ids.pole)
      ?~  id  ~&  >>>  error-parsing-ted-id=pole  `this
      =/  msg  ?~  rest.pole  ''  -.rest.pole
      =^  cs  state  (handle-req:reqs [msg %begs %thread u.id] pole)
      [cs this]
  ==
::
++  on-leave
  |~  =(pole knot)
  ^-  (quip card:agent:gall agent:gall)
  ?+  pole  `this
    [%websocket-client wids=@ ~]
      ::  a deliberate close (status=~ on the entry) deletes the
      ::  relay; anything else is a drop and schedules a reconnect.
      ::  the global relay is not tracked in relays state, so its
      ::  drop needs no cleanup
      =/  uwid  (slaw %ud wids.pole)
      ?~  uwid  `this
      =^  cs  state  (handle-drop:relay u.uwid)
      [cs this]
  ==
::
++  on-peek
  |~  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  ~
    [%x %j %feed host=@ start=@ end=@ count=@ newest=@ replies=@ *]
      (sfeed:scry host.pole start.pole end.pole count.pole newest.pole replies.pole)
    [%x %j %thread host=@ id=@ *]  (thread:scry host.pole id.pole)
    ::
    [%x %j %profile ~]  own-profile:scry
    [%x %j %profile which=@ id=@ ~]  (profile:scry which.pole id.pole)
    [%x %j %relays ~]  relays:scry
    [%x %j %topics ~]  trending:scry
    [%x %j %topic-links source=@ id=@ ~]  (topic-links:scry source.pole id.pole)
    [%x %j %nostr ~]   nostr-feeds-scry:scry
    ::
    [%x %j %gwid patp=@ ~]  (sgwid:scry patp.pole)
    [%x %j %patp gwid=@ ~]  (patp:scry gwid.pole)
    ::  our nostr public key: public, it's on everything we publish
    [%x %pubkey ~]  ``noun+!>(`@ux`pub.i.keys.state)
  ==
::
++  on-agent
  |~  [wire=(pole knot) =sign:agent:gall]
  ^-  (quip card:agent:gall agent:gall)
  ?+  wire  `this
    [%follow rest=*]
      ?:  ?=(%watch-ack -.sign)
        ?~  p.sign  `this
        =^  cs  state  (handle-kick-nack:fols src.bowl)
        [cs this]
      ?:  ?=(%kick -.sign)
        =^  cs  state  (handle-refollow:fols src.bowl)
        [cs this]
      ?.  ?=(%fact -.sign)  `this
      =/  ufact  %-  (soft fact:comms)  q.q.cage.sign
      ?~  ufact  ~&  >>>  bad-follow-fact=[src.bowl p.cage.sign]  `this
      =/  =fact:comms  u.ufact
      =^  cs  state
        ?-  -.fact
          %feed  (handle-res:fols +.fact)
          %post  (handle-post-fact:posts +.fact)
          %prof  (handle-prof-fact:prof +.fact)
        ==
      [cs this]
    ::  one-shot profile fetch, see %fetch in +handle-prof
    [%profile ship=@ ~]
      ?.  ?=(%fact -.sign)  `this
      =/  ufact  %-  (soft fact:comms)  q.q.cage.sign
      ?.  ?=([~ %prof *] ufact)  `this
      =^  cs  state  (handle-prof-fact:prof +.u.ufact)
      [cs this]
  ==
::
++  on-arvo
  |~  [wire=(pole knot) =sign-arvo]
  ^-  (quip card:agent:gall agent:gall)
  ?+  wire  `this
    [%ws-connect ~]  `this  ::  legacy pre-upgrade connects
    [%ws-connect url=@ ~]
      ?.  ?=([%iris %websocket-response *] sign-arvo)  `this
      =/  gift  +.sign-arvo
      =/  ev    +>.gift
      ::  %reject: failed handshake (no on-leave will ever fire);
      ::  %disconnect: the socket's gone. %accept/%message are handled
      ::  elsewhere
      ?.  ?=(?(%reject %disconnect) -.ev)  `this
      =^  cs  state  (handle-ws-sign:relay (slav %t url.wire) +<.gift -.ev)
      [cs this]
    [%ws-ping url=@ wid=@ what=@ ~]
      ?.  ?=([%behn %wake *] sign-arvo)  `this
      =^  cs  state
        %^  handle-ping:relay  (slav %t url.wire)  (slav %ud wid.wire)
        =(%check what.wire)
      [cs this]
    [%ws-retry url=@ at=@ ~]
      ?.  ?=([%behn %wake *] sign-arvo)  `this
      ~?  ?=(^ error.sign-arvo)  ws-retry-timer-error=url.wire
      =^  cs  state
        (handle-wake:relay (slav %t url.wire) (slav %da at.wire))
      [cs this]
    [%ws-oneoff *]
      ?>  ?=([%khan %arow *] sign-arvo)
      ?:  ?=(%| -.p.sign-arvo)
        %-  (slog leaf+"one-off ws thread failed" ~)
        `this
      `this
  ==
::
++  on-fail
  |~  [term tang]
  ^-  (quip card:agent:gall agent:gall)
  `this
--
