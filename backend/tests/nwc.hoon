::  tests for lib/nwc.hoon: the uri, invoice amounts, and a request and its
::  answer made and read back with keys of our own for both sides
::
/-  nostr
/+  nwc, nip44, nostr-keys, cashu
=>
|%
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
::  the example in NIP-47
::
++  uri
  'nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss%3A%2F%2Frelay.damus.io&secret=71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c'
--
|%
++  test-uri
  ^-  tang
  =/  c  (parse-uri:nwc uri)
  ?~  c  (check 'parsed' |)
  ;:  weld
    %+  check  'service'
    .=  service.u.c
    0xb889.ff5b.1513.b641.e2a1.39f6.61a6.6136.4979.c5be.ee91.842f.8f0e.f42a.b558.e9d4
    (check 'relays' =(relays.u.c ~['wss://relay.damus.io']))
    %+  check  'secret'
    .=  secret.u.c
    0x71a8.c14c.1407.c113.6010.79c4.302d.ab36.460f.0ccd.0ad5.06f1.f2dc.73b5.100e.4f3c
    (check 'lud16' =(~ lud16.u.c))
  ==
::
++  test-bad-uris
  ^-  tang
  ;:  weld
    (check 'https' =(~ (parse-uri:nwc 'https://example.com')))
    %+  check  'no secret'
    =(~ (parse-uri:nwc 'nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss%3A%2F%2Frelay.damus.io'))
    %+  check  'short pubkey'
    =(~ (parse-uri:nwc 'nostr+walletconnect://b889ff?relay=wss%3A%2F%2Fr.io&secret=71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c'))
  ==
::
++  test-invoice-sats
  ^-  tang
  ;:  weld
    (check '50n' =(`5 (invoice-sats:nwc 'lnbc50n1pjq9xyz')))
    (check '2500u' =(`250.000 (invoice-sats:nwc 'lnbc2500u1pvjluez')))
    (check '20m caps' =(`2.000.000 (invoice-sats:nwc 'LNBC20M1PVJLUEZ')))
    (check '1 btc' =(`100.000.000 (invoice-sats:nwc 'lnbc11pvjluez')))
    (check 'tbs' =(`21 (invoice-sats:nwc 'lntbs210n1pxyz')))
    (check 'bcrt p' =(`1 (invoice-sats:nwc 'lightning:lnbcrt10000p1pxyz')))
    (check 'no amount' =(~ (invoice-sats:nwc 'lnbc1pvjluezpp5qqqs')))
    (check 'half sat' =(~ (invoice-sats:nwc 'lnbc15n1pxyz')))
  ==
::  a request we make, and the service's answer to it
::
++  test-round-trip
  ^-  tang
  =/  service-key
    0x1234.5678.9abc.def0.1234.5678.9abc.def0.1234.5678.9abc.def0.1234.5678.9abc.def1
  =/  service  `@ux`x:(base:cashu service-key)
  =/  secret
    0x71a8.c14c.1407.c113.6010.79c4.302d.ab36.460f.0ccd.0ad5.06f1.f2dc.73b5.100e.4f3c
  =/  c=connection:nwc  [service ~['wss://r.io'] secret ~]
  =/  req  (request:nwc c 'get_balance' (pairs:enjs:format ~) ~2026.9.29 0xdead.beef)
  ::  the service reads it
  =/  ck  (conversation-key:nip44 service-key (client:nwc secret))
  =/  asked  (decrypt:nip44 ck content.req)
  ::  and answers
  =/  body  '{"result_type":"get_balance","error":null,"result":{"balance":21000}}'
  =/  content  (encrypt:nip44 ck 0xfeed body)
  =/  tags=(list tag:nostr)
    :~  ~['p' (hex64:nwc (client:nwc secret))]
        ~['e' (hex64:nwc id.req)]
    ==
  =/  raw=raw-event:nostr  [service created-at.req 23.195 tags content]
  =/  id  (hash-event:nostr-keys raw)
  =/  ans=event:nostr
    [id service created-at.req 23.195 tags content (sign-event:nostr-keys service-key id 0xbeef)]
  =/  a  (answer-of:nwc c ans)
  ;:  weld
    (check 'signed' (genuine:nwc req (client:nwc secret)))
    (check 'kind' =(23.194 kind.req))
    %+  check  'asked'
    .=  (bind asked de:json:html)
    ``(pairs:enjs:format ~[method+s+'get_balance' params+(pairs:enjs:format ~)])
    ?~  a  (check 'answered' |)
    ;:  weld
      (check 'to' =(id.req to.u.a))
      (check 'result type' =('get_balance' kind.u.a))
      %+  check  'balance'
      =(result.u.a [%& (pairs:enjs:format ~[balance+n+'21000'])])
    ==
    ::  a forged one (not the service's signature) is ignored
    (check 'forged' =(~ (answer-of:nwc c ans(sig 0x1))))
    ::  and one to someone else
    (check 'not ours' =(~ (answer-of:nwc c(secret 0x42) ans)))
  ==
--
