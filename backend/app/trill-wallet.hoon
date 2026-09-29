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
::      [%zap to amount comment about]  a nutzap (NIP-61) to a pubkey
::      [%sync on]                 mirror to relays (NIP-60) or stop; on
::                                 publishes everything again
::
::    NIP-61: with the wallet event goes a kind 10019 (our mints, relays
::    and the P2PK key to lock ecash to), and a %nostrill watch for
::    nutzaps (kind 9321) to us at our mints. each is checked (our mint,
::    locked to our key, DLEQ), unlocked with the P2PK key and swapped in;
::    its history event tags it redeemed
::
::    NIP-60: while sync is on (the default), a mint's proofs are
::    published whenever they change, as new token events that replace
::    (and delete) the last ones, with a history event for the change in
::    balance; the wallet event when the mints change. %nostrill has the
::    nostr key and the relays: it seals, signs and sends what we draft,
::    and pokes us back the event ids ([%signed ref ids]). the key never
::    leaves it. the ship stays the source of truth
::
::    scries:
::      /x/wallet  json: balances, mints, operations, sent tokens, the log
::      /x/phrase  json: the seed phrase
::
::    it imports the tests only so that |commit type-checks them
::
/-  sur=wallet, comms=nostrill-comms, nostr
/+  default-agent, dbug, cashu, cw=cashu-wire, cs=cashu-seed, nip60,
    bip39-english
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
      ::  NIP-60
      quiet=?                                   ::  sync off
      tokens=(map @t (list @ux))                ::  live 7375s, by mint
      listed=(set @t)                           ::  mints in the last 17375
      synced=(map @t (list proof:sur))          ::  proofs the relays have
      round=(unit round)                        ::  a sync %nostrill has
      ::  NIP-61
      zaps=(set @ux)                            ::  nutzaps seen
      redeemed=(map @t (list [ev=@ux from=@ux]))  ::  not in a history yet
  ==
::  +round: a sync out at %nostrill for signing, one at a time. first
::  the wallet event, token events and deletions; then, with their ids,
::  the history. what it replaces, to roll back if %nostrill refuses
::
+$  round
  $:  ref=@ud
      step=?(%tokens %history)
      history=?
      wallet=?
      mints=(list mint-round)
      $=  old
      $:  synced=(map @t (list proof:sur))
          listed=(set @t)
          redeemed=(map @t (list [ev=@ux from=@ux]))
      ==
  ==
+$  mint-round
  $:  url=@t
      gone=(list @ux)
      made=@ud
      was=@ud
      has=@ud
      zaps=(list [ev=@ux from=@ux])
  ==
