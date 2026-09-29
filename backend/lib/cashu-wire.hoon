::  cashu-wire: Cashu's formats: the mint API's json (NUT-00..07), and
::  tokens, V4 (cashuB, CBOR) and V3 (cashuA, json), both ways
::
/-  sur=wallet
/+  cashu, cbor
|%
::
::  hex and points
::
++  hex-of  |=([width=@ud a=@] `@t`(crip ((x-co:co width) a)))
++  point-hex  to-hex:cashu
::  +hex-bytes: a hex string as the bytes it spells, in order
::
++  hex-bytes
  |=  h=@t
  ^-  (unit octs)
  =/  len  (met 3 h)
  ?.  =(0 (mod len 2))  ~
  ?:  =(0 len)  `[0 0]
  =/  a  (rush h hex)
  ?~  a  ~
  `[(div len 2) (rev 3 (div len 2) u.a)]
::
++  bytes-hex
  |=  o=octs
  ^-  @t
  (hex-of (mul 2 p.o) (rev 3 p.o q.o))
::
::  amounts
::
::  +split: an amount as the powers of two in it, smallest first
::
++  split
  |=  amount=@ud
  ^-  (list @ud)
  =|  out=(list @ud)
  =/  i=@ud  0
  |-
  ?:  =(0 amount)  (flop out)
  =?  out  =(1 (end 0 amount))  [(bex i) out]
  $(amount (rsh 0 amount), i +(i))
::  +denominations: an amount as the amounts a keyset has keys for,
::  largest first while they fit, repeating the largest: a mint only
::  signs what it has keys for (tessera stops at 2^20). smallest first;
::  ~ if they can't make it up
::
++  denominations
  |=  [amount=@ud keys=(map @ud point:sur)]
  ^-  (unit (list @ud))
  =/  have=(list @ud)  (sort ~(tap in ~(key by keys)) gth)
  =|  out=(list @ud)
  |-
  ?:  =(0 amount)  `out
  ?~  have  ~
  ?:  |(=(0 i.have) (gth i.have amount))  $(have t.have)
  $(amount (sub amount i.have), out [i.have out])
::  +fee: NUT-02: each input's fee-ppk, summed, rounded up. ~ if an
::  input's keyset is unknown: pretending it's free would make the mint
::  refuse the whole transaction
::
++  fee
  |=  [keysets=(map @t keyset:sur) inputs=(list proof:sur)]
  ^-  (unit @ud)
  =/  ppk=@ud  0
  |-
  ?~  inputs  `(div (add ppk 999) 1.000)
  =/  k  (~(get by keysets) id.i.inputs)
  ?~  k  ~
  $(inputs t.inputs, ppk (add ppk fee-ppk.u.k))
::  +keyset-id: NUT-02. V2 (01...): SHA-256 of
::  "amt:pubhex,...|unit:u[|input_fee_ppk:n][|final_expiry:n]", amounts
::  ascending. V1 (00..., deprecated): the first 7 bytes of SHA-256 of
::  the compressed keys, amounts ascending
::
++  keyset-id
  |=  [v2=? keys=(map @ud point:sur) unit=@t fee-ppk=@ud final-expiry=@ud]
  ^-  @t
  =/  sorted=(list [@ud point:sur])
    (sort ~(tap by keys) |=([a=[@ud *] b=[@ud *]] (lth -.a -.b)))
  ?.  v2
    =/  bytes=(list octs)
      %+  turn  sorted
      |=([* pt=point:sur] [33 (rev 3 33 (compress-point:sc:cashu pt))])
    =/  len=@ud  (mul 33 (lent bytes))
    (cat 3 '00' (end [3 14] (hex-of 64 (sha:cashu [len (can 3 bytes)]))))
  =/  pairs=(list @t)
    %+  turn  sorted
    |=([a=@ud pt=point:sur] (rap 3 ~[(crip (a-co:co a)) ':' (point-hex pt)]))
  =/  pieces=(list @t)  ~[(rap 3 (join ',' pairs)) '|unit:' unit]
  =?  pieces  !=(0 fee-ppk)
    (weld pieces `(list @t)`~['|input_fee_ppk:' (crip (a-co:co fee-ppk))])
  =?  pieces  !=(0 final-expiry)
    (weld pieces `(list @t)`~['|final_expiry:' (crip (a-co:co final-expiry))])
  (cat 3 '01' (hex-of 64 (sha:cashu (as-octs:mimes:html (rap 3 pieces)))))
