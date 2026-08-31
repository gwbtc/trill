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
++  entries
  ^-  (list [npub=tape hex=tape])
  :~
   :-  npub="npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
       hex="82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
   :-  npub="npub107jk7htfv243u0x5ynn43scq9wrxtaasmrwwa8lfu2ydwag6cx2quqncxg"
       hex="7fa56f5d6962ab1e3cd424e758c3002b8665f7b0d8dcee9fe9e288d7751ac194" 
   :-  npub="npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a"
       hex="eab0e756d32b80bcd464f3d844b8040303075a13eabc3599a762c9ac7ab91f4f" 
  ==
++  event  ^-  event:nsur
  =/  id       %+  slaw:sr  %ux  '7089bd04f9c393587c470d93d0948dd2b9ec17acbf71bdcf8e1434995e9e537d'
  =/  sig      %+  slaw:sr  %ux  '6812142aae70dc4d2107198ca6accf6f1b0ecc896de9c30636680b1b00aa76a36df12d5b1d6353a0e7d0065503fe5b2c6886077ce1e09fcc2f56a39d338f4f51'
  =/  pubkey   %+  slaw:sr  %ux  '04bfcb2c170dd6bc5c154763a9f907ed752cbc7f3cd95b941b7776f12327ac9e'
  :: =/  created-at (from-unix:jikan:sr 1.782.656.742)
  =/  created-at  1.782.656.742
  =/  tags=(list (list @t))
    :~
     ~['q' '8892d5d69611e60c14404cdf85e56e31741afc44263ae0322f99619e39929fb4']
     ~['p' '572aa88414c6b1443082fe6d6a70b0a5a132355e2677c6723f2a0200e266a569']
     ~['t' 'bch']
     ~['t' 'bitcoincash']
     ~['client' 'BCHNostr' '31990=df5bcaba9e74cc1764c9773ae160299dde5acf79416e2c96758dba225e6707cc=bchstr24-1' 'wss=//relay.damus.io']
    ==
  =/  content=tape
"""
Why Nostr Can't Grow = Lightning's Flaws Are Blocking Millions of New Users

The vision of decentralized social media on Nostr relies on frictionless value transfer through zaps but the Bitcoin Lightning Network is structurally unsuited for this task. True peer to peer Lightning use is heavily burdened by technical friction because users must manage inbound liquidity just to receive a tip stay constantly online to process transactions and deal with frequent routing failures. Furthermore when base layer congestion spikes the prohibitive on chain fees required to open or close channels make self custody financially impossible for everyday users who simply want to send microtransactions.

To bypass these overwhelming user experience hurdles the Lightning ecosystem has heavily centralized around custodial wallets and exchanges. While these third party services hide the complex channel management from the user they fundamentally break the permissionless ethos of Nostr. Because these centralized entities act as money transmitters they are legally required to enforce strict Know Your Customer regulations. Forcing users to upload government identification and undergo biometric scans just to send small tips completely destroys the promise of a private and censorship resistant digital economy.
    
Bitcoin Cash presents the natural solution for Nostr zaps by eliminating these secondary layer complexities entirely. By relying on a massively scalable base layer Bitcoin Cash keeps transaction fees to fractions of a cent allowing users to send and receive microtransactions directly on chain without ever opening a payment channel. This restores the true peer to peer experience where anyone can receive funds offline no inbound liquidity is required and users can maintain complete self custody without submitting to invasive identity verification.

nostr=note13zfdt45kz8nqc9zqfn0ctetwx96p4lzyycawqv30n9seuwvjn76qnv7mju
"""
:*
  id=(need id)
  pubkey=(need pubkey)
  created-at=created-at
  kind=1
  tags=tags
  content=(crip content)
  sig=(need sig)
==
++  nprofiles  ^-  (list @t)
:~
  'nprofile1qqsqf07t9stsm44uts25wcaflyr76afvh3lnek2mjsdhwah3yvn6e8spye26w'
  'nprofile1qqsyawyrzrttfmv4cmtx5w2m85702kdct7hv3amfrkhagpdf9cz46mgdue6hy'
==
++  nevents  ^-  (list @t)
:~
  'nevent1qqs8pzdaqnuu8y6c03rsmy7sjjxa9w0vz7kt7udae78pgdyet609xlggcxa8u'
  'nevent1qqspsq7xv6f5agltpk36w39hsu2qc34mv8ym6nvkez9plmts60wcsdgjx20vz'
  'nevent1qqs2uvv7fe4wwcqy5qtjd4qgrr4sjjpmmcam72mqu37uhasfkepcfxstc3cye'
==
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
::
++  test
|=  hex=@ux  ^-  @t
  ~&  [%bech-test-input hex]
  =/  nothing  
    =/  np  nprofiles
    |-  ?~  np  ~
      ~&  nprofile=i.np
      =/  decoded  (decode-nprofile (trip i.np))
      ~&  >>  dec=decoded
      =/  npub  (hex-to-npub pubkey.decoded)
      ~&  >  npub=npub
    $(np t.np)
  =/  nothing  
    =/  np  nevents
    |-  ?~  np  ~
      ~&  nevent=i.np
      =/  decoded  (decode-nevent (trip i.np))
      ~&  >>  dec=decoded
      :: =/  npub  (hex-to-npub pubkey.decoded)
      :: ~&  >  npub=npub
    $(np t.np)
  =/  es=(list [npub=tape hex=tape])  entries
  |-
  ?~  es
    'ok'
  =/  hex-from-npub  (npub-to-hex npub.i.es)
  =/  npub-from-hex  (hex-to-npub hex.i.es)
  ~&  [%npub-to-hex npub.i.es hex-from-npub]
  ~&  [%hex-to-npub hex.i.es npub-from-hex]
  ?>  =(hex.i.es hex-from-npub)
  ?>  =(npub.i.es npub-from-hex)
  $(es t.es)
--

