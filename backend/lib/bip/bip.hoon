/-  sur=bitcoin, nsur=nostr
/+  new=bip-b173,
    bcu=bitcoin-utils,
    sr=sortug
=,  sur
=,  bcu
|%
+$  tlv  [typ=@ud val=hexb]
+$  nprofile  [pubkey=tape relays=(list tape)]
+$  nevent  [event-id=tape relays=(list tape) author=(unit tape) kind=(unit @ud)]
+$  naddr  [identifier=tape pubkey=tape kind=@ud relays=(list tape)]
::
:: NIP 19  Bech 32 encoded entities
:: https://raw.githubusercontent.com/nostr-protocol/nips/refs/heads/master/19.md
:: 
::  Basic prefixes
:: npub: public key
:: nsec: private key
:: note: note id
:: 
:: TLV prefixes
:: nprofile: nostr profile
:: nevent:   nostr event
:: naddr:     nostr addressable event coordinate

++  bytes-to-data5
  |=  h=hexb
  ^-  (list @)
  =/  bit-wid=@  (mul 8 wid.h)
  =/  pad=@      (mod (sub 5 (mod bit-wid 5)) 5)
  =/  out-wid=@  (add bit-wid pad)
  =/  out-dat=@ub  `@ub`(lsh [0 pad] dat.h)
  (to-atoms:bit 5 [out-wid out-dat])
::
++  data5-to-hexb
  |=  data=(list @)
  ^-  hexb
  =/  bs=bits  (from-atoms:bit 5 data)
  =/  bit-wid=@  (sub wid.bs (mod wid.bs 8))
  =/  padding=bits  (drop:bit bit-wid bs)
  ?>  =(0 dat.padding)
  [(div bit-wid 8) `@ux`dat:(take:bit bit-wid bs)]
::
++  data5-to-hex
  |=  data=(list @)
  ^-  tape
  (trip (to-cord:hxb (data5-to-hexb data)))
::
++  hex-to-hexb
  |=  hex=tape  ^-  hexb
  (from-cord:hxb (crip hex))
::
++  text-to-hexb
  |=  txt=tape  ^-  hexb
  (flip:byt [(lent txt) `@ux`(crip txt)])
::
++  hexb-to-text
  |=  h=hexb  ^-  tape
  (trip `@t`dat:(flip:byt h))
::
++  is-valid-nip19
  |=  [bech=tape last-1-pos=@]  ^-  ?
  ?&  ?|(=((cass bech) bech) =((cuss bech) bech))
      (gte last-1-pos 1)
      (lte (add last-1-pos 7) (lent bech))
      (levy bech |=(c=@tD (gte c 33)))
      (levy bech |=(c=@tD (lte c 126)))
  ==
::
++  decode-raw-nip19
  |=  body=cord
  ^-  (unit raw-decoded:new)
  =/  bech  (cass (trip body))
  =/  pos  (flop (fand "1" bech))
  ?~  pos  ~
  =/  last-1=@  i.pos
  ?.  (is-valid-nip19 bech last-1)
    ~
  =/  hrp  (scag last-1 bech)
  =/  encoded-data-and-checksum=(list @)
    (slag +(last-1) bech)
  =/  data-and-checksum=(list @)
    %+  murn  encoded-data-and-checksum
    charset-to-value:new
  ?.  =((lent encoded-data-and-checksum) (lent data-and-checksum))
    ~
  ?.  (verify-checksum:new hrp data-and-checksum)
    ~
  =/  checksum-pos  (sub (lent data-and-checksum) 6)
  `[hrp (scag checksum-pos data-and-checksum) (slag checksum-pos data-and-checksum)]
::
++  tlv-to-hexb
  |=  t=tlv  ^-  hexb
  ?>  (lte typ.t 255)
  ?>  (lte wid.val.t 255)
  (cat:byt ~[[1 `@ux`typ.t] [1 `@ux`wid.val.t] val.t])
::
++  tlvs-to-hexb
  |=  tlvs=(list tlv)  ^-  hexb
  ?~  tlvs
    0^0x0
  (cat:byt (turn tlvs tlv-to-hexb))
::
++  decode-tlvs
  |=  h=hexb
  ^-  (list tlv)
  =/  rem=hexb  h
  =/  out=(list tlv)  ~
  |-
  ?:  =(0 wid.rem)
    (flop out)
  ?:  ?&((lte wid.rem 4) =(0 dat.rem))
    (flop out)
  ?>  (gte wid.rem 2)
  =/  typ=@ud  dat:(take:byt 1 rem)
  =/  len=@ud  dat:(take:byt 1 (drop:byt 1 rem))
  =/  rest=hexb  (drop:byt 2 rem)
  ?>  (gte wid.rest len)
  =/  val=hexb  (take:byt len rest)
  $(rem (drop:byt len rest), out [[typ val] out])
::
++  find-first-tlv
  |=  [typ=@ud tlvs=(list tlv)]
  ^-  (unit hexb)
  |-
  ?~  tlvs
    ~
  ?:  =(typ typ.i.tlvs)
    `val.i.tlvs
  $(tlvs t.tlvs)
::
++  find-all-tlvs
  |=  [typ=@ud tlvs=(list tlv)]
  ^-  (list hexb)
  =/  out=(list hexb)  ~
  |-
  ?~  tlvs
    (flop out)
  %=  $
    tlvs  t.tlvs
    out   ?:  =(typ typ.i.tlvs)
            [val.i.tlvs out]
          out
  ==
::
++  relay-tlvs
  |=  relays=(list tape)
  ^-  (list tlv)
  %+  turn  relays
  |=  relay=tape
  [1 (text-to-hexb relay)]