::  +poll-every: how often a deposit's quote is checked
::
++  poll-every  ~s3
::  +restore-batch, +restore-gap: NUT-09 outputs asked about at a time, and
::  how many empty batches in a row end a keyset's restore
::
++  restore-batch  25
++  restore-gap  3
::  +zap-wait: how long relays get to find someone's 10019
::
++  zap-wait  ~s8
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
  ::  mirrored to nostr from the start
  `this(phrase words, seed (seed:cs words), quiet |)
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
  =^  more  state  (mirror:hc &)
  [(weld cards more) this]
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
    =^  more  state  (mirror:hc &)
    [(weld cards more) this]
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
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?:  ?=([%watch ~] wire)
    ?.  ?=([%poke-ack ^] sign)  `this
    =^  cards  state  (note:hc '%nostrill won\'t watch for our nutzaps')
    [cards this]
  ?:  ?=([%fetch @ ~] wire)
    ?.  ?=([%poke-ack ^] sign)  `this
    =^  cards  state  (fail:hc (slav %ud i.t.wire) '%nostrill won\'t look up their 10019')
    [cards this]
  ?:  ?=([%zap ~] wire)
    ?.  ?=([%poke-ack ^] sign)  `this
    =^  cards  state  (note:hc '%nostrill refused to publish our nutzap')
    [cards this]
  ?.  ?=([%nostr ~] wire)  (on-agent:def wire sign)
  ?.  ?=(%poke-ack -.sign)  `this
  ?~  p.sign  `this
  ::  refused: the relays didn't get this round. roll back to what
  ::  they have, so the next mirror sends it again
  =?  state  ?=(^ round)
    %=  state
      round     ~
      synced    synced.old.u.round
      listed    listed.old.u.round
      redeemed  redeemed.old.u.round
    ==
  =^  cards  state  (note:hc '%nostrill refused our NIP-60 events')
  [cards this]
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
    (take url u.m proofs.u.tok ~)
  ::
      %nostr-event
    ?.  =(/gall/nostrill sap.bowl)  ~|(%nostr-events-from-nostrill-only !!)
    ?:  =('nutzaps' name.a)  (nutzap event.a)
    =/  zid  (rush name.a ;~(pfix (jest 'zap-') dem))
    ?~  zid  `state
    (zap-heard u.zid event.a)
  ::
      %nostr-eose
    ?.  =(/gall/nostrill sap.bowl)  ~|(%nostr-events-from-nostrill-only !!)
    =/  zid  (rush name.a ;~(pfix (jest 'zap-') dem))
    ?~  zid  `state
    ::  one relay done: go if some relay had their 10019
    (zap-go u.zid |)
  ::
      %zap
    ?:  =(0 amount.a)  ~|('zap at least 1 sat' !!)
    ?.  .^(? %gu /(scot %p our.bowl)/nostrill/(scot %da now.bowl)/$)
      ~|('%nostrill isn\'t running' !!)
    =/  id  next-op
    =.  next-op  +(next-op)
    =.  ops
      (~(put by ops) id [%zap to.a amount.a comment.a about.a %finding ~ '' '' ~ ~ 0])
    =/  =filter:nostr  [~ `(silt ~[to.a]) `(silt ~[10.019]) ~ ~ ~ ~]
    =/  name  (cat 3 'zap-' (crip (a-co:co id)))
    :_  state
    :~  [%pass /op/(scot %ud id) %arvo %b %wait (add now.bowl zap-wait)]
        :*  %pass  /fetch/(scot %ud id)  %agent  [our.bowl %nostrill]
            %poke  %noun  !>([%fetch name ~[filter]])
    ==  ==
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
    ::  a new P2PK key for the wallet event
    `state(phrase text, seed (seed:cs text), counters ~, listed ~)
  ::
      %sync
    ?.  on.a  `state(quiet &, round ~)
    ::  publish everything again, as if from nothing, and without
    ::  history. +on-poke's mirror then finds a round out
    (mirror(quiet |, round ~, synced ~, listed ~) |)
  ::
      %signed
    ?.  =(/gall/nostrill sap.bowl)  ~|(%signed-by-nostrill-only !!)
    ?~  round  `state
    ?.  =(ref.a ref.u.round)  `state
    ?:  ?=(%history step.u.round)
      ::  done: +on-poke's mirror sends what changed meanwhile
      `state(round ~)
    (signed u.round ids.a)
  ==
::  +mirror: NIP-60. send %nostrill what changed since the relays last
::  heard: each mint whose proofs did, and the wallet event if our mints
::  did. one round at a time: what changes meanwhile goes in the next.
::  history too, if asked and the balance moved
::
++  mirror
  |=  history=?
  ^-  (quip card _state)
  ?:  quiet  `state
  ?^  round  `state
  ?:  &(=(synced proofs) =(listed ~(key by mints)))  `state
  ?.  .^(? %gu /(scot %p our.bowl)/nostrill/(scot %da now.bowl)/$)
    (note 'not mirrored to nostr: %nostrill isn\'t running')
  =/  ref  next-op
  =.  next-op  +(next-op)
  =/  wallet=?  !=(listed ~(key by mints))
  =/  ours=(list @t)  ~(tap in ~(key by mints))
  ::  to roll back to if %nostrill refuses
  =/  old-redeemed  redeemed
  =|  drafts=(list draft:comms)
  ::  with the wallet event, NIP-61's 10019 and a watch for nutzaps
  =|  watch=(list card)
  =?  drafts  wallet
    =/  key  (p2pk-key:cs seed 0)
    =/  info  (info:nip60 nostr-relays ours x:(base:cashu key))
    [[10.019 info '' |] [17.375 ~ (wallet:nip60 key ours) &] drafts]
  =?  watch  wallet  watch-cards
  =|  done=(list mint-round)
  =/  urls=(list @t)  ~(tap in (~(uni in ~(key by synced)) ~(key by proofs)))
  |-
  ?^  urls
    =/  url  i.urls
    =/  old=(list proof:sur)  (~(gut by synced) url ~)
    =/  new=(list proof:sur)  (~(gut by proofs) url ~)
    ?:  =(old new)  $(urls t.urls)
    =/  gone=(list @ux)  (~(gut by tokens) url ~)
    =/  zs  (~(gut by redeemed) url ~)
    =.  redeemed  (~(del by redeemed) url)
    =/  chunks  (chunk new)
    =/  made=(list draft:comms)
      %+  turn  chunks
      |=  ps=(list proof:sur)
      ^-  draft:comms
      [7.375 ~ (token:nip60 url 'sat' ps gone) &]
    =?  made  ?=(^ gone)  (snoc made [5 (deletion:nip60 gone) '' |])
    %=  $
      urls    t.urls
      drafts  (weld (flop made) drafts)
      done    [[url gone (lent chunks) (sum old) (sum new) zs] done]
    ==
  ::  ^round: the mold, not the state's face
  =/  out=^round
    [ref %tokens history wallet (flop done) synced listed old-redeemed]
  :_  state(round `out, synced proofs, listed ~(key by mints))
  :_  watch
  :*  %pass  /nostr  %agent  [our.bowl %nostrill]
      %poke  %noun  !>([%sign ref (flop drafts) ~])
  ==
::  +watch-cards: have %nostrill watch the relays for nutzaps to us at
::  our mints. its last watch is replaced, and the relays send what they
::  have again
::
++  watch-cards
  ^-  (list card)
  ?:  |(quiet =(~ mints))  ~
  ?.  .^(? %gu /(scot %p our.bowl)/nostrill/(scot %da now.bowl)/$)  ~
  =/  pub  .^(@ux %gx /(scot %p our.bowl)/nostrill/(scot %da now.bowl)/pubkey/noun)
  =/  ours=(list @t)  ~(tap in ~(key by mints))
  =/  tags  (~(gas by *(map @t (list @t))) ~[['p' ~[(id-hex:nip60 pub)]] ['u' ours]])
  =/  =filter:nostr  [~ ~ `(silt ~[9.321]) `tags ~ ~ ~]
  :~  :*  %pass  /watch  %agent  [our.bowl %nostrill]
          %poke  %noun  !>([%watch 'nutzaps' ~[filter]])
  ==  ==
::  +nostr-relays: the relays %nostrill has, for our 10019
::
++  nostr-relays
  ^-  (list @t)
  =/  j  .^(json %gx /(scot %p our.bowl)/nostrill/(scot %da now.bowl)/j/relays/json)
  ?.  ?=([%o *] j)  ~
  =/  r  (~(get by p.j) 'relays')
  ?.  ?=([~ %o *] r)  ~
  ~(tap in ~(key by p.u.r))
::  +signed: round one's ids, in the order we drafted: the wallet event's,
::  then each mint's token events and its deletion. note the token events
::  that are live now, and send the history
::
++  signed
  |=  [r=^round ids=(list @ux)]
  ^-  (quip card _state)
  ::  the 10019's and the wallet event's
  =?  ids  wallet.r  (slag 2 ids)
  =|  drafts=(list draft:comms)
  =/  ms  mints.r
  |-
  ?^  ms
    =/  m  i.ms
    =/  made=(list @ux)  (scag made.m ids)
    =.  ids  (slag (add made.m ?~(gone.m 0 1)) ids)
    =.  tokens
      ?~  made  (~(del by tokens) url.m)
      (~(put by tokens) url.m made)
    =?  drafts  &(history.r !=(was.m has.m))
      =/  text
        ?:  (gth has.m was.m)
          (history:nip60 & (sub has.m was.m) 'sat' made gone.m)
        (history:nip60 | (sub was.m has.m) 'sat' made gone.m)
      [[7.376 (redeemed:nip60 zaps.m) text &] drafts]
    $(ms t.ms)
  ?~  drafts  `state(round ~)
  =/  ref  next-op
  =.  next-op  +(next-op)
  :_  state(round `r(ref ref, step %history))
  :~  :*  %pass  /nostr  %agent  [our.bowl %nostrill]
          %poke  %noun  !>([%sign ref (flop drafts) ~])
  ==  ==
::  +chunk: proofs by the token event, per-event:nip60 in each
::
++  chunk
  |=  ps=(list proof:sur)
  ^-  (list (list proof:sur))
  ::  =(~ ps), not ?~: a narrowed ps won't take its own slag back
  ?:  =(~ ps)  ~
  [(scag per-event:nip60 ps) $(ps (slag per-event:nip60 ps))]
::  +take: ecash someone gave us, swapped for our own: from a token, or
::  a nutzap's proofs, unlocked
::
++  take
  |=  [url=@t m=mint:sur ps=(list proof:sur) zap=(unit [ev=@ux from=@ux])]
  ^-  (quip card _state)
  =/  ins  (resolve ps ~(tap in ~(key by keysets.m)))
  ?~  ins  ~|('the token uses a keyset its mint doesn\'t list' !!)
  ?.  (dleqs-ok m u.ins)  ~|('a proof in the token fails its DLEQ check' !!)
  =/  fee  (need (fee:cw keysets.m u.ins))
  =/  total  (sum u.ins)
  ?:  (lte total fee)  ~|('the token is worth no more than the fee' !!)
  =/  ks  (active-keyset url 'sat')
  ?~  ks  ~|('the mint has no active keyset for sats' !!)
  =/  amounts  (need (denominations:cw (sub total fee) keys.u.ks))
  =/  id  next-op
  =.  next-op  +(next-op)
  =^  outs  state  (new-outputs id.u.ks amounts)
  =.  ops  (~(put by ops) id [%receive url u.ins outs zap])
  [~[(swap-card id url u.ins outs)] state]
::  +nutzap: a kind 9321 to us (NIP-61), redeemed once. anything wrong
::  with it is noted, not a crash, and not remembered: another copy (from
::  another relay, or after a fix) gets another try
::
++  nutzap
  |=  ev=event:nostr
  ^-  (quip card _state)
  ?.  =(9.321 kind.ev)  `state
  ?:  (~(has in zaps) id.ev)  `state
  ::  not while restoring: our counters may be behind. +heard-restore
  ::  has the relays send it again
  ?:  (lien ~(val by ops) |=(o=op:sur ?=(%restore -.o)))  `state
  =/  res  (mule |.((redeem ev)))
  ?:  ?=(%& -.res)
    =^  cards  state  p.res
    [cards state(zaps (~(put in zaps) id.ev))]
  %-  (slog [leaf+"trill-wallet: refused nutzap {<id.ev>}" p.res])
  (note (cat 3 'refused a nutzap: ' (crip (scag 16 ((x-co:co 64) id.ev)))))
::  +redeem: a nutzap's proofs, if they're at one of our mints and
::  locked to our P2PK key, signed for (NUT-11) and taken
::
++  redeem
  |=  ev=event:nostr
  ^-  (quip card _state)
  =/  tag
    |=  k=@t
    ^-  (list @t)
    %+  murn  tags.ev
    |=  t=(list @t)
    ?.  ?=([@ @ *] t)  ~
    ?.  =(k i.t)  ~
    `i.t.t
  =/  us  (tag 'u')
  ?~  us  ~|('no mint' !!)
  =/  url  (strip-slash:cw i.us)
  =/  m  (~(get by mints) url)
  ?~  m  ~|('not at one of our mints' !!)
  =/  units  (tag 'unit')
  ?.  ?|(?=(~ units) =(~['sat'] units))  ~|('not in sats' !!)
  =/  key  (p2pk-key:cs seed 0)
  =/  x  x:(base:cashu key)
  =/  ps=(list proof:sur)
    %+  turn  (tag 'proof')
    |=  j=@t
    ^-  proof:sur
    =/  p  (need (proof:de:cw (need (de:json:html j))))
    ?.  (locked-to x secret.p)  ~|('not locked to our key' !!)
    =/  sig  (sign-secret:cashu key (as-octs:mimes:html secret.p) (shas %zap eny.bowl))
    p(witness `(en:json:html (pairs:enjs:format ~[signatures+a+~[s+sig]])))
  ?~  ps  ~|('no proofs' !!)
  (take url u.m ps `[id.ev pubkey.ev])
::  +zap-heard: a 10019 from whom we're zapping: kept if it's the newest
::
++  zap-heard
  |=  [id=@ud ev=event:nostr]
  ^-  (quip card _state)
  =/  o  (~(get by ops) id)
  ?.  ?=([~ %zap *] o)  `state
  =/  z  u.o
  ?.  &(=(10.019 kind.ev) =(to.z pubkey.ev))  `state
  ?:  &(?=(^ info.z) (gte at.u.info.z created-at.ev))  `state
  =/  lock  (tag-values tags.ev 'pubkey')
  ?~  lock  `state
  =/  =zap-info:sur
    [created-at.ev (tag-values tags.ev 'relay') (tag-values tags.ev 'mint') i.lock]
  `state(ops (~(put by ops) id z(info `zap-info)))
::  +zap-go: with their 10019, swap ecash at a mint they take into proofs
::  locked to their key. not final: another relay may yet have it
::
++  zap-go
  |=  [id=@ud final=?]
  ^-  (quip card _state)
  =/  o  (~(get by ops) id)
  ?.  ?=([~ %zap *] o)  `state
  =/  z  u.o
  ?.  ?=(%finding step.z)  `state
  ?~  info.z
    ?.  final  `state
    (fail id 'they take no nutzaps: no kind 10019 on our relays')
  =/  lock  lock.u.info.z
  ?~  (from-hex:cashu lock)  (fail id 'their nutzap key isn\'t a key')
  =/  cands=(list @t)  mints.u.info.z
  |-
  ?~  cands  (fail id 'we lack the ecash, with fees, at any mint they take')
  =/  url  (strip-slash:cw i.cands)
  =/  m  (~(get by mints) url)
  ?~  m  $(cands t.cands)
  =/  have=(list proof:sur)  (fall (~(get by proofs) url) ~)
  ::  never as they are: they must be locked
  =/  pick  (select have amount.z keysets.u.m |)
  ?~  pick  $(cands t.cands)
  =/  ks  (active-keyset url 'sat')
  ?~  ks  $(cands t.cands)
  =/  ins=(list proof:sur)  ins.u.pick
  =/  used  (silt (turn ins |=(p=proof:sur secret.p)))
  =.  proofs
    (~(put by proofs) url (skip have |=(p=proof:sur (~(has in used) secret.p))))
  =/  send-amounts  (need (denominations:cw amount.z keys.u.ks))
  =/  change
    (need (denominations:cw (sub (sum ins) (add amount.z fee.u.pick)) keys.u.ks))
  =/  locked  (locked-outputs id.u.ks send-amounts lock)
  =^  outs  state  (new-outputs id.u.ks change)
  =/  all  (weld locked outs)
  =.  ops
    %+  ~(put by ops)  id
    z(step %swapping, mint url, u i.cands, inputs ins, outputs all, sends (lent locked))
  [~[(swap-card id url ins all)] state]
::  +locked-outputs: outputs whose secrets are NUT-11 P2PK, locked to a
::  key (02/03 hex), random rather than from our seed: not ours to restore
::
++  locked-outputs
  |=  [kid=@t amounts=(list @ud) lock=@t]
  ^-  (list output:sur)
  =/  i=@ud  0
  |-
  ?~  amounts  ~
  =/  nonce  (hex-of:cw 64 (shas (mix i %nonce) eny.bowl))
  =/  secret=@t
    %-  en:json:html
    :-  %a
    :~  s+'P2PK'
        (pairs:enjs:format ~[nonce+s+nonce data+s+lock tags+a+~])
    ==
  =/  r  (mod (shas (mix i %blind) eny.bowl) n:cashu)
  :-  [kid i.amounts secret ?:(=(0 r) 1 r)]
  $(amounts t.amounts, i +(i))
::  +tag-values: the first values of an event's tags of a name
::
++  tag-values
  |=  [tags=(list (list @t)) k=@t]
  ^-  (list @t)
  %+  murn  tags
  |=  t=(list @t)
  ?.  ?=([@ @ *] t)  ~
  ?.  =(k i.t)  ~
  `i.t.t
::  +locked-to: a NUT-10 P2PK secret with our key in data, spendable on
::  our signature alone (SIG_INPUTS)
::
++  locked-to
  |=  [x=@ secret=@t]
  ^-  ?
  =/  j  (de:json:html secret)
  ?.  ?=([~ %a [%s %'P2PK'] [%o *] ~] j)  |
  =/  o  p.i.t.p.u.j
  =/  data  (~(get by o) 'data')
  ?.  ?=([~ %s *] data)  |
  =/  k  (rush p.u.data hex)
  ?~  k  |
  ?.  =(x (end [3 32] u.k))  |
  ?.  =(66 (met 3 p.u.data))  |
  ::  SIG_ALL would sign the outputs too
  !?=(^ (find "SIG_ALL" (trip (en:json:html (~(gut by o) 'tags' ~)))))
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
    %zap       (heard-swap id u.o got)
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
  =^  cards  state
    %-  note
    %+  rap  3
    :~  'added '  url.o  ': '
        (crip (a-co:co ~(wyt by keysets.mn)))  ' keysets'
    ==
  ::  none of its keysets used yet: our seed may have been used there
  ::  (another wallet, or before a nuke). NUT-13: restore first, which
  ::  also moves the counters past what the mint has signed
  =/  kids=(list @t)  ~(tap in ~(key by keysets.mn))
  ?:  (lien kids |=(k=@t (~(has by counters) k)))  [cards state]
  =/  rid  next-op
  =.  next-op  +(next-op)
  =^  more  state  (restore-next rid [%restore url.o kids 0 0 ~ ~])
  [(weld cards more) state]
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
    ?:  ?=(%| -.new)
      ::  a nutzap's proofs may still be good: try it again when the
      ::  relays next send it. spent ones stay done (whoever spent them)
      =?  zaps  &(?=(^ zap.o) ?=(~ (find "spent" (cass (trip p.new)))))
        (~(del in zaps) ev.u.zap.o)
      (fail id (cat 3 'receiving failed: ' p.new))
    =.  ops  (~(del by ops) id)
    =.  proofs  (~(put by proofs) mint.o (weld p.new (fall (~(get by proofs) mint.o) ~)))
    ?~  zap.o
      (note (rap 3 ~['received ' (crip (a-co:co (sum p.new))) ' sats']))
    ::  for the next history event to tag
    =.  redeemed  (~(put by redeemed) mint.o [u.zap.o (~(gut by redeemed) mint.o ~)])
    (note (rap 3 ~['redeemed a nutzap of ' (crip (a-co:co (sum p.new))) ' sats']))
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
  ::
      %zap
    =/  new  (swapped mint.o outputs.o got)
    ?:  ?=(%| -.new)
      =?  proofs  ?=(~ (find "spent" (cass (trip p.new))))
        (~(put by proofs) mint.o (weld inputs.o (fall (~(get by proofs) mint.o) ~)))
      (fail id (cat 3 'zapping failed: ' p.new))
    =.  ops  (~(del by ops) id)
    =/  change  (slag sends.o p.new)
    =.  proofs  (~(put by proofs) mint.o (weld change (fall (~(get by proofs) mint.o) ~)))
    ::  the 9321: the locked proofs, DLEQ and all, to their relays and ours
    =/  locked  (scag sends.o p.new)
    =/  proof-tags=(list (list @t))
      (turn locked |=(p=proof:sur `(list @t)`~['proof' (en:json:html (proof:nip60 p))]))
    =/  about-tags=(list (list @t))
      ?~  about.o  ~
      ~[~['e' (id-hex:nip60 id.u.about.o)] ~['k' (crip (a-co:co kind.u.about.o))]]
    =/  tags=(list (list @t))
      ;:  weld
        proof-tags
        `(list (list @t))`~[~['unit' 'sat'] ~['u' u.o] ~['p' (id-hex:nip60 to.o)]]
        about-tags
      ==
    =/  relays=(list @t)  ?~(info.o ~ relays.u.info.o)
    =^  cards  state
      %-  note
      %+  rap  3
      :~  'nutzapped '  (crip (a-co:co amount.o))  ' sats to '
          (crip (scag 16 ((x-co:co 64) to.o)))
      ==
    :_  state
    :_  cards
    :*  %pass  /zap  %agent  [our.bowl %nostrill]
        %poke  %noun  !>([%sign id ~[[9.321 tags comment.o |]] relays])
    ==
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
    =^  cards  state  (check-next cid [%check mint.o (weld new have) ~])
    ::  nutzaps held back while we restored: the relays send them again
    [(weld cards watch-cards) state]
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
  ::
      %zap
    ::  the relays have had their time
    (zap-go id &)
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
          %zap
        %-  pairs
        :~  id+(numb id)
            kind+s+'zap'
            to+s+(crip ((x-co:co 64) to.o))
            amount+(numb amount.o)
            step+s+step.o
        ==
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
      :-  %nostr
      %-  pairs
      :~  sync+b+!quiet
          syncing+b+?=(^ round)
          :-  %tokens
          (numb (roll ~(val by tokens) |=([l=(list @ux) k=@ud] (add k (lent l)))))
      ==
    ::
      :-  %log
      a+(turn log |=([at=@da what=@t] (pairs ~[at+(sect at) what+s+what])))
  ==
--
