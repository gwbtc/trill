::  debates: a group chat between two opposing sides, with onlookers who
::  vote. the ship that creates a debate hosts it: guests subscribe to
::  it and poke it, it checks every action and relays the result
::
|%
::  +key: a debate, anywhere: its host and the host's id for it
::
+$  key  [host=ship id=@da]
+$  side  ?(%a %b)
::
::  +config: set by the creator
::
::    sides: the two positions, e.g. ['Cats' 'Dogs']
::    start: ~ means it starts when created. end: ~ means open ended,
::    the host ends it by hand
::    debaters: %open, anyone joining may take a side; %invite, only
::    invited ships may (everyone can still watch and vote)
::    revote: whether onlookers may change their vote
::    tally: %live, everyone sees the running count; %hidden, only
::    the total until the debate ends
::
+$  config
  $:  topic=@t
      sides=[a=@t b=@t]
      moderator=(unit ship)
      start=(unit @da)
      end=(unit @da)
      debaters=?(%open %invite)
      revote=?
      tally=?(%live %hidden)
  ==
+$  stage  ?(%scheduled %live %ended)
::
::  +message: a debater's line, stamped by the host when it arrived
::
+$  message  [id=@da author=ship =side text=@t]
++  mon  ((on @da message) lth)
::
+$  debate
  $:  =key
      =config
      =stage
      debaters=(map ship side)
      onlookers=(set ship)
      invited=(set ship)
      votes=(map ship side)
      muted=(set ship)
      removed=(set ship)             ::  can't come back
      messages=((mop @da message) lth)
      ended=(unit @da)
  ==
::
::  +action: pokes to a debate's host, %debates-action mark. guests
::  send the ones they may; the host checks who sent them
::
+$  action
  $%  [%join id=@da as=(unit side)]         ::  ~: as an onlooker
      [%leave id=@da]
      [%say id=@da text=@t]                 ::  debaters, while live
      [%vote id=@da =side]                  ::  onlookers
      [%mute id=@da who=ship on=?]          ::  moderator or host
      [%remove id=@da who=ship]             ::  moderator or host
      [%start id=@da]                       ::  host
      [%end id=@da]                         ::  host
      [%invite id=@da who=(set ship)]       ::  host
  ==
::
::  +command: pokes from our own ship (the UI or dojo)
::
+$  command
  $%  [%create =config invite=(set ship)]
      [%act =key =action]                   ::  sent to key's host
      [%watch =key]                         ::  follow one, e.g. from a link
      [%forget =key]                        ::  stop following, leave it
      [%dismiss =key]                       ::  drop an invitation
      ::  whose presence to follow (replaces the set): the UI sends the
      ::  ships we follow, and any profile being looked at
      [%track who=(set ship)]
  ==
::
::  +presence: the debate a ship is in, as it tells anyone who asks
::  (/presence). a ship is in one debate at a time: the one it hosts or
::  joined, until that ends or it leaves
::
::    role: the side it argues for, %onlooker, or %host for a host that
::    hasn't taken a side
::
+$  presence
  $:  =key
      topic=@t
      sides=[a=@t b=@t]
      =stage
      role=?(side %onlooker %host)
  ==
::
::  +invitation: a host telling a ship it's invited
::
+$  invitation  [=key topic=@t sides=[a=@t b=@t] at=@da]
::
::  +msg: ship to ship pokes, %noun mark: actions go to hosts,
::  invitations to guests
::
+$  msg
  $%  [%action =action]
      [%invited =invitation]
  ==
::
::  +update: what a host sends its subscribers
::
::    %init: the whole debate, on subscribing. votes are only who voted
::    for what when the tally is live or the debate is over; otherwise
::    just the count (see %tally)
::
+$  update
  $%  [%init =debate total=@ud]
      [%said =message]
      $:  %meta
          =stage
          debaters=(map ship side)
          onlookers=(set ship)
          invited=(set ship)
          muted=(set ship)
          ended=(unit @da)
      ==
      [%tally votes=(map ship side) total=@ud]
      [%gone ~]                             ::  removed: you're out
  ==
--
