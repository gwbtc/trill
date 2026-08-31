/-  spider, sur=nostrill
/+  strandio, jsonlib=json-nostrill, sr=sortug, lib=nostrill
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
|=  arg=vase
  =/  m  (strand ,vase)  ^-  form:m
  |^
  =/  ujon  !<((unit json) arg)
  ?~  ujon  (pure:m !>(bail))
  =/  req  (ui:de:jsonlib u.ujon)
  ?~  req  (pure:m !>(bail))
  ?.  ?=(%begs -.u.req)  (pure:m !>(bail))
  ?-  +<.u.req
    %feed
      ;<  =bowl:spider  bind:m  get-bowl:strandio
      =/  desk  q.byk.bowl
      =/  ship=@p  +>.u.req
      =/  =user:sur  (atom-to-user:lib ship)
      ?-  -.user
        %nostr
          ::  TODO  wat do here
          =/  j=json  ~
          (pure:m !>(j))
        %urbit
          ;<  =cage  bind:m  (watch-one:strandio /beg/feed [p.user desk] /beg/feed)
          =/  j  !<(json +.cage)
          (pure:m !>(j))
      ==

    %thread
      ;<  =bowl:spider  bind:m  get-bowl:strandio
      =/  desk  q.byk.bowl
      =/  ship=@p  +>-.u.req
      =/  =user:sur  (atom-to-user:lib ship)
      =/  id=@da  +>+.u.req
      =/  ids  (crip (scow:sr %uw `@`id))
      =/  wire  /beg/thread/[ids]
      ?-  -.user
        %nostr
          ::  TODO  wat do here
          =/  j=json  ~
          (pure:m !>(j))
        %urbit
          ;<  =cage  bind:m  (watch-one:strandio wire [p.user desk] wire)
          =/  j  !<(json +.cage)
          (pure:m !>(j))
      ==
  ==
    ++  bail  ^-  json
    %+  frond:enjs:format  %error
    s+'error'
  --
