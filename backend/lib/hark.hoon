/-  wrap, hark, noti=nostrill-notif, comms=nostrill-comms
/+  lib=nostrill, sr=sortug
|%
++  to-hark
  |=  [n=notif:noti =bowl:gall]  ^-  yarn:hark
  =/  id=@uvH  (sham n)
  =/  var=[(list content:hark) path]
  ?-  -.n
    %prof
      =/  ship  (user-to-atom:lib user.n)
      :-  :~([%ship ship] 'Changed his profile')  /prof/(scot %p ship)
    %req
      =/  ship  (user-to-atom:lib user.n)
      =/  ship-token  [%ship ship]
      =/  req  p.p.n
      ?@  req  ::  follow
        ?~  solved.n
          :-  :~  ship-token
                  'tried to follow you. Your decision is pending'
                  'He left the following request message: '
                   msg.p.n
              ==
              /req/fols/(scot %p ship)/maybe
        ::
        ?.  approved.u.solved.n
          :-  :~  ship-token
                  'Tried to follow you but you rejected his request'
              ==
              /req/fols/(scot %p ship)/ng
        ::
          :-  :~  ship-token
                  'Followed you'
              ==
              /req/fols/(scot %p ship)/ok
      ::  begs
      =/  beg=beg-type:comms  +.req
      ?@  beg  ::  %feed
        ?~  solved.n
          :-  :~  ship-token
                  'Requested access to your feed. Your decision is pending.'
                  'He left the following request message: '
                   msg.p.n
              ==
              /req/begs/feed/(scot %p ship)/maybe
        ::
          ?.  approved.u.solved.n
            :-  :~  ship-token
                  'Requested access to your feed but you rejected his request'
              ==
              /req/begs/feed/(scot %p ship)/ng
          ::
            :-  :~  ship-token
                  'Requested and was granted one-time access to your feed'
              ==
              /req/begs/feed/(scot %p ship)/ok
      ::  %thread
        =/  ids  (scot %ud `@`id.beg)
        ?~  solved.n
          :-  :~  ship-token
                  'Requested access to your thread with id: '
                  ids
                  'Your decision is pending.'
                  'He left the following request message: '
                   msg.p.n
              ==
              /req/begs/thread/(scot %p ship)/[ids]/maybe
        ::
          ?.  approved.u.solved.n
            :-  :~  ship-token
                    'Requested access to your thread with id: '
                    ids
                    ', but you rejected his request'
                ==
                /req/begs/thread/(scot %p ship)/[ids]/ng
          ::
            :-  :~  ship-token
                    'Requested and was granted one-time access to your thread with id: '
                    ids
                ==
                /req/begs/thread/(scot %p ship)/[ids]/ok

    %fol-res
      =/  ship  (user-to-atom:lib user.n)
      =/  ship-token  [%ship ship]
      =/  res=fols-res:comms  p.n
      ?@  p.res  ::  thinking
        :-  :~  ship-token
              ' received your follow request, but hasn\'t responded yet.'
            ==
            /res/fols/(scot %p ship)/maybe
      ?^  +.p.res  ::  approved
        :-  :~  ship-token
              ' accepted your follow request.'
            ==
            /res/fols/(scot %p ship)/ok
      ::
        :-  :~  ship-token
              ' rejected your follow request.'
            ==
            /res/fols/(scot %p ship)/ng
    %beg-res
      =/  ship  (user-to-atom:lib user.n)
      =/  ship-token  [%ship ship]
      =/  res=res:comms  p.n
      ?-  -.res
        %feed
          ?@  p.+.res
            :-  :~  ship-token
                    ' received your request to access his feed, but hasn\'t responded yet.'
                ==
                /res/begs/feed/(scot %p ship)/maybe
          ?^  +.p.+.res
            :-  :~  ship-token
                    ' accepted your request to access his feed'
                ==
                /res/begs/feed/(scot %p ship)/ok
          ::
            :-  :~  ship-token
                    ' rejected your request to access his feed'
                ==
                /res/begs/feed/(scot %p ship)/ng
        %thread
          =/  ids  (scot %ud `@ud`id.res)
         ?@  p.+.res
         :-  :~  ship-token
                 ' received your request to access his thread of id: '
                 ids
                 ' but hasn\'t responded yet.'
             ==
             /res/begs/thread/(scot %p ship)/[ids]/maybe
       ?^  +.p.+.res
         :-  :~  ship-token
                 ' accepted your request to access his thread of id:'
                 ids
             ==
             /res/begs/thread/(scot %p ship)/[ids]/ok
       :: ::
         :-  :~  ship-token
                 ' rejected your request to access his thread of id:'
                 ids
             ==
             /res/begs/thread/(scot %p ship)/[ids]/ng
        ==
    %post
      =/  ship  (user-to-atom:lib user.n)
      =/  ship-token  [%ship ship]

      =/  a=engagement:comms  +>+.n
      :: =/  ids  (scot %ud `@`id.pid.n)
      :: =/  hosts  (scot %p ship.pid.n)
      :: =/  pids  %-  spat  /[hosts]/[ids]
      ?-  -.a
        %mention
          =/  host  host.post.a
          =/  ids    (scot %ud `@`id.post.a)
          =/  hosts  (scot %p host)
          =/  pids  (spat /[hosts]/[ids])
          :: TODO show some text of the mention
          :-  :~(ship-token 'Mentioned you in post:' pids)     /post/mention/(scot %p ship)/[hosts]/[ids]
        %reply
          =/  host  host.child.a
          =/  parents  (scot %ud `@`parent.a)
          =/  ids    (scot %ud `@`id.child.a)
          =/  hosts  (scot %p host)
          =/  parent-pids  (spat /[hosts]/[parents])
          :-  :~(ship-token 'Replied to post:' parent-pids)     /post/reply/(scot %p ship)/[hosts]/[parents]/[ids]
        %quote
          =/  host  host.post.a
          =/  parents  (scot %ud `@`src.a)
          =/  ids    (scot %ud `@`id.post.a)
          =/  hosts  (scot %p host)
          =/  parent-pids  (spat /[hosts]/[parents])
          :: TODO show some text of the quote 
          :-  :~([%ship ship] 'Quoted the post:' parent-pids)     /post/quote/(scot %p ship)/[parents]/[hosts]/[ids]
        %rp
          =/  hostpath=path  (user-to-path:lib -.src.a)
          =/  sid    (scot %ud `@`+.src.a)
          =/  ids    (scot %ud `@`target.a)
          =/  pat  (weld hostpath /[sid]/[ids])
          =/  pidpath=path  (weld hostpath /[sid])
          =/  pids  (spat pidpath)
          :-  :~([%ship ship] 'Reposted the post:' pids)
              (weld /post/rp/(scot %p ship) pat)
        %del-reply
          =/  hostpath=path  (user-to-path:lib -.parent.a)
          =/  sid    (scot %ud `@`+.parent.a)
          =/  pidpath=path  (weld hostpath /[sid])
          =/  parents  (spat pidpath)
          =/  ids    (scot %ud `@`child.a)
          =/  pat  (weld hostpath /[sid]/[ids])
          :-  :~([%ship ship] 'Deleted his reply on:' parents)
              (weld /post/del-reply/(scot %p ship) pat)
        %del-quote
          =/  hostpath=path  (user-to-path:lib -.src.a)
          =/  sid    (scot %ud `@`+.src.a)
          =/  ids    (scot %ud `@`quote.a)
          =/  pidpath=path  (weld hostpath /[sid])
          =/  parents  (spat pidpath)
          =/  pat  (weld hostpath /[sid]/[ids])
          :-  :~([%ship ship] 'Deleted his quote of:' parents)
              (weld /post/del-quote/(scot %p ship)/[parents] pat)
        %reaction
          =/  hostpath=path  (user-to-path:lib -.pid.a)
          =/  sid    (scot %ud `@`+.pid.a)
          =/  pat  (weld hostpath /[sid])
          =/  pids  (spat pat)
          :-  :~([%ship ship] 'Reacted to post:' pids reaction.a)
              (weld /post/react/(scot %p ship) pat)
      ==
      %nostr
        ?-  +<.n
          %relay-down
          :-  :~('The relay: ' url.n 'closed the websockets connection. Try to reconnect in the settings page.')
            /nostr/relay-down/[url.n]
          %new-relay
          :-  :~('A new relay has become available: ' url.n 'Try it out some time. You can add it to the settings page.')
            /nostr/new-relay/[url.n]
          %keys
          =/  ship  (user-to-atom:lib user.n)
          =/  ship-token  [%ship ship]
          =/  pubkey  (crip (scow:sr %ux pubkey.n))
          :-  :~  ship-token
                 ' has changed his Nostr pubkey. The new value is: '
                pubkey
              ==
              /nostr/keys/(scot %p ship)/[pubkey]
        ==
      
  ==
  =/  pat=path  (weld +.var /(scot %da now.bowl))
  =/  =rope:hark    [~ ~ dap.bowl pat]
  [id rope now.bowl -.var pat ~]
