::  cashu: the ecash cryptography (github.com/cashubtc/nuts)
::
::    NUT-00  hash_to_curve, blinding and unblinding (BDHKE)
::    NUT-12  DLEQ proofs, that a mint signed with the key it says
::    NUT-11  P2PK: signing a locked proof's secret
::
::    byte strings are octs in their natural order, as cords are. points
::    are zuse's [x y]; on the wire they're compressed SEC1 in hex, which
::    read as one big-endian number: 02/03 prefix, then x
::
|%
++  sc  secp256k1:secp:crypto
+$  point  point:sc
::  +p: the field prime; +n: the group order
::
++  p  0xffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff.fffe.ffff.fc2f
++  n  0xffff.ffff.ffff.ffff.ffff.ffff.ffff.fffe.baae.dce6.af48.a03b.bfd2.5e8c.d036.4141
::
::  points as hex
::
++  from-hex
  |=  h=@t
  ^-  (unit point)
  ?.  =(66 (met 3 h))  ~
  =/  a  (rush h hex)
  ?~  a  ~
  (lift u.a)
::  +lift: a compressed point, if it's on the curve
::
++  lift
  |=  c=@
  ^-  (unit point)
  =/  prefix  (rsh [3 32] c)
  ?.  |(=(2 prefix) =(3 prefix))  ~
  ?.  (on-curve (end [3 32] c))  ~
  `(decompress-point:sc c)
::
++  to-hex
  |=  pt=point
  ^-  @t
  (crip ((x-co:co 66) (compress-point:sc pt)))
::  +uncompressed-hex: 04, x, y: 130 characters (for +hash-e)
::
++  uncompressed-hex
  |=  pt=point
  ^-  @t
  (crip (weld "04" ((x-co:co 128) (add (lsh [3 32] x.pt) y.pt))))
::  +on-curve: whether some y has y^2 = x^3 + 7 (decompress-point doesn't
::  check: it would make a point of any x)
::
++  on-curve
  |=  x=@
  ^-  ?
  ?:  (gte x p)  |
  =/  fp  ~(. fo p)
  =/  y2  (sum.fp (exp.fp 3 x) 7)
  =/  y  (exp.fp (rsh [0 2] +(p)) y2)
  =(y2 (pro.fp y y))
::
++  neg
  |=  pt=point
  ^-  point
  [x.pt ?:(=(0 y.pt) 0 (sub p y.pt))]
::
::  point arithmetic, named apart from the stdlib's add, sub and mul
::
++  pt-mul  |=([pt=point k=@] (mul-point-scalar:sc pt k))
++  pt-add  |=([a=point b=point] (add-points:sc a b))
++  pt-sub  |=([a=point b=point] (add-points:sc a (neg b)))
++  base  |=(k=@ (priv-to-pub:sc k))
::  +sha: SHA-256 of octs, as the big-endian number the spec means
::
++  sha  |=(o=octs `@`(rev 3 32 (shay o)))
::  +hash-to-curve: NUT-00. SHA-256 of the domain separator and the
::  message, then of that and a counter (4 bytes, little-endian) until it
::  names the x of a point, whose even y (02) is taken
::
++  hash-to-curve
  |=  msg=octs
  ^-  point
  =/  domain  'Secp256k1_HashToCurve_Cashu_'
  =/  mh  (shay (add 28 p.msg) (can 3 ~[[28 domain] msg]))
  =/  c=@  0
  |-
  ?>  (lth c 0x1.0000.0000)
  =/  x  (rev 3 32 (shay 36 (can 3 ~[[32 mh] [4 c]])))
  ?:  (on-curve x)  (decompress-point:sc (add (lsh [3 32] 2) x))
  $(c +(c))
::  +blind: B_ = Y + rG, what's sent to the mint to sign
::
++  blind
  |=  [secret=octs r=@]
  ^-  point
  ::  base crashes outside 0 < r < n
  (pt-add (hash-to-curve secret) (base (mod r n)))
::  +unblind: C = C_ - rK, the mint's signature on the secret itself
::
++  unblind
  |=  [c-blind=point r=@ k=point]
  ^-  point
  =/  c  (pt-sub c-blind (pt-mul k (mod r n)))
  ::  zuse gives the point at infinity as [0 0] rather than crashing: no
  ::  signature is that
  ~|  %unblinded-to-infinity
  ?<  =([0 0] c)
  c
::  +hash-e: NUT-12's challenge: SHA-256 of the points' uncompressed hex,
::  run together as a string
::
++  hash-e
  |=  pts=(list point)
  ^-  @
  =/  text=@t  (rap 3 (turn pts uncompressed-hex))
  (sha (as-octs:mimes:html text))
::  +dleq-ok: NUT-12, that C_ was signed by the key behind A:
::  R1 = sG - eA, R2 = sB_ - eC_, and e = hash(R1, R2, A, C_)
::
++  dleq-ok
  |=  [a=point b-blind=point c-blind=point e=@ s=@]
  ^-  ?
  ?.  &((lth e n) (gth s 0) (lth s n))  |
  =/  r1  (pt-sub (base s) (pt-mul a e))
  =/  r2  (pt-sub (pt-mul b-blind s) (pt-mul c-blind e))
  =(e (hash-e ~[r1 r2 a c-blind]))
::  +proof-dleq-ok: NUT-12 from a proof someone else minted, with the
::  blinding factor r they passed on: B_ = Y + rG, C_ = C + rA
::
++  proof-dleq-ok
  |=  [secret=octs c=point a=point e=@ s=@ r=@]
  ^-  ?
  %:  dleq-ok
    a
    (blind secret r)
    (pt-add c (pt-mul a r))
    e
    s
  ==
::  +sign-secret: NUT-11, a P2PK witness signature: schnorr over the
::  SHA-256 of the secret string, as 64-byte hex. zuse's schnorr takes
::  and gives big-endian numbers, as lib/nostr/keys.hoon uses it
::
++  sign-secret
  |=  [key=@ secret=octs eny=@]
  ^-  @t
  (crip ((x-co:co 128) (sign:schnorr:sc key (sha secret) eny)))
::  +sig-ok: a P2PK witness signature (hex) on the secret, by the key
::  whose x (big-endian) this is
::
++  sig-ok
  |=  [pub-x=@ secret=octs sig=@t]
  ^-  ?
  =/  s  (rush sig hex)
  ?~  s  |
  (verify:schnorr:sc pub-x (sha secret) u.s)
--
