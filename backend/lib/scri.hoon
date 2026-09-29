/-  sur=nostrill, nsur=nostr, comms=nostrill-comms,
    post=trill-post, gate=trill-gate, feed=trill-feed, tsur=topics
/+  appjs=json-nostrill,
    lib=nostrill,
    feedlib=trill-feed,
    postlib=trill-post,
    constants,
    sr=sortug,
    gwid,
    gwidj=json-gwid,
    ws=websockets,
    topicsj=json-topics

|_  [=state:sur =bowl:gall]
+$  card  card:agent:gall

++  get-followers  ^-  (set user:comms)
  =/  subs  ~(tap by sup.bowl)
    %+  roll  subs  |=  [[* p=@p pat=path] acc=(set user:comms)] 
      ?.  ?=([%follow ~] pat)  acc
      ?:  .=(our.bowl p)   acc
      (~(put in acc) [%urbit p])
    

++  patp  |=  gwids=@t  ^-  (unit (unit cage))
  =/  upatp  (to-p:b:gwid gwids)
  ?~  upatp  ~
  :-  ~  :-  ~  :-  %json  !>  [%s (scot %p u.upatp)]

::  TODO work for @ux too
++  sgwid  |=  patps=@t  ^-  (unit (unit cage))
  =/  patp  (slaw %p patps)
  ?~  patp  ~
  =/  p  u.patp
  =/  bitsize  (met 3 p)
  :: TODO surely there's proper verification methods
  =/  =user:comms  ?:  .=(32 bitsize)  [%nostr `@ux`p]  [%urbit p]
  =/  gwid  (make:b:gwid +.user)
  =/  jon   (gwid:en:gwidj gwid)
  :-  ~  :-  ~  :-  %json  !>  jon
  
++  my-gwid  ^-  nyms:gwid
  (make:b:gwid pub.i.keys.state)
++  my-urbit-id  ^-  urbit-id:comms
  =/  urgwid  (make:b:gwid our.bowl)
  [our.bowl `@ud`our.bowl urgwid]

++  default-user-meta  |=  who=@p  ^-  user-meta:nsur
    :^  (scot %p who)
        ''
        ''
        ~
++  default-profile  ^-  user-profile:comms
  =/  nostrgwid  (make:b:gwid pub.i.keys.state)
  =/  urgwid  (make:b:gwid our.bowl)
  =/  fans  get-followers
  :*  pub.i.keys.state
      ~(key by following.state)
      ~(wyt by following.state)
      fans
      ~(wyt in fans)
      (default-user-meta our.bowl)
      `my-urbit-id
      nostrgwid
    ==
++  empty-profile  |=  u=user:sur  ^-  user-profile:comms
  =/  bgwid  (make:b:gwid +.u)
  ?:  ?=(%urbit -.u)
  =/  nostrgwid  (make:b:gwid pub.i.keys.state)
  :*  0x0
      ~
      0
      ~
      0
      (default-user-meta +.u)
      `[+.u `@`+.u bgwid]
      nostrgwid
    ==

  :*  +.u
      ~
      0
      ~
      0
      (default-user-meta ~zod)
      ~
      bgwid
    ==
++  empty-nostr-profile  |=  [pubkey=@ux meta=user-meta:nsur]  ^-  user-profile:comms
  =/  bgwid  (make:b:gwid pubkey)
  :-  pubkey
  :-  ~
  :-  0
  :-  ~
  :-  0
  :-  meta
  :-  ~
      bgwid

++  get-poast  |=  [host=@p id=@]  ^-  (unit post:post)
  =/  poast  ?:  .=(host our.bowl)
    (get:orm:feed feed.state id)
    ~
  poast



