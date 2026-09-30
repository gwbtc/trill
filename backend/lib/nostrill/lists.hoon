::  nostrill-lists: bookmarks, mutes and reports from our own frontend
::
::    all three are private lists; reporting an urbit post also sends
::    its host a %report heads-up, which shows up in their notifications
::
/-  sur=nostrill, ui=nostrill-ui
/+  lib=nostrill
|_  [=state:sur =bowl:gall]
+$  card  card:agent:gall
++  handle
  |=  poke=lists-poke:ui
  ^-  (quip card _state)
  =?  bookmarks.state  ?=(%bookmark -.poke)
    ?:  add.poke  (~(put by bookmarks.state) ref.poke now.bowl)
    (~(del by bookmarks.state) ref.poke)
  =?  muted.state  ?=(%mute -.poke)
    ?:  add.poke  (~(put in muted.state) user.poke)
    (~(del in muted.state) user.poke)
  =?  reported.state  ?=(%report -.poke)
    (~(put in reported.state) ref.poke)
  =/  ui-card
    (update-ui:cards:lib [%lists bookmarks.state muted.state reported.state])
  ?.  ?=(%report -.poke)  [~[ui-card] state]
  ?.  ?=(%urbit -.ref.poke)  [~[ui-card] state]
  ?:  =(our.bowl host.ref.poke)  [~[ui-card] state]
  =/  eng  [%eng [%report [[%urbit host.ref.poke] id.ref.poke] reason.poke]]
  :_  state
  :~  ui-card
      (poke-host:~(. cards:lib bowl) host.ref.poke eng)
  ==
--
