/-  tf=trill-feed, tp=trill-post, comms=nostrill-comms
|%
+$  state  state-0
+$  chat  [=feed:tf last-read=(unit @da)]
+$  request  post:tp
+$  delivery  ?(%sending %pending %failed)
+$  policy  [muted=(set ship) blocked=(set ship)]
+$  state-0
  $:  %0
      dms=(map ship chat)
      requests=(map ship request)
      outbox=(map ship (map @da delivery))
      =policy
  ==
::
+$  poke
  $%  ::  ames poke
      [%recv =post:tp]
      [%req accepted=?]
      [%block msg=@t]
      ::  dojo poke
      [%send peer=ship content=@t]
      [%accept peer=ship]
      [%dbug *]
  ==
+$  ui-poke
  $%  [%send peer=ship content=@t]
      [%read peer=ship id=(unit @da)]
      [%mute peer=ship]
      [%unmute peer=ship]
      [%block peer=ship]
      [%unblock peer=ship]
      ::  block where you tell them
      [%gtfo peer=ship msg=@t]
      [%accept peer=ship]
      [%reject peer=ship]
  ==
::
+$  chat-fact
  $:  =fc:tf
      last-read=(unit @da)
      unread=@ud
      muted=?
      blocked=?
      delivery=(map @da delivery)
  ==
+$  fact
  $%  [%init dms=(map ship chat-fact) requests=(map ship request) jail=policy]
      [%peer peer=ship chat-fact]
      [%requests requests=(map ship request)]
      [%err msg=@t]
  ==
--
