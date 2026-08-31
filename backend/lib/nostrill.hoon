/-  sur=nostrill, nsur=nostr, comms=nostrill-comms, ui=nostrill-ui,
    post=trill-post, gate=trill-gate
/+  nostr-keys, sr=sortug,
    jsonlib=json-nostrill,
    ws=websockets
|%
::
++  default-state  |=  =bowl:gall  ^-  state:sur
  =/  s  *state:sur
  =/  key  (gen-keys:nostr-keys eny.bowl)
  s(keys [key ~])

++  print-relay-stats
  |=  rm=(map @ relay-stats:nsur)
  =/  l  ~(tap by rm)
  |-  ?~  l  ~
    =/  [wid=@ rs=relay-stats:nsur]  i.l
    ~&  relay-url=url.rs
    ~&  connected=start.rs
    ~&  sub-count=~(wyt by reqs.rs)
    =/  total-received
      %+  roll  ~(tap by reqs.rs)
        |=  [[* rs=req-state:nsur] acc=@ud]
          %+  add  acc  received.rs
    ~&  >>  total=total-received  
    $(l t.l)
  
++  ui-ws-res  |=  [wid=@ msg=@t]
  
  =/  octs  (as-octs:mimes:html msg)
  =/  res-event=websocket-event:eyre  [%message 1 `octs]
  :~  (give-ws-payload-server:ws wid res-event)
  ==

++  user-to-path  |=  u=user:sur  ^-  path
  ?-  -.u
    %urbit  /urbit/(scot %p +.u)
    %nostr  /nostr/(crip (scow:sr %ux +.u))
  ==
++  user-to-atom  |=  u=user:sur  ^-  @
  ?-  -.u
    %urbit  +.u
    %nostr  +.u
  ==
++  cord-to-user  |=  c=@t  ^-  (unit user:sur)
    =/  upk  (slaw:sr %ux c)
    ?~  upk 
      ::  not hex
      =/  up  (slaw %p c)
      ::  not @p either
      ?~  up  ~
      ::  yes @p, not hex
      `[%urbit u.up]
      ::  yes hex
    ?.  (validate-pubkey:nostr-keys u.upk)  ~
    `[%nostr u.upk]


++  atom-to-user  |=  p=@  ^-  u=user:sur
  ?:  (validate-pubkey:nostr-keys p)
    [%nostr p]  
    [%urbit p]

++  make-wfeed
  |=  =sourced-feeds:nsur  ^-  wfeed:nsur
    =/  w  *wfeed:nsur
    =/  l  ~(tap by sourced-feeds)
    |-  ?~  l  w
      =/  url=@t  -.i.l
      =/  sf=sourced-feed:nsur  +.i.l
      =/  f=nostr-feed:nsur  feed.sf
      =/  posts=(list [@ud event:nsur])  (tap:norm:nsur f)
      =/  nw
        |-  ?~  posts  w
        =/  =event:nsur  +.i.posts
          =/  exists  (get:worm:nsur w created-at.event)
          =/  relays  ?~  exists  ~[url]
            [url relays.u.exists]
          =/  wev=wevent:nsur  [relays event]
          =.  w  (put:worm:nsur w created-at.event wev)
          $(posts t.posts)
        $(l t.l, w nw)
::

++  cards
|_  =bowl:gall
  ++  init  ^-  (list card:agent:gall)
    bindings
  ++  relay-binding  ^-  card:agent:gall
    [%pass /binding %arvo %e %connect [~ /nostrill] dap.bowl]
  ++  ui-binding  ^-  card:agent:gall
    [%pass /binding %arvo %e %connect [~ /nostrill-ui] dap.bowl]
  ++  bindings
    :~  relay-binding
        ui-binding
    ==
  ++  update-ui  |=  =fact:ui  ^-  card:agent:gall
    =/  jon  (fact:en:jsonlib fact)
    [%give %fact ~[/ui] %json !>(jon)]
  :: ++  update-followers  |=  =fact:comms  ^-  card:agent:gall
  ++  update-followers  |=  =fact:comms  ^-  card:agent:gall
    [%give %fact ~[/follow] %noun !>(fact)]
  ::
  ++  poke-host  |=  [sip=@p =poke:comms]  ^-  card:agent:gall
    [%pass /heads-up %agent [sip dap.bowl] %poke %noun !>(poke)]

  ++  poke-ui-thread  |=  [tid=@ta sub-id=@t]  ^-  card:agent:gall
    =/  ta-now  (scot %ud `@`now.bowl)
    =/  payload=ted:ui  [%res sub-id]
    [%pass /ted-res/[ta-now] %agent [our.bowl %spider] %poke %spider-input !>([tid %nostrill-ted !>(payload)])]
  --
--
