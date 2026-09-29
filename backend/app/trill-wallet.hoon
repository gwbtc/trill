::  trill-wallet: a Cashu ecash wallet (NIP-60/61), kept on the ship
::
::    ecash is proofs: secrets a mint has signed. we keep them here, by
::    mint; the secrets come from our seed phrase (NUT-13), so the phrase
::    alone restores the wallet. mints are talked to over http; anything
::    that takes several requests is an +op in state, step by step, with
::    what it's about to blind or spend saved before the request goes out
::
::    pokes (%noun, our own ship): $action in sur/wallet.hoon
::      [%add-mint url]        fetch and check a mint's keysets
::      [%deposit url amount]  a Lightning invoice; minted once paid
::
::    scries:
::      /x/wallet  json: balances, mints, operations, the log
::
::    it imports the tests only so that |commit type-checks them
::
/-  sur=wallet
/+  default-agent, dbug, cashu, cw=cashu-wire, cs=cashu-seed, nip44
/=  t-cashu  /tests/cashu
/=  t-wire  /tests/cashu-wire
/=  t-seed  /tests/cashu-seed
/=  t-nip44  /tests/nip44
::
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      phrase=tape                               ::  the 12 words
      seed=@                                    ::  their BIP-39 seed
      mints=(map @t mint:sur)
      counters=(map @t @ud)                     ::  NUT-13, by keyset
      proofs=(map @t (list proof:sur))          ::  spendable, by mint
      ops=(map @ud op:sur)
      next-op=@ud
      sent=(list sent:sur)                      ::  tokens we made, newest first
      log=(list [at=@da what=@t])               ::  newest first, 50 kept
  ==
::  +poll-every: how often a deposit's quote is checked
::
++  poll-every  ~s3
--
::
=|  state-0
=*  state  -
%-  agent:dbug
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    hc    ~(. +> bowl)
::
++  on-init
  ^-  (quip card _this)
  =/  words  (new-phrase:cs eny.bowl)
  `this(phrase words, seed (seed:cs words))
::
++  on-save  !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ::  no migrations before launch: change state-0 in place and |nuke
  `this(state !<(state-0 old))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?.  ?=(%noun mark)  (on-poke:def mark vase)
  =^  cards  state  (act:hc ;;(action:sur q.vase))
  [cards this]
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%op @ *]
    =/  id  (slav %ud i.t.wire)
    ?:  ?=([%behn %wake *] sign-arvo)
      =^  cards  state  (wake:hc id)
      [cards this]
    ?.  ?=([%iris %http-response *] sign-arvo)  `this
    =/  res=client-response:iris  +>.sign-arvo
    ?:  ?=(%progress -.res)  `this
    =^  cards  state  (heard:hc id t.t.wire res)
    [cards this]
  ==
::
++  on-peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  (on-peek:def pole)
    [%x %wallet ~]  ``json+!>(wallet-json:hc)
  ==
