::  nostrill-dbug: dojo debug pokes for %nostrill
::
::    poked as [%dbug noun] through the %noun mark, e.g.
::    :nostrill [%dbug %stats]
::
::    notifications
::      %hark-clear           clear all hark notifications
::    permissions
::      %perms-print          print feed permissions
::      %perms-toggle-manual  toggle manual-approval mode
::      %perms-toggle-locks   toggle every lock (rank/luk/ship/tags)
::    seeding
::      %seed-threads         seed own feed with threads of nested replies
::      %seed-longform        seed own feed with one long chunked thread
::    own feed
::      %feed-bounds          print oldest/newest own-feed entries
::      %feed-print           dump every own-feed post as markdown
::      [%thread-print id]    print one thread from own feed
::      [%thread-del id]      delete all posts belonging to a thread
::    websockets / relays
::      %relays-print         print global-relay check + full relays map
::      %relays-status        per-url [url wid status] (reconnect state)
::      %relays-reset         wipe relays state + cancel every iris socket
::      %sockets-print        list iris-side websockets
::    nostr feeds
::      %nostr-feeds-print    per-sub-name, per-relay event counts
::      %stats                counts: nostr-feeds, profiles, relay stats
::    profiles
::      %profile-own          print own profile
::      %profiles-print       print every stored profile
::      %profiles-wipe        wipe the profiles map
::    follows
::      %follows-print        print following keys + followers
::      [%follow-feed ship]   print the stored feed for one followed ship
::    keys
::      %keys-generate        generate + print a throwaway keypair (not stored)
::      %keys-print           print all stored keypairs incl. npub
::    subscriptions
::      %kick-all             kick every inbound subscriber
::      %leave-all            leave every outbound watch
::
/-  sur=nostrill, nsur=nostr, comms=nostrill-comms,
    tp=trill-post, tf=trill-feed
/+  lib=nostrill, postlib=trill-post, feedlib=trill-feed,
    harklib=hark, sr=sortug, nostr-keys, bip=bip-bip, constants,
    ws=websockets, seed, scri, followlib=nostrill-follows
|_  [=state:sur =bowl:gall]
+*  feed         feed.state
    keys         keys.state
    relays       relays.state
    profiles     profiles.state
    following    following.state
    feed-perms   feed-perms.state
    nostr-feeds  nostr-feeds.state
    fols         ~(. followlib [state bowl])
    scry         ~(. scri [state bowl])