::  +id-ok: whether a keyset's id is the one its keys, unit and fee give:
::  a mint can't then quietly change its fee
::
++  id-ok
  |=  k=keyset:sur
  ^-  ?
  =/  v2  =('01' (end [3 2] id.k))
  =(id.k (keyset-id v2 keys.k unit.k fee-ppk.k final-expiry.k))
::  +full-id: a keyset id as a token may carry it (V4 shortens V2 ids to
::  their first 16 hex characters), as one of ours. ~ if it matches none,
::  or more than one
::
++  full-id
  |=  [id=@t ours=(list @t)]
  ^-  (unit @t)
  ?^  (find ~[id] ours)  `id
  =/  hits  (skim ours |=(o=@t =(id (end [3 (met 3 id)] o))))
  ?.  ?=([@ ~] hits)  ~
  `i.hits
::  +blank-count: NUT-08: blank outputs for a melt's fee reserve,
::  ceil(log2 reserve), at least one if there is a reserve
::
++  blank-count
  |=  reserve=@ud
  ^-  @ud
  ?:  =(0 reserve)  0
  ?:  =(1 reserve)  1
  (xeb (dec reserve))
::
::  json: the mint API
::
++  en
  =,  enjs:format
  |%
  ++  proof
    |=  p=proof:sur
    ^-  json
    %-  pairs
    ;:  weld
      ^-  (list [@t json])
      :~  id+s+id.p
          amount+(numb amount.p)
          secret+s+secret.p
          'C'^s+(point-hex c.p)
      ==
      ^-  (list [@t json])
      ?~  witness.p  ~
      ~[witness+s+u.witness.p]
    ==
  ::
  ++  blinded
    |=  b=blinded:sur
    ^-  json
    (pairs ~[amount+(numb amount.b) id+s+id.b 'B_'^s+(point-hex b.b)])
  ::
  ++  proofs  |=(ps=(list proof:sur) `json`a+(turn ps proof))
  ++  outputs  |=(bs=(list blinded:sur) `json`a+(turn bs blinded))
  ::  +ys: the points to ask about in /v1/checkstate
  ::
  ++  ys
    |=  ps=(list proof:sur)
    ^-  json
    :-  %a
    %+  turn  ps
    |=(p=proof:sur s+(point-hex (hash-to-curve:cashu (as-octs:mimes:html secret.p))))
  --
