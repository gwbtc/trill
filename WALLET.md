# Fast secp256k1 point multiplication in Hoon, via the ECDSA recovery jet

Cashu wallets and mints are mostly point multiplications on secp256k1:
blinding (`B_ = Y + r·G`), unblinding (`C = C_ − r·K`), signing (`C_ = k·B_`)
and DLEQ proofs (`s·G − e·A`, `s·B_ − e·C_`). In zuse, `mul-point-scalar`
and `priv-to-pub` are plain Hoon (Jacobian double-and-add), not jetted.
Each call takes about **13 ms** on a fake ship. A wallet restore (NUT-09)
blinds hundreds of outputs, so it takes the better part of a minute.

The only secp256k1 operations vere jets are ECDSA signing (`%sign`),
recovery (`%reco`), nonce derivation (`%make`), and Schnorr signing and
verification (`%sosi`, `%sove`). Recovery can be made to do arbitrary
point arithmetic.

## The trick

`ecdsa-raw-recover:secp256k1:secp:crypto` takes a hash `z` and a signature
`[v r s]`, and returns the public key

```
Q = r⁻¹ · (s·R − z·G)
```

where `R` is the curve point with x-coordinate `r` and the y-parity in
`v`'s low bit. It runs in C (libsecp256k1).

To get `k·P + j·G` for any point `P` and scalars `k` and `j`, choose:

- `r = x(P)` and `v = y(P) mod 2`, so that `R = P`
- `s = k·r mod n`
- `z = −j·r mod n`

Then:

```
Q = r⁻¹ · (k·r·P + j·r·G) = k·P + j·G
```

In Hoon (`n` is the group order):

```hoon
::  k·P + j·G, in libsecp256k1
++  lin
  |=  [p=point k=@ j=@]
  ^-  point
  =/  r  x.p
  %+  ecdsa-raw-recover:secp256k1:secp:crypto
    (mod (sub n (mod (mul j r) n)) n)        ::  z = −j·r
  [(mod y.p 2) r (mod (mul k r) n)]         ::  v, r, s = k·r
```

## What each operation becomes

- `k·P` is `(lin p k 0)`.
- `k·G` is `(lin g k 0)`: `G` is just another point.
- Blinding, `Y + r·G`, is `(lin y 1 r)`, one call.
- Unblinding, `C_ − r·K`, is `C_ + (lin k (n − r) 0)`. A single point
  addition in Hoon is cheap.
- The first DLEQ term, `s·G − e·A`, is `(lin a (n − e) s)`, one call.
- The second DLEQ term, `s·B_ − e·C_`, is two calls and an addition.

## Caveats

- **`x(P)` must be less than `n`.** `v`'s second bit would cover
  `r = x − n`, but zuse's recovery doesn't take that. It happens for
  about one point in 2¹²⁸; fall back to `mul-point-scalar` there.
- **`k` must be non-zero mod `n`,** because `s = 0` isn't a valid
  signature. For `k = 0`, compute `j·G` as `(lin g j 0)`.
- **A point at infinity result is untested.** If `k·P + j·G` is the point
  at infinity, recovery fails or crashes. Honest inputs never produce it;
  treat it as a refusal.

## Measured

On a fake ship (vere 4.x), 1,000 multiplications of a random point by
random 256-bit scalars:

| | total | per multiplication |
|---|---|---|
| `mul-point-scalar` (Hoon) | 12.9 s | ~13 ms |
| `lin` through the `%reco` jet | 0.16 s (with some tool overhead in it) | ≤ 0.2 ms |

That's at least 70× faster, with identical results. In trill's wallet
(`backend/lib/cashu.hoon`), every Cashu point operation goes through it:
blinding, unblinding and DLEQ checks. It still passes the NUT-00, NUT-12
and NUT-13 test vectors.