++  thread  |=  [hs=@t ids=@t]
  ^-  (unit (unit cage))  :-  ~  :-  ~  :-  %json  !>
  %-  res:en:appjs
  ^-  res:comms
  =/  host  (slaw %p hs)
  ?~  host
    =/  msg  'Host is not a @p'  [%thread `@da`0 msg %done %ng]
  :: TODO what about non urbit stuff
  =/  =user:sur  [%urbit u.host]
  =/  fed=(unit feed:feed)
    ?:  .=(u.host our.bowl)  `feed.state  (~(get by following.state) user)
  ?~  fed
    =/  msg  'Feed not found'
        [%thread `@da`0 msg %done %ng]
  =/  id  (slaw:sr %ud ids)  ?~  id
    =/  msg  'Post ID malformed'
    [%thread `@da`0 msg %done %ng]
  =/  node  (get:orm:feed u.fed u.id)
  ?~  node
    =/  msg  'Post not found in feed'
        [%thread u.id msg %done %ng]
  =/  fn   (node-to-full:feedlib u.node u.fed)
  =/  ted  (extract-thread:feedlib fn)
  =/  msg  ''  [%thread u.id msg %done %ok fn ted]

++  sfeed  |=  [hs=@t s=@t e=@t c=@ n=@ r=@]
  ^-  (unit (unit cage))  :-  ~  :-  ~  :-  %json  !>
  %-  res:en:appjs
  ^-  res:comms
  =/  host  (slaw %p hs)
  ?~  host
    =/  msg  'Host is not a @p'
        [%feed msg %done %ng]
  =/  =user:sur  [%urbit u.host]
  =/  fed=(unit feed:feed)  ?:  .=(u.host our.bowl)  `feed.state  (~(get by following.state) user)
  ?~  fed
  =/  msg  'Feed not found'
        [%feed msg %done %ng]
  =/  start=(unit @da)  (timestamp:sr s)  
  =/  end               (timestamp:sr e) 
  =/  cont  (slaw:sr %ud c)
  =/  count  ?~  cont  feed-page-size:constants  u.cont
  =/  newest  !=('0' n)
  :: =/  nodelist  (tap:orm:feed u.fed)
  :: =/  replies=?  !=('0' r)
  :: =/  threads  %+  skim  nodelist 
  ::   |=  [=id:post =post:post]  ^-  ?
  ::   ?.  replies
  ::   ?&
  ::     ?=  %~  parent.post
  ::     (lte id start)  (gte id end)
  ::   ==
  ::   ?&  (lte id start)  (gte id end)  ==
  :: =/  thread-count  (lent threads)
  :: =/  result=(list [id:post post:post])  ?:  newest  (scag count threads)  (flop (scag count (flop threads)))
  :: =/  cursors=[(unit @da) (unit @da)]  ?~  result  [~ ~]  ?~  threads  [~ ~]  :-
  :: ?:  .=((head result) (head threads))  ~  `id:(head result)
  :: ?:  .=((rear result) (rear threads))  ~  `id:(rear result)
  :: =/  =fc:feed  [(gas:orm:feed *feed:feed result) -.cursors +.cursors]
  :: TODO counts and order
  =/  nf  (lot:orm:feed u.fed start end)
  =/  hed  (pry:orm:feed nf)
  =/  tal  (ram:orm:feed nf)
  =/  ns=(unit @da)  ?~  hed  ~  (some key.u.hed)
  =/  ne=(unit @da)  ?~  tal  ~  (some key.u.tal)
  =/  =fc:feed  [nf ns ne]
  =/  uprof  (~(get by profiles.state) user)
  =/  profile  ?^  uprof  u.uprof
    ?:  .=(our.bowl u.host)  default-profile  (empty-profile [%urbit u.host])
  =/  msg  ''
  [%feed msg %done %ok fc profile]

++  own-profile
^-  (unit (unit cage))
  :-  ~  :-  ~  :-  %json  !>
  =/  uprof  (~(get by profiles.state) [%urbit our.bowl])
  %-  en-profile:en:appjs 
    ?^  uprof  u.uprof  default-profile
    
++  profile  |=  [which=@t ids=@t]
^-  (unit (unit cage))
  =/  network  (parse-app which)
  ?~  network  ~
  =/  usert  (branch-id u.network ids)
  ?~  usert  ~
  :-  ~  :-  ~  :-  %json  !>
  =/  uprof  (~(get by profiles.state) -.u.usert)
  %-  en-profile:en:appjs 
    ?^  uprof  u.uprof
    ?:  +.u.usert  default-profile  (empty-profile -.u.usert)
    
++  branch-id  |=  [network=?(%nostr %urbit) id=@t]
  ^-  (unit [user:sur itsa-me=?])
  ?:  ?=(%nostr network)
    =/  upk  (slaw:sr %ux id)
    ?~  upk  ~
      =/  itsa-me  .=(u.upk pub.i.keys.state)
      `[[%nostr u.upk] itsa-me]
    =/  up  (slaw %p id)
    ?~  up  ~
      =/  itsa-me  .=(u.up our.bowl)
      `[[%urbit u.up] itsa-me]
++  parse-app  |=  which=@t  ^-  (unit ?(%nostr %urbit))
    ?:  .=('nostr' which)  `%nostr
    ?:  .=('urbit' which)  `%urbit
    ~