::
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
::
|_  =bowl:gall
::  +act: what we're asked to do
::
++  act
  |=  a=action:sur
  ^-  (quip card _state)
  ?-  -.a
      %add-mint
    =/  url  (strip-slash:cw url.a)
    ?.  ?=(^ (rush url ;~(pfix ;~(pose (jest 'https://') (jest 'http://')) (plus next))))
      ~|('a mint url starts with https://' !!)
    =/  id  next-op
    =.  next-op  +(next-op)
    =.  ops  (~(put by ops) id [%add-mint url ~ ~])
    [~[(get id /keysets (cat 3 url '/v1/keysets'))] state]
  ::
      %deposit
    =/  url  (strip-slash:cw mint.a)
    ?.  (~(has by mints) url)  ~|('add the mint first' !!)
    ?:  =(0 amount.a)  ~|('deposit at least 1 sat' !!)
    =/  id  next-op
    =.  next-op  +(next-op)
    =.  ops
      (~(put by ops) id [%deposit url 'sat' amount.a '' '' *@da %quoting ~])
    =/  body
      %-  pairs:enjs:format
      ~[amount+(numb:enjs:format amount.a) unit+s+'sat']
    [~[(post id /quote (cat 3 url '/v1/mint/quote/bolt11') body)] state]
  ::
      %receive
    =/  tok  (decode-token:cw token.a)
    ?~  tok  ~|('that isn\'t a cashu token' !!)
    =/  url  mint.u.tok
    =/  m  (~(get by mints) url)
    ?~  m  ~|((cat 3 'add its mint first: ' url) !!)
    ?.  =('sat' unit.u.tok)  ~|('only tokens in sats, for now' !!)
    =/  ins  (resolve proofs.u.tok ~(tap in ~(key by keysets.u.m)))
    ?~  ins  ~|('the token uses a keyset its mint doesn\'t list' !!)
    ?.  (dleqs-ok u.m u.ins)  ~|('a proof in the token fails its DLEQ check' !!)
    =/  fee  (need (fee:cw keysets.u.m u.ins))
    =/  total  (sum u.ins)
    ?:  (lte total fee)  ~|('the token is worth no more than the fee' !!)
    =/  ks  (active-keyset url 'sat')
    ?~  ks  ~|('the mint has no active keyset for sats' !!)
    =/  amounts  (need (denominations:cw (sub total fee) keys.u.ks))
    =/  id  next-op
    =.  next-op  +(next-op)
    =^  outs  state  (new-outputs id.u.ks amounts)
    =.  ops  (~(put by ops) id [%receive url u.ins outs])
    [~[(swap-card id url u.ins outs)] state]
  ::
      %send
    =/  url  (strip-slash:cw mint.a)
    =/  m  (~(get by mints) url)
    ?~  m  ~|('add the mint first' !!)
    ?:  =(0 amount.a)  ~|('send at least 1 sat' !!)
    =/  have=(list proof:sur)  (fall (~(get by proofs) url) ~)
    =/  pick  (select have amount.a keysets.u.m)
    ?~  pick  ~|('not enough ecash at that mint, with fees' !!)
    =/  ins=(list proof:sur)  ins.u.pick
    ::  the proofs are reserved: out of the wallet until this is done
    =/  used  (silt (turn ins |=(p=proof:sur secret.p)))
    =.  proofs
      (~(put by proofs) url (skip have |=(p=proof:sur (~(has in used) secret.p))))
    ::  they add up exactly: they're the token, as they are, fee-free
    ?:  exact.u.pick
      (made url amount.a memo.a ins)
    =/  ks  (active-keyset url 'sat')
    ?~  ks  ~|('the mint has no active keyset for sats' !!)
    =/  send-amounts  (need (denominations:cw amount.a keys.u.ks))
    =/  change
      (need (denominations:cw (sub (sum ins) (add amount.a fee.u.pick)) keys.u.ks))
    =/  id  next-op
    =.  next-op  +(next-op)
    =^  outs  state  (new-outputs id.u.ks (weld send-amounts change))
    =.  ops
      %+  ~(put by ops)  id
      [%send url amount.a memo.a ins outs (lent send-amounts)]
    [~[(swap-card id url ins outs)] state]
  ==
