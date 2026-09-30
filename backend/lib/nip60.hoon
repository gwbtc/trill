::  nip60: a Cashu wallet's nostr events (github.com/nostr-protocol/nips/60.md)
::
::    kind 17375  the wallet: its P2PK key and mints (replaceable)
::    kind 7375   unspent proofs from one mint; replaced, never edited
::    kind 7376   history: a change in balance and the token events behind it
::    kind 5      deleting token events we've replaced (NIP-09, k=7375)
::
::    %nostrill seals (NIP-44, to our own key) and signs them: the nostr
::    key stays there. this builds the plaintext
::
/-  sur=wallet, nostr
/+  cw=cashu-wire
|%
::  +per-event: proofs in one token event. NIP-44 takes 64 KiB of text;
::  a proof with its DLEQ is some 450 bytes
::
++  per-event  50
::
++  id-hex  |=(id=@ux `@t`(crip ((x-co:co 64) id)))
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
::  +lock-key: our P2PK public key as NIP-61 has senders lock to: 02 and
::  the x (BIP-340 signing doesn't mind the y)
::
++  lock-key  |=(x=@ `@t`(cat 3 '02' (hex-of:cw 64 x)))
::  +info: NIP-61's kind 10019 tags: where to send us ecash and how to lock
::  it
::
++  info
  |=  [relays=(list @t) mints=(list @t) x=@]
  ^-  (list tag:nostr)
  ;:  weld
    (turn relays |=(r=@t `tag:nostr`~['relay' r]))
    (turn mints |=(m=@t `tag:nostr`~['mint' m 'sat']))
    `(list tag:nostr)`~[~['pubkey' (lock-key x)]]
  ==
::  +redeemed: a 7376's public tags for the nutzaps it redeemed
::
++  redeemed
  |=  zs=(list [ev=@ux from=@ux])
  ^-  (list tag:nostr)
  =|  out=(list tag:nostr)
  |-
  ?~  zs  (flop out)
  %=  $
    zs   t.zs
    out  [~['p' (id-hex from.i.zs)] ~['e' (id-hex ev.i.zs) '' 'redeemed'] out]
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
