/+  bip=bip-bip
=>
|%
++  pubkey
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"
++  event-id
  "b9f5441e45ca39179320e0031cfb18e34078673dcc3d3e3a3b3a981571b14f4e"
++  relay
  "wss://r.x.com"
++  nprofile
  "nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgx4wuus"
++  nevent
  "nevent1qqstna2yrezu5wghjvswqqculvvwxsrcvu7uc0f78gan4xq4wxc57nspp4mhxue69uhhytnc9e3k7mgzyqalp33lewf5vdq847t6te0wvnags0gs0mu72kz8938tn24wlfze6qcyqqqqqqgp24y0s"
++  naddr
  "naddr1qq9x67fdv9e8g6trd3jszrthwden5te0wgh8stnrdaksygpm7rrrljungc6q0tuh5hj7ue863q73qlheu4vywtzwhx42a7j9n5psgqqqw4rsfqzg04"
++  fail
  |=  msg=@t
  ^-  tang
  [leaf+(trip msg) ~]
--
::
|%
++  test-npub-to-hex
  ^-  tang
  =/  es=(list [npub=tape hex=tape])  entries:bip
  |-
  ?~  es
    ~
  ?>  =(hex.i.es (npub-to-hex:bip npub.i.es))
  $(es t.es)
::
++  test-hex-to-npub
  ^-  tang
  =/  es=(list [npub=tape hex=tape])  entries:bip
  |-
  ?~  es
    ~
  ?>  =(npub.i.es (hex-to-npub:bip hex.i.es))
  $(es t.es)
::
++  test-encode-nprofile
  ^-  tang
  =/  actual  (encode-nprofile:bip pubkey [relay ~])
  ~&  actual-nprofile=actual
  ?:  =(nprofile actual)  ~  (fail 'encode-nprofile')
::
++  test-decode-nprofile
  ^-  tang
  =/  actual  (decode-nprofile:bip nprofile)
  ~&  decoded-nprofile=actual
  ?:  =([pubkey [relay ~]] actual)  ~  (fail 'decode-nprofile')
::
++  test-encode-nevent
  ^-  tang
  =/  actual  (encode-nevent:bip event-id [relay ~] `pubkey `1)
  ~&  actual-nevent=actual
  ?:  =(nevent actual)  ~  (fail 'encode-nevent')
::
++  test-decode-nevent
  ^-  tang
  =/  actual  (decode-nevent:bip nevent)
  ~&  decoded-nevent=actual
  ?:  =([event-id [relay ~] `pubkey `1] actual)  ~  (fail 'decode-nevent')
::
++  test-encode-naddr
  ^-  tang
  =/  actual  (encode-naddr:bip "my-article" pubkey 30.023 [relay ~])
  ~&  actual-naddr=actual
  ?:  =(naddr actual)  ~  (fail 'encode-naddr')
::
++  test-decode-naddr
  ^-  tang
  =/  actual  (decode-naddr:bip naddr)
  ~&  decoded-naddr=actual
  ?:  =(["my-article" pubkey 30.023 [relay ~]] actual)  ~  (fail 'decode-naddr')
::
++  test-roundtrip-naddr
  ^-  tang
  =/  encoded  (encode-naddr:bip "my-article" pubkey 30.023 [relay ~])
  =/  actual  (decode-naddr:bip encoded)
  ?:  =(["my-article" pubkey 30.023 [relay ~]] actual)  ~  (fail 'roundtrip-naddr')
::
--