::  +trending: every %topics source's topics, but those hidden as spam, for
::  the trending topics card. null when %topics isn't running
::
++  trending
^-  (unit (unit cage))
  :-  ~  :-  ~  :-  %json  !>
  ^-  json
  =/  base=path  /(scot %p our.bowl)/topics/(scot %da now.bowl)
  ?.  .^(? %gu (weld base /$))  ~
  =/  status
    .^  $:  every=@dr
            next=(unit @da)
            errors=(map source-id:tsur [at=@da msg=@t])
            fetched=(map source-id:tsur @da)
        ==
      %gx  (weld base /status/noun)
    ==
  =/  =prefs:tsur  .^(prefs:tsur %gx (weld base /prefs/noun))
  =/  spam
    .^  [provider=(unit @tas) verdicts=(map @t verdict:tsur)]
      %gx  (weld base /spam/noun)
    ==
  ::  without a spam provider, nothing is hidden
  =/  verdict
    |=  t=topic:tsur
    ^-  (unit verdict:tsur)
    ?~  provider.spam  ~
    (~(get by verdicts.spam) (topic-key:tsur title.t))
  ::  only fetched sources: an unfetched one's scry is empty and .^
  ::  would crash on it. topics in none of the chosen categories are
  ::  left out (the keyword-classified ones; google news only fetches
  ::  the chosen sections)
  =/  srcs=(list [id=source-id:tsur at=@da topics=(list topic:tsur)])
    %+  turn  ~(tap by fetched.status)
    |=  [id=source-id:tsur at=@da]
    :+  id  at
    %+  skim  .^((list topic:tsur) %gx (weld base /topics/[id]/noun))
    |=  t=topic:tsur
    ?=(^ (~(int in categories.t) cats.prefs))
  ::  flagged: Jev's yes over the threshold, or the owner's word; once
  ::  each, however many sources have it
  =/  flagged=(list [key=@t t=topic:tsur v=verdict:tsur])
    =/  seen=(set @t)  ~
    =/  lists=(list (list topic:tsur))
      (turn srcs |=([* * ts=(list topic:tsur)] ts))
    =/  all=(list topic:tsur)  (zing lists)
    =|  out=(list [key=@t t=topic:tsur v=verdict:tsur])
    |-
    ?~  all  (flop out)
    =/  v  (verdict i.all)
    =/  k  (topic-key:tsur title.i.all)
    ?.  ?&  ?=(^ v)
            !(~(has in seen) k)
            |(?=(^ override.u.v) (hidden:tsur u.v))
        ==
      $(all t.all)
    $(all t.all, seen (~(put in seen) k), out [[k i.all u.v] out])
  ::  all of them: the card pages through them itself
  %^  trending:en:topicsj  prefs
    %+  turn  srcs
    |=  [id=source-id:tsur at=@da topics=(list topic:tsur)]
    =/  shown
      %+  skip  topics
      |=  t=topic:tsur
      =/  v  (verdict t)
      ?~(v | (hidden:tsur u.v))
    [id at shown]
  [provider.spam flagged]
::
::  +topic-links: a trending topic's related articles, by its source and
::  +topic-id:tsur; the card's topics come without them. null when the
::  topic's gone (refetched away) or %topics isn't running
::
++  topic-links
  |=  [source=@tas id=@t]
  ^-  (unit (unit cage))
  :-  ~  :-  ~  :-  %json  !>
  ^-  json
  =/  base=path  /(scot %p our.bowl)/topics/(scot %da now.bowl)
  ?.  .^(? %gu (weld base /$))  ~
  ::  a source never fetched has no topics to scry
  =/  status
    .^  [every=@dr next=(unit @da) errors=* fetched=(map source-id:tsur @da)]
      %gx  (weld base /status/noun)
    ==
  ?.  (~(has by fetched.status) source)  ~
  =/  ts  .^((list topic:tsur) %gx (weld base /topics/[source]/noun))
  |-
  ?~  ts  ~
  ?:  =(id (topic-id:tsur title.i.ts))  (links:en:topicsj i.ts)
  $(ts t.ts)
::
++  relays
^-  (unit (unit cage))
  =/  sockets  (list-connected:ws bowl)
  :-  ~  :-  ~  :-  %json  !>
  %+  all-relays:en:appjs  sockets  relays.state
::
++  nostr-feeds-scry
^-  (unit (unit cage))
  :-  ~  :-  ~  :-  %json  !>
  (en-nostr-feeds:en:appjs nostr-feeds.state)
  

--
