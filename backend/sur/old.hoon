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
::  Preserve the exact pre-split molds for loading persisted state.
+$  legacy-feed  ((mop @ud event:nostr) gth)
++  legacy-order  ((on @ud event:nostr) gth)
+$  state-1
  $:  %1
      keys=(lest keys:nostr)
      profiles=(map user:sur user-profile:comms)
      feed=feed:trill
      feed-perms=gate:gate
      following=(map user:sur feed:trill)
      timeline=global-feed:sur
      follow-graph=(map user:sur (set user:sur))
      relays=(map url:nostr relay-stats:nostr)
      nostr-feeds=(map @t (map url:nostr [feed=legacy-feed sub=req-state:nostr]))
      requests=requests:sur
      responses=responses:sur
      bookmarks=(map post-ref:sur @da)
      muted=(set user:sur)
      reported=(set post-ref:sur)
  ==

++  state-0-to-2
  |=  s=state-0
  ^-  state:sur
  =/  r  *state-1
  =.  r
    %=  r
      keys          keys.s
      profiles      profiles.s
      feed          feed.s
      feed-perms    feed-perms.s
      following     following.s
      timeline      global-feed.s
      follow-graph  follow-graph.s
      requests      requests.s
      responses     responses.s
      relays
        %-  malt
        %+  turn  ~(val by relays.s)
        |=  old=relay-stats-0
        [url.old [start.old url.old ~ `[%connected 0 start.old ~ ~] ~]]
    ==
  (state-1-to-2 r)

++  state-1-to-2
  |=  s=state-1
  ^-  state:sur
  =/  r  *state:sur
  =.  r
    %=  r
      keys        keys.s
      feed        feed.s
      feed-perms  feed-perms.s
      timeline    timeline.s
      relays      relays.s
      requests    requests.s
      responses   responses.s
      bookmarks   bookmarks.s
      muted       muted.s
      reported    reported.s
    ==
  =.  profiles.r
    %-  malt
    %+  murn  ~(tap by profiles.s)
    |=  [u=user:sur p=user-profile:comms]
    ^-  (unit [@p user-profile:comms])
    ?.  ?=(%urbit -.u)  ~
    `[+.u p]
  =.  following.r
    %-  malt
    %+  murn  ~(tap by following.s)
    |=  [u=user:sur f=feed:trill]
    ^-  (unit [@p feed:trill])
    ?.  ?=(%urbit -.u)  ~
    `[+.u f]
  =.  follow-graph.r
    %-  malt
    %+  murn  ~(tap by follow-graph.s)
    |=  [u=user:sur follows=(set user:sur)]
    ^-  (unit [@p (set user:sur)])
    ?.  ?=(%urbit -.u)  ~
    `[+.u follows]
  =.  following.nostr-data.r
    %-  silt
    %+  murn
      (weld ~(tap in ~(key by following.s)) ~(tap in ~(key by follow-graph.s)))
    |=  u=user:sur
    ^-  (unit @ux)
    ?.  ?=(%nostr -.u)  ~
    `+.u
  =.  user-map.nostr-data.r
    %+  roll  ~(tap by profiles.s)
    |=  [[u=user:sur p=user-profile:comms] acc=(map @ux user-data:nostr)]
    ?.  ?=(%nostr -.u)  acc
    =/  data  *user-data:nostr
    =.  data  data(pubkey +.u, profile `user-meta.p)
    =.  following.data
      %-  some
      %-  silt
      %+  murn  ~(tap in following.p)
      |=  ref=user:sur
      ^-  (unit @ux)
      ?.  ?=(%nostr -.ref)  ~
      `+.ref
    (~(put by acc) +.u data)
  =.  feeds.nostr-data.r
    %-  ~(run by nostr-feeds.s)
    |=  sources=(map url:nostr [feed=legacy-feed sub=req-state:nostr])
    ^-  sourced-feeds:nostr
    %-  ~(run by sources)
    |=  sf=[feed=legacy-feed sub=req-state:nostr]
    ^-  sourced-feed:nostr
    :-  %+  gas:norm:nostr  *feed:nostr
        %+  turn  (tap:legacy-order feed.sf)
        |=  [* ev=event:nostr]
        [[created-at.ev id.ev] ev]
    sub.sf
  ::  Rebuild the per-author note cache from preserved raw relay feeds.
  =.  user-map.nostr-data.r
    =/  sources=(list sourced-feed:nostr)
      %-  zing
      %+  turn  ~(val by feeds.nostr-data.r)
      |=(fs=sourced-feeds:nostr ~(val by fs))
    =/  users  user-map.nostr-data.r
    |-  ?~  sources  users
    =/  events=(list [event-key:nostr event:nostr])  (tap:norm:nostr feed.i.sources)
    =.  users
      |-  ?~  events  users
      =/  key=event-key:nostr  -.i.events
      =/  ev=event:nostr  +.i.events
      =/  data  (~(gut by users) pubkey.ev *user-data:nostr)
      =.  data  data(pubkey pubkey.ev)
      =.  feed.data  (put:norm:nostr feed.data key ev)
      $(events t.events, users (~(put by users) pubkey.ev data))
    $(sources t.sources)

  r

--
