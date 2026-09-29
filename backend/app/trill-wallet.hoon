::  trill-wallet: a Cashu ecash wallet (NIP-60/61), kept on the ship
::
::    ecash is proofs: secrets a mint has signed. we keep them here, by
::    mint; the secrets come from our seed phrase (NUT-13), so the phrase
::    alone restores the wallet. mints are talked to over http; anything
::    that takes several requests is an +op in state, step by step, with
::    what it's about to blind or spend saved before the request goes out
::
::    pokes (%noun, our own ship): $action in sur/wallet.hoon
::      [%add-mint url]            fetch and check a mint's keysets
::      [%deposit url amount]      a Lightning invoice; minted once paid
::      [%send url amount memo]    a token (in the sent list)
::      [%receive token]           a cashuA/cashuB token, swapped in
::      [%withdraw url invoice]    pay a Lightning invoice (melt)
::      [%check url]               drop the proofs the mint says are spent
::      [%restore url]             reclaim what our seed made (NUT-09)
::      [%set-phrase words]        use another seed phrase (empty wallet)
::
::    scries:
::      /x/wallet  json: balances, mints, operations, sent tokens, the log
::      /x/phrase  json: the seed phrase
::
::    it imports the tests only so that |commit type-checks them
::
/-  sur=wallet
/+  default-agent, dbug, cashu, cw=cashu-wire, cs=cashu-seed, nip44, bip39-english
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
::  +restore-batch, +restore-gap: NUT-09 outputs asked about at a time, and
::  how many empty batches in a row end a keyset's restore
::
++  restore-batch  25
++  restore-gap  3
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
    ::  the seed phrase, to write down
    [%x %phrase ~]  ``json+!>(`json`s+(crip phrase))
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
    =/  pick  (select have amount.a keysets.u.m &)
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
  ::
      %withdraw
    =/  url  (strip-slash:cw mint.a)
    ?.  (~(has by mints) url)  ~|('add the mint first' !!)
    =/  id  next-op
    =.  next-op  +(next-op)
    =.  ops
      (~(put by ops) id [%withdraw url invoice.a '' 0 0 ~ ~ %quoting])
    =/  body
      (pairs:enjs:format ~[request+s+invoice.a unit+s+'sat'])
    [~[(post id /quote (cat 3 url '/v1/melt/quote/bolt11') body)] state]
  ::
      %check
    =/  url  (strip-slash:cw mint.a)
    =/  have=(list proof:sur)  (fall (~(get by proofs) url) ~)
    ?~  have  (note 'nothing to check')
    =/  id  next-op
    =.  next-op  +(next-op)
    (check-next id [%check url have ~])
  ::
      %restore
    =/  url  (strip-slash:cw mint.a)
    =/  m  (~(get by mints) url)
    ?~  m  ~|('add the mint first' !!)
    =/  id  next-op
    =.  next-op  +(next-op)
    (restore-next id [%restore url ~(tap in ~(key by keysets.u.m)) 0 0 ~ ~])
  ::
      %set-phrase
    ::  only over an empty wallet: the proofs we hold are this seed's
    ?.  &(=(~ ops) (levy ~(val by proofs) |=(ps=(list proof:sur) =(~ ps))))
      ~|('the wallet isn\'t empty: spend or send its ecash first' !!)
    =/  words  (phrase-words words.a)
    ?~  words  ~|('that isn\'t a BIP-39 phrase of 12 to 24 words' !!)
    =/  text=tape  (zing (join " " u.words))
    `state(phrase text, seed (seed:cs text), counters ~)
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
    %withdraw  (heard-withdraw id u.o tag got)
    %check     (heard-check id u.o got)
    %restore   (heard-restore id u.o got)
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
  |=  [have=(list proof:sur) amount=@ud keysets=(map @t keyset:sur) exact-ok=?]
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
  ?:  &(exact-ok ?=(^ exact))  `[exact 0 &]
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
::
::  withdrawing: a melt quote, our proofs reserved with blank outputs for
::  change, then the melt; a pending one is polled
::
++  heard-withdraw
  |=  [id=@ud o=op:sur tag=path got=(each json @t)]
  ^-  (quip card _state)
  ?>  ?=(%withdraw -.o)
  ?:  ?=(%| -.got)
    ?-  step.o
      %quoting  (fail id (cat 3 'the withdrawal failed: ' p.got))
      %pending  [~[(poll-timer id)] state]
        %melting
      ::  refused: the proofs come back, unless it says they're spent
      =?  proofs  ?=(~ (find "spent" (cass (trip p.got))))
        (~(put by proofs) mint.o (weld inputs.o (fall (~(get by proofs) mint.o) ~)))
      (fail id (cat 3 'the payment failed: ' p.got))
    ==
  ?:  ?=([%quote ~] tag)
    =/  q  (melt-quote:de:cw p.got)
    ?~  q  (fail id 'the mint\'s melt quote didn\'t parse')
    =/  m  (~(get by mints) mint.o)
    ?~  m  (fail id 'the mint is gone')
    =/  have=(list proof:sur)  (fall (~(get by proofs) mint.o) ~)
    =/  pick  (select have (add amount.u.q reserve.u.q) keysets.u.m |)
    ?~  pick  (fail id 'not enough ecash at that mint, with fees')
    =/  ins  ins.u.pick
    =/  used  (silt (turn ins |=(p=proof:sur secret.p)))
    =.  proofs
      (~(put by proofs) mint.o (skip have |=(p=proof:sur (~(has in used) secret.p))))
    ::  blanks for whatever may come back: all but the invoice and the
    ::  input fee (NUT-08; a mint may return unused reserve and more)
    =/  over  (sub (sum ins) (add amount.u.q fee.u.pick))
    =/  ks  (active-keyset mint.o 'sat')
    ?~  ks  (fail id 'the mint has no active keyset for sats')
    =^  blanks  state  (new-outputs id.u.ks (reap (blank-count:cw over) 1))
    =.  o
      %=  o
        quote    quote.u.q
        amount   amount.u.q
        reserve  reserve.u.q
        inputs   ins
        blanks   blanks
        step     %melting
      ==
    =.  ops  (~(put by ops) id o)
    =/  body
      %-  pairs:enjs:format
      :~  quote+s+quote.u.q
          inputs+(proofs:en:cw ins)
          outputs+(outputs:en:cw (turn blanks blinded))
      ==
    [~[(post id /melt (cat 3 mint.o '/v1/melt/bolt11') body)] state]
  ::  the melt's answer, or a pending one's quote
  =/  r  (melt-result:de:cw p.got)
  ?~  r  (fail id 'the mint\'s melt answer didn\'t parse')
  ?:  =('PENDING' state.u.r)
    =.  ops  (~(put by ops) id o(step %pending))
    [~[(poll-timer id)] state]
  ?.  =('PAID' state.u.r)
    ::  not paid: the proofs are ours again
    =.  proofs
      (~(put by proofs) mint.o (weld inputs.o (fall (~(get by proofs) mint.o) ~)))
    (fail id 'the invoice wasn\'t paid')
  =/  back  (unblind-change mint.o blanks.o change.u.r)
  =.  ops  (~(del by ops) id)
  ?:  ?=(%| -.back)
    (note (cat 3 'paid, but the change was lost: ' p.back))
  =.  proofs  (~(put by proofs) mint.o (weld p.back (fall (~(get by proofs) mint.o) ~)))
  =/  fee  (sub (sub (sum inputs.o) amount.o) (sum p.back))
  %-  note
  %+  rap  3
  :~  'paid '  (crip (a-co:co amount.o))  ' sats; fees '
      (crip (a-co:co fee))
  ==
