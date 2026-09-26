::  nostrill-follows: follow/unfollow engine
::
/-  sur=nostrill, comms=nostrill-comms, ui=nostrill-ui, notif=nostrill-notif
/+  lib=nostrill, harklib=hark, feedlib=trill-feed, scri
|_  [=state:sur =bowl:gall]
::  +push-profile: our follows changed, so refresh the follow fields of
::  our profile and send it to our followers, whose copies back their
::  "who to follow" suggestions
::
++  push-profile
  ^-  (quip card:agent:gall _state)
  =/  fresh  ~(default-profile scri [state bowl])
  =/  cur  (~(get by profiles.state) [%urbit our.bowl])
  =/  prof=user-profile:comms
    ?~  cur  fresh
    %=  u.cur
      following        following.fresh
      following-count  following-count.fresh
      followers        followers.fresh
      follower-count   follower-count.fresh
    ==
  =?  profiles.state  ?=(^ cur)
    (~(put by profiles.state) [%urbit our.bowl] prof)
  :_  state
  :~  (update-followers:cards:lib [%prof `prof])
  ==
::
++  handle-add
  |=  =user:sur
  ^-  (quip card:agent:gall _state)
  ?-  -.user
    %urbit  :_  state
            :~  (urbit-watch +.user)
            ==
    ::  TODO subscribe to the user's posts through a relay
    %nostr  `state
  ==
::
++  handle-del
  |=  =user:sur
  ^-  (quip card:agent:gall _state)
  =.  following.state  (~(del by following.state) user)
  =/  graph  (~(get by follow-graph.state) [%urbit our.bowl])
  ?~  graph  `state
  =/  nset  (~(del in u.graph) user)
  =.  follow-graph.state  (~(put by follow-graph.state) [%urbit our.bowl] nset)
  =/  =fact:ui  [%fols %quit user]
  =/  c1  (update-ui:cards:lib fact)
  =^  pcs  state  push-profile
  ?:  ?=(%urbit -.user)
    :_  state
    :*  c1
        (urbit-leave +.user)
        pcs
    ==
  ::  TODO close the user's relay subscription
  :_  state
  [c1 pcs]
::  +handle-res: response to our follow request
::
++  handle-res
  |=  fr=fols-res:comms
  ^-  (quip card:agent:gall _state)
  =/  =user:sur  [%urbit src.bowl]
  =/  enfr  [user now.bowl fr]
  =/  n=notif:notif  [%fol-res enfr]
  =/  hark-card  (send-hark:harklib n bowl)
  =.  state
    ?@  p.fr  state     ::  deferred
    ?@  +.p.fr  state   ::  approval denied
    =/  fd=feed-data:comms  data.p.fr
    =.  following.state   (~(put by following.state) user feed.fc.fd)
    =.  timeline.state  (add-new-feed:feedlib timeline.state feed.fc.fd)
    =.  profiles.state  (~(put by profiles.state) user profile.fd)
    =/  graph  (~(get by follow-graph.state) [%urbit our.bowl])
    =/  follows  ?~  graph  (silt ~[user])  (~(put in u.graph) user)
    =.  follow-graph.state  (~(put by follow-graph.state) [%urbit our.bowl] follows)
    state
  =/  =fact:ui  [%fols %new-urbit enfr]
  =^  pcs  state  push-profile
  :_  state
  :*  hark-card
      (update-ui:cards:lib fact)
      pcs
  ==
::
++  handle-refollow
  |=  sip=@p
  ::  TODO refollow on kick? we don't know which side dropped
  `state
::
++  handle-kick-nack
  |=  p=@p
  ^-  (quip card:agent:gall _state)
  =.  following.state  (~(del by following.state) [%urbit p])
  =/  graph  (~(get by follow-graph.state) [%urbit our.bowl])
  ?~  graph  `state
  =/  ngraph  (~(del in u.graph) [%urbit p])
  =.  follow-graph.state  (~(put by follow-graph.state) [%urbit our.bowl] ngraph)
  =^  pcs  state  push-profile
  :_  state
  [(update-ui:cards:lib [%fols %quit %urbit src.bowl]) pcs]
::
++  urbit-leave  |=  sip=@p  ^-  card:agent:gall
  [%pass /follow %agent [sip dap.bowl] %leave ~]
::
++  urbit-watch  |=  sip=@p  ^-  card:agent:gall
  [%pass /follow %agent [sip dap.bowl] %watch /follow]
--
