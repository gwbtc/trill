::  wallet: a Cashu ecash wallet (github.com/cashubtc/nuts), as
::  %trill-wallet keeps it. NIP-60 mirrors it to relays; see
::  lib/cashu.hoon for the cryptography
::
/-  nostr
|%
+$  point  [x=@ y=@]
::  +keyset: a mint's keys for one unit, one key per amount (NUT-01/02)
::
::    id: 16 hex (00...) or 66 hex (01...) characters, derived from the
::    rest (+keyset-id in lib/cashu-wire.hoon): check it
::    fee-ppk: parts per thousand of a unit, per proof spent
::    final-expiry: unix seconds after which it's retired; 0 if never
::
+$  keyset
  $:  id=@t
      unit=@t
      active=?
      fee-ppk=@ud
      final-expiry=@ud
      keys=(map @ud point)
  ==
::  +dleq: the mint's proof that it signed with its key (NUT-12); r is
::  our blinding factor, passed along so others can check it too
::
+$  dleq  [e=@ s=@ r=(unit @)]
::  +proof: ecash: a secret and the mint's signature on it (NUT-00)
::
+$  proof
  $:  id=@t
      amount=@ud
      secret=@t
      c=point
      dleq=(unit dleq)
      witness=(unit @t)
  ==
::  +blinded: a BlindedMessage, for the mint to sign
::
+$  blinded  [id=@t amount=@ud b=point]
::  +blind-sig: the mint's BlindSignature on one
::
+$  blind-sig  [id=@t amount=@ud c=point dleq=(unit [e=@ s=@])]
::  +output: what we keep of a blinded message to unblind its signature:
::  its secret and blinding factor
::
+$  output  [id=@t amount=@ud secret=@t r=@]
::  +mint: a mint we use, by its url (no trailing slash)
::
+$  mint  [url=@t keysets=(map @t keyset)]
::  +op: an operation in flight, kept in state step by step so a crash or
::  an upgrade can pick it up again. what it will spend or has blinded is
::  saved before the request that uses it goes out
::
+$  op
  $%  ::  fetching a mint's keysets, then each one's keys
      $:  %add-mint
          url=@t
          found=(list [id=@t unit=@t active=? fee-ppk=@ud final-expiry=@ud])
          waiting=(set @t)                      ::  keysets whose keys are out
      ==
      ::  Lightning in: a quote and its invoice, polled until paid, then
      ::  the ecash minted on these outputs
      $:  %deposit
          mint=@t
          unit=@t
          amount=@ud
          quote=@t
          request=@t                            ::  the bolt11 invoice
          expiry=@da
          step=?(%quoting %waiting %minting)
          outputs=(list output)
      ==
      ::  a token someone gave us, swapped for proofs of our own; or a
      ::  nutzap (NIP-61): its event and sender
      $:  %receive
          mint=@t
          inputs=(list proof)
          outputs=(list output)
          zap=(unit [ev=@ux from=@ux])
      ==
      ::  ecash to hand over: our proofs swapped into the amount (the
      ::  first sends outputs) and change for us
      $:  %send
          mint=@t
          amount=@ud
          memo=(unit @t)
          inputs=(list proof)
          outputs=(list output)
          sends=@ud
      ==
      ::  Lightning out: a melt quote for an invoice, then our proofs
      ::  (reserved) with blank outputs for the change (NUT-05, NUT-08)
      $:  %withdraw
          mint=@t
          invoice=@t
          quote=@t
          amount=@ud
          reserve=@ud
          inputs=(list proof)
          blanks=(list output)
          step=?(%quoting %melting %pending)
      ==
      ::  a nutzap (NIP-61): their 10019 looked up on the relays, our
      ::  ecash swapped into proofs locked to their key (the first sends
      ::  outputs), then a 9321 to them with those
      $:  %zap
          to=@ux                                ::  their nostr pubkey
          amount=@ud
          comment=@t
          about=(unit [id=@ux kind=@ud])        ::  the event zapped
          step=?(%finding %swapping)
          info=(unit zap-info)
          mint=@t                               ::  ours, and as they list it
          u=@t
          inputs=(list proof)
          outputs=(list output)
          sends=@ud
      ==
      ::  asking the mint which proofs are spent, 100 at a time (NUT-07)
      $:  %check
          mint=@t
          todo=(list proof)
          doing=(list proof)
      ==
      ::  asking the mint to sign again what our seed made (NUT-09, 13):
      ::  keyset by keyset, batch by batch from counter 0, until
      ::  restore-gap empty batches in a row
      $:  %restore
          mint=@t
          keysets=(list @t)
          counter=@ud
          empty=@ud
          batch=(list output)
          found=(list proof)
      ==
  ==
