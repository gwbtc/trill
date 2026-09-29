::  nwc: Nostr Wallet Connect, the client side (NIP-47)
::
::    a wallet service (Alby Hub, coinos, ...) gives us a connection uri:
::    its pubkey, the relays it listens on, and a secret that is our key
::    for this connection alone (not our nostr key). we ask with kind 23194
::    events, NIP-44 encrypted to the service and signed with the secret;
::    it answers with 23195s p-tagging us. its 13194 says what it does
::
/-  nostr
/+  cashu, nip44, nostr-keys, js=json-nostr
|%
::  +connection: what the uri gives
::
+$  connection  [service=@ux relays=(list @t) secret=@ lud16=(unit @t)]
::  +parse-uri: nostr+walletconnect://<hex pubkey>?relay=...&secret=<hex>
::  (relay may repeat; values url-encoded)
::
++  parse-uri
  |=  uri=@t
  ^-  (unit connection)
  ::  pasted: spaces and line breaks aside
  =/  t=tape  (skip (trip uri) |=(c=@t |(=(c ' ') =(c '\0a'))))
  =/  rest=(unit tape)
    ?:  =("nostr+walletconnect://" (scag 22 t))  `(slag 22 t)
    ?:  =("nostrwalletconnect://" (scag 21 t))  `(slag 21 t)
    ~
  ?~  rest  ~
  =/  q  (find "?" u.rest)
  ?~  q  ~
  =/  host  (scag u.q u.rest)
  =?  host  =("/" (slag (dec (max 1 (lent host))) host))  (snip host)
  ?.  =(64 (lent host))  ~
  =/  service  (rush (crip host) hex)
  ?~  service  ~
  =/  params=(list [@t @t])
    %+  murn  (split (slag +(u.q) u.rest) '&')
    |=  kv=tape
    ^-  (unit [@t @t])
    =/  e  (find "=" kv)
    ?~  e  ~
    =/  v  (de-urlt:html (slag +(u.e) kv))
    ?~  v  ~
    `[(crip (scag u.e kv)) (crip u.v)]
  =/  relays=(list @t)
    (murn params |=([k=@t v=@t] ?.(=('relay' k) ~ `v)))
  =/  secrets=(list @t)
    (murn params |=([k=@t v=@t] ?.(=('secret' k) ~ `v)))
  ?~  relays  ~
  ?~  secrets  ~
  ?.  =(64 (met 3 i.secrets))  ~
  =/  secret  (rush i.secrets hex)
  ?~  secret  ~
  ?:  |(=(0 u.secret) (gte u.secret n:cashu))  ~
  =/  lud16  (murn params |=([k=@t v=@t] ?.(=('lud16' k) ~ `v)))
  `[u.service relays u.secret ?~(lud16 ~ `i.lud16)]
::
++  split
  |=  [t=tape c=@t]
  ^-  (list tape)
  =|  out=(list tape)
  |-
  =/  i  (find ~[c] t)
  ?~  i  (flop [t out])
  $(t (slag +(u.i) t), out [(scag u.i t) out])
::  +client: our pubkey (x) for the secret
::
++  client  |=(secret=@ `@ux`x:(base:cashu secret))
::
++  hex64  |=(a=@ `@t`(crip ((x-co:co 64) a)))
::  +request: a signed 23194 asking method with params
::
++  request
  |=  [c=connection method=@t params=json now=@da eny=@]
  ^-  event:nostr
  =/  ck  (conversation-key:nip44 secret.c service.c)
  =/  body  (en:json:html (pairs:enjs:format ~[method+s+method params+params]))
  =/  content  (encrypt:nip44 ck (end [3 32] (shas %nwc-nonce eny)) body)
  =/  pub  (client secret.c)
  =/  at=@ud  (div (sub now ~1970.1.1) ~s1)
  =/  tags=(list tag:nostr)
    :~  ~['encryption' 'nip44_v2']
        ~['p' (hex64 service.c)]
        ~['expiration' (crip (a-co:co (add at 60)))]
    ==
  =/  raw=raw-event:nostr  [pub at 23.194 tags content]
  =/  id  (hash-event:nostr-keys raw)
  [id pub at 23.194 tags content (sign-event:nostr-keys secret.c id (shas %nwc-sig eny))]
::  +genuine: an event is what its id and signature say, by this author
::
++  genuine
  |=  [ev=event:nostr author=@ux]
  ^-  ?
  ?.  =(author pubkey.ev)  |
  =/  raw=raw-event:nostr  [pubkey.ev created-at.ev kind.ev tags.ev content.ev]
  ?.  =(id.ev (hash-event:nostr-keys raw))  |
  (verify:schnorr:secp256k1:secp:crypto pubkey.ev id.ev sig.ev)
