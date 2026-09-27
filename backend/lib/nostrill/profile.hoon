::  nostrill-profile: own profile and key management
::
/-  sur=nostrill, comms=nostrill-comms, ui=nostrill-ui
/+  lib=nostrill, nostr-keys, scri, evlib=nostr-events, nostr-client
|_  [=state:sur =bowl:gall]
+*  scry     ~(. scri [state bowl])
    nclient  ~(. nostr-client [state bowl])
+$  card  card:agent:gall
::  +cycle-keys: generate a fresh nostr keypair, current profile
::    adopts the new pubkey
::
++  cycle-keys
  ^-  (quip card _state)
  =/  ks  (gen-keys:nostr-keys eny.bowl)
  =.  keys.state  [ks keys.state]
  =/  curr  (~(get by profiles.state) [%urbit src.bowl])
  =/  np  ?~  curr  default-profile:scry  u.curr(pubkey pub.ks)
  =.  profiles.state  (~(put by profiles.state) [%urbit src.bowl] np)
  ::  publish the new identity's kind-0 to the global relay,
  ::  signed by the fresh key
  =/  event  (profile-to-event:evlib i.keys.state np eny.bowl now.bowl)
  :_  state
  :~  (update-followers:cards:lib [%prof `np])
      (send-card:global:nclient [%event event])
  ==
::  +handle-prof: profile pokes from our own frontend
::
++  handle-prof
  |=  poke=prof-poke:ui
  ^-  (quip card _state)
  ?-  -.poke
    %add
      =/  prof  default-profile:scry
      =.  user-meta.prof  +.poke
      =.  profiles.state  (~(put by profiles.state) [%urbit our.bowl] prof)
      ::  publish to the global relay
      =/  event  (profile-to-event:evlib i.keys.state prof eny.bowl now.bowl)
      :_  state
      :~  (update-followers:cards:lib [%prof `prof])
          (send-card:global:nclient [%event event])
      ==
    %del
      =.  profiles.state  (~(del by profiles.state) [%urbit our.bowl])
      ::  TODO send deletion to relay
      :_  state
      :~  (update-followers:cards:lib [%prof ~])
      ==
    %fetch
      ::  urbit profiles only, one-shot watches of /profile (answered
      ::  in +on-agent); the frontend asks relays for nostr ones
      :_  state
      %+  murn  p.poke
      |=  =user:sur
      ?.  ?=(%urbit -.user)  ~
      ?:  =(our.bowl +.user)  ~
      =/  =wire  /profile/(scot %p +.user)
      `[%pass wire %agent [+.user dap.bowl] %watch /profile]
  ==
::  +give-prof: our profile to anyone who asks, then kick
::
++  give-prof
  ^-  (list card)
  =/  uprof  (~(get by profiles.state) [%urbit our.bowl])
  =/  prof  ?^  uprof  u.uprof  default-profile:scry
  =/  =fact:comms  [%prof `prof]
  :~  [%give %fact ~ %noun !>(fact)]
      [%give %kick ~ ~]
  ==
::  +handle-prof-fact: profile update from a ship we follow
::
++  handle-prof-fact
  |=  prof=(unit user-profile:comms)
  ^-  (quip card _state)
  =.  profiles.state  ?~  prof
    (~(del by profiles.state) [%urbit src.bowl])
    (~(put by profiles.state) [%urbit src.bowl] u.prof)
  :_  state
  :~  (update-ui:cards:lib [%prof profiles.state])
  ==
--
