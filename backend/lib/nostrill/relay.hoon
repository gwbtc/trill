::  nostrill-relay: relay/websocket event engine for %nostrill
::
/-  sur=nostrill, nsur=nostr, comms=nostrill-comms, ui=nostrill-ui,
    post=trill-post, gate=trill-gate, feed=trill-feed
/+  lib=nostrill,
    nreq=nostr-req,
    evlib=nostr-events,
    nostr-client,
    njs=json-nostr,
    scri,
    constants,
    harklib=hark,
    ws=websockets
|_  [=state:sur =bowl:gall]
+*  cardslib  ~(. cards:lib bowl)
+$  card  card:agent:gall
::  relay connection management. relays.state is keyed by url: one
::  connection per server, and the entry (with its recorded subs
::  and backoff state) survives socket churn. the CURRENT socket
::  id lives at wid (~ while disconnected); status=~ marks a
::  deliberate close in flight, so on-leave deletes the entry
::  instead of reconnecting. timers are never cancelled: every
::  wake self-validates against next.status (gall/behn %rest is
::  unreliable; see n-contacts)
::
::  +get-relay: any currently-live relay (used for nostr replies)
::
++  get-relay
  ^-  (unit [wid=@ud relay=relay-stats:nsur])
  =/  entries  ~(tap by relays.state)
  |-  ?~  entries  ~
  =/  rs=relay-stats:nsur  +.i.entries
  ?^  wid.rs  `[u.wid.rs rs]
  $(entries t.entries)
::  +relay-by-wid: find the relay whose CURRENT socket is wid
::
++  relay-by-wid
  |=  wid=@ud
  ^-  (unit relay-stats:nsur)
  =/  entries  ~(tap by relays.state)
  |-  ?~  entries  ~
  =/  rs=relay-stats:nsur  +.i.entries
  ?:  =(`wid wid.rs)  `rs
  $(entries t.entries)
::
++  set-relay
  |=  wid=@ud
  ^-  (quip card _state)
  =/  socket  (get-url:ws wid bowl)
  ?~  socket  ~&  "socket wid not in iris"  !!
  ?.  ?=(%accepted status.u.socket)  ~&  "socket status in iris unsync"  !!
  =/  url  url.u.socket
  ::  the global-feed relay is not tracked in relays state
  ?:  .=(url global-relay:constants)  `state
  =/  old  (~(get by relays.state) url)
  ::  one connection per server: refuse a second socket for a url
  ::  that already has a live one. the refused wid never enters
  ::  state, so its eventual on-leave is naturally inert
  ?:  ?&  ?=(^ old)
          ?=(^ wid.u.old)
          !=(u.wid.u.old wid)
      ==
    ~&  >>  duplicate-socket-refused=[wid url]
    :_  state
    :~  (disconnect:ws wid)
    ==
  ::  tries are NOT reset on accept: only surviving ws-flap-window
  ::  resets them (judged at drop time), so accept-drop loops
  ::  still walk up the backoff ladder
  =/  conn=relay-conn:nsur
    ?:  ?&(?=(^ old) ?=(^ status.u.old))
      u.status.u.old(stage %connected, since now.bowl, next ~)
    [%connected 0 now.bowl ~ ~]
  ::  reqs start empty: the previous socket's sub-ids are dead
  =/  rs=relay-stats:nsur
    [?~(old now.bowl start.u.old) url `wid `conn ~]
  =.  relays.state  (~(put by relays.state) url rs)
  ::  replay recorded ongoing subs on the fresh socket
  =^  replay-cards  state
    =/  subs  ~(tap by subs.conn)
    =|  css=(list card)
    |-  ?~  subs  [css state]
    =^  cs  state  (do-get ~[wid] -.i.subs +.i.subs)
    $(subs t.subs, css (weld css cs))
  :_  state
  [(update-ui:cardslib [%nostr %relays relays.state]) replay-cards]
