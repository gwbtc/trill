/-  tp=trill-post
/+  sr=sortug
|%
++  en
=,  enjs:format
  |%
  ++  cord  |=  s=@t   ^-  json  s+s
  ::  +user: bare string form; +user-tagged: {urbit: ...} frond form
  ::
  ++  user  |=  u=user:tp  ^-  json
    ?-  -.u
      %urbit  (patp +.u)
      %nostr  (hex +.u)
    ==
  ++  user-tagged  |=  u=user:tp  ^-  json
    (frond -.u (user u))
  ++  hex   |=  h=@ux  ^-  json
    =/  scoww  scow:sr
    [%s (crip (scoww(min-chars 64) %ux h))]
  ::  +hexn: zero-padded hex of a given width (e.g. 128 for
  ::  nostr signatures); relays reject odd/short hex fields
  ::
  ++  hexn  |=  [chars=@ud h=@ux]  ^-  json
    =/  scoww  scow:sr
    [%s (crip (scoww(min-chars chars) %ux h))]
  ++  b64   |=  h=@uv  ^-  json  
    [%s (crip (scow:sr %uv h))]
  ++  ud    |=  n=@  ^-  [%s cord=@t]
    [%s (crip (scow:sr %ud n))]
  ++  patp  |=  p=@p  ^-  json
    [%s (scot %p p)]
  ++  set  |*  [s=(^set) f=$-(* json)]  ^-  json
    :-  %a
    %+  turn  ~(tap in s)  f
  ++  list  |*  [l=(^list) f=$-(* json)]  ^-  json
    :-  %a
    %+  turn  l  f
  --
++  de
=,  dejs-soft:format
  |%
  ++  user
    %-  of  :~
      urbit+(se %p)
      nostr+hex
    ==
  ++  hex  |=  jon=json  ^-  (unit @ux)
    ?.  ?=(%s -.jon)  ~
    =/  atom=(unit @)  (slaw:sr %ux p.jon)
    ?~  atom  ~
    atom
  ++  du 
    (cu from-unix:chrono:userlib ni)
  ++  se  |=  aur=@tas  |=  jon=json
    ?.  ?=(%s -.jon)  ~
    (slaw aur p.jon)
  ++  string-ud
    |=  jon=json  ^-  (unit @)
    ?.  ?=([%s @t] jon)  ~
    (rush p.jon dem)

  :: ++  un  |*  wit=fist  |=  jon=json  ^-  (unit *)
  ::   ?~  jon  ~
  --

--