::
++  de
  =,  dejs-soft:format
  |%
  ++  point  |=(j=json ?.(?=([%s *] j) ~ (from-hex:cashu p.j)))
  ++  hexn  |=(j=json ?.(?=([%s *] j) ~ (rush p.j hex)))
  ::  +keys: /v1/keys/{id}: {"keysets": [{id, unit, keys: {amount: hex}}]}
  ::
  ++  keys
    |=  j=json
    ^-  (unit (list [id=@t unit=@t keys=(map @ud point:sur)]))
    %.  j
    %+  cu  |=(l=(list [@t @t (map @ud point:sur)]) l)
    %-  ot
    :~  :-  %keysets
        %-  ar
        %-  ot
        :~  id+so
            unit+so
            keys+amount-keys
    ==  ==
  ::  +amount-keys: {"1": "02..", "2": ..}, amounts as decimal strings
  ::
  ++  amount-keys
    |=  j=json
    ^-  (unit (map @ud point:sur))
    ?.  ?=([%o *] j)  ~
    =/  kvs  ~(tap by p.j)
    =|  out=(map @ud point:sur)
    |-
    ?~  kvs  `out
    =/  a  (rush -.i.kvs dem)
    =/  pt  (point +.i.kvs)
    ?:  |(?=(~ a) ?=(~ pt))  ~
    $(kvs t.kvs, out (~(put by out) u.a u.pt))
  ::  +keysets: /v1/keysets: [{id, unit, active, input_fee_ppk?,
  ::  final_expiry?}]; the optional ones 0 when missing or null
  ::
  ++  keysets
    |=  j=json
    ^-  (unit (list [id=@t unit=@t active=? fee-ppk=@ud final-expiry=@ud]))
    %.  j
    %-  ot
    :~  :-  %keysets
        %-  ar
        |=  k=json
        ^-  (unit [@t @t ? @ud @ud])
        =/  u  ((ot ~[id+so unit+so active+bo]) k)
        ?~  u  ~
        =/  num
          |=  key=@t
          ^-  @ud
          ?.  ?=([%o *] k)  0
          (fall (biff (~(get by p.k) key) ni) 0)
        `[-.u.u +<.u.u +>.u.u (num 'input_fee_ppk') (num 'final_expiry')]
    ==
  ::  +mint-quote: POST /v1/mint/quote/bolt11 and GET of one. whether
  ::  it's paid and issued, whichever way the mint says: a state
  ::  (UNPAID/PAID/ISSUED), amount_paid and amount_issued, or a paid flag
  ::
  ++  mint-quote
    |=  j=json
    ^-  (unit [quote=@t request=@t paid=? issued=? expiry=(unit @ud)])
    ?.  ?=([%o *] j)  ~
    =/  get  |=(k=@t (~(get by p.j) k))
    =/  quote  (biff (get 'quote') so)
    =/  request  (biff (get 'request') so)
    ?~  quote  ~
    ?~  request  ~
    =/  state  (biff (get 'state') so)
    =/  amount-paid  (biff (get 'amount_paid') ni)
    =/  amount-issued  (biff (get 'amount_issued') ni)
    =/  paid-flag  (biff (get 'paid') bo)
    =/  paid=?
      ?|  ?=([~ ?(%'PAID' %'ISSUED')] state)
          &(?=(^ amount-paid) (gth u.amount-paid (fall amount-issued 0)))
          =([~ &] paid-flag)
      ==
    =/  issued=?
      ?|  =([~ 'ISSUED'] state)
          &(?=(^ amount-issued) ?=(^ amount-paid) (gte u.amount-issued u.amount-paid) !=(0 u.amount-paid))
      ==
    `[u.quote u.request paid issued (biff (get 'expiry') ni)]
  ::  +error: a mint's refusal: NUT-00's {detail, code}, or a bare
  ::  {detail} as tessera sends (its details are kebab-case names, like
  ::  token-already-spent, output-already-signed, quote-not-paid)
  ::
  ++  error
    |=  j=json
    ^-  (unit [code=(unit @ud) detail=@t])
    ?.  ?=([%o *] j)  ~
    =/  detail  (biff (~(get by p.j) 'detail') so)
    ?~  detail  ~
    `[(biff (~(get by p.j) 'code') ni) u.detail]
  ::  +signatures: {"signatures": [{id, amount, C_, dleq?}]}
  ::
  ++  signatures
    |=  j=json
    ^-  (unit (list blind-sig:sur))
    %.  j
    %-  ot
    :~  signatures+(ar blind-sig)
    ==
  ::
  ++  blind-sig
    |=  j=json
    ^-  (unit blind-sig:sur)
    =/  u  ((ot ~[id+so amount+ni 'C_'^point]) j)
    ?~  u  ~
    =/  d=(unit [e=@ s=@])
      ?.  ?=([%o *] j)  ~
      =/  dj  (~(get by p.j) 'dleq')
      ?~  dj  ~
      ((ot ~[e+hexn s+hexn]) u.dj)
    `[-.u.u +<.u.u +>.u.u d]
  ::  +proof: as tokens (V3) and NIP-60 events carry them
  ::
  ++  proof
    |=  j=json
    ^-  (unit proof:sur)
    =/  u  ((ot ~[id+so amount+ni secret+so 'C'^point]) j)
    ?~  u  ~
    ?.  ?=([%o *] j)  ~
    =/  d=(unit dleq:sur)
      =/  dj  (~(get by p.j) 'dleq')
      ?~  dj  ~
      =/  es  ((ot ~[e+hexn s+hexn]) u.dj)
      ?~  es  ~
      =/  r  ?.(?=([%o *] u.dj) ~ (biff (~(get by p.u.dj) 'r') hexn))
      `[-.u.es +.u.es r]
    =/  w  (biff (~(get by p.j) 'witness') so)
    `[-.u.u +<.u.u +>-.u.u +>+.u.u d w]
  ::  +states: /v1/checkstate: {"states": [{Y, state}]}, in order
  ::
  ++  states
    |=  j=json
    ^-  (unit (list @t))
    %.  j
    (ot ~[states+(ar (ot ~[state+so]))])
  --
::
::  tokens
::
::  +decode-token: a cashuA or cashuB string; the keyset ids come as the
::  token has them (V4 may shorten them to 16 hex: resolve with +full-id)
::
++  decode-token
  |=  s=@t
  ^-  (unit token:sur)
  =/  t  (trip s)
  ::  cashu: links carry them too
  =?  t  =("cashu:" (scag 6 t))  (slag 6 t)
  ?:  =("cashuB" (scag 6 t))  (decode-v4 (crip (slag 6 t)))
  ?:  =("cashuA" (scag 6 t))  (decode-v3 (crip (slag 6 t)))
  ~
::  +base64url: to and from base64 with - and _ for + and /, with or
::  without the = padding
::
++  from-base64url
  |=  s=@t
  ^-  (unit octs)
  =/  t  (turn (trip s) |=(c=@t ?:(=('-' c) '+' ?:(=('_' c) '/' c))))
  =/  pad  (mod (sub 4 (mod (lent t) 4)) 4)
  (de:base64:mimes:html (crip (weld t (reap pad '='))))
::
++  to-base64url
  |=  o=octs
  ^-  @t
  =/  t  (trip (en:base64:mimes:html o))
  (crip (turn t |=(c=@t ?:(=('+' c) '-' ?:(=('/' c) '_' c)))))
::
++  decode-v3
  |=  s=@t
  ^-  (unit token:sur)
  =/  raw  (from-base64url s)
  ?~  raw  ~
  =/  j  (de:json:html q.u.raw)
  ?~  j  ~
  =,  dejs-soft:format
  =/  u
    %.  u.j
    (ot ~[token+(ar (ot ~[mint+so proofs+(ar proof:de)]))])
  ?~  u  ~
  ::  V3 may hold several mints; we take one: the first
  ?~  u.u  ~
  =/  unt=@t  ?.(?=([%o *] u.j) 'sat' (fall (biff (~(get by p.u.j) 'unit') so) 'sat'))
  =/  memo  ?.(?=([%o *] u.j) ~ (biff (~(get by p.u.j) 'memo') so))
  `[(strip-slash -.i.u.u) unt memo +.i.u.u]
