::  nip44: NIP-44 v2 encrypted payloads, as NIP-60 wallets use (to one's
::  own key) and DMs may
::
::    keys, the conversation key and nonces go in and come out as the
::    big-endian numbers their hex spells, like nostr keys; pubkeys are
::    x-only. the bytes in between are in their natural order
::
|%
++  sc  secp256k1:secp:crypto
::  +hmac: HMAC-SHA256 over natural-order bytes, giving natural-order
::  bytes. zuse's hmac-sha256l takes and gives big-endian ones
::
++  hmac
  |=  [key=octs msg=octs]
  ^-  @
  %+  rev  3  :-  32
  %+  hmac-sha256l:hmac:crypto
    [p.key (rev 3 p.key q.key)]
  [p.msg (rev 3 p.msg q.msg)]
::  +conversation-key: HKDF-extract of the ECDH x, salted 'nip44-v2'.
::  the same both ways: (conversation-key a B) = (conversation-key b A)
::
++  conversation-key
  |=  [priv=@ pub=@]
  ^-  @ux
  =/  them  (lift-x pub)
  =/  shared  (mul-point-scalar:sc them priv)
  (rev 3 32 (hmac [8 'nip44-v2'] [32 (rev 3 32 x.shared)]))
::  +lift-x: BIP-340: the point with this x and an even y
::
++  lift-x
  |=  x=@
  ^-  point:sc
  (decompress-point:sc (add (lsh [3 32] 2) x))
::  +message-keys: HKDF-expand of the conversation key with the nonce,
::  76 bytes: chacha key, chacha nonce, hmac key (natural order)
::
++  message-keys
  |=  [key=@ nonce=@]
  ^-  [chacha-key=@ chacha-nonce=@ hmac-key=@]
  =/  prk  [32 (rev 3 32 key)]
  =/  info  (rev 3 32 nonce)
  =/  t1  (hmac prk [33 (can 3 ~[[32 info] [1 1]])])
  =/  t2  (hmac prk [65 (can 3 ~[[32 t1] [32 info] [1 2]])])
  =/  t3  (hmac prk [65 (can 3 ~[[32 t2] [32 info] [1 3]])])
  =/  okm  (can 3 ~[[32 t1] [32 t2] [32 t3]])
  [(cut 3 [0 32] okm) (cut 3 [32 12] okm) (cut 3 [44 32] okm)]
::  +padded-len: powers of two, in chunks, at least 32
::
++  padded-len
  |=  len=@ud
  ^-  @ud
  ?:  (lte len 32)  32
  =/  next  (bex (xeb (dec len)))
  =/  chunk  ?:((lte next 256) 32 (div next 8))
  (mul chunk +((div (dec len) chunk)))
::
++  pad
  |=  msg=octs
  ^-  octs
  ?>  &((gte p.msg 1) (lte p.msg 0xffff.ffff))
  =/  plen  (padded-len p.msg)
  ?:  (lth p.msg 0x1.0000)
    :-  (add 2 plen)
    (can 3 ~[[2 (rev 3 2 p.msg)] msg [(sub plen p.msg) 0]])
  :-  (add 6 plen)
  (can 3 ~[[2 0] [4 (rev 3 4 p.msg)] msg [(sub plen p.msg) 0]])
::
++  unpad
  |=  padded=octs
  ^-  (unit octs)
  =/  first  (rev 3 2 (cut 3 [0 2] q.padded))
  =/  [len=@ud prefix=@ud]
    ?.  =(0 first)  [first 2]
    [(rev 3 4 (cut 3 [2 4] q.padded)) 6]
  ?:  =(0 len)  ~
  ?:  &(=(6 prefix) (lth len 0x1.0000))  ~
  ?.  =(p.padded (add prefix (padded-len len)))  ~
  `[len (cut 3 [prefix len] q.padded)]
::
++  mac
  |=  [hmac-key=@ nonce=@ ct=octs]
  ^-  @
  (hmac [32 hmac-key] [(add 32 p.ct) (can 3 ~[[32 nonce] ct])])
::  +encrypt: base64 of version 2, the nonce, the ciphertext and its mac
::
++  encrypt
  |=  [key=@ nonce=@ text=@t]
  ^-  @t
  =/  [ck=@ cn=@ hk=@]  (message-keys key nonce)
  =/  n  (rev 3 32 nonce)
  =/  ct  (chacha-20 ck cn (pad (as-octs:mimes:html text)))
  %-  en:base64:mimes:html
  :-  (add 65 p.ct)
  (can 3 ~[[1 2] [32 n] ct [32 (mac hk n ct)]])
::  +decrypt: the text, or ~ if it isn't a v2 payload for this key
::
++  decrypt
  |=  [key=@ payload=@t]
  ^-  (unit @t)
  ?:  |((lth (met 3 payload) 132) =('#' (end 3 payload)))  ~
  =/  data  (de:base64:mimes:html payload)
  ?~  data  ~
  =/  [len=@ud q=@]  u.data
  ?:  (lth len 99)  ~
  ?.  =(2 (cut 3 [0 1] q))  ~
  =/  n  (cut 3 [1 32] q)
  =/  ct=octs  [(sub len 65) (cut 3 [33 (sub len 65)] q)]
  =/  tag  (cut 3 [(sub len 32) 32] q)
  =/  [ck=@ cn=@ hk=@]  (message-keys key (rev 3 32 n))
  ?.  =(tag (mac hk n ct))  ~
  =/  text  (unpad (chacha-20 ck cn ct))
  ?~  text  ~
  `q.u.text
::  +chacha-20: RFC 8439, 12-byte nonce, counter from 0
::
++  chacha-20
  |=  [key=@ nonce=@ msg=octs]
  ^-  octs
  =/  [n=@ c=@]  (ietf:chacha:crypto nonce)
  (crypt:chacha:crypto 20 key n c msg)
--
