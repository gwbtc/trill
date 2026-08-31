/-  sur=nostr
/+  js=json-nostr, sr=sortug
|%
++  gen-sub-id  |=  eny=@  ^-  @t
  %-  crip  (scag 60 (scow:sr %uw eny))
++  gen-keys  |=  eny=@  ^-  keys:sur
  =,  secp256k1:secp:crypto
  =/  privkey
  |-
    =/  k  (~(rad og eny) (bex 256))
    ?.  (lth k n.t)  $  k

  =/  pubkey  (priv-to-pub privkey)
  ::  nostr uses bip-340 x-only keys: the x coordinate alone,
  ::  32 bytes. zuse's schnorr signer is bip-340 (implicit even-y
  ::  key), so signatures verify against this key regardless of
  ::  the point's y parity
  [pub=x.pubkey priv=privkey]
::
++  hash-event  |=  raw=raw-event:sur  ^-  @ux
  =/  jon  (raw-event:en:js raw)
  =/  jstring  (en:json:html jon)
  (swp 3 (shax jstring))

++  raws
  |=  [eny=@ bits=@]
  ^-  [@ @]
  [- +>-]:(~(raws og eny) bits)

++  sign-event  |=  [priv=@ux hash=@ux eny=@]
  =^  sed  eny  (raws eny 256)
  (sign:schnorr:secp256k1:secp:crypto priv hash sed)


:: 
++  validate-pubkey  |=  pubkey=@ux  ^-  ?
  =/  tap  (scow:sr %ux pubkey)
  .=  (lent tap)  64
::  
++  diff-filters
|=  [a=filter:sur b=filter:sur]  ^-  filter:sur
  =/  ids      (unit-set-dif ids.a ids.b)
  =/  authors  (unit-set-dif authors.a authors.b)
  =/  kinds    (unit-set-dif kinds.a kinds.b)
  =/  tags  ~
  =/  since  ~
  =/  until  ~
  =/  limit  ~  :: TODO
  [ids authors kinds tags since until limit]
++  unit-set-dif
  |*  [a=(unit) b=(unit)]
    %^  clap  a  b  |*  [x=(set) y=(set)]  (~(dif in x) y)
--