::  +heard: an http response for an operation, on the wire it went out on
::
++  heard
  |=  [id=@ud tag=path res=client-response:iris]
  ^-  (quip card _state)
  =/  o  (~(get by ops) id)
  ?~  o  `state
  =/  got=(each json @t)  (parse res)
  ?-  -.u.o
    %add-mint  (heard-add-mint id u.o tag got)
    %deposit   (heard-deposit id u.o tag got)
    %receive   (heard-swap id u.o got)
    %send      (heard-swap id u.o got)
  ==
::  +parse: a 2xx json body, or why not
::
++  parse
  |=  res=client-response:iris
  ^-  (each json @t)
  ?.  ?=(%finished -.res)  [%| 'the request was cancelled']
  =/  status  status-code.response-header.res
  =/  body=@t  ?~(full-file.res '' q.data.u.full-file.res)
  =/  j  (de:json:html body)
  ?:  &((gte status 200) (lth status 300))
    ?~  j  [%| 'the mint sent something that isn\'t json']
    [%& u.j]
  =/  e  ?~(j ~ (error:de:cw u.j))
  ?^  e  [%| detail.u.e]
  [%| (crip "http {<status>}: {(scag 200 (trip body))}")]
::
::  adding a mint: its keysets, then each one's keys, each checked against
::  its id
::
++  heard-add-mint
  |=  [id=@ud o=op:sur tag=path got=(each json @t)]
  ^-  (quip card _state)
  ?>  ?=(%add-mint -.o)
  ?:  ?=(%| -.got)  (fail id (cat 3 'adding the mint failed: ' p.got))
  ?:  ?=([%keysets ~] tag)
    =/  ks  (keysets:de:cw p.got)
    ?~  ks  (fail id 'the mint\'s keysets didn\'t parse')
    ?~  u.ks  (fail id 'the mint has no keysets')
    =/  ids=(list @t)  (turn u.ks |=([i=@t *] i))
    =.  ops  (~(put by ops) id o(found u.ks, waiting (silt ids)))
    :_  state
    %+  turn  ids
    |=(k=@t (get id /keys/[k] (rap 3 ~[url.o '/v1/keys/' k])))
  ?.  ?=([%keys @ ~] tag)  `state
  =/  kid  i.t.tag
  =/  got-keys  (keys:de:cw p.got)
  =/  meta  (skim found.o |=([i=@t *] =(i kid)))
  =/  mn=mint:sur  (fall (~(get by mints) url.o) [url.o ~])
  =?  mn  &(?=([~ ^] got-keys) ?=(^ meta))
    =/  k  i.u.got-keys
    =/  ks=keyset:sur
      [kid unit.k active.i.meta fee-ppk.i.meta final-expiry.i.meta keys.k]
    ::  a keyset whose id isn't its own is dropped: the mint could be
    ::  misstating its fee
    ?.  (id-ok:cw ks)  mn
    mn(keysets (~(put by keysets.mn) kid ks))
  =/  waiting  (~(del in waiting.o) kid)
  ?.  =(~ waiting)
    =.  ops  (~(put by ops) id o(waiting waiting))
    =.  mints  (~(put by mints) url.o mn)
    `state
  =.  ops  (~(del by ops) id)
  ?:  =(~ keysets.mn)
    (note (cat 3 'no keyset of the mint checked out: ' url.o))
  =.  mints  (~(put by mints) url.o mn)
  %-  note
  %+  rap  3
  :~  'added '  url.o  ': '
      (crip (a-co:co ~(wyt by keysets.mn)))  ' keysets'
  ==
::
::  depositing: a quote and invoice, polled until paid, then minted
::
++  heard-deposit
  |=  [id=@ud o=op:sur tag=path got=(each json @t)]
  ^-  (quip card _state)
  ?>  ?=(%deposit -.o)
  ?:  ?=(%| -.got)
    ::  a failed poll is tried again; a failed quote or mint isn't
    ?:  &(?=([%poll ~] tag) ?=(%waiting step.o))
      [~[(poll-timer id)] state]
    (fail id (cat 3 'the deposit failed: ' p.got))
  ?+  tag  `state
      ?([%quote ~] [%poll ~])
    =/  q  (mint-quote:de:cw p.got)
    ?~  q  (fail id 'the mint\'s quote didn\'t parse')
    =/  expiry=@da
      ?~  expiry.u.q  (add now.bowl ~h1)
      (from-unix:chrono:userlib u.expiry.u.q)
    =.  o  o(quote quote.u.q, request request.u.q, expiry expiry, step %waiting)
    ?.  paid.u.q
      ?:  (gth now.bowl expiry)  (fail id 'the invoice expired unpaid')
      =.  ops  (~(put by ops) id o)
      [~[(poll-timer id)] state]
    ::  paid but already issued, and not by us here: only a restore can
    ::  bring those proofs back
    ?:  issued.u.q  (fail id 'the quote was already issued')
    (mint-outputs id o)
  ::
      [%mint ~]
    =/  sigs  (signatures:de:cw p.got)
    ?~  sigs  (fail id 'the mint\'s signatures didn\'t parse')
    =/  new  (unblind-all mint.o outputs.o u.sigs)
    ?:  ?=(%| -.new)  (fail id p.new)
    =.  proofs  (~(put by proofs) mint.o (weld (fall (~(get by proofs) mint.o) ~) p.new))
    =.  ops  (~(del by ops) id)
    %-  note
    (rap 3 ~['deposited ' (crip (a-co:co amount.o)) ' sats at ' mint.o])
  ==
