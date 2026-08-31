/-  *wrap, nostr, comms=nostrill-comms,
    trill=trill-feed, tp=trill-post, gate=trill-gate
|%
+$  state  state-0
+$  state-0
  $:  %0
      ::  identity
      keys=(lest keys:nostr)  ::  cycled, i.keys is current
      profiles=(map user user-profile:comms)
      ::  own feed
      feed=feed:trill
      feed-perms=gate:gate
      ::  social graph
      following=(map user feed:trill)
      timeline=global-feed  ::  merged mop of followed users' posts
      follow-graph=(map user (set user))
      ::  nostr relays, keyed by url: one connection per server,
      ::  and the entry survives socket (wid) churn
      relays=(map url=@t relay-stats:nostr)
      ::  per-request-name, per-relay-url feeds from subscriptions
      =nostr-feeds:nostr
      ::  incoming requests, saved to handle async
      =requests
      ::  our responses to requests
      =responses
  ==
::
+$  global-feed  ((mop upid post:tp) ugth)
++  uorm         ((on upid post:tp) ugth)
++  ugth
  |=  [a=[[* id=@] =time] b=[[* id=@] =time]]
  ?:  .=(time.a time.b)  (gth id.a id.b)  (gth time.a time.b)
::  canonical definitions live in sur/trill/post
+$  upid  upid:tp
+$  user  user:tp
::  request handling
::
+$  requests    ((mop @da req:comms) gth)
+$  responses   ((mop @da ruling) gth)
++  orq         ((on @da req:comms) gth)
++  ors         ((on @da ruling) gth)
::  +ruling: our response to a received request
::
+$  ruling
  $:  req=(enbowl req:comms)
      =gate:gate
      =decision
  ==
+$  decision  [time=@da approved=? manual=? msg=@t]
--
