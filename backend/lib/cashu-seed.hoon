::  cashu-seed: NUT-13 deterministic secrets. from a 12-word BIP-39 phrase,
::  each keyset's secrets and blinding factors by counter, so a wallet
::  restores from its phrase alone (NUT-09); and P2PK keys
::
::    seeds and keys are the big-endian numbers their hex spells
::
/+  bip39, bip32, cashu
|%
::  +new-phrase: 12 words from 16 bytes of entropy
::
++  new-phrase
  |=  eny=@
  ^-  tape
  (from-entropy:bip39 [16 (end [3 16] eny)])
::  +seed: the phrase's 64-byte BIP-39 seed (no passphrase)
::
++  seed
  |=  phrase=tape
  ^-  @
  (to-seed:bip39 phrase "")
::  +derive: a keyset's secret (as the hex string it's used as) and
::  blinding factor, at a counter
::
++  derive
  |=  [seed=@ id=@t counter=@ud]
  ^-  [secret=@t r=@]
  ?:  =('01' (end [3 2] id))  (derive-v2 seed id counter)
  (derive-v1 seed id counter)
::  +derive-v2: keysets 01...: HMAC-SHA256 keyed by the seed over
::  "Cashu_KDF_HMAC_SHA256" || keyset id bytes || counter (u64, big-endian)
::  || 0 for the secret, 1 for r (reduced mod n)
::
++  derive-v2
  |=  [seed=@ id=@t counter=@ud]
  ^-  [secret=@t r=@]
  =/  id-len  (div (met 3 id) 2)
  =/  id-bytes  (rev 3 id-len (rash id hex))
  =/  kdf
    |=  kind=@
    ^-  @
    =/  len  :(add 21 id-len 9)
    =/  msg
      %+  can  3
      :~  [21 'Cashu_KDF_HMAC_SHA256']
          [id-len id-bytes]
          [8 (rev 3 8 counter)]
          [1 kind]
      ==
    ::  zuse's hmac-sha256l takes and gives big-endian bytes
    (hmac-sha256l:hmac:crypto [64 seed] [len (rev 3 len msg)])
  :-  (crip ((x-co:co 64) (kdf 0)))
  (mod (kdf 1) n:cashu)
::  +derive-v1: keysets 00... (deprecated): BIP-32 at
::  m/129372'/0'/{keyset int}'/{counter}'/0 for the secret, .../1 for r
::
++  derive-v1
  |=  [seed=@ id=@t counter=@ud]
  ^-  [secret=@t r=@]
  =/  kint  (mod (rash (end [3 16] id) hex) (dec (bex 31)))
  =/  base=(list @u)  ~[(hard 129.372) (hard 0) (hard kint) (hard counter)]
  =/  secret  (key-at seed (snoc base 0))
  :-  (crip ((x-co:co 64) secret))
  (key-at seed (snoc base 1))
::  +p2pk-key: the private key at m/129373'/10'/0'/0'/{counter}, for
::  locking ecash to ourselves
::
++  p2pk-key
  |=  [seed=@ counter=@ud]
  ^-  @
  (key-at seed ~[(hard 129.373) (hard 10) (hard 0) (hard 0) counter])
::
++  hard  |=(i=@ud `@u`(add i (bex 31)))
::
++  key-at
  |=  [seed=@ path=(list @u)]
  ^-  @
  =/  k  (from-seed:bip32 [64 seed])
  =.  k  (derive-sequence:k path)
  private-key:k
--
