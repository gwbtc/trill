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
++  big-test
  |%
  ++  entries
    ^-  (list [npub=tape hex=tape])
    :~
     :-  npub="npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
         hex="82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
     :-  npub="npub107jk7htfv243u0x5ynn43scq9wrxtaasmrwwa8lfu2ydwag6cx2quqncxg"
         hex="7fa56f5d6962ab1e3cd424e758c3002b8665f7b0d8dcee9fe9e288d7751ac194" 
     :-  npub="npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a"
         hex="eab0e756d32b80bcd464f3d844b8040303075a13eabc3599a762c9ac7ab91f4f" 
    ==
  ++  event  ^-  event:nsur
    =/  id       %+  slaw:sr  %ux  '7089bd04f9c393587c470d93d0948dd2b9ec17acbf71bdcf8e1434995e9e537d'
    =/  sig      %+  slaw:sr  %ux  '6812142aae70dc4d2107198ca6accf6f1b0ecc896de9c30636680b1b00aa76a36df12d5b1d6353a0e7d0065503fe5b2c6886077ce1e09fcc2f56a39d338f4f51'
    =/  pubkey   %+  slaw:sr  %ux  '04bfcb2c170dd6bc5c154763a9f907ed752cbc7f3cd95b941b7776f12327ac9e'
    :: =/  created-at (from-unix:jikan:sr 1.782.656.742)
    =/  created-at  1.782.656.742
    =/  tags=(list (list @t))
      :~
       ~['q' '8892d5d69611e60c14404cdf85e56e31741afc44263ae0322f99619e39929fb4']
       ~['p' '572aa88414c6b1443082fe6d6a70b0a5a132355e2677c6723f2a0200e266a569']
       ~['t' 'bch']
       ~['t' 'bitcoincash']
       ~['client' 'BCHNostr' '31990=df5bcaba9e74cc1764c9773ae160299dde5acf79416e2c96758dba225e6707cc=bchstr24-1' 'wss=//relay.damus.io']
      ==
    =/  content=tape
  """
  Why Nostr Can't Grow = Lightning's Flaws Are Blocking Millions of New Users

  The vision of decentralized social media on Nostr relies on frictionless value transfer through zaps but the Bitcoin Lightning Network is structurally unsuited for this task. True peer to peer Lightning use is heavily burdened by technical friction because users must manage inbound liquidity just to receive a tip stay constantly online to process transactions and deal with frequent routing failures. Furthermore when base layer congestion spikes the prohibitive on chain fees required to open or close channels make self custody financially impossible for everyday users who simply want to send microtransactions.

  To bypass these overwhelming user experience hurdles the Lightning ecosystem has heavily centralized around custodial wallets and exchanges. While these third party services hide the complex channel management from the user they fundamentally break the permissionless ethos of Nostr. Because these centralized entities act as money transmitters they are legally required to enforce strict Know Your Customer regulations. Forcing users to upload government identification and undergo biometric scans just to send small tips completely destroys the promise of a private and censorship resistant digital economy.
    
  Bitcoin Cash presents the natural solution for Nostr zaps by eliminating these secondary layer complexities entirely. By relying on a massively scalable base layer Bitcoin Cash keeps transaction fees to fractions of a cent allowing users to send and receive microtransactions directly on chain without ever opening a payment channel. This restores the true peer to peer experience where anyone can receive funds offline no inbound liquidity is required and users can maintain complete self custody without submitting to invasive identity verification.

  nostr=note13zfdt45kz8nqc9zqfn0ctetwx96p4lzyycawqv30n9seuwvjn76qnv7mju
  """
  :*
    id=(need id)
    pubkey=(need pubkey)
    created-at=created-at
    kind=1
    tags=tags
    content=(crip content)
    sig=(need sig)
  ==
  ++  nprofiles  ^-  (list @t)
  :~
    'nprofile1qqsqf07t9stsm44uts25wcaflyr76afvh3lnek2mjsdhwah3yvn6e8spye26w'
    'nprofile1qqsyawyrzrttfmv4cmtx5w2m85702kdct7hv3amfrkhagpdf9cz46mgdue6hy'
  ==
  ++  nevents  ^-  (list @t)
  :~
    'nevent1qqs8pzdaqnuu8y6c03rsmy7sjjxa9w0vz7kt7udae78pgdyet609xlggcxa8u'
    'nevent1qqspsq7xv6f5agltpk36w39hsu2qc34mv8ym6nvkez9plmts60wcsdgjx20vz'
    'nevent1qqs2uvv7fe4wwcqy5qtjd4qgrr4sjjpmmcam72mqu37uhasfkepcfxstc3cye'
  ==
  ++  test
  |=  hex=@ux  ^-  @t
    ~&  [%bech-test-input hex]
    =/  nothing  
      =/  np  nprofiles
      |-  ?~  np  ~
        ~&  nprofile=i.np
        =/  decoded  (decode-nprofile (trip i.np))
        ~&  >>  dec=decoded
        =/  npub  (hex-to-npub pubkey.decoded)
        ~&  >  npub=npub
      $(np t.np)
    =/  nothing  
      =/  np  nevents
      |-  ?~  np  ~
        ~&  nevent=i.np
        =/  decoded  (decode-nevent (trip i.np))
        ~&  >>  dec=decoded
        :: =/  npub  (hex-to-npub pubkey.decoded)
        :: ~&  >  npub=npub
      $(np t.np)
    =/  es=(list [npub=tape hex=tape])  entries
    |-
    ?~  es
      'ok'
    =/  hex-from-npub  (npub-to-hex npub.i.es)
    =/  npub-from-hex  (hex-to-npub hex.i.es)
    ~&  [%npub-to-hex npub.i.es hex-from-npub]
    ~&  [%hex-to-npub hex.i.es npub-from-hex]
    ?>  =(hex.i.es hex-from-npub)
    ?>  =(npub.i.es npub-from-hex)
    $(es t.es)
  --
--