+$  card  card:agent:gall
::
++  handle
  |=  noun=*
  ^-  (quip card _state)
  ?+  noun
      ~&  >>>  unknown-dbug-poke=noun
      ~&  >>>  "commands are listed in the header of lib/nostrill/dbug.hoon"
      `state
  ::  notifications
    %hark-clear
      :_  state
      :~  (clear-hark:harklib bowl)
      ==
  ::  permissions
    %perms-print
      ~&  >  perms=feed-perms
      `state
    %perms-toggle-manual
      =.  feed-perms  feed-perms(manual !manual.feed-perms)
      ~&  >  perms=feed-perms
      `state
    %perms-toggle-locks
      =.  lock.feed-perms
        %=  lock.feed-perms
          rank  rank.lock.feed-perms(locked !locked.rank.lock.feed-perms)
          luk   luk.lock.feed-perms(locked !locked.luk.lock.feed-perms)
          ship  ship.lock.feed-perms(locked !locked.ship.lock.feed-perms)
          tags  tags.lock.feed-perms(locked !locked.tags.lock.feed-perms)
        ==
      ~&  >  perms=feed-perms
      `state
  ::  seeding
    %seed-threads
      =.  state  seed-threads
      `state
    %seed-longform
      =.  state  seed-own
      `state
  ::  own feed inspection
    %feed-bounds
      ~&  pry=(pry:orm:tf feed)
      ~&  ram=(ram:orm:tf feed)
      `state
    %feed-print
      =/  posts  (tap:orm:tf feed)
      |-  ?~  posts  `state
        =/  p=post:tp  +.i.posts
        ~&  id=id.p
        ~&  >>  (content-map-to-md:postlib contents.p)
        =/  ign  ?^  parent.p
                    ~&  >  par=u.parent.p
                    ~&  >>>  ted=thread.p
                    ~  ~
        $(posts t.posts)
    [%thread-print @]
      =/  op  (got:orm:tf feed +.noun)
      =/  full-node  (node-to-full:feedlib op feed)
      =/  ted  (extract-thread:feedlib full-node)
      ~&  lent=(lent ted)
      |-  ?~  ted  `state
        ~&  id=id.i.ted
        ~&  >>  (content-map-to-md:postlib contents.i.ted)
        $(ted t.ted)
    [%thread-del @]
      =/  posts  (tap:orm:tf feed)
      =.  feed
        |-  ?~  posts  feed
          =/  p=post:tp  +.i.posts
          =.  feed  ?.  .=(thread.p +.noun)  feed
            =<  +  (del:orm:tf feed id.p)
          $(posts t.posts)
      `state
  ::  websocket / relay status
    %relays-print
      ~&  global=(check-connected:ws global-relay:constants bowl)
      ~&  relays=~(tap by relays)
      `state
    %sockets-print
      ~&  >  ws-connections=(list-connected:ws bowl)
      `state
    %relays-reset
      =.  relays  *(map @t relay-stats:nsur)
      :_  state
      %+  turn  (list-connected:ws bowl)
      |=  [wid=@ url=@t status=*]  (cancel-connect:ws wid)
    %relays-status
      =/  l  ~(tap by relays)
      =/  ign
        |-  ?~  l  ~
        =/  rs=relay-stats:nsur  +.i.l
        ~&  >  [url.rs wid=wid.rs status=status.rs]
        $(l t.l)
      `state
  ::  nostr feed inspection
    %nostr-feeds-wipe
      =.  nostr-feeds  *nostr-feeds:nsur
      `state
  ::  nostr feed inspection
    %nostr-feeds-print
      =/  nfs=(list [name=@t sfs=sourced-feeds:nsur])  ~(tap by nostr-feeds)
      |-  ?~  nfs  `state
        ~&  >  feed-name=name.i.nfs
        =/  srcs=(list [url=@t sf=sourced-feed:nsur])  ~(tap by sfs.i.nfs)
        =/  ign
          |-  ?~  srcs  ~
          =/  sf  sf.i.srcs
          ~&  >>  [url=url.i.srcs events=~(wyt by feed.sf) sub-id=sub-id.sub.sf]
          $(srcs t.srcs)
        $(nfs t.nfs)
    %stats
      ~&  nostr-feeds=~(wyt by nostr-feeds)
      ~&  profiles=~(wyt in ~(key by profiles))
      =/  ign  (print-relay-stats:lib relays)
      `state
  ::  profiles
    %profile-own
      ~&  >  own-prof=(~(get by profiles) [%urbit our.bowl])
      `state
    %profiles-print
      =/  pfs  ~(tap by profiles)
      ~&  stored-profiles=(lent pfs)
      |-  ?~  pfs  `state
        ~&  >>  user=-.i.pfs
        ~&  >  profile=+.i.pfs
        $(pfs t.pfs)
    %profiles-wipe
      =.  profiles  *(map user:sur user-profile:comms)
      `state
  ::  follows
    %follows-print
      ~&  following=~(key by following)
      ~&  followers=get-followers:scry
      `state
    [%follow-feed @p]
      ~&  (~(get by following) [%urbit +.noun])
      `state
  ::  keys
    %keys-generate
      =/  ks  (gen-keys:nostr-keys eny.bowl)
      ~&  pub=(scow:sr %ux -.ks)
      ~&  priv=(scow:sr %ux +.ks)
      `state
    %keys-print
      =/  ks  `(list keys:nsur)`keys
      =/  scoww  scow:sr
      |-  ?~  ks  `state
        =/  key  i.ks
        ~&  pub=(scow:sr %ux -.key)
        ~&  priv=(scow:sr %ux +.key)
        ~&  npub=(hex-to-npub:bip (scoww(min-chars 64) %ux -.key))
        $(ks t.ks)
  ::  subscriptions
    %kick-all
      :_  state
      %+  turn  ~(tap by sup.bowl)
      |=  [* p=@p pat=path]
      [%give %kick ~[pat] ~]
    %leave-all
      :_  state
      %+  turn  ~(tap by wex.bowl)
      |=  [[wire sip=@p term] q=*]
      (urbit-leave:fols sip)
  ==
::  +seed-threads: fill own feed with generated threads of nested replies
::
++  seed-threads
  ^+  state
  =/  pubkey  pub.i.keys
  =/  basedate  (yore ~2020.1.1)
  =/  l  (gulf 0 10)
  =.  feed
    |-  ?~  l  feed
    =/  i  +(i.l)
    =/  eny  (scow %p (add i (end 5 eny.bowl)))
    =/  content=@t  %-  crip  "THREAD OP \0a{eny}"
    =/  sp=sent-post:tp  (build-sp:postlib our.bowl our.bowl content ~ ~)
    =/  opdate  basedate(m (add i m.basedate))
    =/  opid  (year opdate)
    =/  op=post:tp  (build-post:postlib opid pubkey sp)
    =.  feed  (put:orm:tf feed id.op op)
    =/  nests  10
    =/  nnests  nests
    =/  rng  ~(. og eny.bowl)
    =/  parent-id  id.op
    =/  new-parent  parent-id
    =.  feed
      |-  ?:  .=(nests 0)  feed
      =/  parent  (get:orm:tf feed parent-id)
      ?~  parent  ~&  >>>  ["parent wasn't set in feed??\0a" parent-id]  !!
      =^  reply-count  rng  (rads:rng 10)
      =.  reply-count  +(reply-count)
      =/  rcount  reply-count
      =/  new-state=[_feed @da]
        |-  ?:  .=(reply-count 0)  [feed new-parent]
        =^  author-atom  rng  (rads:rng (bex 32))
        =/  author  `@p`author-atom
        =/  reny  (scow %p (add eny.bowl (add nests reply-count)))
        =/  reply-content
          %-  crip
          "Reply to \0a{(scow %da parent-id)}\0a on thread {(scow %da id.op)}\0a{reny}"
        =/  sp=sent-post:tp
          (build-sp:postlib host.u.parent author reply-content `parent-id `id.op)
        =/  months  +((sub nnests nests))
        =/  days    +((sub rcount reply-count))
        =/  d=date  [[.y 0] months `tarp`[days 0 0 0 ~]]
        =/  reply-id  %-  year  (add-to-date:jikan:sr opdate d)
        =/  reply=post:tp  (build-post:postlib reply-id pubkey sp)
        =.  new-parent  id.reply
        =.  children.u.parent  (~(put in children.u.parent) id.reply)
        =.  feed  (put:orm:tf feed id.u.parent u.parent)
        =.  feed  (put:orm:tf feed id.reply reply)
        $(reply-count (dec reply-count))
      =.  feed  -.new-state
      =.  parent-id  +.new-state
      $(nests (dec nests))
    $(l t.l)
  state
::  +seed-own: fill own feed with one long-form thread of chunked text
::
++  seed-own
  ^+  state
  =/  text  long-text:seed
  =/  chunks  (chunk-by-size text 256)
  ?~  chunks  ~&  "empty seed text"  state
  =/  rest=(list tape)  t.chunks
  =/  pubkey  pub.i.keys
  =/  content  (crip i.chunks)
  =/  sp=sent-post:tp  (build-sp:postlib our.bowl our.bowl content ~ ~)
  =/  op=post:tp       (build-post:postlib now.bowl pubkey sp)
  ~&  seed-thread-id=id.op
  =/  parent-id  id.op
  =.  feed  (put:orm:tf feed id.op op)
  =/  idx  1
  =.  feed
    |-  ?~  rest  feed
    =/  parent  (get:orm:tf feed parent-id)
    ?~  parent  ~&  >>>  ["parent wasn't set in feed??\0a" parent-id]  !!
    =/  content  (crip i.rest)
    =/  sp=sent-post:tp
      (build-sp:postlib our.bowl our.bowl content `parent-id `id.op)
    =/  reply-id   (add now.bowl (mul idx ~s10))
    =/  p=post:tp  (build-post:postlib reply-id pubkey sp)
    =.  children.u.parent  (~(put in children.u.parent) id.p)
    =.  feed  (put:orm:tf feed id.u.parent u.parent)
    =.  feed  (put:orm:tf feed id.p p)
    $(rest t.rest, parent-id id.p, idx +(idx))
  state
::  +chunk-by-size: split a list into chunks of at most q elements
::    (salvaged from lib/seq)
::
++  chunk-by-size
  |*  [p=(list) q=@ud]
  ?:  =(0 q)  ~|('chunk size is 0' !!)
  =/  res=(list (list _?>(?=(^ p) i.p)))  ~
  =/  i=@ud  0
  =/  next=(list _?>(?=(^ p) i.p))  ~
  |-  ^-  (list (list _?>(?=(^ p) i.p)))
  ?~  p  (flop [(flop next) res])
  ?:  =(i q)  $(i 0, res [(flop next) res], next ~)
  $(i +(i), next [i.p next], p t.p)
--