::
++  poke-hark
  |=  [=yarn:hark =bowl:gall]  ^-  card:agent:gall
  =/  h=action:hark  [%add-yarn .n .y yarn]
  =/  poke  [%pass /harrk %agent [our.bowl %hark] %poke %hark-action !>(h)]
  poke
::
++  send-hark
  |=  [n=notif:noti =bowl:gall]  ^-  card:agent:gall
  =/  y  (to-hark n bowl)
  (poke-hark y bowl)

  
++  clear-hark  |=  =bowl:gall
  =/  h=action:hark  [%saw-seam %desk %nostrill]
  [%pass /harrk %agent [our.bowl %hark] %poke %hark-action !>(h)]
  

:: |=  f=engagement:hark
:: =/  id      (end 7 (shas %trill-hark eny.bowl))
:: =/  pat-id  /[-.f]/(scot %da now.bowl)
:: =/  rope    [~ ~ q.byk.bowl pat-id]
:: =/  body  
:: ?+  -.f  ~
:: %reply  
:: :~([%ship ship.f] ' replied to you on Trill')
:: %quote 
:: :~([%ship ship.f] ' quoted you on Trill')
:: %share  
:: :~([%ship ship.f] ' RT\'d a post of yours on Trill')
:: %mention  
:: :~([%ship ship.f] ' mentioned you on Trill')
:: %react    
:: :~([%ship ship.f] ' reacted to a post of yours on Trill')
:: %follow   
:: :~([%ship ship.f] ' followed you on Trill')
:: %unfollow 
:: :~([%ship ship.f] ' unfollowed you on Trill')
:: ==
:: =/  a  [%add-yarn & & id rope now.bowl body /apps/trill ~]
:: =/  =cage  [%hark-action !>(a)]
:: [%pass /hark %agent [our.bowl %hark] %poke cage]
--
