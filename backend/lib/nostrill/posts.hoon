::  nostrill-posts: post/engagement engine for %nostrill
::
/-  sur=nostrill, nsur=nostr, comms=nostrill-comms, ui=nostrill-ui, notif=nostrill-notif,
    post=trill-post, feed=trill-feed, gate=trill-gate
/+  lib=nostrill,
    harklib=hark,
    feedlib=trill-feed,
    postlib=trill-post,
    gatelib=trill-gate,
    sr=sortug,
    constants,
    nostrill-relay,
    nostr-client,
    evlib=nostr-events

|_  [=state:sur =bowl:gall]
+$  card  card:agent:gall
::  +reply-gate: write-perms for a new post from the composer's
::    reply policy. a locked ship sublock is a whitelist; our own
::    ship is always allowed
::
++  reply-gate
  |=  [policy=reply-policy:ui mentions=(list @p)]
  ^-  gate:gate
  =|  g=gate:gate
  ?-  policy
    %everyone  g
    %following
      =/  ships
        %+  murn  ~(tap by following.state)
        |=  [u=user:sur *]
        ^-  (unit @p)
        ?.  ?=(%urbit -.u)  ~
        `+.u
      g(ship.lock [(silt [our.bowl ships]) & &])
    %mentioned
      g(ship.lock [(silt [our.bowl mentions]) & &])
  ==
++  wrap-post  |=  p=post:post  ^-  post-wrapper:comms
  =/  pubkey  ?:  .=(author.p our.bowl)  pub.i.keys.state  0x0
  =/  user  (atom-to-user:lib author.p)
  =/  profile  (~(get by profiles.state) user)
  [p pubkey profile ~ ~]

  
:: state
++  add-to-feed  |=  p=post:post
  ?:  .=(our.bowl host.p)
    =.  feed.state  (put:orm:feed feed.state id.p p)
    state
    ::
    =/  host  (atom-to-user:lib host.p)
    =/  uf  (~(get by following.state) host)
    ?~  uf  state
    =/  nf  (put:orm:feed u.uf id.p p)
    =.  following.state  (~(put by following.state) host nf)
    =/  =upid:sur  [host id.p]
    =.  timeline.state  (put:uorm:sur timeline.state upid p)
    state
++  add-reply  |=  p=post:post  ^+  state
    ?~  parent.p  ~&  ["not a reply!!" p]  !!
    ?:  .=(our.bowl host.p)
      =/  parent  (get:orm:feed feed.state u.parent.p)
      ?~  parent  ~&  ["op not found!!" p]  !!
      =.  children.u.parent  (~(put in children.u.parent) id.p)
      =.  feed.state  (put:orm:feed feed.state id.u.parent u.parent)
      =.  feed.state  (put:orm:feed feed.state id.p p)
      state
      ::
      =/  host  (atom-to-user:lib host.p)
      =/  uf  (~(get by following.state) host)
      ?~  uf  state
      =/  parent  (get:orm:feed u.uf u.parent.p)
      ?~  parent  ~&  ["op not found!!" p]  !!
      =.  children.u.parent  (~(put in children.u.parent) id.p)
      =/  nf  (put:orm:feed u.uf id.u.parent u.parent)
      =/  nf  (put:orm:feed nf id.p p)
      =.  following.state  (~(put by following.state) host nf)

      =/  ppid=upid:sur  [host id.u.parent]      
      =.  timeline.state  (put:uorm:sur timeline.state ppid u.parent)
      =/  =upid:sur  [host id.p]
      =.  timeline.state  (put:uorm:sur timeline.state upid p)
      state

++  del-from-feed  |=  p=post:post
  ?:  .=(our.bowl host.p)
    =.  feed.state  (delete-with-children:feedlib feed.state p)
    state
    ::
    =/  host  (atom-to-user:lib host.p)
    =/  uf  (~(get by following.state) host)
    ?~  uf  state
    =/  nf  (delete-with-children:feedlib u.uf p)
    =.  following.state  (~(put by following.state) host nf)
    =.  timeline.state  (delete-from-global:feedlib timeline.state p)
    state

      
    
  
++  headsup-poke
  |=  [poke=post-poke:ui p=post:post]  ^-  engagement:comms
  ?-  -.poke
    %add  !!
    %reply     [%reply id.poke p]
    %quote     [%quote id.poke p]
    %rp        [%rp [host.poke id.poke] id.p]
    %del       [%del-reply [host.poke id.poke] id.p]
    %reaction  [%reaction [host.poke id.poke] reaction.poke]
    %del-reaction  [%del-reaction [host.poke id.poke]]
  ==
::
++  handle-post  |=  poke=post-poke:ui
  ^-  (quip card _state)
  |^
  =/  profile  (~(get by profiles.state) [%urbit our.bowl])
  =/  pubkey  pub.i.keys.state
  =/  crds  ~(. cards:lib bowl)
  ::  TODO UI notifications  [%hark ]
    ?-  -.poke
      %del  
        ?-  -.host.poke  
            %nostr  `state
            ::
            %urbit
          =/  host=@p  +.host.poke
          ?.  .=(our.bowl host)
            ?~  pos=(get:orm:feed feed.state id.poke)
              ::  case: del our reply when host isn't our.bowl
              =/  eng-card  (poke-host:crds host [%eng [%del-reply [host.poke *@da] id.poke]])
              :_  state
              :~  eng-card
              ==
            =/  p  u.pos
            ?~  parent.p
              ?~  is-ref=(get-ref:postlib p)
                ~&  >>>  'unexpected post structure'
                `state
              =.  feed.state  =<  +  (del:orm:feed feed.state id.poke)
              =/  ref=[ship @da]  u.is-ref
              =/  eng-poke  (headsup-poke [%rp host.poke +.ref] p)
              =/  eng-card  (poke-host:crds `@p`-.ref [%eng eng-poke])
              =/  f   [%post %del (wrap-post p)]
              ::  case: delete rp
              :_  state
              :~  (update-followers:cards:lib f)
                  (update-ui:cards:lib f)
                  eng-card
              ==
            ~&  >>>  'unexpected post structure'
            `state
            ::
          ?~  pos=(get:orm:feed feed.state id.poke)  `state
          =/  p  u.pos
          =.  feed.state  =<  +  (del:orm:feed feed.state id.poke)
          =.  feed.state  (delete-nested-children:feedlib feed.state p)
          =/  f  [%post %del (wrap-post p)]
          =/  cards=(list card)
            :~  (update-followers:cards:lib f)
                (update-ui:cards:lib f)
            ==
          =/  is-ref=(unit [ship @da])  (get-ref:postlib p)
          ?~  is-ref  
            ?~  parent.p  
              ::  case: delete our post
              [cards state]
            ?~  poast=(get:orm:feed feed.state u.parent.p)
              ~&  >>>  %parent-missing
              [cards state]
            ::  case: delete our reply to our post
            =.  children.u.poast  (~(del in children.u.poast) id.p)
            =.  feed.state  (put:orm:feed feed.state u.parent.p u.poast)
            =/  f   [%post %upd (wrap-post u.poast)]
            :_  state
            %+  welp  cards
            :~
              (update-followers:cards:lib f)
              (update-ui:cards:lib f)
            ==
          ::  case: delete quote or repost. a repost is a lone ref block, a
          ::  quote has text around its ref. a repost has to untoggle the
          ::  host's shared set (the %rp headsup, as in the non-our-host
          ::  branch); sending %del-quote left it in shared forever
          =/  ref=[ship @da]  u.is-ref
          =/  is-rp=?
            ?=([[%ref *] ~] (latest-post-content:postlib contents.p))
          =/  eng-poke
            ?:  is-rp  [%eng (headsup-poke [%rp host.poke +.ref] p)]
            [%eng [%del-quote [urbit+our.bowl +.ref] id.p]]
          :_  state
          %+  snoc  cards
          (poke-host:crds `@p`-.ref eng-poke)
        ==
      %add
        =/  sp     (build-sp:postlib our.bowl our.bowl content.poke ~ ~)
        =/  p=post:post
          (build-post:postlib now.bowl pubkey sp)
        ::  mentions come from the raw text: the markdown parser
        ::  consumes sigs, so patps are gone after tokenising
        =/  mentions
          (extract-mentions:postlib content.poke (silt ~[our.bowl]))
        =.  write.perms.p  (reply-gate reply.poke mentions)
        =.  state  (add-to-feed p)
        =/  pw  (wrap-post p)
        =/  fact  [%post %add pw]
        =/  ui-card    (update-ui:cards:lib fact)
        =/  fact-card  (update-followers:cards:lib fact)

        =/  mention-cards  %+  turn  mentions  |=  s=@p
          %+  poke-host:crds  s  [%eng %mention p]
        =/  global-cards=(list card:agent:gall)  ?.  global.poke  ~

          =/  nclient  ~(. nostr-client [state bowl])
          =/  tag=(list @t)  :~('patp' (scot %p our.bowl))
          =/  tags  :~(tag)
          =/  event  (post-to-event:evlib i.keys.state eny.bowl p 667 tags)
          =/  relay-card  (send-card:global:nclient [%event event])
          =/  ui-fact  [%nostr %sent-post host.p id.p ~[global-relay:constants] event]
          :~  (update-ui:cards:lib ui-fact)
              relay-card
          ==
        
        :: TODO anon feed
        :_  state
          %+  weld  global-cards  %+  weld  mention-cards
          :~  ui-card
              fact-card
          ==
      %quote
        =/  quote  ?-  -.host.poke
          %urbit  [%ref %trill +.host.poke /(crip (scow:sr %ud id.poke))]
          %nostr  [%ref %nostr `@p`+.host.poke /(crip (scow:sr %ud id.poke))]
          ==
        =/  host  (user-to-atom:lib host.poke)
        =/  sp     (build-sp:postlib our.bowl our.bowl content.poke ~ ~)
        =.  contents.sp  (snoc contents.sp quote)
        =/  p=post:post
          (build-post:postlib now.bowl pubkey sp)
        =.  state  (add-to-feed p)
        =/  pw  (wrap-post p)
        =/  fact  [%post %add pw]
        =/  ui-card    (update-ui:cards:lib fact)
        =/  fact-card  (update-followers:cards:lib fact)
        ?-  -.host.poke  
          %nostr
            ::  TODO: %quote nostr case
            :_  state
            :~  ui-card
                fact-card
            ==
          %urbit
            =/  eng-poke  [%eng (headsup-poke poke p)]
            =/  eng-card  (poke-host:crds +.host.poke eng-poke)
            =/  mentions
              %+  extract-mentions:postlib  content.poke
              (silt ~[host.p author.p])
            =/  mention-cards  %+  turn  mentions  |=  s=@p
              %+  poke-host:crds  s  [%eng %mention p]
            :_  state
              %+  weld  mention-cards
              :~  ui-card
                  fact-card
                  eng-card
              ==
        ==
      %reply
        ?:  ?=(%nostr -.host.poke)  
          =/  nrelay  ~(. nostrill-relay [state bowl])
          =/  rl  get-relay:nrelay
          ?~  rl  ~&  >>>  "no relay!"  `state
          =/  wid=@  -.u.rl
          =/  relay=relay-stats:nsur  +.u.rl
          =/  nclient  ~(. nostr-client [state bowl])
          =/  rclient  ~(. relay.nclient [wid relay])
          :: TODO look at that kind logic
          =/  ev  (build-event:evlib i.keys.state eny.bowl now.bowl content.poke 1)
          =/  parent-id  (crip (scow:parsing:sr %ux id.poke))
          =/  reply-tag=(list @t)  ['e' parent-id url.relay 'reply' ~]
          =.  tags.ev  ~[reply-tag]
          :_  state
          :~  (send-card:rclient [%event ev])
          ==
        ::
        =/  host  (user-to-atom:lib host.poke)
        =/  sp     (build-sp:postlib host our.bowl content.poke `id.poke `thread.poke)
        =/  p=post:post
          (build-post:postlib now.bowl pubkey sp)
        =.  state  (add-reply p)
        =/  pw  (wrap-post p)
        =/  fact  [%post %add pw]
        =/  ui-card    (update-ui:cards:lib fact)
        =/  fact-card  (update-followers:cards:lib fact)
        =/  eng-poke  [%eng (headsup-poke poke p)]
        =/  eng-card  (poke-host:crds host.p eng-poke)

        =/  mentions
          %+  extract-mentions:postlib  content.poke
          (silt ~[host.p author.p])
        =/  mention-cards  %+  turn  mentions  |=  s=@p
          %+  poke-host:crds  s  [%eng %mention p]
        
        :_  state
          %+  weld  mention-cards
          :~  ui-card
              fact-card
              eng-card
          ==
      %rp
        =/  host  (user-to-atom:lib host.poke)
        =/  quote  [%ref %trill host /(crip (scow:sr %ud id.poke))]
        =/  sp     (build-sp:postlib host our.bowl '' ~ ~)
        =.  contents.sp  ~[quote]
        =/  p=post:post
          (build-post:postlib now.bowl pubkey sp)
        =.  feed.state  (put:orm:feed feed.state id.p p)
        =/  pw  (wrap-post p)
        =/  fact  [%post %add pw]
        =/  ui-card    (update-ui:cards:lib fact)
        =/  fact-card  (update-followers:cards:lib fact)
        ?-  -.host.poke
          %nostr
            ::  TODO: %rp nostr case
            :_  state 
            :~  ui-card
                fact-card
            ==
          %urbit
            =/  eng-poke  [%eng (headsup-poke poke p)]
            =/  eng-card  (poke-host:crds +.host.poke eng-poke)
            :_  state
              :~  ui-card
                  fact-card
                  eng-card
              ==
        ==
      %reaction
        =/  host  (user-to-atom:lib host.poke)
        ?:  .=(host our.bowl)
          =/  p  (got:orm:feed feed.state id.poke)
          =.  reacts.engagement.p  %+  ~(put by reacts.engagement.p)
            our.bowl  [reaction.poke *signature:post]
          =.  state  (add-to-feed p)
          =/  pw  (wrap-post p)
          =/  fact  [%post %add pw]
          =/  fact-card  (update-followers:cards:lib fact)
          =/  ui-card    (update-ui:cards:lib fact)
          =/  eng-poke  [%eng (headsup-poke poke p)]
          =/  eng-card  (poke-host:crds host eng-poke)

          :_  state
            :~  ui-card
                fact-card
                eng-card
            ==
            ::
            =/  default-eng  [%eng (headsup-poke poke *post:post)]
            :: TODO we kinda should use timeline for this
            :: If we have the relevant post in our state somewhere we want to update the UI too. Else we just send the headsup poke to the post host
          :: =/  up  (get:orm:feed timeline.state id.poke)
            =/  uf  (~(get by following.state) host.poke)
            ?~  uf  :_  state  :~((poke-host:crds host default-eng))
            =/  up  (get:orm:feed u.uf id.poke)
            ?~  up  :_  state  :~((poke-host:crds host default-eng))
            =/  p  u.up 
            =.  reacts.engagement.p  %+  ~(put by reacts.engagement.p)
              our.bowl  [reaction.poke *signature:post]
            =.  state  (add-to-feed p)
            =/  pw  (wrap-post p)
            =/  fact  [%post %add pw]
            =/  ui-card    (update-ui:cards:lib fact)
            =/  eng-poke  [%eng (headsup-poke poke p)]
            =/  eng-card  (poke-host:crds host.p eng-poke)
            :_  state
              :~  ui-card
                  eng-card
              ==
      ::  mirrors %reaction: drop our react locally where we hold the post,
      ::  and tell the host so it drops it from the canonical copy
      %del-reaction
        =/  host  (user-to-atom:lib host.poke)
        =/  eng-poke  [%eng (headsup-poke poke *post:post)]
        =/  eng-card  (poke-host:crds host eng-poke)
        =/  fed=(unit feed:feed)
          ?:  .=(host our.bowl)  `feed.state
          (~(get by following.state) host.poke)
        ?~  fed  :_  state  :~(eng-card)
        =/  up  (get:orm:feed u.fed id.poke)
        ?~  up  :_  state  :~(eng-card)
        =/  p  u.up
        =.  reacts.engagement.p  (~(del by reacts.engagement.p) our.bowl)
        =.  state  (add-to-feed p)
        =/  fact  [%post %add (wrap-post p)]
        =/  cards=(list card)
          :~  (update-ui:cards:lib fact)
              eng-card
          ==
        :_  state
        ?.  .=(host our.bowl)  cards
        [(update-followers:cards:lib fact) cards]
    ==
  --


  ++  handle-eng
    |=  e=engagement:comms
    ^-  (quip card:agent:gall _state)
    =/  user  [%urbit src.bowl]
    =/  n=notif:notif  [%post [user now.bowl e]]
    =/  hark-card=card:agent:gall  (send-hark:harklib n bowl)
    =/  cards  :~(hark-card)
    ::  We send the notification always.
    ::  Only update state if we are the host. Else we wait for the fact from the actual host
    ?-  -.e
      %mention  [cards state]
      %reply
        =/  poast  (get:orm:feed feed.state parent.e)
        ?~  poast  ~&  "parent of reply doesnt exist"  [cards state]
        ::  enforce the parent post's write perms (reply policy)
        ?.  (can-access:gatelib src.bowl write.perms.u.poast '' bowl)
          ~&  >>>  reply-denied=[src.bowl parent.e]
          `state
        =.  state  (add-reply child.e)
        ::  now the parent should be updated 
        =/  poast  (get:orm:feed feed.state parent.e)
        ?~  poast  ~&  "parent of reply doesnt exist"  [cards state]
        =/  f   [%post %add (wrap-post child.e)]
        =/  f2  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib f)
            (update-followers:cards:lib f2)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
            hark-card
        ==
      %quote
        =/  poast  (get:orm:feed feed.state src.e)
        ?~  poast  [cards state]
        ::
        =/  pid  [our.bowl src.e]
        =/  spid  [*signature:post src.bowl id.post.e]
        =.  quoted.engagement.u.poast  (~(put in quoted.engagement.u.poast) spid)
        =.  state  (add-to-feed u.poast)
        =/  f  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
            hark-card
        ==
      %rp
        =/  poast  (get:orm:feed feed.state id.src.e)
        ?~  poast  [cards state]
        =/  pid  [our.bowl src.e]
        =/  spid  [*signature:post src.bowl target.e]
        =.  shared.engagement.u.poast  
          ?:  (~(has in shared.engagement.u.poast) spid)
            (~(del in shared.engagement.u.poast) spid)
          (~(put in shared.engagement.u.poast) spid)
        =.  state  (add-to-feed u.poast)
        =/  f  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
            hark-card
        ==
      %reaction
        =/  poast  (get:orm:feed feed.state id.pid.e)
        ?~  poast  [cards state]
        :: TODO signatures et al.
        =/  pid  [our.bowl id.pid.e]
        =/  sign  *signature:post
        =.  q.sign  src.bowl
        =.  reacts.engagement.u.poast  (~(put by reacts.engagement.u.poast) src.bowl [reaction.e sign])
        =.  state  (add-to-feed u.poast)
        =/  f  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
            hark-card
        ==
      ::  someone reported one of our posts: just notify, if it's ours
      %report
        ?~  p=(get:orm:feed feed.state id.pid.e)  `state
        [cards state]
      ::  no notification for taking a reaction back
      %del-reaction
        =/  poast  (get:orm:feed feed.state id.pid.e)
        ?~  poast  `state
        ?.  (~(has by reacts.engagement.u.poast) src.bowl)  `state
        =.  reacts.engagement.u.poast
          (~(del by reacts.engagement.u.poast) src.bowl)
        =.  state  (add-to-feed u.poast)
        =/  f  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
        ==
      %del-reply
        ?~  p=(get:orm:feed feed.state child.e)  `state
        ?.  .=(src.bowl author.u.p)  `state
        ?~  parent.u.p  `state
        =/  poast  (get:orm:feed feed.state u.parent.u.p)
        ?~  poast  `state
        (handle-post [%del urbit+our.bowl child.e])
      %del-quote
        =/  poast  (get:orm:feed feed.state id.src.e)
        ?~  poast  [cards state]
        ::
        =/  pid  [our.bowl src.e]

        =/  spid  [*signature:post src.bowl quote.e]
        =.  quoted.engagement.u.poast  (~(del in quoted.engagement.u.poast) spid)
        =.  state  (add-to-feed u.poast)
        =/  f  [%post %upd (wrap-post u.poast)]
        :_  state
        :~  (update-followers:cards:lib f)
            (update-ui:cards:lib [%post %add (wrap-post u.poast)])
            hark-card
        ==
    ==







++  handle-post-fact  |=  pf=post-fact:comms
  ^-  (quip card _state)
  ?-  -.pf
    %add  :_  (add-to-feed post.pf)
          :~  (update-ui:cards:lib [%post pf])  
          ==
    %upd  :_  (add-to-feed post.pf)
          :~  (update-ui:cards:lib [%post pf])  
          ==
    %del  :_  (del-from-feed post.pf)
          :~  (update-ui:cards:lib [%post pf])  
          ==
  ==
--
