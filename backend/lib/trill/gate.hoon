/-  gate=trill-gate
|%
++  mask-lock
|=  =lock:gate  ^-  lock:gate
  :*  ?:  public.rank.lock    rank.lock    [~ %| %|]
      ?:  public.luk.lock     luk.lock     [~ %| %|]
      ?:  public.ship.lock    ship.lock    [~ %| %|]
      ?:  public.tags.lock    tags.lock    [~ %| %|]
                              pass.lock
      ?:  public.custom.lock  custom.lock  [~ %|]
  ==
++  can-access
|=  [=ship =gate:gate msg=@t =bowl:gall]  ^-  ?
  ::  TODO
  :: =/  is-muted  (check-lock ship mute.gate '' bowl)
  :: ?:  is-muted  .n
  (check-lock ship lock.gate msg bowl)

++  check-lock
::  TODO change this to =user?
|=  [=ship =lock:gate msg=@t =bowl:gall]  ^-  ?
  ::  TODO hashing algorithm
  ?^  pass.lock  .=(u.pass.lock (shas %nostrillio msg))
  ?^  fn.custom.lock  %-  u.fn.custom.lock  ship
  ::  ship sublock: the ship itself; luk sublock: its sponsor chain
  =/  in-ship  (~(has in caveats.ship.lock) ship)
  =/  fu  (sein:title our.bowl now.bowl ship)
  =/  ye  (sein:title our.bowl now.bowl fu)
  =/  ze  (sein:title our.bowl now.bowl ye)
  =/  in-luk   ?|
    (~(has in caveats.luk.lock) fu)
    (~(has in caveats.luk.lock) ye)
    (~(has in caveats.luk.lock) ze)
  ==
  =/  in-rank  (~(has in caveats.rank.lock) (clan:title ship))
  :: =/  in-tags  (~(has in (scry-pals-tags caveats.tags.lock)) ship)
  ::  a locked sublock is a whitelist (must be in caveats), an
  ::  unlocked one a blacklist (must not be). each sublock checks
  ::  its OWN locked flag against its OWN membership
  =/  can  |=  [pit=? has=?]  ^-  ?  ?:  pit  has  !has
  =/  as-ship  (can locked.ship.lock in-ship)
  =/  as-luk   (can locked.luk.lock in-luk)
  =/  as-rank  (can locked.rank.lock in-rank)
  ::=/  as-tags  (can locked.tags.lock in-tags)
  ?&(as-ship as-luk as-rank)

++  scry-pals-tags
|=  tags=(set @t)  ^-  (set @p)
  :: .^()
  ~
++  apply-change
|=  [=lock:gate =change:gate]  ^-  lock:gate
  ?-  -.change
    %set-rank    lock(rank +.change)
    %set-luk     lock(luk +.change)
    %set-ship    lock(ship +.change)
    %set-tags     lock(tags +.change)
    %set-custom  lock  ::TODO
  ==
++  open-all
|=  =lock:gate  ^-  lock:gate
  %=  lock
    rank  rank.lock(locked .n)
    luk   luk.lock(locked .n)
    ship  ship.lock(locked .n)
    tags  tags.lock(locked .n)
  ==
++  lock-all
|=  =lock:gate  ^-  lock:gate
%=  lock
rank  rank.lock(locked .y)
luk   luk.lock(locked .y)
ship  ship.lock(locked .y)
tags  tags.lock(locked .y)
==
++  toggle-rank
|=  [r=rank:title setting=[caveats=(set rank:title) locked=? public=?]]
  =/  new-caveats=(set rank:title)  ?:  locked.setting
  (~(put in caveats.setting) r)
  (~(del in caveats.setting) r)
  setting(caveats new-caveats)
++  toggle-ship
|=  [s=ship setting=[caveats=(set ship) locked=? public=?]]
  =/  new-caveats=(set ship)  ?:  locked.setting
  (~(put in caveats.setting) s)
  (~(del in caveats.setting) s)
  setting(caveats new-caveats)
++  toggle-tag
|=  [t=@t setting=[caveats=(set @t) locked=? public=?]]
  =/  new-caveats=(set @t)  ?:  locked.setting
  (~(put in caveats.setting) t)
  (~(del in caveats.setting) t)
  setting(caveats new-caveats)
--
