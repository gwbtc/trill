/-  sur=chat,
    tf=trill-feed, tp=trill-post, comms=nostrill-comms
/+  postlib=trill-post, feedlib=trill-feed, jsonlib=json-chat,
    sr=sortug
|_  [state=state-0:sur =bowl:gall]
+*  dms  dms.state
    requests  requests.state
    outbox  outbox.state
    policy  policy.state
+$  card  card:agent:gall
::  scries
++  scry-all
^-  json
  (init:en:jsonlib [summary requests policy])

++  scry-chat
|=  [peer=ship s=@t e=@t]  ^-  json
  =/  start=(unit @da)  (timestamp:sr s)  
  =/  end=(unit @da)    (timestamp:sr e) 
  =/  f  (dm-feed peer)
  =/  fc  (dm-feed-subset [f start end])
  =/  chat  (dm-chat peer)
  =/  unread-count  (count-unread chat)
  (dm:en:jsonlib [peer fc last-read.chat unread-count (is-muted peer) (is-blocked peer) (peer-delivery peer)])
::  pokes
++  send
  |=  [peer=ship content=@t]
  ^-  [(list card) _state]
  ?:  (is-blocked peer)
    :_  state
    :~  (err-fact 'cannot send to blocked peer')
    ==
  ?:  (has-outbound-request peer)
    :_  state
    :~  (err-fact 'message request already pending')
    ==
  ?:  ?&  (is-unknown peer)
          (~(has by requests) peer)
      ==
    :_  state
    :~  (err-fact 'accept or reject this request before sending')
    ==
  =/  sp=sent-post:tp
    (build-sp:postlib our.bowl our.bowl content ~ ~)
  =/  post=post:tp
    (build-post:postlib now.bowl 0x0 sp)
  =^  added  state  (put-dm peer post)
  =.  state  (set-read peer `id.post)
  ?.  added
    [~ state]
  ?:  =(peer our.bowl)
    :_  state
    :~  (peer-fact peer)
    ==
  =.  state  (set-delivery peer id.post %sending)
  :_  state
  :~  (peer-fact peer)
      (peer-poke peer post)
  ==
::
++  read
  |=  [peer=ship id=(unit @da)]
  ^-  [(list card) _state]
  =.  state  (set-read peer id)
  :_  state
  :~  (peer-fact peer)
  ==
::
++  mute
  |=  peer=ship
  ~&  muting=peer
  ^-  [(list card) _state]
  ?:  (is-blocked peer)
    :_  state
    :~  (err-fact 'cannot mute blocked peer')
    ==
  =.  muted.policy  (~(put in muted.policy) peer)
  :_  state
  :~  (peer-fact peer)
  ==
::
++  unmute
  |=  peer=ship
  ~&  unmuting=peer
  ^-  [(list card) _state]
  =.  muted.policy  (~(del in muted.policy) peer)
  :_  state
  :~  (peer-fact peer)
  ==
::
++  block
  |=  peer=ship
  ^-  [(list card) _state]
  =.  muted.policy  (~(del in muted.policy) peer)
  =.  blocked.policy  (~(put in blocked.policy) peer)
  =.  requests  (~(del by requests) peer)
  =.  state  (clear-outbound-request peer)
  :_  state
  :~  requests-fact
      (peer-fact peer)
  ==
::
++  gtfo
  |=  [peer=ship msg=@t]
  ^-  [(list card) _state]
  =.  muted.policy  (~(del in muted.policy) peer)
  =.  blocked.policy  (~(put in blocked.policy) peer)
  =.  requests  (~(del by requests) peer)
  =.  state  (clear-outbound-request peer)
  :_  state
  :~  requests-fact
      (peer-fact peer)
      (block-poke peer msg)
  ==
::
++  unblock
  |=  peer=ship
  ^-  [(list card) _state]
  =.  blocked.policy  (~(del in blocked.policy) peer)
  :_  state
  :~  (peer-fact peer)
  ==
::
++  accept
  |=  peer=ship
  ^-  [(list card) _state]
  =/  req  (~(get by requests) peer)
  ?~  req
    :_  state
    :~  (err-fact 'message request not found')
    ==
  =^  added  state  (put-dm peer u.req)
  =.  requests  (~(del by requests) peer)
  :_  state
  :~  requests-fact
      (peer-fact peer)
      (req-poke peer %.y)
  ==
::
++  reject
  |=  peer=ship
  ^-  [(list card) _state]
  =.  requests  (~(del by requests) peer)
  :_  state
  :~  requests-fact
      (req-poke peer %.n)
  ==
::
++  dm-chat
  |=  peer=ship
  ^-  chat:sur
  =/  c  (~(get by dms) peer)
  ?~  c  [*feed:tf ~]
  u.c
::
++  dm-feed
  |=  peer=ship
  ^-  feed:tf
  feed:(dm-chat peer)
++  dm-feed-subset
  |=  =fc:tf
  ^-  fc:tf
  (subset:feedlib fc .n now.bowl)
:: ::
++  put-dm
  |=  [peer=ship post=post:tp]
  ^-  [? _state]
  =/  feed  (dm-feed peer)
  =/  old  (get:orm:tf feed id.post)
  ?^  old
    [.n state]
  =.  feed  (put:orm:tf feed id.post post)
  =/  old-chat  (dm-chat peer)
  =.  dms  (~(put by dms) peer old-chat(feed feed))
  [.y state]
::
++  put-dm-in
  |=  [peer=ship post=post:tp]
  ^-  feed:tf
  =/  feed  (dm-feed peer)
  (put:orm:tf feed id.post post)

::
++  set-read
  |=  [peer=ship id=(unit @da)]
  ^-  _state
  =/  chat  (dm-chat peer)
  =/  last  ?~  id  (latest-id feed.chat)  id
  =.  dms  (~(put by dms) peer chat(last-read last))
  state
::
++  peer-delivery
  |=  peer=ship
  ^-  (map @da delivery:sur)
  =/  entries  (~(get by outbox) peer)
  ?~  entries  *(map @da delivery:sur)
  u.entries
::
++  set-delivery
  |=  [peer=ship id=@da status=delivery:sur]
  ^-  _state
  =/  entries  (peer-delivery peer)
  =.  entries  (~(put by entries) id status)
  =.  outbox  (~(put by outbox) peer entries)
  state
::
++  clear-delivery
  |=  [peer=ship id=@da]
  ^-  _state
  =/  entries  (peer-delivery peer)
  =.  entries  (~(del by entries) id)
  =.  outbox
    ?:  =(0 (lent ~(tap by entries)))
      (~(del by outbox) peer)
    (~(put by outbox) peer entries)
  state
::
++  clear-outbound-request
  |=  peer=ship
  ^-  _state
  ?.  (has-outbound-request peer)
    state
  =.  dms  (~(del by dms) peer)
  =.  outbox  (~(del by outbox) peer)
  state
::
++  feed-count
  |=  peer=ship
  ^-  @ud
  (lent ~(tap by feed:(dm-chat peer)))
::
++  has-outbound-request
  |=  peer=ship
  ^-  ?
  ?&  =(1 (feed-count peer))
      !=(0 (lent ~(tap by (peer-delivery peer))))
  ==
::
++  latest-id
  |=  feed=feed:tf
  ^-  (unit @da)
  =/  latest  (pry:orm:tf feed)
  ?~  latest  ~
  `key.u.latest
::
++  wrap-post
  |=  post=post:tp
  ^-  post-wrapper:comms
  [post *nostr-meta:comms]
::
:: facts
++  summary
^-  (map ship chat-fact:sur)
  %-  ~(gas by *(map ship chat-fact:sur))
  %+  turn  ~(tap by dms)
  |=  [peer=ship chat=chat:sur]
  ^-  [ship chat-fact:sur]
    =/  msgs  (tap:orm:tf feed.chat)
    =/  unread-count  (count-unread chat)
    :: =/  unread-count  ?:  (is-muted peer)  0  (count-unread chat)
    
    =|  subset=(list [id=@da post:tp])
    =/  feed
      |-  ?~  msgs  (gas:orm:tf *feed:tf subset)
      ?:  %+  lte  3  (lent subset)  
        (gas:orm:tf *feed:tf subset)
      $(msgs t.msgs, subset [i.msgs subset])
    =/  =fc:tf  [feed ~ ~]
    =/  cf=chat-fact:sur
      [fc last-read.chat unread-count (is-muted peer) (is-blocked peer) (peer-delivery peer)]
    [peer cf]

++  peer-fact
  |=  peer=ship
  ^-  card
  =/  chat  (dm-chat peer)
  =/  fc  (dm-feed-subset [feed.chat ~ ~])
  =/  unread-count  (count-unread chat)
  =/  fact=fact:sur
    [%peer peer fc last-read.chat unread-count (is-muted peer) (is-blocked peer) (peer-delivery peer)]
  =/  peer-path  (scot %p peer)
  =/  paths=(list path)
    :~  /ui
        /dm/[peer-path]
    ==
  =/  jon  (fact:en:jsonlib fact)
  [%give %fact paths %json !>(jon)]
:: ::
++  init-fact-all
  ^-  card
  =/  fact=fact:sur  [%init summary requests policy]
  =/  jon  (fact:en:jsonlib fact)
  [%give %fact ~[/ui] %json !>(jon)]
::
++  err-fact
  |=  msg=@t
  ^-  card
  =/  fact=fact:sur  [%err msg]
  =/  jon  (fact:en:jsonlib fact)
  [%give %fact ~[/ui] %json !>(jon)]
::
++  requests-fact
  ^-  card
  =/  fact=fact:sur  [%requests requests]
  =/  jon  (fact:en:jsonlib fact)
  [%give %fact ~[/ui] %json !>(jon)]
::
++  peer-poke
  |=  [peer=ship post=post:tp]
  ^-  card
  =/  poke=poke:sur  [%recv post]
  =/  peer-path  (scot %p peer)
  =/  id-path  (scot %da id.post)
  [%pass /send/[peer-path]/[id-path] %agent [peer %noschat] %poke %noun !>(poke)]
::
++  req-poke
  |=  [peer=ship accepted=?]
  ^-  card
  =/  poke=poke:sur  [%req accepted]
  =/  peer-path  (scot %p peer)
  [%pass /req/[peer-path] %agent [peer %noschat] %poke %noun !>(poke)]
::
++  block-poke
  |=  [peer=ship msg=@t]
  ^-  card
  =/  poke=poke:sur  [%block msg]
  =/  peer-path  (scot %p peer)
  [%pass /block/[peer-path] %agent [peer %noschat] %poke %noun !>(poke)]
::
++  poke-ack
  |=  [=(pole knot) error=(unit tang)]
  ^-  [(list card) _state]
  ?+  pole  [~ state]
    [%send peer=@t id=@t ~]
      =/  who=(unit ship)  (slaw %p peer.pole)
      =/  mid=(unit @da)  (slaw %da id.pole)
      ?~  who  [~ state]
      ?~  mid  [~ state]
      =.  state
        ?~  error
          ?:  (has-outbound-request u.who)
            (set-delivery u.who u.mid %pending)
          (clear-delivery u.who u.mid)
        (set-delivery u.who u.mid %failed)
      :_  state
      :~  (peer-fact u.who)
      ==
  ==
::
++  req
  |=  accepted=?
  ~&  req-in=[src.bowl accepted]
  ^-  [(list card) _state]
  =/  peer  src.bowl
  =/  msg=@t
    ?:  accepted
      'message request accepted'
    'message request rejected'
  =.  state
    ?:  accepted
      =/  delivery  (peer-delivery peer)
      =/  ids  ~(tap by delivery)
      ?~  ids
        state
      (clear-delivery peer -.i.ids)
    (clear-outbound-request peer)
  :_  state
  :~  (peer-fact peer)
      (err-fact msg)
  ==
::
++  block-in
  |=  msg=@t
  ^-  [(list card) _state]
  =/  peer  src.bowl
  =.  muted.policy  (~(del in muted.policy) peer)
  =.  blocked.policy  (~(put in blocked.policy) peer)
  =.  requests  (~(del by requests) peer)
  =.  state  (clear-outbound-request peer)
  :_  state
  :~  requests-fact
      (peer-fact peer)
      (err-fact msg)
  ==
::
++  recv
  |=  post=post:tp
  ^-  [(list card) _state]
  ~&  noschat-recv=[src=src.bowl author=author.post host=host.post id=id.post]
  ?:  ?|  (is-blocked src.bowl)
          (is-blocked author.post)
      ==
    [~ state]
  ?.  =(author.post src.bowl)
    :_  state
    :~  (err-fact 'rejected DM with forged author')
    ==
  ?.  =(host.post author.post)
    :_  state
    :~  (err-fact 'rejected DM with unexpected host')
    ==
  ?:  (is-unknown author.post)
    =.  requests  (~(put by requests) author.post post)
    :_  state
    :~  requests-fact
    ==
  =^  added  state  (put-dm author.post post)
  :_  state
  ?.  added
    ~
  ?:  (is-muted author.post)  ~
  :~  (peer-fact author.post)
  ==
++  handle-ui
  |=  jon=json
  =/  pok=(unit ui-poke:sur)  (ui:de:jsonlib jon)
  ?~  pok  ~&  bad-ui-poke=jon  !!
  ?-  -.u.pok
    %send     (send peer.u.pok content.u.pok)
    %read     (read peer.u.pok id.u.pok)
    %mute     (mute peer.u.pok)
    %unmute   (unmute peer.u.pok)
    %block    (block peer.u.pok)
    %gtfo     (gtfo peer.u.pok msg.u.pok)
    %unblock  (unblock peer.u.pok)
    %accept   (accept peer.u.pok)
    %reject   (reject peer.u.pok)
  ==
::  helpers
++  is-unknown
  |=  peer=ship
  ^-  ?
  ?~  (~(get by dms) peer)  %.y  %.n
::
++  is-muted
  |=  peer=ship
  ^-  ?
  (~(has in muted.policy) peer)
::
++  is-blocked
  |=  peer=ship
  ^-  ?
  (~(has in blocked.policy) peer)
::
++  count-unread
  |=  c=chat:sur  ^-  @ud
  =/  bats  (bat:morm:tf feed.c last-read.c 1.000.000)
  (lent bats)

::  dbug
++  print-chats
  ~&  "yo"
  =/  chats  ~(tap by dms)
  =/  nothing
  |-  ?~  chats  ~
    =/  sip  -.i.chats
    ~&  >>  chats-with=sip
    =/  chat=chat:sur  +.i.chats
    ~&  >>  last-read=last-read.chat
    ~&  >>>  count-unread=(count-unread chat)
    =/  msgs  (tap:orm:tf feed.chat)
    ~&  >>>  (lent msgs)
    =/  nothing2
      |-  ?~  msgs  ~
        ~&  ts=-.i.msgs
        =/  p=post:tp  +.i.msgs
        =/  text  (content-map-to-md:postlib contents.p)
        ~&  >  text
      $(msgs t.msgs)
    $(chats t.chats)
  [~ state]
++  print-chat
|=  peer=@p
  =/  chat  (~(get by dms) peer)
  ?~  chat  ~&  peer="dm not found"  `state
  =/  chat  u.chat
    ~&  >>  last-read=last-read.chat
    ~&  >>>  count-unread=(count-unread chat)
    =/  msgs  (tap:orm:tf feed.chat)
    ~&  >>>  (lent msgs)
    =/  nothing2
      |-  ?~  msgs  ~
        ~&  ts=-.i.msgs
        =/  p=post:tp  +.i.msgs
        :: =/  text  (content-map-to-md:postlib contents.p)
        :: ~&  >  text
        ~&  >  contents.p
      $(msgs t.msgs)
  [~ state]

++  print-reqs
  =/  reqs  ~(tap by requests)
  ~&  req-count=(lent reqs)
  =/  nothing
  |-  ?~  reqs  ~
    =/  sip  -.i.reqs
    ~&  >>  req-from=sip
    =/  p=post:tp  +.i.reqs
    =/  text  (content-map-to-md:postlib contents.p)
    ~&  >  text
    $(reqs t.reqs)
  [~ state]
++  print-outbox
  =/  boxs  ~(tap by outbox)
  =/  nothing
  |-  ?~  boxs  ~
    =/  sip=@p  -.i.boxs
    ~&  >>  outbox-of=sip
    =/  delivery-map=(map @da delivery:sur)  +.i.boxs
    =/  posts  ~(tap by delivery-map)
    =/  nothing2
      |-  ?~  posts  ~
        ~&  ts=-.i.posts
        =/  status  +.i.posts
        ~&  status=status
      
      $(posts t.posts)
    $(boxs t.boxs)
  [~ state]
++  seed
  =/  base-ts  ~2026.01.01
  =/  rng  ~(. og eny.bowl)
  =/  peers  ~(tap in ~(key by dms))
  =^  rng  state
    %+  roll  peers
    |=  [peer=@p acc=[_rng _state]]
    ?:  .=(peer our.bowl)  [rng state]

    =/  rng  -.acc
    =/  state  +.acc
    =^  extra  rng  (rads:rng 21)
    =/  count=@ud  (add 10 extra)
    =/  msgs  (gulf 1 count)
    =/  feed  *feed:tf
    =^  rng  feed
      %+  roll  msgs
      |=  [msg-idx=@ acc=[_rng feed:tf]]
      =/  rng   -.acc
      =/  feed  +.acc
      =^  from-peer  rng  (rads:rng 2)
      =/  author=ship  ?:  =(0 from-peer)  our.bowl  peer
      =/  msg=@t
        %-  crip
        "seed dm.{(scow %ud msg-idx)} from {(scow %p author)}"
      =/  sp=sent-post:tp
        (build-sp:postlib author author msg ~ ~)
      =/  id=@da
        =/  range  (sub now.bowl base-ts)
        =^  random-time  rng  (rads:rng range)
        (add base-ts random-time)
      =/  post=post:tp
        (build-post:postlib id 0x0 sp)
      =.  feed  (put:orm:tf feed id.post post)
      [rng feed]
    ::
    =/  ids  (tap:orm:tf feed)
    =^  read-idx  rng  (rads:rng count)
    =/  last-read=(unit @da)
      ?:  .=  read-idx  count  ~
      %-  some
        =/  entry  (snag read-idx ids)
        -.entry
    ~&  [peer (lent ids)]
    =/  ndms  (~(put by dms.state) peer [feed last-read])
    =.  state  state(dms ndms)
    [rng state]
    ::
  state
::
++  seed-requests
  =.  requests  *(map ship request:sur)
  =/  base-ts  ~2026.01.01
  =/  rng  ~(. og eny.bowl)
  =^  extra  rng  (rads:rng 6)
  =/  count=@ud  (add 10 extra)
  =/  peers  (gulf 1 count)
  =^  rng  state
    %+  roll  peers
    |=  [peer-idx=@ acc=[_rng _state]]
    =/  rng  -.acc
    =/  state  +.acc
    =^  peer-atom  rng  (rads:rng (bex 32))
    =/  peer=ship  `@p`peer-atom
    =/  msg=@t
      %-  crip
      "seed request {(scow %ud peer-idx)} from {(scow %p peer)}"
    =/  sp=sent-post:tp
      (build-sp:postlib peer peer msg ~ ~)
    =/  id=@da
      =/  range  (sub now.bowl base-ts)
      =^  random-time  rng  (rads:rng range)
      (add base-ts random-time)
    =/  post=post:tp
      (build-post:postlib id 0x0 sp)
    ~&  seed-request=[peer id.post]
    =.  requests  (~(put by requests.state) peer post)
    =.  state  state(requests requests)
    [rng state]
    ::
  state
--