::  +unset-relay: deliberate close by wid. status=~ tells the
::    eventual on-leave to delete the entry instead of reconnecting
::
++  unset-relay
  |=  wid=@ud
  ^-  (quip card _state)
  =/  urs  (relay-by-wid wid)
  ?~  urs  `state
  =.  relays.state
    (~(put by relays.state) url.u.urs u.urs(status ~))
  ::  the state fact must precede the disconnect: moves process
  ::  depth-first, so the disconnect's whole consequence chain
  ::  (iris -> leave -> handle-drop -> the authoritative %relays
  ::  fact with the entry deleted) runs before our next card --
  ::  emitting the transient snapshot after it would clobber the
  ::  final state in the frontend
  ::
  :_  state
  :~  (update-ui:cardslib [%nostr %relays relays.state])
      (disconnect:ws wid)
  ==
::  +unset-relay-url: deliberate close by url; reaches relays that
::    are mid-backoff or dormant (no live wid)
::
++  unset-relay-url
  |=  url=@t
  ^-  (quip card _state)
  =/  old  (~(get by relays.state) url)
  ?~  old  `state
  ?^  wid.u.old  (unset-relay u.wid.u.old)
  ::  no live socket: deleting the entry inertizes any pending wake
  =.  relays.state  (~(del by relays.state) url)
  :_  state
  :~  (update-ui:cardslib [%nostr %relays relays.state])
  ==
::
++  wait-card
  |=  [url=@t at=@da]
  ^-  card
  [%pass /ws-retry/(scot %t url)/(scot %da at) %arvo %b %wait at]
::
++  start-connect
  |=  [url=@t tries=@ud subs=(map @t relay-get:nsur)]
  ^-  (quip card _state)
  =/  at  (add now.bowl ws-connect-timeout:constants)
  =/  old  (~(get by relays.state) url)
  =/  rs=relay-stats:nsur
    :*  ?~(old now.bowl start.u.old)
        url
        ~
        `[%connecting tries now.bowl `at subs]
        ~
    ==
  =.  relays.state  (~(put by relays.state) url rs)
  :_  state
  :~  (connect:ws url bowl)
      (wait-card url at)
  ==
::
++  want-relay
  |=  url=@t
  ^-  (quip card _state)
  ?:  =(url global-relay:constants)  `state
  =/  old  (~(get by relays.state) url)
  ::  busy: connected, connecting, or a deliberate close in flight
  ?:  ?&  ?=(^ old)
          ?|  ?=(~ status.u.old)
              !?=(%idle stage.u.status.u.old)
          ==
      ==
    `state
  ?^  (check-connected:ws url bowl)
    ~&  >>  already-connected-to=url
    `state
  ::  a re-added dormant entry starts fresh but keeps its subs
  %^  start-connect  url  0
  ?:  ?&(?=(^ old) ?=(^ status.u.old))
    subs.u.status.u.old
  ~
::
++  fail-relay
  |=  url=@t
  ^-  (quip card _state)
  =/  old  (~(get by relays.state) url)
  ?~  old  `state
  ?~  status.u.old  `state
  =/  conn  u.status.u.old
  =.  tries.conn  +(tries.conn)
  ?:  (gth tries.conn ws-max-tries:constants)
    ::  give up. the dormant entry keeps its subs so a manual
    ::  re-add replays them
    =.  relays.state
      %+  ~(put by relays.state)  url
      u.old(wid ~, status `conn(stage %idle, next ~))
    :_  state
    :~  (update-ui:cardslib [%nostr %drop url])
        (send-hark:harklib [%nostr %relay-down url] bowl)
    ==
  =/  at  (add now.bowl (snag (dec tries.conn) ws-backoff:constants))
  =.  relays.state
    %+  ~(put by relays.state)  url
    u.old(wid ~, status `conn(stage %idle, next `at))
  :_  state
  :~  (wait-card url at)
  ==
::  +handle-drop: iris dropped its subscription on a client path.
::    only entries whose CURRENT wid matches are considered, so
::    stale leaves (refused dupes, already-replaced sockets, the
::    global relay) are naturally inert
::
++  handle-drop
  |=  wid=@ud
  ^-  (quip card _state)
  =/  urs  (relay-by-wid wid)
  ?~  urs  `state
  =/  rs  u.urs
  ?~  status.rs
    ::  deliberate close confirmed: forget the relay
    =.  relays.state  (~(del by relays.state) url.rs)
    :_  state
    :~  (update-ui:cardslib [%nostr %relays relays.state])
    ==
  ::  server drop: clear the socket and walk the backoff ladder.
  ::  flap guard: only a connection that survived resets tries
  =/  conn  u.status.rs
  =?  tries.conn
      (gte (sub now.bowl since.conn) ws-flap-window:constants)
    0
  =.  relays.state
    (~(put by relays.state) url.rs rs(wid ~, status `conn, reqs ~))
  =^  cards  state  (fail-relay url.rs)
  :_  state
  [(update-ui:cardslib [%nostr %relays relays.state]) cards]