::  +zap-info: a kind 10019: where and how someone takes nutzaps
::
+$  zap-info  [at=@ud relays=(list @t) mints=(list @t) lock=@t]
::  +entry: the wallet's history, for people: what moved, where. amount
::  is what came in or went out, fee what it cost on top (or off the top)
::
+$  entry
  $:  at=@da
      kind=?(%deposit %withdraw %send %receive %zap-in %zap-out %ln-in %ln-out)
      mint=@t
      amount=@ud
      fee=@ud
      who=(unit @ux)                            ::  a nutzap's other side
  ==
::  +nwc: a Lightning wallet we use through Nostr Wallet Connect (NIP-47,
::  lib/nwc.hoon): its service's key, relays, and our secret for it (never
::  shown), what it says it does, and our link to its relay
::
+$  nwc
  $:  service=@ux
      relays=(list @t)
      secret=@
      lud16=(unit @t)
      methods=(set @t)                          ::  from its 13194
      encryption=(unit (set @t))                ::  ditto; ~ until heard
      balance=(unit @ud)                        ::  msats
      wid=(unit @ud)                            ::  our socket to relays's first
      link=?(%connecting %open %down)
      tries=@ud                                 ::  reconnects in a row
      queue=(list event:nostr)                  ::  to send once open
      asks=(map @ux nwc-ask)                    ::  our requests, by event id
      invoices=(map @t nwc-invoice)             ::  ours, unpaid: by payment hash
      tick=(unit @da)                           ::  the one timer
  ==
+$  nwc-ask  [sent=@da what=nwc-what]
+$  nwc-what
  $%  [%balance ~]
      [%pay invoice=@t amount=(unit @ud)]       ::  sats, if it says
      [%invoice amount=@ud]                     ::  sats
      [%lookup hash=@t]
  ==
+$  nwc-invoice  [invoice=@t amount=@ud made=@da expires=@da]
::  +sent: a token we made, to copy and hand over; its proofs are
::  someone else's once they swap it
::
+$  sent  [at=@da mint=@t amount=@ud token=@t]
::  +action: pokes from our own ship (%noun; the UI's %json later)
::
+$  action
  $%  [%add-mint url=@t]
      [%deposit mint=@t amount=@ud]             ::  in sats
      [%receive token=@t]                       ::  cashuA... or cashuB...
      [%send mint=@t amount=@ud memo=(unit @t)]
      [%withdraw mint=@t invoice=@t]            ::  pay a bolt11 invoice
      [%check mint=@t]                          ::  drop spent proofs
      [%restore mint=@t]                        ::  what our seed can reclaim
      [%set-phrase words=@t]                    ::  an empty wallet only
      [%del-mint url=@t]                        ::  one we hold nothing at
      ::  a Lightning wallet over NWC
      [%nwc-connect uri=@t]                     ::  nostr+walletconnect://...
      [%nwc-disconnect ~]
      [%nwc-pay invoice=@t]
      [%nwc-invoice amount=@ud description=@t]  ::  sats
      [%nwc-refresh ~]                          ::  ask its balance
      [%sync on=?]                              ::  NIP-60 mirroring
      [%signed ref=@ud ids=(list @ux)]          ::  %nostrill's reply
      [%nostr-event name=@t =event:nostr]       ::  from a %nostrill watch
      [%nostr-eose name=@t]                     ::  a %nostrill fetch's end
      ::  a nutzap: sats to a nostr pubkey, about an event or not
      [%zap to=@ux amount=@ud comment=@t about=(unit [id=@ux kind=@ud])]
  ==
::  +token: ecash to hand over, from one mint in one unit (NUT-00 V3/V4)
::
+$  token
  $:  mint=@t
      unit=@t
      memo=(unit @t)
      proofs=(list proof)
  ==
--
