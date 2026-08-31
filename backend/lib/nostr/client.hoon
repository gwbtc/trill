::  nostr-client: build and send nostr protocol messages over websockets
::
/-  sur=nostrill, nsur=nostr
/+  js=json-nostr,
    sr=sortug,
    nostr-keys,
    constants,
    server,
    ws=websockets,
    nostr-req
|_  [=state:sur =bowl:gall]
+$  card  card:agent:gall
::  general utils
::
++  parse-body
  |=  jstring=@t
  ^-  (unit relay-msg:nsur)
  =/  ures  (de:json:html jstring)
  ?~  ures  ~
  =/  ur  (relay-msg:de:js u.ures)
  ?~  ur  ~&  >>>  relay-msg-parsing-failed=jstring  ~
  ur
::
++  close-sub-req
  |=  [sub-id=@t wid=@ud relay=relay-stats:nsur]
  ^-  [client-msg:nsur relay-stats:nsur]
  =.  reqs.relay  (~(del by reqs.relay) sub-id)
  =/  req=client-msg:nsur  [%close sub-id]
  [req relay]
::  request builders
::
++  build-req
  |=  fs=(list filter:nsur)
  ^-  [%req relay-req:nsur]
  =/  sub-id  (gen-sub-id:nostr-keys eny.bowl)
  [%req sub-id fs]
::
++  init-req
  |=  [sub-id=@t name=@t fs=(list filter:nsur) ongoing=? chunked=(list filter:nsur)]
  ^-  req-state:nsur
  [sub-id name now.bowl ~ fs 0 ongoing chunked]
::
++  req-to-msg
  |=  req=client-msg:nsur
  ^-  websocket-message:eyre
  =/  req-body=json  (req:en:js req)
  =/  octs  (json-to-octs:server req-body)
  [1 `octs]
::  +global: comms with the global relay (urbit-wide firehose)
::
++  global
  |%
  ++  get-wid
    ^-  (unit @)
    =/  usocket  (check-connected:ws global-relay:constants bowl)
    ?~  usocket  ~
    `wid.u.usocket
  ::  one-off thread: connect, send, disconnect
  ::
  ++  send-and-close
    |=  req=client-msg:nsur
    ^-  card
    =/  wmsg  (req-to-msg req)
    (one-off:ws global-relay:constants wmsg bowl)
  ::
  ++  send-card
    |=  req=client-msg:nsur
    ^-  card
    =/  wmsg  (req-to-msg req)
    =/  wid  get-wid
    ?~  wid
      ~&  >>>  "not connected to global relay, running thread"
      (send-and-close req)
    (give-ws-payload-client:ws u.wid wmsg)
  --
::  +relay: comms with one connected relay
::
++  relay
  |_  [wid=@ud relay=relay-stats:nsur]
  ::  +send-thread: fire a subscription for a frontend-driven thread
  ::
  ++  send-thread
    |=  [req-name=@t filters=(list filter:nsur) ongoing=? chunked=(list filter:nsur)]
    ^-  [sub-id=@t rs=req-state:nsur =card]
    =/  req  (build-req filters)
    =/  sub-id=@t  sub-id.req
    =/  card  (send-card req)
    =/  rs=req-state:nsur  (init-req sub-id req-name filters .n ~)
    [sub-id rs card]
  ::
  ++  send-sub
    |=  [req-name=@t fs=(list filter:nsur) ongoing=? chunked=(list filter:nsur)]
    ^-  [(list card) req-state:nsur]
    =/  sub-id  (gen-sub-id:nostr-keys eny.bowl)
    =/  msg  [%req sub-id fs]
    =/  req=req-state:nsur  [sub-id req-name now.bowl ~ fs 0 ongoing chunked]
    :_  req
    :~  (send-card msg)
    ==
  ::
  ++  send-card
    |=  req=client-msg:nsur
    ^-  card
    =/  wmsg  (req-to-msg req)
    (give-ws-payload-client:ws wid wmsg)
  ::  +get-popular: posts + profiles of the default follow list, last 30 days
  ::
  ++  get-popular
    =/  kinds  (silt ~[1])
    =/  since  (sub now.bowl ~d30)
    =/  authors  (silt default-follows:nostr-req)
    =/  posts-filter=filter:nsur  [~ `authors `kinds ~ `since ~ ~]
    =/  profiles-filter=filter:nsur  [~ `authors `(silt ~[0]) ~ ~ ~ ~]
    =/  filters  ~[posts-filter profiles-filter]
    =/  ongoing  .y
    [filters ongoing ~]
  --
--
