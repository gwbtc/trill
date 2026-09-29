::  trill-wallet: a Cashu ecash wallet (NIP-60/61), kept on the ship
::
::    phase 2 in progress: for now this only holds the libraries the
::    wallet is built from, so |commit compiles them. it imports the
::    tests too, only so that |commit type-checks them before any are run
::
/-  sur=wallet
/+  default-agent, dbug, cashu, wire=cashu-wire, cbor, nip44, cashu-seed
/=  t-cashu  /tests/cashu
/=  t-wire  /tests/cashu-wire
/=  t-seed  /tests/cashu-seed
/=  t-nip44  /tests/nip44
::
|%
+$  card  card:agent:gall
+$  state-0  [%0 ~]
--
::
=|  state=state-0
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init   `this
++  on-save   !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ::  no migrations before launch: change state-0 in place and |nuke
  `this(state !<(state-0 old))
::
++  on-poke   on-poke:def
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-peek   on-peek:def
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--