::  +unblind-change: NUT-08: change signed onto our blanks, in their
::  order, fewer if it's less; each amount is the signature's, not ours
::
++  unblind-change
  |=  [url=@t blanks=(list output:sur) sigs=(list blind-sig:sur)]
  ^-  (each (list proof:sur) @t)
  =/  m  (~(get by mints) url)
  ?~  m  [%| 'the mint is gone']
  =|  out=(list proof:sur)
  |-
  ?~  sigs  [%& (flop out)]
  ?~  blanks  [%| 'more change than blank outputs']
  =*  b  i.blanks
  =*  s  i.sigs
  ?.  =(id.b id.s)  [%| 'change on another keyset']
  =/  ks  (~(get by keysets.u.m) id.s)
  ?~  ks  [%| 'change on an unknown keyset']
  =/  k  (~(get by keys.u.ks) amount.s)
  ?~  k  [%| 'change of an amount with no key']
  =/  bp  (blind:cashu (as-octs:mimes:html secret.b) r.b)
  ?~  dleq.s  [%| 'the mint didn\'t prove its change (no DLEQ)']
  ?.  (dleq-ok:cashu u.k bp c.s e.u.dleq.s s.u.dleq.s)
    [%| 'the mint\'s change proof (DLEQ) is wrong']
  =/  c  (unblind:cashu c.s r.b u.k)
  =/  p=proof:sur  [id.s amount.s secret.b c `[e.u.dleq.s s.u.dleq.s `r.b] ~]
  $(blanks t.blanks, sigs t.sigs, out [p out])