::
++  decode-v4
  |=  s=@t
  ^-  (unit token:sur)
  =/  raw  (from-base64url s)
  ?~  raw  ~
  =/  c  (decode:cbor u.raw)
  ?~  c  ~
  =/  mint  (get:cbor u.c 'm')
  =/  unt  (get:cbor u.c 'u')
  =/  memo  (get:cbor u.c 'd')
  =/  groups  (get:cbor u.c 't')
  ?.  &(?=([~ %t *] mint) ?=([~ %t *] unt) ?=([~ %a *] groups))  ~
  =/  proofs=(unit (list proof:sur))
    =|  out=(list proof:sur)
    =/  gs  p.u.groups
    |-
    ?~  gs  `out
    =/  id  (get:cbor i.gs 'i')
    =/  ps  (get:cbor i.gs 'p')
    ?.  &(?=([~ %b *] id) ?=([~ %a *] ps))  ~
    =/  kid  (bytes-hex p.u.id)
    =/  got  (v4-proofs kid p.u.ps)
    ?~  got  ~
    $(gs t.gs, out (weld out u.got))
  ?~  proofs  ~
  =/  m=(unit @t)  ?.(?=([~ %t *] memo) ~ `p.u.memo)
  `[(strip-slash p.u.mint) p.u.unt m u.proofs]
::
++  v4-proofs
  |=  [kid=@t ps=(list cbor:cbor)]
  ^-  (unit (list proof:sur))
  =|  out=(list proof:sur)
  |-
  ?~  ps  `(flop out)
  =/  a  (get:cbor i.ps 'a')
  =/  s  (get:cbor i.ps 's')
  =/  c  (get:cbor i.ps 'c')
  ?.  &(?=([~ %u *] a) ?=([~ %t *] s) ?=([~ %b *] c))  ~
  =/  pt  (lift:cashu (rev 3 p.p.u.c q.p.u.c))
  ?~  pt  ~
  =/  d=(unit dleq:sur)
    =/  dc  (get:cbor i.ps 'd')
    ?~  dc  ~
    =/  e  (get:cbor u.dc 'e')
    =/  s  (get:cbor u.dc 's')
    =/  r  (get:cbor u.dc 'r')
    ?.  &(?=([~ %b *] e) ?=([~ %b *] s))  ~
    :-  ~
    :+  (rev 3 p.p.u.e q.p.u.e)
      (rev 3 p.p.u.s q.p.u.s)
    ?.(?=([~ %b *] r) ~ `(rev 3 p.p.u.r q.p.u.r))
  =/  w  (get:cbor i.ps 'w')
  =/  witness=(unit @t)  ?.(?=([~ %t *] w) ~ `p.u.w)
  $(ps t.ps, out [[kid p.u.a p.u.s u.pt d witness] out])
