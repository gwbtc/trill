/-  *wrap, nsur=nostr, tf=trill-feed, tp=trill-post
/+  gwid
::  Communication between Urbit Ships
|%
::  canonical definitions live in sur/trill/post
+$  upid  upid:tp
+$  user  user:tp

+$  user-profile
  $:  pubkey=@ux
      following=(set user)
      following-count=@ud
      followers=(set user)
      follower-count=@ud
      =user-meta:nsur
      urbit-id=(unit urbit-id)
      ::  this one built on the nostr pubkey, not the @p
      gwid=nyms:gwid
  ==
+$  urbit-id
$:  p=@p
    point=@ud
    gwid=nyms:gwid    
==

::  Pokes are used to notify solely users of engagement. There is no data requests through pokes

+$  poke
  $%
      [%eng engagement]
      [%ted wid=@ud ws-proxy]
      [%dbug *]
  ==
+$  ws-proxy
  $%  [%msg msg=websocket-message:eyre]
      [%disconnect ~]
  ==
+$  engagement
  $%  [%reply parent=@da child=post:tp]
      [%quote src=@da =post:tp]
      [%del-quote src=upid quote=@da]
      [%del-reply parent=upid child=@da]
      [%rp src=upid target=@da]
      [%reaction pid=upid reaction=@t]
      [%del-reaction pid=upid]
      [%report pid=upid reason=@t]
      [%mention =post:tp]
  ==
::  Data requests is done through subscriptions.
::  Requests can be proper subscriptions %fols i.e. following someone and expecting updates
::  Or one-off requests %begs These are also done as subscriptions, through threads called by the frontend.
::  Both are handled by the %gate permission system
+$  req
  $:  msg=@t  :: Users can add a custom message to their requests. "Let me in bro"
  $=  p
  :: WTF  why did this crash (on runtime!)  if it was defined as $^ instead
  $@  %fols
      [%begs beg-type]
==
+$  beg-type
  $@  %feed
      [%thread id=@da]
::  Responses to requsts
::  %begs  responses are sent directly to the frontend
::  %fols  responses are sent to on-agent of the requester as an %fols fact
+$  res
  $%  [%feed fols-res]
      [%thread id=@da (deferred thread-data)]
  ==
+$  fols-res  (deferred feed-data)

+$  feed-data  [=fc:tf profile=user-profile]
+$  thread-data
  $:  node=full-node:tp
      thread=(list full-node:tp)  ::  list of all the users consecutive posts, as in long form thread
  ==
 ::  Updates sent to followers who are subscribed to us
+$  fact
  $%  [%feed fols-res]  ::  response to follow requests
      [%post post-fact]
      [%prof (unit user-profile)]  ::  null to delete the profile
  ==
::  We wrap posts on nostr metadata if the post was also published to Nostr   
+$  post-wrapper  [=post:tp =nostr-meta]
+$  nostr-meta
$:  pub=@ux
    prof=(unit user-profile)
    ev-id=(unit @ux)
    relays=(list @t)
==
::  Updates whether there's a new post in the feed, a change to some post in the feed, or some post deleted
+$  post-fact
  $%  [%add post-wrapper]
      [%upd post-wrapper]
      [%del post-wrapper]
  ==
--
