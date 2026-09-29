::  lib/cashu-seed.hoon against the NUT-13 test vectors
::  (bulk/specs/nut13-tests.md)
::
/+  seed=cashu-seed, cashu
=>
|%
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
++  num  |=(h=@t (rash h hex))
++  phrase
  "half depart obvious quality work element tank gorilla view sugar picture humble"
--
|%
::  keysets 00...: BIP-32 at m/129372'/0'/864559728'/{counter}'/{0,1}
::
++  test-v1
  ^-  tang
  =/  s  (seed:seed phrase)
  =/  d0  (derive:seed s '009a1f293253e41e' 0)
  =/  d1  (derive:seed s '009a1f293253e41e' 1)
  ;:  weld
    (check 'v1 secret 0' =('485875df74771877439ac06339e284c3acfcd9be7abf3bc20b516faeadfe77ae' secret.d0))
    (check 'v1 r 0' =((num 'ad00d431add9c673e843d4c2bf9a778a5f402b985b8da2d5550bf39cda41d679') r.d0))
    (check 'v1 secret 1' =('8f2b39e8e594a4056eb1e6dbb4b0c38ef13b1b2c751f64f810ec04ee35b77270' secret.d1))
    (check 'v1 r 1' =((num '967d5232515e10b81ff226ecf5a9e2e2aff92d66ebc3edf0987eb56357fd6248') r.d1))
  ==
::  keysets 01...: the HMAC-SHA256 KDF
::
++  test-v2
  ^-  tang
  =/  s  (seed:seed phrase)
  =/  id  '015ba18a8adcd02e715a58358eb618da4a4b3791151a4bee5e968bb88406ccf76a'
  =/  d0  (derive:seed s id 0)
  =/  d1  (derive:seed s id 1)
  ;:  weld
    (check 'v2 secret 0' =('db5561a07a6e6490f8dadeef5be4e92f7cebaecf2f245356b5b2a4ec40687298' secret.d0))
    (check 'v2 r 0' =((num '6d26181a3695e32e9f88b80f039ba1ae2ab5a200ad4ce9dbc72c6d3769f2b035') r.d0))
    (check 'v2 secret 1' =('b70e7b10683da3bf1cdf0411206f8180c463faa16014663f39f2529b2fda922e' secret.d1))
    (check 'v2 r 1' =((num 'bde4354cee75545bea1a2eee035a34f2d524cee2bb01613823636e998386952e') r.d1))
  ==
::  P2PK keys: m/129373'/10'/0'/0'/{counter}
::
++  test-p2pk
  ^-  tang
  =/  s  (seed:seed phrase)
  =/  pub  |=(k=@ (to-hex:cashu (base:cashu k)))
  ;:  weld
    %+  check  'p2pk 0'
    =('021693d45f4fdf610ae641fedb0944fb460fbb8264f21c19d2626c3da755fcbbcb' (pub (p2pk-key:seed s 0)))
    %+  check  'p2pk 1'
    =('0395461ab678058c0ed6aa39f38dda490eaa163e9ad27070b23ec3d06b41e07535' (pub (p2pk-key:seed s 1)))
  ==
::  a fresh phrase is 12 words
::
++  test-new-phrase
  ^-  tang
  =/  words  (lent (fand " " (new-phrase:seed 0xdead.beef.cafe.babe)))
  (check '12 words' =(11 words))
--
