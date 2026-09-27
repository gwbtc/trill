::  json-debates: debates for the UI. ids are decimal strings (like post
::  ids), times are unix milliseconds
::
/-  sur=debates
/+  common=json-common, dlib=debates
|%
++  en
=,  enjs:format
|%
++  key
  |=  k=key:sur
  ^-  json
  (pairs ~[host+s+(scot %p host.k) id+(ud:en:common id.k)])
::
::  (@p, not ship: enjs:format has a ship gate, which shadows the mold)
++  ships
  |=  s=(set @p)
  ^-  json
  a+(turn ~(tap in s) |=(p=@p s+(scot %p p)))
::
++  sided
  |=  m=(map @p side:sur)
  ^-  json
  (pairs (turn ~(tap by m) |=([p=@p s=side:sur] [(scot %p p) s+s])))
::
++  message
  |=  m=message:sur
  ^-  json
  %-  pairs
  :~  id+(ud:en:common id.m)
      time+(time id.m)
      author+s+(scot %p author.m)
      side+s+side.m
      text+s+text.m
  ==
::  +debate: votes as given (already redacted if need be), with the total,
::  and whether there are older messages than those given
::
++  debate
  |=  [d=debate:sur total=@ud more=?]
  ^-  json
  =/  c  config.d
  %-  pairs
  :~  key+(key key.d)
      topic+s+topic.c
      sides+(pairs ~[a+s+a.sides.c b+s+b.sides.c])
      moderator+?~(moderator.c ~ s+(scot %p u.moderator.c))
      start+?~(start.c ~ (time u.start.c))
      end+?~(end.c ~ (time u.end.c))
      debaters+s+debaters.c
      revote+b+revote.c
      tally+s+tally.c
      stage+s+stage.d
      members+(sided debaters.d)
      onlookers+(ships onlookers.d)
      invited+(ships invited.d)
      muted+(ships muted.d)
      votes+(sided votes.d)
      total+(numb total)
      more+b+more
      messages+a+(turn (tap:mon:sur messages.d) |=([@da m=message:sur] (message m)))
      ended+?~(ended.d ~ (time u.ended.d))
  ==
::
++  update
  |=  u=update:sur
  ^-  json
  %+  frond  -.u
  ?-  -.u
    %init   (debate debate.u total.u more.u)
    %page   (pairs ~[messages+a+(turn messages.u message) more+b+more.u])
    %said   (message message.u)
    %tally  (pairs ~[votes+(sided votes.u) total+(numb total.u)])
    %gone   ~
      %meta
    %-  pairs
    :~  stage+s+stage.u
        members+(sided debaters.u)
        onlookers+(ships onlookers.u)
        invited+(ships invited.u)
        muted+(ships muted.u)
        ended+?~(ended.u ~ (time u.ended.u))
    ==
  ==
::
::  +presence: the debate a ship is in, or null
::
++  presence
  |=  p=(unit presence:sur)
  ^-  json
  ?~  p  ~
  %-  pairs
  :~  key+(key key.u.p)
      topic+s+topic.u.p
      sides+(pairs ~[a+s+a.sides.u.p b+s+b.sides.u.p])
      stage+s+stage.u.p
      role+s+role.u.p
  ==
::
++  invitation
  |=  i=invitation:sur
  ^-  json
  %-  pairs
  :~  key+(key key.i)
      topic+s+topic.i
      sides+(pairs ~[a+s+a.sides.i b+s+b.sides.i])
      at+(time at.i)
  ==
--
::
++  de
=,  dejs-soft:format
|%
++  ship  (se:de:common %p)
++  id
  |=  j=json
  ^-  (unit @da)
  ?.  ?=([%s @] j)  ~
  (bind (rush p.j dem) |=(n=@ `@da`n))
++  side  (su (perk %a %b ~))
++  key  (ot ~[host+ship id+id])
::
++  command
  ^-  $-(json (unit command:sur))
  %-  of
  :~  create+create
      ::  the key's id is the action's
      :-  %act
      %+  cu  |=([h=@p a=action:sur] [[h (action-id:dlib a)] a])
      (ot ~[host+ship action+action])
      watch+key
      forget+key
      dismiss+key
      track+(ot ~[who+(cu |=(l=(list @p) (silt l)) (ar ship))])
      older+(ot ~[key+key before+id])
  ==
::  +create: the config, and who to invite, in one object
::
++  create
  |=  j=json
  ^-  (unit [config:sur (set @p)])
  =/  u
    %.  j
    %-  ot
    :~  topic+so
        sides+(ot ~[a+so b+so])
        moderator+(mu ship)
        start+(mu di)
        end+(mu di)
        debaters+(su (perk %open %invite ~))
        revote+bo
        tally+(su (perk %live %hidden ~))
        invite+(ar ship)
    ==
  ?~  u  ~
  =/  [topic=@t sides=[@t @t] moderator=(unit @p) start=(unit @da) end=(unit @da) debaters=?(%open %invite) revote=? tally=?(%live %hidden) invite=(list @p)]
    u.u
  `[[topic sides moderator start end debaters revote tally] (silt invite)]
::
++  action
  ^-  $-(json (unit action:sur))
  %-  of
  :~  join+(ot ~[id+id as+(mu side)])
      leave+(ot ~[id+id])
      say+(ot ~[id+id text+so])
      vote+(ot ~[id+id side+side])
      mute+(ot ~[id+id who+ship on+bo])
      remove+(ot ~[id+id who+ship])
      start+(ot ~[id+id])
      end+(ot ~[id+id])
      invite+(ot ~[id+id who+(cu |=(l=(list @p) (silt l)) (ar ship))])
  ==
--
--