::  +tag-value: the first value of an event's first tag of a name
::
++  tag-value
  |=  [ev=event:nostr k=@t]
  ^-  (unit @t)
  |-
  ?~  tags.ev  ~
  =/  t  i.tags.ev
  ?:  &(?=([@ @ *] t) =(k i.t))  `i.t.t
  $(tags.ev t.tags.ev)
::  +answer: a 23195 to us, from the service, decrypted: which request it
::  answers, and its result or error
::
+$  answer
  $:  to=@ux                                    ::  the request's id
      kind=@t                                   ::  result_type
      result=(each json [code=@t message=@t])
  ==
++  answer-of
  |=  [c=connection ev=event:nostr]
  ^-  (unit answer)
  ?.  =(23.195 kind.ev)  ~
  ?.  (genuine ev service.c)  ~
  ?.  =(`(hex64 (client secret.c)) (tag-value ev 'p'))  ~
  =/  e  (tag-value ev 'e')
  ?~  e  ~
  =/  to  (rush u.e hex)
  ?~  to  ~
  =/  ck  (conversation-key:nip44 secret.c service.c)
  =/  text  (decrypt:nip44 ck content.ev)
  ?~  text  ~
  =/  j  (de:json:html u.text)
  ?.  ?=([~ %o *] j)  ~
  =/  o  p.u.j
  =/  kind  (~(get by o) 'result_type')
  =/  kind=@t  ?.(?=([~ %s *] kind) '' p.u.kind)
  =/  err  (~(get by o) 'error')
  ?:  ?=([~ %o *] err)
    =/  code  (~(get by p.u.err) 'code')
    =/  msg  (~(get by p.u.err) 'message')
    :-  ~
    :+  u.to  kind
    :-  %|
    :-  ?.(?=([~ %s *] code) 'OTHER' p.u.code)
    ?.(?=([~ %s *] msg) '' p.u.msg)
  `[u.to kind %& (~(gut by o) 'result' ~)]
::  +info: a 13194's methods and encryption schemes
::
++  info
  |=  ev=event:nostr
  ^-  [methods=(set @t) encryption=(set @t)]
  :-  (silt (murn (split (trip content.ev) ' ') |=(w=tape ?~(w ~ `(crip w)))))
  =/  enc  (tag-value ev 'encryption')
  ::  none said: NIP-04 only (NIP-47)
  ?~  enc  (silt ~['nip04'])
  (silt (murn (split (trip u.enc) ' ') |=(w=tape ?~(w ~ `(crip w)))))
::  +lead: how many digits a tape starts with
::
++  lead
  |=  t=tape
  ^-  @ud
  ?~  t  0
  ?.  &((gte i.t '0') (lte i.t '9'))  0
  +($(t t.t))
::  +invoice-sats: a BOLT11 invoice's amount, from its human-readable
::  part: ln<network><amount><multiplier>, before the last 1 (bech32 data
::  has none). ~ if it names none or isn't whole sats
::
++  invoice-sats
  |=  invoice=@t
  ^-  (unit @ud)
  =/  t  (cass (trip invoice))
  =?  t  =("lightning:" (scag 10 t))  (slag 10 t)
  =/  ones  (fand "1" t)
  ?~  ones  ~
  =/  hrp  (scag (rear ones) t)
  ?.  =("ln" (scag 2 hrp))  ~
  =/  hrp  (slag 2 hrp)
  ::  the network: bcrt, bc, tbs, tb (longest first)
  =/  net
    ?:  =("bcrt" (scag 4 hrp))  4
    ?:  =("tbs" (scag 3 hrp))  3
    ?:  |(=("bc" (scag 2 hrp)) =("tb" (scag 2 hrp)))  2
    0
  ?:  =(0 net)  ~
  =/  hrp  (slag net hrp)
  =/  digits  (scag (lead hrp) hrp)
  ?~  digits  ~
  =/  n  (rash (crip digits) dem)
  =/  mult  (slag (lent digits) hrp)
  ?~  mult  `(mul n 100.000.000)
  ?^  t.mult  ~
  ?+  i.mult  ~
    %m  `(mul n 100.000)
    %u  `(mul n 100)
    %n  ?.(=(0 (mod n 10)) ~ `(div n 10))
    %p  ?.(=(0 (mod n 10.000)) ~ `(div n 10.000))
  ==
--