::
++  maybe-author-tlv
  |=  author=(unit tape)
  ^-  (list tlv)
  ?~  author
    ~
  [[2 (hex-to-hexb u.author)] ~]
::
++  maybe-kind-tlv
  |=  kind=(unit @ud)
  ^-  (list tlv)
  ?~  kind
    ~
  [[3 [4 `@ux`u.kind]] ~]
::
++  encode-tlv-bech
  |=  [hrp=tape tlvs=(list tlv)]
  ^-  tape
  (trip (encode-raw:new hrp %.n (bytes-to-data5 (tlvs-to-hexb tlvs))))
::
++  decode-tlv-bech
  |=  [hrp=tape bech=tape]
  ^-  (list tlv)
  =/  raw  (decode-raw-nip19 (crip bech))
  ?~  raw
    ~&  [%bad-nip19 bech]
    !!
  ?>  =(hrp hrp.u.raw)
  (decode-tlvs (data5-to-hexb data.u.raw))
::
++  npub-to-hex
|=  npub=tape  ^-  @ux
  =/  raw  (decode-raw:new (crip npub))
  ?~  raw
    ~&  [%bad-npub npub]
    !!
  ?>  =("npub" hrp.u.raw)
  =/  =hexb  (data5-to-hexb data.u.raw)
  ~&  hexb=hexb
  +.hexb

++  npub-to-hexstring
|=  npub=tape  ^-  tape
  =/  raw  (decode-raw:new (crip npub))
  ?~  raw
    ~&  [%bad-npub npub]
    !!
  ?>  =("npub" hrp.u.raw)
  (data5-to-hex data.u.raw)
::
++  ux-to-npub
::  we can parse hex string into the native hex numerical type @ux
|=  hex=@ux  ^-  tape
  =/  hext=tape  (scow:sr %ux hex)
  =/  h=hexb  (hex-to-hexb hext)
  (trip (encode-raw:new "npub" %.n (bytes-to-data5 h)))
::
++  hex-to-npub
::  we can parse hex string into the native hex numerical type @ux
|=  hext=tape  ^-  tape
  =/  h=hexb  (hex-to-hexb hext)
  (trip (encode-raw:new "npub" %.n (bytes-to-data5 h)))
::
++  encode-nprofile
  |=  [pubkey=tape relays=(list tape)]
  ^-  tape
  =/  tlvs=(list tlv)
    [[0 (hex-to-hexb pubkey)] (relay-tlvs relays)]
  (encode-tlv-bech "nprofile" tlvs)
::
++  decode-nprofile
  |=  bech=tape
  ^-  nprofile
  =/  tlvs  (decode-tlv-bech "nprofile" bech)
  =/  pub  (find-first-tlv 0 tlvs)
  ?~  pub
    ~&  %missing-pubkey
    !!
  ?>  =(32 wid.u.pub)
  [pubkey=(trip (to-cord:hxb u.pub)) relays=(turn (find-all-tlvs 1 tlvs) hexb-to-text)]
::
++  encode-nevent
  |=  [event-id=tape relays=(list tape) author=(unit tape) kind=(unit @ud)]
  ^-  tape
  =/  tlvs=(list tlv)
    [[0 (hex-to-hexb event-id)] ~]
  =.  tlvs  (weld tlvs (relay-tlvs relays))
  =.  tlvs  (weld tlvs (maybe-author-tlv author))
  =.  tlvs  (weld tlvs (maybe-kind-tlv kind))
  (encode-tlv-bech "nevent" tlvs)
::
++  decode-nevent
  |=  bech=tape
  ^-  nevent
  =/  tlvs  (decode-tlv-bech "nevent" bech)
  =/  eid  (find-first-tlv 0 tlvs)
  ?~  eid
    ~&  %missing-event-id
    !!
  ?>  =(32 wid.u.eid)
  =/  author  (find-first-tlv 2 tlvs)
  =/  kind  (find-first-tlv 3 tlvs)
  =/  parsed-kind=(unit @ud)
    ?~  kind
      ~
    =/  k=@ud  `@ud`dat.u.kind
    `k
  :*  event-id=(trip (to-cord:hxb u.eid))
      relays=(turn (find-all-tlvs 1 tlvs) hexb-to-text)
      author=?~(author ~ `(trip (to-cord:hxb u.author)))
      kind=parsed-kind
  ==
::
++  encode-naddr
  |=  [identifier=tape pubkey=tape kind=@ud relays=(list tape)]
  ^-  tape
  =/  tlvs=(list tlv)
    [[0 (text-to-hexb identifier)] (relay-tlvs relays)]
  =.  tlvs  (weld tlvs [[2 (hex-to-hexb pubkey)] ~])
  =.  tlvs  (weld tlvs [[3 [4 `@ux`kind]] ~])
  (encode-tlv-bech "naddr" tlvs)
::
++  decode-naddr
  |=  bech=tape
  ^-  naddr
  =/  tlvs  (decode-tlv-bech "naddr" bech)
  =/  ident  (find-first-tlv 0 tlvs)
  =/  pub  (find-first-tlv 2 tlvs)
  =/  kind  (find-first-tlv 3 tlvs)
  ?~  pub
    ~&  %missing-author
    !!
  ?~  kind
    ~&  %missing-kind
    !!
  ?>  =(32 wid.u.pub)
  ?>  =(4 wid.u.kind)
  :*  identifier=?~(ident "" (hexb-to-text u.ident))
      pubkey=(trip (to-cord:hxb u.pub))
      kind=`@ud`dat.u.kind
      relays=(turn (find-all-tlvs 1 tlvs) hexb-to-text)
  ==
--