::
::  swapping: a received token for our own proofs, or ours into a token
::  to send and change
::
++  heard-swap
  |=  [id=@ud o=op:sur got=(each json @t)]
  ^-  (quip card _state)
  ::  one kind at a time: their fields sit in different places
  ?+  -.o  `state
      %receive
    =/  new  (swapped mint.o outputs.o got)
    ?:  ?=(%| -.new)  (fail id (cat 3 'receiving failed: ' p.new))
    =.  ops  (~(del by ops) id)
    =.  proofs  (~(put by proofs) mint.o (weld p.new (fall (~(get by proofs) mint.o) ~)))
    (note (rap 3 ~['received ' (crip (a-co:co (sum p.new))) ' sats']))
  ::
      %send
    =/  new  (swapped mint.o outputs.o got)
    ?:  ?=(%| -.new)
      ::  our reserved proofs come back, unless the mint says they're
      ::  spent (a check of their state sorts out the rest)
      =?  proofs  ?=(~ (find "spent" (cass (trip p.new))))
        (~(put by proofs) mint.o (weld inputs.o (fall (~(get by proofs) mint.o) ~)))
      (fail id (cat 3 'sending failed: ' p.new))
    =.  ops  (~(del by ops) id)
    ::  the first sends proofs are the token; the rest are our change
    =/  change  (slag sends.o p.new)
    =.  proofs  (~(put by proofs) mint.o (weld change (fall (~(get by proofs) mint.o) ~)))
    (made mint.o amount.o memo.o (scag sends.o p.new))
  ==
::  +swapped: a swap's answer as proofs on our outputs, or why not
::
++  swapped
  |=  [url=@t outs=(list output:sur) got=(each json @t)]
  ^-  (each (list proof:sur) @t)
  ?:  ?=(%| -.got)  got
  =/  sigs  (signatures:de:cw p.got)
  ?~  sigs  [%| 'the mint\'s signatures didn\'t parse']
  (unblind-all url outs u.sigs)
::  +made: a token of these proofs, kept to hand over
::
++  made
  |=  [url=@t amount=@ud memo=(unit @t) ps=(list proof:sur)]
  ^-  (quip card _state)
  =/  token  (encode-token:cw [url 'sat' memo ps])
  =/  entries=(list sent:sur)  [[now.bowl url amount token] sent]
  =.  sent  entries
  (note (rap 3 ~['made a token for ' (crip (a-co:co amount)) ' sats']))
::
++  swap-card
  |=  [id=@ud url=@t ins=(list proof:sur) outs=(list output:sur)]
  ^-  card
  %:  post  id  /swap  (cat 3 url '/v1/swap')
    %-  pairs:enjs:format
    :~  inputs+(proofs:en:cw ins)
        outputs+(outputs:en:cw (turn outs blinded))
    ==
  ==
::
++  sum
  |=  ps=(list proof:sur)
  ^-  @ud
  (roll ps |=([p=proof:sur n=@ud] (add n amount.p)))
::  +select: proofs for an amount. first, largest first, any that add up
::  to it exactly: sent as they are, no swap, no fee. else, largest first
::  until they cover the amount and the fee of swapping them
::
++  select
  |=  [have=(list proof:sur) amount=@ud keysets=(map @t keyset:sur)]
  ^-  (unit [ins=(list proof:sur) fee=@ud exact=?])
  =/  big=(list proof:sur)
    (sort have |=([a=proof:sur b=proof:sur] (gth amount.a amount.b)))
  =/  exact=(list proof:sur)
    =|  out=(list proof:sur)
    =/  left  amount
    =/  ps  big
    |-
    ?~  ps  ?:(=(0 left) out ~)
    ?:  =(0 left)  out
    ?:  (gth amount.i.ps left)  $(ps t.ps)
    $(ps t.ps, left (sub left amount.i.ps), out [i.ps out])
  ?^  exact  `[exact 0 &]
  =|  out=(list proof:sur)
  =/  ps  big
  |-
  =/  fee  (fall (fee:cw keysets out) 0)
  ?:  &(?=(^ out) (gte (sum out) (add amount fee)))  `[out fee |]
  ?~  ps  ~
  $(ps t.ps, out [i.ps out])
::  +resolve: a token's proofs with their keyset ids made full; ~ if one
::  isn't among the mint's
::
++  resolve
  |=  [ps=(list proof:sur) ids=(list @t)]
  ^-  (unit (list proof:sur))
  =|  out=(list proof:sur)
  |-
  ?~  ps  `(flop out)
  =/  full  (full-id:cw id.i.ps ids)
  ?~  full  ~
  $(ps t.ps, out [i.ps(id u.full) out])