::
++  handle-wake
  |=  [url=@t at=@da]
  ^-  (quip card _state)
  =/  old  (~(get by relays.state) url)
  ?~  old  `state
  ?~  status.u.old  `state  ::  deliberate close in flight
  =/  conn  u.status.u.old
  ?.  =(`at next.conn)  `state  ::  stale timer
  ?-  stage.conn
    %connected   `state
    %connecting  (fail-relay url)  ::  connect attempt timed out
    %idle
      ?^  (check-connected:ws url bowl)  `state
      (start-connect url tries.conn subs.conn)
  ==
::  +reconcile: heal entries whose socket silently vanished (run
::    from on-load; a %connected entry with no iris socket can
::    never receive a leave, so treat it as a drop)
::
++  reconcile
  ^-  (quip card _state)
  =/  entries  ~(tap by relays.state)
  =|  cards=(list card)
  |-  ?~  entries
    ?~  cards  [~ state]
    [[(update-ui:cardslib [%nostr %relays relays.state]) cards] state]
  =/  rs=relay-stats:nsur  +.i.entries
  ?:  ?|  ?=(~ status.rs)
          !?=(%connected stage.u.status.rs)
      ==
    $(entries t.entries)
  ?^  (check-connected:ws url.rs bowl)  $(entries t.entries)
  ~&  >>  reconcile-lost-socket=url.rs
  =.  relays.state
    (~(put by relays.state) url.rs rs(wid ~, reqs ~))
  =^  cs  state  (fail-relay url.rs)
  $(entries t.entries, cards (weld cards cs))
::  +handle-ws-sign: %reject or %disconnect arvo signs from iris.
::    only meaningful while %connecting: %reject is the sole signal
::    for a failed handshake (no on-leave ever fires), and a
::    %disconnect sign always precedes any on-leave, which drives
::    the connected case
::
++  handle-ws-sign
  |=  url=@t
  ^-  (quip card _state)
  =/  old  (~(get by relays.state) url)
  ?:  ?&  ?=(^ old)
          ?=(^ status.u.old)
          ?=(%connecting stage.u.status.u.old)
      ==
    (fail-relay url)
  `state
::  +handle-client-event: a nostr client published an event to us.
::    we are not accepting submissions (yet)
::
++  handle-client-event
  |=  [wid=@ =event:nsur]
  ^-  (quip card _state)
  =/  response  (ok-client-event:nreq event .n 'we\'re full')
  =/  cs  (ws-response:nreq wid response)
  [cs state]
::  +handle-ws: dispatch an incoming relay message
::
++  handle-ws
  |=  [wid=@ud relay=relay-stats:nsur msg=relay-msg:nsur]
  =/  nclient  ~(. nostr-client [state bowl])
  =/  rclient  ~(. relay.nclient [wid relay])
  |^
  =^  cards  state
    ?-  -.msg
      ::  returned when we post a message to a relay
      %ok      (handle-ok url.relay +.msg)
      %event   (handle-event sub-id.msg event.msg)
      %eose    (handle-eose +.msg)
      %closed  =.  reqs.relay  (~(del by reqs.relay) sub-id.msg)
               =.  relays.state  (~(put by relays.state) url.relay relay)
               `state
      %auth    ~&  >>  auth=+.msg  ::  TODO handle auth challenges?
               `state
      %notice  ~&  >>  notice=+.msg  ::  TODO pass to UI?
               `state
    ==
  [cards state]
  ::
  ++  handle-ok
    |=  [relay=@t event-id=@ux accepted=? msg=@t]
    ^-  (quip card _state)
    ::  TODO pass to UI
    `state
  ::
  ++  handle-event
    |=  [sub-id=@t =event:nsur]
    ^-  (quip card _state)
    ::  increment event count in relay state
    =/  req  (~(get by reqs.relay) sub-id)
    ?~  req  ~&  >>>  "sub id not found in relay state"  `state
    =.  received.u.req  +(received.u.req)
    =.  reqs.relay  (~(put by reqs.relay) sub-id u.req)
    =.  relays.state  (~(put by relays.state) url.relay relay)
    |^
    ::  https://nostrdata.github.io/kinds/
    ::  if it's an ongoing request past %eose,
    ::  pass the individual event to the UI as is
    =/  cs1=(list card)
      ?.  &(ongoing.u.req ?=(^ eose.u.req))  ~
      :~  (update-ui:cardslib [%nostr %event event])
      ==
    =^  cs  state
      ?:  .=(kind.event 0)  ::  user metadata
        parse-metadata
      ?:  .=(kind.event 1)  ::  a poast
        parse-poast
      ?:  .=(kind.event 3)  ::  follow list
        parse-follows
      ::  TODO kinds 6 (reposts), 7 (reactions)
      `state
    [(weld cs1 cs) state]
    ::
    ++  parse-metadata
      ^-  (quip card _state)
      =/  jstring  content.event
      =/  ujon  (de:json:html jstring)
      ?~  ujon  ~&  failed-parse-metadata=ujon  `state
      =/  umeta  (user-meta:de:njs u.ujon)
      ?~  umeta  ~&  >>  failed-dejs-metadata=ujon  `state
      =/  prof  (empty-nostr-profile:scri pubkey.event u.umeta)
      ::  keep the follow list if their kind 3 came first
      =/  old  (~(get by profiles.state) [%nostr pubkey.event])
      =?  prof  ?=(^ old)
        prof(following following.u.old, following-count following-count.u.old)
      =.  profiles.state  (~(put by profiles.state) [%nostr pubkey.event] prof)
      `state
    ::  +parse-follows: a kind 3 contact list, whose p tags are who they
    ::  follow. replaceable, so the latest one simply replaces the last.
    ::  their followers would need everyone else's lists; not tracked
    ::
    ++  parse-follows
      ^-  (quip card _state)
      =/  follows=(set user:sur)
        %-  silt
        %+  murn  tags.event
        |=  tag=(list @t)
        ^-  (unit user:sur)
        ?~  tag  ~
        ?.  =('p' i.tag)  ~
        ?~  t.tag  ~
        ::  a bare hex pubkey, no 0x
        =/  pk  (rush i.t.tag hex)
        ?~  pk  ~
        `[%nostr `@ux`u.pk]
      =/  key  [%nostr pubkey.event]
      =/  prof
        %+  ~(gut by profiles.state)  key
        (empty-nostr-profile:scri pubkey.event *user-meta:nsur)
      =.  following.prof  follows
      =.  following-count.prof  ~(wyt in follows)
      =.  profiles.state  (~(put by profiles.state) key prof)
      `state
    ::
    ++  parse-poast
      ^-  (quip card _state)
      ::  file the event under this sub's named sourced feed
      =/  sfs  (~(gut by nostr-feeds.state) name.u.req *sourced-feeds:nsur)
      =/  sf   (~(gut by sfs) url.relay *sourced-feed:nsur)
      =.  feed.sf  (put:norm:nsur feed.sf created-at.event event)
      =.  sub.sf   u.req
      =.  nostr-feeds.state
        (~(put by nostr-feeds.state) name.u.req (~(put by sfs) url.relay sf))
      ::  if we follow the author, also file into their trill feed
      =/  user  [%nostr pubkey.event]
      =/  user-feed  (~(get by following.state) user)
      =/  profile  (~(get by profiles.state) user)
      =?  following.state  ?=(^ user-feed)
        =/  pw  (event-to-post:evlib event profile `url.relay)
        =/  poast=post:post  -.pw
        =/  nf  (put:orm:feed u.user-feed id.poast poast)
        (~(put by following.state) [%nostr pubkey.event] nf)
      `state
    --
  ::
  ++  handle-eose
    |=  sub-id=@t
    =/  ureq=(unit req-state:nsur)  (~(get by reqs.relay) sub-id)
    ?~  ureq  ~&  >>>  "sub id not found! on eose"  `state
    =/  reqs=req-state:nsur  u.ureq
    =^  cards  relay
      ?:  (is-feed:nreq filters.reqs)
        ::  TODO don't send all at once, stream in chunks
        =/  sf=(unit sourced-feeds:nsur)  (~(get by nostr-feeds.state) name.reqs)
        ?~  sf  `relay
        =/  =wfeed:nsur  (make-wfeed:lib u.sf)
        =/  c  (update-ui:cardslib [%nostr %feed name.reqs wfeed])
        [[c ~] relay]
      ::
      =/  users=(set @ux)  (user-req:nreq filters.reqs)
      ?:  (gth ~(wyt in users) 0)
        ::  TODO send the user feed subset to the UI
        `relay
      =/  thread-id  (thread-req:nreq filters.reqs)
      ?^  thread-id
        =/  sfs  (~(gut by nostr-feeds.state) name.reqs *sourced-feeds:nsur)
        =/  events=(list [@ud event:nsur])
          %-  zing
          %+  turn  ~(tap by sfs)
          |=  [url=@t sf=sourced-feed:nsur]
          (tap:norm:nsur feed.sf)
        =/  subset  %+  skim  events  |=  [* ev=event:nsur]
          ?|  .=(u.thread-id id.ev)
              =/  refs  (get-references:evlib ev)
              (~(has in refs) u.thread-id)
          ==
        =/  f  (gas:norm:nsur *nostr-feed:nsur subset)
        =/  c  (update-ui:cardslib [%nostr %thread f])
        [:~(c) relay]
      ::
      [~ relay]
    ::  any req that asked for profiles (kind 0) sends them on, whatever
    ::  else it was: the timeline sub asks for its authors' profiles
    ::  alongside their posts, and is caught by +user-req above
    =/  prof-cards=(list card:agent:gall)
      ?.  (profs-req:nreq filters.reqs)  ~
      ~[(update-ui:cardslib [%prof profiles.state])]
    ::  TODO handle chunked requests: pop the queue, send the next sub
    ::  one-shot subs close at %eose; ongoing subs record it
    ::  and stay live
    =^  cards3  relay
      ?.  ongoing.reqs
        =/  d  (close-sub-req:nclient sub-id wid relay)
        :_  +.d
        :~  (send-card:rclient -.d)
        ==
      =.  eose.reqs  `[now.bowl received.reqs]
      =.  reqs.relay  (~(put by reqs.relay) sub-id reqs)
      [~ relay]
    =.  relays.state  (~(put by relays.state) url.relay relay)
    =/  eose-card    (update-ui:cardslib [%nostr %eose sub-id])
    =/  relays-card  (update-ui:cardslib [%nostr %relays relays.state])
    :_  state
    :-  eose-card  :-  relays-card
    :(weld cards prof-cards cards3)
  --
::  +handle-ted: relay requests proxied through a thread
::
++  handle-ted
  |=  r=ted:ui
  ^-  (quip card _state)
  ?.  ?=(%req -.r)  `state
  (relay-get +.r)
::
++  relay-get
  |=  [tid=@ta wids=(list @ud) req-name=@t rg=relay-get:ui]
  ^-  (quip card _state)
  =/  nclient  ~(. nostr-client [state bowl])
  =^  cards  state
    =|  css=(list card)
    |-  ?~  wids  [css state]
    =/  wid=@ud  i.wids
    =/  urelay  (relay-by-wid wid)
    ?~  urelay
      ~&  >>>  not-connected-to-relay=wid
      $(wids t.wids)
    =/  relay  u.urelay
    =/  rclient  ~(. relay.nclient [wid relay])
    =/  d
      ?+  -.rg  !!
        %sync  (send-thread:rclient req-name get-popular:rclient)
      ==
    =.  reqs.relay  (~(put by reqs.relay) sub-id.d rs.d)
    =.  relays.state  (~(put by relays.state) url.relay relay)
    =/  cs=(list card)
      :~  (poke-ui-thread:cardslib tid sub-id.d)
          card.d
      ==
    $(wids t.wids, css (weld cs css))
  [cards state]
::  +do-get: fire a subscription request at a list of relays.
::    used by the UI %get poke and by sub replay after reconnect
::
++  do-get
  |=  [wids=(list @ud) name=@t rg=relay-get:nsur]
  ^-  (quip card _state)
  =/  nclient  ~(. nostr-client [state bowl])
  =|  css=(list card)
  |-  ?~  wids  [css state]
  =/  wid=@ud  i.wids
  =/  urelay  (relay-by-wid wid)
  ?~  urelay
    ~&  >>>  not-connected-to-relay=wid
    $(wids t.wids)
  =/  relay  u.urelay
  =/  rclient  ~(. relay.nclient [wid relay])
  =/  d=[(list card) req-state:nsur]
    ?+  -.rg  !!
      %sync    (send-sub:rclient name get-popular:rclient)
      %custom  %-  send-sub:rclient
               ::  TODO calculate if we need chunking I guess
               [name.rg filters.rg ongoing.rg ~]
    ==
  ::  mutate the relay state with the request
  =.  reqs.relay  (~(put by reqs.relay) sub-id.+.d +.d)
  ::  record ongoing subs so they get replayed after a reconnect
  =?  status.relay  &(ongoing.+.d ?=(^ status.relay))
    =/  conn  u.status.relay
    `conn(subs (~(put by subs.conn) name rg))
  =.  relays.state  (~(put by relays.state) url.relay relay)
  ::  file the sub at nostr-feeds, preserving already-cached events
  =/  osfs  (~(gut by nostr-feeds.state) name *sourced-feeds:nsur)
  =/  old   (~(get by osfs) url.relay)
  =/  =sourced-feed:nsur  [?~(old *nostr-feed:nsur feed.u.old) +.d]
  =.  nostr-feeds.state
    (~(put by nostr-feeds.state) name (~(put by osfs) url.relay sourced-feed))
  $(wids t.wids, css (weld css -.d))
::  +publish: signed events to every relay with a live socket. one that's
::  down misses them; whoever sent them can send them again
::
++  publish
  |=  evs=(list event:nsur)
  ^-  (list card)
  =/  nclient  ~(. nostr-client [state bowl])
  =/  entries  ~(tap by relays.state)
  =|  cs=(list card)
  |-  ?~  entries  cs
  =/  rs=relay-stats:nsur  +.i.entries
  ?~  wid.rs  $(entries t.entries)
  =/  rclient  ~(. relay.nclient [u.wid.rs rs])
  =/  more=(list card)
    (turn evs |=(e=event:nsur (send-card:rclient [%event e])))
  $(entries t.entries, cs (weld more cs))
::  +handle-rela: pokes from UI related to relay interaction
::
++  handle-rela
  |=  rh=relay-handling:ui
  ^-  (quip card _state)
  =/  nclient  ~(. nostr-client [state bowl])
  |^
  ?:  ?=(%send-prof -.action.rh)  :_  state  (send-prof relays.rh)
  ?:  ?=(%send-post -.action.rh)  :_  state  (send-post relays.rh +.action.rh)
  ::  %get
  =^  cards  state  (do-get relays.rh name.action.rh p.action.rh)
  =/  relays-card  (update-ui:cardslib [%nostr %relays relays.state])
  [[relays-card cards] state]
  ::
  ::  +send-event-to-relays: send one event to every connected wid,
  ::    returning the cards and the urls actually reached
  ::
  ++  send-event-to-relays
    |=  [wids=(list @ud) =event:nsur]
    ^-  [(list card) urls=(list @t)]
    =|  cs=(list card)
    =|  urls=(list @t)
    |-  ?~  wids  [cs urls]
    =/  wid=@ud  i.wids
    =/  urelay  (relay-by-wid wid)
    ?~  urelay
      ~&  >>>  not-connected-to-relay=wid
      $(wids t.wids)
    =/  rclient  ~(. relay.nclient [wid u.urelay])
    %=  $
      wids  t.wids
      cs    [(send-card:rclient [%event event]) cs]
      urls  [url.u.urelay urls]
    ==
  ::
  ++  send-post
    |=  [wids=(list @ud) host=@p id=@da]
    ^-  (list card)
    =/  scry   ~(. scri [state bowl])
    =/  upoast  (get-poast:scry host id)
    ?~  upoast  ~&  >>>  post-to-relay-not-found=[host id]  ~
    ::  TODO tags
    =/  tags=(list (list @t))  ~
    =/  event  (post-to-event:evlib i.keys.state eny.bowl u.upoast 1 tags)
    =/  [cards=(list card) urls=(list @t)]  (send-event-to-relays wids event)
    :-  (update-ui:cardslib [%nostr %sent-post host id urls event])
    cards
  ::
  ++  send-prof
    |=  wids=(list @ud)
    ^-  (list card)
    =/  prof  (~(get by profiles.state) [%urbit src.bowl])
    ?~  prof  ~&  "send-prof failed"  ~
    =/  event  (profile-to-event:evlib i.keys.state u.prof eny.bowl now.bowl)
    =/  [cards=(list card) urls=(list @t)]  (send-event-to-relays wids event)
    :-  (update-ui:cardslib [%nostr %sent-prof urls])
    :-  (send-card:global:nclient [%event event])
    cards
  --
--
