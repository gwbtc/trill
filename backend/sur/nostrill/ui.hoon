/-  *wrap, sur=nostrill, nsur=nostr, comms=nostrill-comms
|%
+$  poke
  $%  [%fols fols-poke]
      [%begs begs-poke]
      [%post post-poke]
      [%prof prof-poke]
      [%keys ~]  ::  cycle-keys
      [%rela relay-poke]
      :: [%notif @da]  :: dismiss notification
  ==
+$  begs-poke
  $%  [%feed p=@p]
      [%thread p=@p id=@da]
  ==
::  +reply-policy: who may reply to a post. the backend turns this
::  into a ship whitelist on the post's write perms
::
+$  reply-policy  ?(%everyone %following %mentioned)
+$  post-poke
  $%  [%add content=@t global=? anon=? reply=reply-policy]
      [%reply content=@t host=user:sur id=@da thread=@da]
      [%quote content=@t host=user:sur id=@da]
      [%rp host=user:sur id=@da]  :: NIP-18
      [%reaction host=user:sur id=@da reaction=@t]
      :: [%rt id=@ux pubkey=@ux relay=@t]  :: NIP-18
      [%del host=user:sur id=@da]
  ==
+$  fols-poke
  $%  [%add =user:sur]
      [%del =user:sur]
  ==
+$  prof-poke
  $%  [%add meta=user-meta:nsur]
      [%del ~]
      [%fetch p=(list user:sur)]
  ==
+$  relay-poke
      ::  add or remove relays
  $%  [%add p=@t]
      [%del p=@ud]
      ::  remove by url: reaches relays that are mid-backoff or
      ::  dormant and so have no wid
      [%del-url p=@t]
      ::  data to send/receive from relays
      [%do relay-handling]
  ==
+$  relay-handling
  $:  relays=(list @ud)  ::  list of wids
      action=relay-order
  ==
+$  relay-order
    $%  [%get name=@t p=relay-get]
        [%send-post host=@p id=@da]
        [%send-prof ~]
    ==
+$  relay-get  relay-get:nsur
:: facts
+$  fact
  $%  [%nostr nostr-fact]
      [%post post-fact:comms]
      [%fols fols-fact]
      [%prof (map user:sur user-profile:comms)]
      :: our own keys!
      [%keys pub=@ux]
  ==
+$  fols-fact
  $%  [%new-urbit (enbowl fols-res:comms)]
      [%new-nostr pubkey=@ux profile=(unit user-profile:comms) relays=(list @t)]
      ::  UI feedback that the backend handled the click
      [%quit =user:sur]
  ==
+$  nostr-fact
  $%  [%feed name=@t feed=wfeed:nsur]
      [%user npub=@t feed=wfeed:nsur]    ::  a user feed we requested
      [%thread feed=nostr-feed:nsur]  ::  a specific thread we requested
      [%event event:nsur]            ::  some specific event
      [%eose sub-id=@t]              ::  end of data or backlog
      [%relays (map url=@t relay-stats:nsur)]
      [%drop url=@t]                 ::  connected with a relay was closed
      [%sent-post host=@p id=@ relays=(list @t) event:nsur]  ::  confirmation that a post of ours was sent to a relay
      [%sent-prof relays=(list @t)]
  ==
::  same as relay-handling but does it async with a thread instead of a card 
+$  ted
    $%  [%req tid=@t relays=(list @ud) req-name=@t p=relay-get]
        [%res sub-id=@t]
    ==
--
