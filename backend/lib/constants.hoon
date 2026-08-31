|%
++  feed-page-size  100
++  global-relay  'wss://nostr.sortug.com'
::  relay reconnect policy
::
++  ws-backoff  `(list @dr)`~[~s1 ~s5 ~s30 ~m2 ~m10]
++  ws-max-tries  5    ::  give up past this; = (lent ws-backoff)
++  ws-flap-window  ~m1     ::  uptime below this doesn't reset tries
++  ws-connect-timeout  ~s30  ::  backstop; vere normally sends %reject
--
