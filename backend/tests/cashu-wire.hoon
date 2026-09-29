::  lib/cashu-wire.hoon and lib/cbor.hoon against the NUT-00 token
::  vectors (bulk/specs/nut00-tests.md)
::
/-  sur=wallet
/+  wire=cashu-wire, cbor, cashu
=>
|%
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
++  pt-hex  to-hex:cashu
::
++  v4-single
  'cashuBpGF0gaJhaUgArSaMTR9YJmFwgaNhYQFhc3hAOWE2ZGJiODQ3YmQyMzJiYTc2ZGIwZGYxOTcyMTZiMjlkM2I4Y2MxNDU1M2NkMjc4MjdmYzFjYzk0MmZlZGI0ZWFjWCEDhhhUP_trhpXfStS6vN6So0qWvc2X3O4NfM-Y1HISZ5JhZGlUaGFuayB5b3VhbXVodHRwOi8vbG9jYWxob3N0OjMzMzhhdWNzYXQ='
++  v4-multi
  'cashuBo2F0gqJhaUgA_9SLj17PgGFwgaNhYQFhc3hAYWNjMTI0MzVlN2I4NDg0YzNjZjE4NTAxNDkyMThhZjkwZjcxNmE1MmJmNGE1ZWQzNDdlNDhlY2MxM2Y3NzM4OGFjWCECRFODGd5IXVW-07KaZCvuWHk3WrnnpiDhHki6SCQh88-iYWlIAK0mjE0fWCZhcIKjYWECYXN4QDEzMjNkM2Q0NzA3YTU4YWQyZTIzYWRhNGU5ZjFmNDlmNWE1YjRhYzdiNzA4ZWIwZDYxZjczOGY0ODMwN2U4ZWVhY1ghAjRWqhENhLSsdHrr2Cw7AFrKUL9Ffr1XN6RBT6w659lNo2FhAWFzeEA1NmJjYmNiYjdjYzY0MDZiM2ZhNWQ1N2QyMTc0ZjRlZmY4YjQ0MDJiMTc2OTI2ZDNhNTdkM2MzZGNiYjU5ZDU3YWNYIQJzEpxXGeWZN5qXSmJjY8MzxWyvwObQGr5G1YCCgHicY2FtdWh0dHA6Ly9sb2NhbGhvc3Q6MzMzOGF1Y3NhdA'
++  v3
  'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vODMzMy5zcGFjZTozMzM4IiwicHJvb2ZzIjpbeyJhbW91bnQiOjIsImlkIjoiMDA5YTFmMjkzMjUzZTQxZSIsInNlY3JldCI6IjQwNzkxNWJjMjEyYmU2MWE3N2UzZTZkMmFlYjRjNzI3OTgwYmRhNTFjZDA2YTZhZmMyOWUyODYxNzY4YTc4MzciLCJDIjoiMDJiYzkwOTc5OTdkODFhZmIyY2M3MzQ2YjVlNDM0NWE5MzQ2YmQyYTUwNmViNzk1ODU5OGE3MmYwY2Y4NTE2M2VhIn0seyJhbW91bnQiOjgsImlkIjoiMDA5YTFmMjkzMjUzZTQxZSIsInNlY3JldCI6ImZlMTUxMDkzMTRlNjFkNzc1NmIwZjhlZTBmMjNhNjI0YWNhYTNmNGUwNDJmNjE0MzNjNzI4YzcwNTdiOTMxYmUiLCJDIjoiMDI5ZThlNTA1MGI4OTBhN2Q2YzA5NjhkYjE2YmMxZDVkNWZhMDQwZWExZGUyODRmNmVjNjlkNjEyOTlmNjcxMDU5In1dfV0sInVuaXQiOiJzYXQiLCJtZW1vIjoiVGhhbmsgeW91LiJ9'
