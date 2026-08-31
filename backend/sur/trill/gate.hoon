|%
+$  gate
$:  =lock
    manual=_|  ::  whether we want to store the requests in state and look at them manually later instead of allowing/refusing outright
    begs=(map @p (list [time=@da msg=@t]))
    mute=lock      :: mute list to prevent request spamming
    backlog=$~(50 @)       :: size of backlog sent to followers by default
==

+$  lock
$:  rank=(sublock rank:title)
    luk=(sublock ship)
    ship=(sublock ship)
    tags=(sublock @t)
    pass=(unit @)  ::  hashed password
    custom=[fn=(unit $-(@p ?)) public=?]
==
++  sublock
|$  t
  $:  caveats=(set t)
      locked=_|
      public=?
  ==
+$  change
$%  [%set-rank set=(set rank:title) locked=? public=?] 
    [%set-luk set=(set ship) locked=? public=?] 
    [%set-ship set=(set ship) locked=? public=?] 
    [%set-tags set=(set @t) locked=? public=?] 
    [%set-custom term] :: Handle this and set in hoon
==
--
