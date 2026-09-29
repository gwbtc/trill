::  nip60: a Cashu wallet's nostr events (github.com/nostr-protocol/nips/60.md)
::
::    kind 17375  the wallet: its P2PK key and mints (replaceable)
::    kind 7375   unspent proofs from one mint; replaced, never edited
::    kind 7376   history: a change in balance and the token events behind it
::    kind 5      deleting token events we've replaced (NIP-09, k=7375)
::
::    contents are NIP-44 encrypted to our own key: +conversation-key of
::    our private and public key. every event needs its own nonce
::
/-  sur=wallet, nostr
/+  cw=cashu-wire, nip44, nostr-keys
|%
::  +per-event: proofs in one token event. NIP-44 takes 64 KiB of text;
::  a proof with its DLEQ is some 450 bytes
::
++  per-event  50
::
++  id-hex  |=(id=@ux `@t`(crip ((x-co:co 64) id)))
++  unix  |=(d=@da `@ud`(div (sub d ~1970.1.1) ~s1))
::  +sign: an event, hashed and signed
::
++  sign
  |=  [ks=keys:nostr eny=@ now=@da kind=@ud tags=(list tag:nostr) content=@t]
  ^-  event:nostr
  =/  raw=raw-event:nostr  [pub.ks (unix now) kind tags content]
  =/  id  (hash-event:nostr-keys raw)
  :*  id
      pub.ks
      created-at.raw
      kind
      tags
      content
      (sign-event:nostr-keys priv.ks id eny)
  ==
::  +seal: text encrypted to ourselves, with the nth nonce from eny
::
++  seal
  |=  [ck=@ eny=@ n=@ud text=@t]
  ^-  @t
  (encrypt:nip44 ck (end [3 32] (shas n eny)) text)
::  +proof: a proof as cashu libraries keep it, DLEQ included
::
++  proof
  |=  p=proof:sur
  ^-  json
  =/  base  (proof:en:cw p)
  ?.  ?=([%o *] base)  base
  ?~  dleq.p  base
  =/  d  u.dleq.p
  =/  fields=(list [@t json])
    :~  e+s+(hex-of:cw 64 e.d)
        s+s+(hex-of:cw 64 s.d)
    ==
  =?  fields  ?=(^ r.d)  (snoc fields r+s+(hex-of:cw 64 u.r.d))
  [%o (~(put by p.base) 'dleq' (pairs:enjs:format fields))]
::  +wallet: the 17375's content: our P2PK key and the mints
::
++  wallet
  |=  [privkey=@ mints=(list @t)]
  ^-  @t
  %-  en:json:html
  :-  %a
  :-  a+~[s+'privkey' s+(hex-of:cw 64 privkey)]
  (turn mints |=(m=@t `json`a+~[s+'mint' s+m]))
::  +token: a 7375's content
::
++  token
  |=  [mint=@t unit=@t ps=(list proof:sur) del=(list @ux)]
  ^-  @t
  %-  en:json:html
  %-  pairs:enjs:format
  :~  mint+s+mint
      unit+s+unit
      proofs+a+(turn ps proof)
      del+a+(turn del |=(i=@ux `json`s+(id-hex i)))
  ==
::  +history: a 7376's content. amounts in the unit's smallest part
::
++  history
  |=  [in=? amount=@ud unit=@t created=(list @ux) destroyed=(list @ux)]
  ^-  @t
  =/  e
    |=  [marker=@t ids=(list @ux)]
    (turn ids |=(i=@ux `json`a+~[s+'e' s+(id-hex i) s+'' s+marker]))
  %-  en:json:html
  :-  %a
  ;:  weld
    ^-  (list json)
    :~  a+~[s+'direction' s+?:(in 'in' 'out')]
        a+~[s+'amount' s+(crip (a-co:co amount))]
        a+~[s+'unit' s+unit]
    ==
    ^-  (list json)  (e 'destroyed' destroyed)
    ^-  (list json)  (e 'created' created)
  ==
::  +deletion: the kind 5's tags for token events we've replaced
::
++  deletion
  |=  ids=(list @ux)
  ^-  (list tag:nostr)
  %+  snoc
    (turn ids |=(i=@ux `tag:nostr`~['e' (id-hex i)]))
  ~['k' '7375']
--