::  +dleqs-ok: a token's DLEQ proofs, where it gives them with their
::  blinding factors, check out against the mint's keys (NUT-12)
::
++  dleqs-ok
  |=  [m=mint:sur ps=(list proof:sur)]
  ^-  ?
  %+  levy  ps
  |=  p=proof:sur
  ?~  dleq.p  &
  ?~  r.u.dleq.p  &
  =/  ks  (~(get by keysets.m) id.p)
  ?~  ks  |
  =/  k  (~(get by keys.u.ks) amount.p)
  ?~  k  |
  %:  proof-dleq-ok:cashu
    (as-octs:mimes:html secret.p)
    c.p
    u.k
    e.u.dleq.p
    s.u.dleq.p
    u.r.u.dleq.p
  ==
::  +mint-outputs: blind the amount into outputs on an active keyset,
::  save them and advance the counter, then ask the mint to sign them
::
++  mint-outputs
  |=  [id=@ud o=op:sur]
  ^-  (quip card _state)
  ?>  ?=(%deposit -.o)
  =/  ks  (active-keyset mint.o unit.o)
  ?~  ks  (fail id 'the mint has no active keyset for sats')
  =/  amounts  (denominations:cw amount.o keys.u.ks)
  ?~  amounts  (fail id 'the keyset can\'t make up that amount')
  =^  outs  state  (new-outputs id.u.ks u.amounts)
  =.  ops  (~(put by ops) id o(step %minting, outputs outs))
  =/  body
    %-  pairs:enjs:format
    :~  quote+s+quote.o
        outputs+(outputs:en:cw (turn outs blinded))
    ==
  [~[(post id /mint (cat 3 mint.o '/v1/mint/bolt11') body)] state]
::  +new-outputs: secrets and blinding factors for these amounts, from
::  the keyset's counter onwards; the counter moves past them now, so no
::  secret is ever used twice
::
++  new-outputs
  |=  [kid=@t amounts=(list @ud)]
  ^-  [(list output:sur) _state]
  =/  c  (fall (~(get by counters) kid) 0)
  =|  outs=(list output:sur)
  |-
  ?~  amounts
    [(flop outs) state(counters (~(put by counters) kid c))]
  =/  [secret=@t r=@]  (derive:cs seed kid c)
  $(amounts t.amounts, c +(c), outs [[kid i.amounts secret r] outs])
::
++  blinded
  |=  o=output:sur
  ^-  blinded:sur
  [id.o amount.o (blind:cashu (as-octs:mimes:html secret.o) r.o)]
::  +unblind-all: the mint's signatures on our outputs, in order, as
::  proofs. each must be for the output's keyset and amount, and prove
::  (DLEQ) it's signed with that amount's key
::
++  unblind-all
  |=  [url=@t outs=(list output:sur) sigs=(list blind-sig:sur)]
  ^-  (each (list proof:sur) @t)
  =/  m  (~(get by mints) url)
  ?~  m  [%| 'the mint is gone']
  ?.  =((lent outs) (lent sigs))  [%| 'the mint signed a different number of outputs']
  =|  out=(list proof:sur)
  |-
  ?~  outs  [%& (flop out)]
  ?~  sigs  [%& (flop out)]
  =*  o  i.outs
  =*  s  i.sigs
  ?.  &(=(id.o id.s) =(amount.o amount.s))
    [%| 'a signature doesn\'t match its output']
  =/  ks  (~(get by keysets.u.m) id.o)
  ?~  ks  [%| 'a signature is on an unknown keyset']
  =/  k  (~(get by keys.u.ks) amount.o)
  ?~  k  [%| 'a signature is for an amount the keyset has no key for']
  =/  b  b:(blinded o)
  ?~  dleq.s  [%| 'the mint didn\'t prove its signature (no DLEQ)']
  ?.  (dleq-ok:cashu u.k b c.s e.u.dleq.s s.u.dleq.s)
    [%| 'the mint\'s signature proof (DLEQ) is wrong']
  =/  c  (unblind:cashu c.s r.o u.k)
  =/  p=proof:sur  [id.o amount.o secret.o c `[e.u.dleq.s s.u.dleq.s `r.o] ~]
  $(outs t.outs, sigs t.sigs, out [p out])