::  +encode-token: cashuB, proofs grouped by keyset, in the key order the
::  NUT-00 vectors have: t, d, m, u; per proof a, s, c, d, w
::
++  encode-token
  |=  tok=token:sur
  ^-  @t
  =/  ids=(list @t)
    =|  seen=(list @t)
    =/  ps  proofs.tok
    |-
    ?~  ps  (flop seen)
    ?^  (find ~[id.i.ps] seen)  $(ps t.ps)
    $(ps t.ps, seen [id.i.ps seen])
  =/  groups=(list cbor:cbor)
    %+  turn  ids
    |=  id=@t
    :-  %m
    :~  [[%t 'i'] [%b (need (hex-bytes id))]]
        :-  [%t 'p']
        :-  %a
        %+  turn  (skim proofs.tok |=(p=proof:sur =(id id.p)))
        |=  p=proof:sur
        ^-  cbor:cbor
        :-  %m
        ;:  weld
          ^-  (list kv:cbor)
          :~  [[%t 'a'] [%u amount.p]]
              [[%t 's'] [%t secret.p]]
              [[%t 'c'] [%b [33 (rev 3 33 (compress-point:sc:cashu c.p))]]]
          ==
          ^-  (list kv:cbor)
          ?~  dleq.p  ~
          :_  ~
          :-  [%t 'd']
          :-  %m
          ;:  weld
            ^-  (list kv:cbor)
            :~  [[%t 'e'] [%b [32 (rev 3 32 e.u.dleq.p)]]]
                [[%t 's'] [%b [32 (rev 3 32 s.u.dleq.p)]]]
            ==
            ^-  (list kv:cbor)
            ?~(r.u.dleq.p ~ ~[[[%t 'r'] [%b [32 (rev 3 32 u.r.u.dleq.p)]]]])
          ==
          ^-  (list kv:cbor)
          ?~(witness.p ~ ~[[[%t 'w'] [%t u.witness.p]]])
        ==
    ==
  =/  top=(list kv:cbor)
    ;:  weld
      ^-  (list kv:cbor)
      ~[[[%t 't'] [%a groups]]]
      ^-  (list kv:cbor)
      ?~(memo.tok ~ ~[[[%t 'd'] [%t u.memo.tok]]])
      ^-  (list kv:cbor)
      ~[[[%t 'm'] [%t mint.tok]] [[%t 'u'] [%t unit.tok]]]
    ==
  (cat 3 'cashuB' (to-base64url (encode:cbor [%m top])))
::  +strip-slash: mint urls are compared without trailing slashes
::
++  strip-slash
  |=  url=@t
  ^-  @t
  =/  t  (flop (trip url))
  |-
  ?:  &(?=(^ t) =('/' i.t))  $(t t.t)
  (crip (flop t))
--
