|%
++  feed-page-size  100
++  global-relay  'wss://nostr.sortug.com'
::  relay reconnect policy
::
++  ws-backoff  `(list @dr)`~[~s1 ~s5 ~s30 ~m2 ~m10]
++  ws-max-tries  5    ::  give up past this; = (lent ws-backoff)
++  ws-flap-window  ~m1     ::  uptime below this doesn't reset tries
++  ws-connect-timeout  ~s30  ::  backstop; vere normally sends %reject
::  liveness: a tiny REQ this often, and a socket that hasn't answered it
::  (EOSE or CLOSED) in ws-ping-timeout is dead. vere can't see every
::  death: half-open TCP, or sockets from before a restart
++  ws-ping-every  ~m1
++  ws-ping-timeout  ~s20
--