--
|%
++  test-v4-single
  ^-  tang
  =/  tok  (decode-token:wire v4-single)
  ?~  tok  ~[leaf+"v4 single didn't decode"]
  =/  p  (snag 0 proofs.u.tok)
  ;:  weld
    (check 'mint' =('http://localhost:3338' mint.u.tok))
    (check 'unit' =('sat' unit.u.tok))
    (check 'memo' =(`'Thank you' memo.u.tok))
    (check 'one proof' =(1 (lent proofs.u.tok)))
    (check 'keyset id' =('00ad268c4d1f5826' id.p))
    (check 'amount' =(1 amount.p))
    (check 'secret' =('9a6dbb847bd232ba76db0df197216b29d3b8cc14553cd27827fc1cc942fedb4e' secret.p))
    (check 'C' =('038618543ffb6b8695df4ad4babcde92a34a96bdcd97dcee0d7ccf98d472126792' (pt-hex c.p)))
    ::  and back, byte for byte
    (check 're-encodes' =(v4-single (encode-token:wire u.tok)))
  ==
::  two keysets; no = padding on this one
::
++  test-v4-multi
  ^-  tang
  =/  tok  (decode-token:wire v4-multi)
  ?~  tok  ~[leaf+"v4 multi didn't decode"]
  ;:  weld
    (check 'three proofs' =(3 (lent proofs.u.tok)))
    (check 'no memo' =(~ memo.u.tok))
    %+  check  'ids'
    =(~['00ffd48b8f5ecf80' '00ad268c4d1f5826' '00ad268c4d1f5826'] (turn proofs.u.tok |=(p=proof:sur id.p)))
    (check 'amounts' =(~[1 2 1] (turn proofs.u.tok |=(p=proof:sur amount.p))))
    ::  our encoding of it decodes to the same token
    (check 'round trip' =(tok (decode-token:wire (encode-token:wire u.tok))))
  ==
::
++  test-v3
  ^-  tang
  =/  tok  (decode-token:wire v3)
  ?~  tok  ~[leaf+"v3 didn't decode"]
  ;:  weld
    (check 'v3 mint' =('https://8333.space:3338' mint.u.tok))
    (check 'v3 memo' =(`'Thank you.' memo.u.tok))
    (check 'v3 amounts' =(~[2 8] (turn proofs.u.tok |=(p=proof:sur amount.p))))
    %+  check  'v3 C'
    .=  '029e8e5050b890a7d6c0968db16bc1d5d5fa040ea1de284f6ec69d61299f671059'
    (pt-hex c:(snag 1 proofs.u.tok))
  ==
::
++  test-bad-tokens
  ^-  tang
  ;:  weld
    (check 'wrong prefix' =(~ (decode-token:wire 'casshuAeyJ0b2tlbiI6W119')))
    (check 'no prefix' =(~ (decode-token:wire 'eyJ0b2tlbiI6W119')))
    (check 'junk' =(~ (decode-token:wire 'cashuB!!!')))
  ==
::
++  test-cbor
  ^-  tang
  =/  c=cbor:cbor
    [%m ~[[[%t 'n'] [%u 1.000]] [[%t 'b'] [%b [3 0x3.0201]]] [[%t 'l'] [%a ~[[%bool &] ~ [%u 23] [%u 24]]]]]]
  (check 'cbor round trip' =(`c (decode:cbor (encode:cbor c))))
::
++  test-amounts
  ^-  tang
  =/  ks=(map @t keyset:sur)
    (malt ~[['k' ['k' 'sat' & 100 ~]]])
  =/  pr  |=(n=@ud `proof:sur`['k' n '' [0 0] ~ ~])
  ;:  weld
    (check 'split 13' =(~[1 4 8] (split:wire 13)))
    (check 'split 0' =(~ (split:wire 0)))
    ::  NUT-02: 100 ppk each: 1 to 10 inputs cost 1, 11 cost 2
    (check 'fee 3' =(1 (fee:wire ks (reap 3 (pr 1)))))
    (check 'fee 11' =(2 (fee:wire ks (reap 11 (pr 1)))))
    (check 'fee 0' =(0 (fee:wire ks ~)))
    ::  NUT-08: ceil(log2 1000) = 10
    (check 'blanks 1000' =(10 (blank-count:wire 1.000)))
    (check 'blanks 0' =(0 (blank-count:wire 0)))
    (check 'blanks 1' =(1 (blank-count:wire 1)))
    (check 'blanks 2' =(1 (blank-count:wire 2)))
    (check 'blanks 3' =(2 (blank-count:wire 3)))
  ==
--