::
::  checking: which of our proofs the mint says are spent, 100 at a time
::
++  check-next
  |=  [id=@ud o=op:sur]
  ^-  (quip card _state)
  ?>  ?=(%check -.o)
  ?~  todo.o
    =.  ops  (~(del by ops) id)
    (note (cat 3 'checked the proofs at ' mint.o))
  =/  doing  (scag 100 `(list proof:sur)`todo.o)
  =.  ops  (~(put by ops) id o(todo (slag 100 `(list proof:sur)`todo.o), doing doing))
  =/  body  (pairs:enjs:format ~[['Ys' (ys:en:cw doing)]])
  [~[(post id /check (cat 3 mint.o '/v1/checkstate') body)] state]
::
++  heard-check
  |=  [id=@ud o=op:sur got=(each json @t)]
  ^-  (quip card _state)
  ?>  ?=(%check -.o)
  ?:  ?=(%| -.got)  (fail id (cat 3 'checking failed: ' p.got))
  =/  states  (states:de:cw p.got)
  ?~  states  (fail id 'the mint\'s states didn\'t parse')
  ?.  =((lent u.states) (lent doing.o))  (fail id 'the mint answered for other proofs')
  ::  the states come in the order the proofs went
  =/  spent=(set @t)
    =|  out=(set @t)
    =/  ps=(list proof:sur)  doing.o
    =/  ss=(list @t)  u.states
    |-
    ?~  ps  out
    ?~  ss  out
    =?  out  =('SPENT' i.ss)  (~(put in out) secret.i.ps)
    $(ps t.ps, ss t.ss)
  =/  have=(list proof:sur)  (fall (~(get by proofs) mint.o) ~)
  =.  proofs
    (~(put by proofs) mint.o (skip have |=(p=proof:sur (~(has in spent) secret.p))))
  =?  log  !=(~ spent)
    =/  entries=(list [at=@da what=@t])
      :_  log
      :-  now.bowl
      (rap 3 ~['dropped ' (crip (a-co:co ~(wyt in spent))) ' spent proofs'])
    (scag 50 entries)
  (check-next id o)
::
::  restoring: our seed's outputs, batch by batch, that the mint has
::  signed before (NUT-09); each keyset from counter 0 until restore-gap
::  empty batches in a row
::
++  restore-next
  |=  [id=@ud o=op:sur]
  ^-  (quip card _state)
  ?>  ?=(%restore -.o)
  ?~  keysets.o
    ::  done: what we don't hold already goes in, then a check drops
    ::  the spent
    =/  have=(list proof:sur)  (fall (~(get by proofs) mint.o) ~)
    =/  held=(set @t)  (silt (turn have |=(p=proof:sur secret.p)))
    =/  new=(list proof:sur)
      (skip found.o |=(p=proof:sur (~(has in held) secret.p)))
    =.  proofs  (~(put by proofs) mint.o (weld new have))
    =.  ops  (~(del by ops) id)
    =^  noted  state
      (note (rap 3 ~['restored ' (crip (a-co:co (lent new))) ' proofs; checking them']))
    =/  cid  next-op
    =.  next-op  +(next-op)
    (check-next cid [%check mint.o (weld new have) ~])
  =/  kid  i.keysets.o
  =/  outs=(list output:sur)
    %+  turn  (gulf counter.o (add counter.o (dec restore-batch)))
    |=  c=@ud
    =/  [secret=@t r=@]  (derive:cs seed kid c)
    [kid 1 secret r]
  =.  ops  (~(put by ops) id o(batch outs))
  =/  body  (pairs:enjs:format ~[outputs+(outputs:en:cw (turn outs blinded))])
  [~[(post id /restore (cat 3 mint.o '/v1/restore') body)] state]
