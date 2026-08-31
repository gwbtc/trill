/-  comms=nostrill-comms
/+  lib=gwid, common=json-common
|%
++  en
=,  enjs:format
  |%
  ++  uurbit-id  |=  u=(unit urbit-id:comms)  ^-  json
    ?~  u  ~
    (urbit-id u.u)
  ++  urbit-id  |=  u=urbit-id:comms  ^-  json
    %-  pairs
      :~  patp+(patp:en:common p.u)
          point+(ud:en:common point.u)
          gwid+(gwid gwid.u)
      ==
  ++  gwid  |=  g=nyms:lib  ^-  json
    %-  pairs
      :~  english+(gwidnym english.g)
          hanzi+(gwidnym hanzi.g)
      ==
  ++  gwidnym  |=  o=output:lib  ^-  json
    %-  pairs
      :~  nym+s+nym.o
          abridged+s+abridged.o
          foreshortened+s+foreshortened.o
      ==
  
  --
:: ++  de
:: =,  dejs-soft:format
::   |%
  
::   --

--
