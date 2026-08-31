::  nostr: protocol types
::
::    https://github.com/nostr-protocol/nips
::
|%
+$  keys  [pub=@ priv=@]
+$  url  @t
::  +nostr-feeds: per-request-name, per-relay-url feeds
::
+$  nostr-feeds    (map @t sourced-feeds)
+$  sourced-feeds  (map url sourced-feed)
+$  sourced-feed   [feed=nostr-feed sub=req-state]
::  +wevent: an event annotated with the relays it was seen on
::
+$  wevent
  $:  relays=(list url)
      event
  ==
::
+$  event
  $:  id=@ux           ::  32 bytes
      pubkey=@ux       ::  32 bytes
      created-at=@ud   ::  unix seconds
      kind=@ud
      tags=(list tag)
      content=@t
      sig=@ux          ::  64 bytes
  ==
+$  raw-event
  $:  pubkey=@ux
      created-at=@ud
      kind=@ud
      tags=(list tag)
      content=@t
  ==
+$  tag  (list @t)
+$  wfeed       ((mop @ud wevent) gth)
++  worm        ((on @ud wevent) gth)
+$  nostr-feed  ((mop @ud event) gth)
++  norm        ((on @ud event) gth)
::  +user-meta: kind-0 profile metadata (NIP-01)
::
+$  user-meta
  $:  name=@t
      about=@t
      picture=@t
      other=(map @t json)
  ==
::  relay connection state
::
::    wid is the CURRENT socket id, ~ while disconnected or backing
::    off. status=~ means a deliberate close is in flight: on-leave
::    deletes the entry instead of starting the reconnect flow
::
+$  relay-stats
  $:  start=@da
      url=@t
      wid=(unit @ud)
      status=(unit relay-conn)
      reqs=relay-subs
  ==
::  +relay-conn: reconnect machinery for one relay
::
+$  relay-conn
  $:  stage=?(%idle %connecting %connected)
      tries=@ud               ::  consecutive failures this outage
      since=@da               ::  last accept time (flap guard)
      next=(unit @da)         ::  pending timer target; ~ = dormant/gave-up
      subs=(map name=@t relay-get)  ::  ongoing subs to replay
  ==
+$  relay-subs  (map sub-id req-state)
+$  req-state
  $:  sub-id=@t
      name=@t
      sent=@da
      eose=(unit eose)
      filters=(list filter)
      received=event-count
      ::  one-shot subs close at %eose; ongoing subs stay live
      ongoing=?
      ::  if chunked we trigger a new subscription on %eose
      chunked=(list filter)
  ==
+$  eose
  $:  ts=@da
      =event-count
  ==
+$  sub-id  @t
+$  event-count  @ud
::
+$  relay-req
  $:  sub-id=@t
      filters=(list filter)
  ==
+$  filter
  $:  ids=(unit (set @ux))
      authors=(unit (set @ux))
      kinds=(unit (set @ud))
      tags=(unit (map @t (list @t)))
      since=(unit @da)
      until=(unit @da)
      limit=(unit @ud)
  ==
::  messages from a relay
::
++  relay-msg
  $%  [%event sub-id=@t =event]
      [%ok id=@ux accepted=? msg=@t]
      [%eose sub-id=@t]
      [%closed sub-id=@t msg=@t]
      [%notice msg=@t]
      [%auth challenge=@t]
  ==
::  messages from a client
::
+$  client-msg
  $%  [%req relay-req]
      [%event =event]
      [%auth =event]
      [%close sub-id=@t]
  ==
::  +relay-get: a subscription request to a relay
::
::    canonical home; sur/nostrill/ui re-exposes it as relay-get:ui
::
+$  relay-get
  $%  [%sync ~]  ::  now does get-popular
      [%prof ~]
      [%user pubkey=@ux]
      [%thread id=@ux]
      [%custom name=@t filters=(list filter) ongoing=?]
  ==
--
