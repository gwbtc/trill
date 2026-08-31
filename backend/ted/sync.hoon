/-  spider, ui=nostrill-ui
/+  strandio, jsonlib=json-nostrill
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
|=  arg=vase
  =/  m  (strand ,vase)  ^-  form:m
  |^
  =/  ujon  !<((unit json) arg)
  ?~  ujon  bail
  =/  ureq  (de-relay-do:de:jsonlib u.ujon)
  ?~  ureq  ~&  bad-json=(en:json:html u.ujon)  bail
  =/  req=relay-handling:ui  u.ureq
  ;<  =bowl:spider  bind:m  get-bowl:strandio
  ?.  ?=(relay-get:ui action.req)  bail
  =/  t=ted:ui  [%req tid.bowl relays.req action.req]

  ;<  ~  bind:m  (poke-our:strandio %nostrill %nostrill-ted !>(t))
  ;<  v=vase  bind:m  (take-poke:strandio %nostrill-ted)
  =/  res  !<(ted:ui v)
  ?.  ?=(%res -.res)  bail
  =/  j=json  [%s sub-id.res]
  (pure:m !>(j))
    ++  bail
    %-  pure:m   !>
      ^-  json
      %+  frond:enjs:format  %error
      s+'error'
  --
