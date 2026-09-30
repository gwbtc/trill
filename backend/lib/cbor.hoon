::  cbor: the CBOR (RFC 8949) that Cashu V4 tokens use: unsigned
::  integers, byte and text strings, arrays, maps, true, false, null.
::  maps keep their order, so a token re-encodes to its own bytes.
::  indefinite lengths, tags, negatives and floats aren't read
::
::    bytes are octs in their natural order
::
|%
::  shaped like zuse's recursive json: null is the atom ~. every
::  recursion goes through a named type (cbor, kv): an inline [cbor cbor]
::  inside (list ..), or a $~ default, looped the compiler until the ship
::  ran out of memory
+$  cbor
  $@  ~
  $%  [%u p=@ud]
      [%b p=octs]
      [%t p=@t]
      [%a p=(list cbor)]
      [%m p=(list kv)]
      [%bool p=?]
  ==
+$  kv  [k=cbor v=cbor]
::  +get: a map's value for a text key
::
++  get
  |=  [c=cbor key=@t]
  ^-  (unit cbor)
  ?@  c  ~
  ?.  ?=(%m -.c)  ~
  =/  kvs  p.c
  |-
  ?~  kvs  ~
  ?:  =([%t key] -.i.kvs)  `+.i.kvs
  $(kvs t.kvs)
::
++  encode
  |=  c=cbor
  ^-  octs
  =/  parts=(list octs)  (bits c)
  :-  (roll parts |=([o=octs n=@ud] (add n p.o)))
  (can 3 parts)
::  +bits: c as octs to run together
::
++  bits
  |=  c=cbor
  ^-  (list octs)
  ?@  c  ~[[1 0xf6]]
  ?-  -.c
    %u     ~[(head 0 p.c)]
    %b     ~[(head 2 p.p.c) p.c]
    %t     ~[(head 3 (met 3 p.c)) [(met 3 p.c) p.c]]
    %bool  ~[[1 ?:(p.c 0xf5 0xf4)]]
      %a
    ::  loops, not turn: an arm passed to turn inside itself fuse-loops
    =/  out=(list octs)  ~[(head 4 (lent p.c))]
    =/  xs  p.c
    |-
    ?~  xs  out
    $(xs t.xs, out (weld out (bits i.xs)))
  ::
      %m
    =/  out=(list octs)  ~[(head 5 (lent p.c))]
    =/  kvs  p.c
    |-
    ?~  kvs  out
    $(kvs t.kvs, out :(weld out (bits -.i.kvs) (bits +.i.kvs)))
  ==
::  +head: a major type and its count, the count big-endian
::
++  head
  |=  [major=@ n=@ud]
  ^-  octs
  =/  m  (lsh [0 5] major)
  ?:  (lth n 24)  [1 (add m n)]
  ?:  (lth n 0x100)  [2 (can 3 ~[[1 (add m 24)] [1 n]])]
  ?:  (lth n 0x1.0000)  [3 (can 3 ~[[1 (add m 25)] [2 (rev 3 2 n)]])]
  ?:  (lth n 0x1.0000.0000)  [5 (can 3 ~[[1 (add m 26)] [4 (rev 3 4 n)]])]
  [9 (can 3 ~[[1 (add m 27)] [8 (rev 3 8 n)]])]
::  +decode: all of the bytes as one item, or ~
::
++  decode
  |=  o=octs
  ^-  (unit cbor)
  =/  r  (item o 0)
  ?~  r  ~
  ?.  =(p.o +.u.r)  ~
  `-.u.r
::  +item: the item at byte i, and where the next one starts
::
++  item
  |=  [o=octs i=@ud]
  ^-  (unit [cbor @ud])
  ?.  (lth i p.o)  ~
  =/  b  (cut 3 [i 1] q.o)
  =/  major  (rsh [0 5] b)
  =/  info  (end [0 5] b)
  ::  the count: in info, or the next 1, 2, 4 or 8 bytes
  =/  n=(unit [@ud @ud])
    ?:  (lth info 24)  `[info +(i)]
    =/  len
      ?+  info  0
        %24  1
        %25  2
        %26  4
        %27  8
      ==
    ?:  =(0 len)  ~
    ?:  (gth (add +(i) len) p.o)  ~
    `[(rev 3 len (cut 3 [+(i) len] q.o)) :(add i 1 len)]
  ?:  =(7 major)
    ?+  info  ~
      %20  `[[%bool |] +(i)]
      %21  `[[%bool &] +(i)]
      %22  `[~ +(i)]
    ==
  ?~  n  ~
  =/  [count=@ud at=@ud]  u.n
  ?+  major  ~
    %0  `[[%u count] at]
  ::
      ?(%2 %3)
    ?:  (gth (add at count) p.o)  ~
    =/  data  (cut 3 [at count] q.o)
    `[?:(=(2 major) [%b [count data]] [%t data]) (add at count)]
  ::
      %4
    =|  out=(list cbor)
    |-
    ?:  =(0 count)  `[[%a (flop out)] at]
    =/  r  (item o at)
    ?~  r  ~
    $(count (dec count), out [-.u.r out], at +.u.r)
  ::
      %5
    =|  out=(list kv)
    |-
    ?:  =(0 count)  `[[%m (flop out)] at]
    =/  k  (item o at)
    ?~  k  ~
    =/  v  (item o +.u.k)
    ?~  v  ~
    $(count (dec count), out [[-.u.k -.u.v] out], at +.u.v)
  ==
--
