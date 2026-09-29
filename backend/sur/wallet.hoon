::  wallet: a Cashu ecash wallet (github.com/cashubtc/nuts), as
::  %trill-wallet keeps it. NIP-60 mirrors it to relays; see
::  lib/cashu.hoon for the cryptography
::
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
::  +token: ecash to hand over, from one mint in one unit (NUT-00 V3/V4)
::
+$  token
  $:  mint=@t
      unit=@t
      memo=(unit @t)
      proofs=(list proof)
  ==
--