::
++  active-keyset
  |=  [url=@t un=@t]
  ^-  (unit keyset:sur)
  =/  m  (~(get by mints) url)
  ?~  m  ~
  =/  ks=(list keyset:sur)
    (skim ~(val by keysets.u.m) |=(k=keyset:sur &(active.k =(un unit.k))))
  ::  the cheapest to spend from
  ?~  ks  ~
  `(snag 0 (sort ks |=([a=keyset:sur b=keyset:sur] (lth fee-ppk.a fee-ppk.b))))
::
::  timers and requests
::
++  wake
  |=  id=@ud
  ^-  (quip card _state)
  =/  o  (~(get by ops) id)
  ?~  o  `state
  ?.  ?=([%deposit *] u.o)  `state
  ?.  ?=(%waiting step.u.o)  `state
  :_  state
  ~[(get id /poll (rap 3 ~[mint.u.o '/v1/mint/quote/bolt11/' quote.u.o]))]
::
++  poll-timer
  |=  id=@ud
  ^-  card
  [%pass /op/(scot %ud id) %arvo %b %wait (add now.bowl poll-every)]
::
++  get
  |=  [id=@ud tag=path url=@t]
  ^-  card
  :*  %pass  (weld /op/(scot %ud id) tag)  %arvo  %i  %request
      [%'GET' url ~ ~]  *outbound-config:iris
  ==
::
++  post
  |=  [id=@ud tag=path url=@t body=json]
  ^-  card
  =/  text  (en:json:html body)
  :*  %pass  (weld /op/(scot %ud id) tag)  %arvo  %i  %request
      [%'POST' url ~[['Content-Type' 'application/json']] `(as-octs:mimes:html text)]
      *outbound-config:iris
  ==
::
::  the log
::
++  note
  |=  what=@t
  ^-  (quip card _state)
  =/  entries=(list [at=@da what=@t])  [[now.bowl what] log]
  =.  log  (scag 50 entries)
  `state
::
++  fail
  |=  [id=@ud why=@t]
  ^-  (quip card _state)
  =.  ops  (~(del by ops) id)
  (note why)
::
::  json
::
++  balance
  |=  url=@t
  ^-  @ud
  (roll (fall (~(get by proofs) url) ~) |=([p=proof:sur n=@ud] (add n amount.p)))
::
++  wallet-json
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  :-  %balance
      (numb (roll ~(tap in ~(key by mints)) |=([u=@t n=@ud] (add n (balance u)))))
    ::
      :-  %mints
      :-  %a
      %+  turn  ~(val by mints)
      |=  m=mint:sur
      %-  pairs
      :~  url+s+url.m
          balance+(numb (balance url.m))
          proofs+(numb (lent (fall (~(get by proofs) url.m) ~)))
          keysets+(numb ~(wyt by keysets.m))
      ==
    ::
      :-  %ops
      :-  %a
      %+  turn  ~(tap by ops)
      |=  [id=@ud o=op:sur]
      ?-  -.o
          %add-mint
        (pairs ~[id+(numb id) kind+s+'add-mint' url+s+url.o])
      ::
          %deposit
        %-  pairs
        :~  id+(numb id)
            kind+s+'deposit'
            mint+s+mint.o
            amount+(numb amount.o)
            step+s+step.o
            invoice+s+request.o
        ==
      ::
          %receive
        (pairs ~[id+(numb id) kind+s+'receive' mint+s+mint.o amount+(numb (sum inputs.o))])
      ::
          %send
        (pairs ~[id+(numb id) kind+s+'send' mint+s+mint.o amount+(numb amount.o)])
      ==
    ::
      :-  %sent
      :-  %a
      %+  turn  sent
      |=  s=sent:sur
      (pairs ~[at+(sect at.s) mint+s+mint.s amount+(numb amount.s) token+s+token.s])
    ::
      :-  %log
      a+(turn log |=([at=@da what=@t] (pairs ~[at+(sect at) what+s+what])))
  ==
--
