/-  spider, comms=nostrill-comms
/+  strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
::  One-off WebSockets message thread.
::  Connects to a WebSockets server, awaits the connection to be open,
::  sends a message, then closes the connection.
::
|=  arg=vase
=/  m  (strand ,vase)  ^-  form:m
;<  =bowl:spider  bind:m  get-bowl:strandio
=/  args  !<([@t websocket-message:eyre] arg)
=/  endpoint  -.args
|^
=/  =task:iris  [%websocket-connect q.byk.bowl endpoint]
=/  iris-card  [%pass /ws-connect %arvo %i task]
;<  ~  bind:m  (send-raw-card:strandio iris-card)
;<  wid=@ud  bind:m  %+  (retry:strandio @ud)  `5  get-wid
::  NOTE: we can't send cards to Iris directly. Iris is subscribed to
::  the agent, not the thread, so we poke the agent instead
=/  pok=poke:comms  [%ted wid %msg +.args]
;<  ~  bind:m  (poke-our:strandio %nostrill %noun !>(pok))
;<  ~  bind:m  (sleep:strandio ~s2)
=/  pok=poke:comms  [%ted wid %disconnect ~]
;<  ~  bind:m  (poke-our:strandio %nostrill %noun !>(pok))
(pure:m !>(~))
::
+$  socket  [wid=@ud url=@t status=$?(%accepted %pending)]
++  get-wid
  =/  m  (strand ,(unit @))
  ^-  form:m
  ;<  sockets=(list socket)  bind:m  (scry:strandio (list socket) /ix//ws/nostrill)
  ?~  sockets  (pure:m ~)
  =/  l=(list socket)  sockets
  |-  ?~  l  (pure:m ~)
  =/  =socket  i.l
  ?.  .=(url.socket endpoint)
    $(l t.l)
  ?.  ?=(%accepted status.socket)
    $(l t.l)
  (pure:m `wid.socket)
--