::
++  heard-restore
  |=  [id=@ud o=op:sur got=(each json @t)]
  ^-  (quip card _state)
  ?>  ?=(%restore -.o)
  ?:  ?=(%| -.got)  (fail id (cat 3 'restoring failed: ' p.got))
  ?~  keysets.o  (restore-next id o)
  =/  kid  i.keysets.o
  =/  pairs  (restored:de:cw p.got)
  ?~  pairs  (fail id 'the mint\'s restore answer didn\'t parse')
  =/  m  (~(get by mints) mint.o)
  ?~  m  (fail id 'the mint is gone')
  ::  our outputs by their blinded point, with their counters
  =/  ours=(map point:sur [c=@ud o=output:sur])
    =|  out=(map point:sur [c=@ud o=output:sur])
    =/  c=@ud  counter.o
    =/  os=(list output:sur)  batch.o
    |-
    ?~  os  out
    $(os t.os, c +(c), out (~(put by out) b:(blinded i.os) [c i.os]))
  =/  got-back=(list [c=@ud p=proof:sur])
    %+  murn  u.pairs
    |=  [b=point:sur s=blind-sig:sur]
    ^-  (unit [c=@ud p=proof:sur])
    =/  mine  (~(get by ours) b)
    ?~  mine  ~
    =/  ks  (~(get by keysets.u.m) id.s)
    ?~  ks  ~
    =/  k  (~(get by keys.u.ks) amount.s)
    ?~  k  ~
    ?~  dleq.s  ~
    ?.  (dleq-ok:cashu u.k b c.s e.u.dleq.s s.u.dleq.s)  ~
    =/  c  (unblind:cashu c.s r.o.u.mine u.k)
    `[c.u.mine [id.s amount.s secret.o.u.mine c `[e.u.dleq.s s.u.dleq.s `r.o.u.mine] ~]]
  =/  found  (weld found.o (turn got-back |=([* p=proof:sur] p)))
  ::  the counter goes past anything the mint had signed
  ::  (rolled over the plain list type: over got-back narrowed to
  ::  non-empty by the =? below, roll doesn't compile)
  =/  top=@ud
    %+  roll  `(list [c=@ud p=proof:sur])`got-back
    |=([[c=@ud *] n=@ud] (max +(c) n))
  =?  counters  ?=(^ got-back)
    (~(put by counters) kid (max top (fall (~(get by counters) kid) 0)))
  =/  empty  ?~(got-back +(empty.o) 0)
  =/  next=op:sur
    ?:  (gte empty restore-gap)
      o(keysets t.keysets.o, counter 0, empty 0, found found)
    o(counter (add counter.o restore-batch), empty empty, found found)
  (restore-next id next)
::  +phrase-words: a phrase as its words, if it's 12 to 24 BIP-39 words
::
++  phrase-words
  |=  t=@t
  ^-  (unit (list tape))
  =/  ws=(list tape)
    %+  skip  (split (cass (trip t)))
    |=(w=tape =(~ w))
  ?.  (~(has in (silt ~[12 15 18 21 24])) (lent ws))  ~
  ?.  (levy ws |=(w=tape ?=(^ (find ~[w] bip39-english))))  ~
  `ws
::
++  split
  |=  t=tape
  ^-  (list tape)
  =|  out=(list tape)
  =|  cur=tape
  |-
  ?~  t  (flop [(flop cur) out])
  ?:  |(=(' ' i.t) =('\0a' i.t))  $(t t.t, out [(flop cur) out], cur ~)
  $(t t.t, cur [i.t cur])
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
  ?+  -.u.o  `state
      %deposit
    ?.  ?=(%waiting step.u.o)  `state
    :_  state
    ~[(get id /poll (rap 3 ~[mint.u.o '/v1/mint/quote/bolt11/' quote.u.o]))]
  ::
      %withdraw
    ?.  ?=(%pending step.u.o)  `state
    :_  state
    ~[(get id /poll (rap 3 ~[mint.u.o '/v1/melt/quote/bolt11/' quote.u.o]))]
  ==
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
      ::
          %withdraw
        %-  pairs
        :~  id+(numb id)
            kind+s+'withdraw'
            mint+s+mint.o
            amount+(numb amount.o)
            step+s+step.o
            invoice+s+invoice.o
        ==
      ::
          %check
        (pairs ~[id+(numb id) kind+s+'check' mint+s+mint.o left+(numb (lent todo.o))])
      ::
          %restore
        %-  pairs
        :~  id+(numb id)
            kind+s+'restore'
            mint+s+mint.o
            keysets-left+(numb (lent keysets.o))
            found+(numb (lent found.o))
        ==
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
