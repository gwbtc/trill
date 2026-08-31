/-  sur=nostrill, nsur=nostr, comms=nostrill-comms,
    post=trill-post, gate=trill-gate
/+  js=json-nostr, sr=sortug, trill=trill-post, nostr-keys
|%
::  events
++  get-references  |=  ev=event:nsur  ^-  (set @ux)
  =|  ids=(set @ux)
  =/  tags  tags.ev
  |-  ?~  tags  ids
    =/  tag  i.tags
    ?~  tag            $(tags t.tags)
    ?.  .=('e' i.tag)  $(tags t.tags)
    ?~   t.tag         $(tags t.tags)
    =/  ref  (slaw:sr %ux i.t.tag)
    =?  ids  ?=(^ ref)  (~(put in ids) u.ref)
    $(tags t.tags)

::  +finalize-event: hash, sign and assemble a raw event
::
++  finalize-event
  |=  [=keys:nsur eny=@ raw=raw-event:nsur]
  ^-  event:nsur
  =/  event-id  (hash-event:nostr-keys raw)
  =/  signature  (sign-event:nostr-keys priv.keys event-id eny)
  :*  event-id
      pub.keys
      created-at.raw
      kind.raw
      tags.raw
      content.raw
      signature
  ==
::  kind should be 1 when sending to normal relays,
::  667 when sending to the global relay
::
++  build-event
  |=  [=keys:nsur eny=@ time=@da content=@t kind=@ud]
  ^-  event:nsur
  =/  ts  (to-unix-secs:jikan:sr time)
  (finalize-event keys eny [pub.keys ts kind ~ content])
::
++  profile-to-event
  |=  [=keys:nsur prof=user-profile:comms eny=@ now=@da]
  ^-  event:nsur
  =/  jon=json  (user-meta:en:js user-meta.prof)
  =/  string  (en:json:html jon)
  =/  ts  (to-unix-secs:jikan:sr now)
  (finalize-event keys eny [pub.keys ts 0 ~ string])
::
++  post-to-event
  |=  [=keys:nsur eny=@ p=post:post kind=@ud tags=(list tag:nsur)]
  ^-  event:nsur
  =/  cl  (latest-post-content:trill contents.p)
  =/  string  (crip (content-list-to-md:trill cl))
  =/  ts  (to-unix-secs:jikan:sr id.p)
  (finalize-event keys eny [pub.keys ts kind tags string])

++  event-to-post
  |=  [=event:nsur profile=(unit user-profile:comms) relay=(unit @t)]
    ^-  post-wrapper:comms
    ::  most people on nostr don't use markdown, they just spam links.
    ::  if parsing fails, fall back to the raw text as one paragraph
    =/  clr  (tokenise:trill content.event)
    =/  cl=content-list:post
      ?:  ?=(%& -.clr)  p.clr
      ~[[%paragraph ~[[%text content.event]]]]
    =/  ts  (from-unix:jikan:sr created-at.event)
    =/  cm=content-map:post  (init-content-map:trill cl ts)
   :: TODO more about @ps and stuff
    =/  p=post:post  :*
      id=ts
      host=`@p`pubkey.event
      author=`@p`pubkey.event
      thread=ts
      parent=~
      children=~
      contents=cm
      perms=*perms:post
      *engagement:post
      `@`id.event
      *signature:post
      tags=~
    ==  
    =/  relays=(list @t)  ?~  relay  ~  ~[u.relay]
    :: TODO make this more reliable
    =/  meta=nostr-meta:comms  [pubkey.event profile `id.event relays]
    [p meta]
--
