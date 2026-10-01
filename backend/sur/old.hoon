/-  sur=nostrill, nostr, comms=nostrill-comms,
    trill=trill-feed, gate=trill-gate
|%
+$  state-0
  $:  %0
      :: nostr config
      relays=(map @ud relay-stats-0)  ::  key is the websocket id
      :: TODO deprecate?
      global-relay-conn=(unit @ud)  :: the websocket id
      :: ws-msg-queue=(list websocket-event:eyre)
      keys=(lest keys:nostr)  :: cycled, i.keys is current one
      ::  own feed
      =feed:trill
      feed-perms=gate:gate
      ::  nostr feed from relays
      :: TODO deprecate and parse properly into a feed:trill
      nostr-feed=*
      ::  profiles
      profiles=(map user:sur user-profile:comms)

      following=(map user:sur feed:trill)

      following2=global-feed:sur
      ::
      =global-feed:sur
      follow-graph=(map user:sur (set user:sur))
      ::  Save incoming requests to handle async
      =requests:sur
      ::  Save our given responses
      =responses:sur
  ==

::  the relay types as they shipped with state-0 (sur/nostr has moved on:
::  relay-stats gained wid and status, req-state was reshaped)
::
+$  relay-stats-0
  $:  start=@da
      url=@t
      reqs=(map @t req-state-0)
  ==
+$  req-state-0
  $:  name=@t
      filters=(list filter:nostr)
      received=@ud
      ongoing=(unit ?)
      chunked=(list filter:nostr)
  ==
::
++  state-0-to-1
  |=  s=state-0  ^-  state-1:sur
  |^
  :*
    %1
    keys=keys.s
    profiles=profiles.s
    feed=feed.s
    feed-perms=feed-perms.s
    following=following.s
    timeline=global-feed.s
    follow-graph=make-follow-graph
    ::  keyed by url now, not by socket id
    relays=migrate-relays
    nostr-feeds=~
    requests=requests.s
    responses=responses.s
    bookmarks=~
    muted=~
    reported=~
  ==
  ::  each relay by its url, marked connected with no socket: on-load's
  ::  +reconcile reconnects those. the old subs went with their sockets
  ::
  ++  migrate-relays  ^-  (map @t relay-stats:nostr)
    %-  malt
    %+  turn  ~(val by relays.s)
    |=  r=relay-stats-0
    ^-  [@t relay-stats:nostr]
    [url.r [start.r url.r ~ `[%connected 0 start.r ~ ~] ~]]
  
  ++  make-follow-graph  ^-  (map user:sur (set user:sur))
    ~
  --
--
