::  lib/cashu.hoon against the Cashu NUT test vectors
::  (github.com/cashubtc/nuts/tree/main/tests, bulk/specs/)
::
/+  cashu
=>
|%
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
::  +bytes: a hex string as the bytes it spells, in order
::
++  bytes
  |=  h=@t
  ^-  octs
  =/  len  (div (met 3 h) 2)
  [len (rev 3 len (rash h hex))]
++  pt  |=(h=@t (need (from-hex:cashu h)))
++  hx  to-hex:cashu
++  num  |=(h=@t (rash h hex))
--
|%
++  test-hash-to-curve
  ^-  tang
  ;:  weld
    %+  check  'h2c 0'
    .=  '024cce997d3b518f739663b757deaec95bcd9473c30a14ac2fd04023a739d1a725'
    %-  hx  %-  hash-to-curve:cashu
    (bytes '0000000000000000000000000000000000000000000000000000000000000000')
  ::
    %+  check  'h2c 1'
    .=  '022e7158e11c9506f1aa4248bf531298daa7febd6194f003edcd9b93ade6253acf'
    %-  hx  %-  hash-to-curve:cashu
    (bytes '0000000000000000000000000000000000000000000000000000000000000001')
  ::
    %+  check  'h2c 2'
    .=  '026cdbe15362df59cd1dd3c9c11de8aedac2106eca69236ecd9fbe117af897be4f'
    %-  hx  %-  hash-to-curve:cashu
    (bytes '0000000000000000000000000000000000000000000000000000000000000002')
  ==
::
++  test-blind
  ^-  tang
  %+  weld
    %+  check  'blind 1'
    .=  '033b1a9737a40cc3fd9b6af4b723632b76a67a36782596304612a6c2bfb5197e6d'
    %-  hx
    %+  blind:cashu
      (bytes 'd341ee4871f1f889041e63cf0d3823c713eea6aff01e80f1719f08f9e5be98f6')
    (num '99fce58439fc37412ab3468b73db0569322588f62fb3a49182d67e23d877824a')
  %+  check  'blind 2'
  .=  '029bdf2d716ee366eddf599ba252786c1033f47e230248a4612a5670ab931f1763'
  %-  hx
  %+  blind:cashu
    (bytes 'f1aaf16c2239746f369572c0784d9dd3d032d952c2d992175873fb58fae31a60')
  (num 'f78476ea7cc9ade20f9e05e58a804cf19533f03ea805ece5fee88c8e2874ba50')
::  the mint's side, C_ = kB_: checks the point arithmetic unblind uses
::
++  test-mint-signature
  ^-  tang
  =/  b-blind  (pt '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2')
  %+  weld
    %+  check  'sign 1'
    .=  '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2'
    (hx (pt-mul:cashu b-blind 1))
  %+  check  'sign 2'
  .=  '0398bc70ce8184d27ba89834d19f5199c84443c31131e48d3c1214db24247d005d'
  %-  hx
  %+  pt-mul:cashu  b-blind
  (num '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f')
::  unblinding undoes blinding: (k(Y + rG)) - r(kG) = kY
::
++  test-unblind
  ^-  tang
  =/  secret  (bytes 'd341ee4871f1f889041e63cf0d3823c713eea6aff01e80f1719f08f9e5be98f6')
  =/  r  (num '99fce58439fc37412ab3468b73db0569322588f62fb3a49182d67e23d877824a')
  =/  k  (num '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f')
  =/  c-blind  (pt-mul:cashu (blind:cashu secret r) k)
  %+  check  'unblind'
  .=  (hx (pt-mul:cashu (hash-to-curve:cashu secret) k))
  (hx (unblind:cashu c-blind r (base:cashu k)))
::
++  test-hash-e
  ^-  tang
  =/  one  (pt '020000000000000000000000000000000000000000000000000000000000000001')
  =/  c-blind  (pt '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2')
  %+  check  'hash_e'
  .=  (num 'a4dc034b74338c28c6bc3ea49731f2a24440fc7c4affc08b31a93fc9fbe6401e')
  (hash-e:cashu ~[one one one c-blind])
::
++  test-dleq-blind-signature
  ^-  tang
  =/  a  (pt '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')
  =/  b  (pt '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2')
  =/  e  (num '9818e061ee51d5c8edc3342369a554998ff7b4381c8652d724cdf46429be73d9')
  =/  s  (num '9818e061ee51d5c8edc3342369a554998ff7b4381c8652d724cdf46429be73da')
  %+  weld
    (check 'dleq on a blind signature' (dleq-ok:cashu a b b e s))
  ::  and a tampered one fails
  (check 'bad dleq refused' !(dleq-ok:cashu a b b e +(s)))
::
++  test-dleq-proof
  ^-  tang
  =/  a  (pt '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')
  %+  check  'dleq on a proof'
  %:  proof-dleq-ok:cashu
    (as-octs:mimes:html 'daf4dd00a2b68a0858a80450f52c8a7d2ccf87d375e43e216e0c571f089f63e9')
    (pt '024369d2d22a80ecf78f3937da9d5f30c1b9f74f0c32684d583cca0fa6a61cdcfc')
    a
    (num 'b31e58ac6527f34975ffab13e70a48b6d2b0d35abc4b03f0151f09ee1a9763d4')
    (num '8fbae004c59e754d71df67e392b6ae4e29293113ddc2ec86592a0431d16306d8')
    (num 'a6d13fcd7a18442e6076f5e1e7c887ad5de40a019824bdfa9fe740d302e8d861')
  ==
::  NUT-11's example: its witness verifies against the secret's key
::
++  test-p2pk-example
  ^-  tang
  =/  secret
    %-  as-octs:mimes:html
    '["P2PK",{"nonce":"859d4935c4907062a6297cf4e663e2835d90d97ecdd510745d32f6816323a41f","data":"0249098aa8b9d2fbec49ff8598feb17b592b986e62319a4fa488a3dc36387157a7","tags":[["sigflag","SIG_INPUTS"]]}]'
  =/  pub-x  (num '49098aa8b9d2fbec49ff8598feb17b592b986e62319a4fa488a3dc36387157a7')
  =/  sig  '60f3c9b766770b46caac1d27e1ae6b77c8866ebaeba0b9489fe6a15a837eaa6fcd6eaa825499c72ac342983983fd3ba3a8a41f56677cc99ffd73da68b59e1383'
  %+  weld
    (check 'p2pk example verifies' (sig-ok:cashu pub-x secret sig))
  (check 'another secret does not' !(sig-ok:cashu pub-x (as-octs:mimes:html 'x') sig))
::  our signatures verify
::
++  test-p2pk-sign
  ^-  tang
  =/  key  (num '99fce58439fc37412ab3468b73db0569322588f62fb3a49182d67e23d877824a')
  =/  secret  (as-octs:mimes:html '["P2PK",{"nonce":"00","data":"02aa"}]')
  =/  sig  (sign-secret:cashu key secret 0xdead.beef)
  (check 'signed secret verifies' (sig-ok:cashu x:(base:cashu key) secret sig))
--
