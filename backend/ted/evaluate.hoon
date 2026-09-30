::  Ask a Jev evaluation through %trill-ai-client and wait for it: poke
::  %evaluate, watch /response/<id>, return the answers typed. what an
::  agent does to use it, in thread form
::
::    arg: [provider=@tas evaluate-args] from sur/ai-client.hoon, e.g.
::    -nostrill!evaluate [%openrouter 'jev-latest' s+'Buy followers!' (malt ~[['spam' [%noul s+'Is this spam?' ~ ~]]])]
::
::    returns (each evaluation outcome): the answers, or what came back
::    instead of them
::
/-  spider, sur=ai-client
/+  strandio, jev
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  from dojo the arg comes wrapped in a unit; from agents, bare
=/  bare=vase  ?.(?=([~ *] q.arg) arg (slot 3 arg))
=/  [provider=@tas args=evaluate-args:sur]
  !<([@tas evaluate-args:sur] bare)
;<  =bowl:strand  bind:m  get-bowl:strandio
=/  id=@tas  (cat 3 'ted' (crip (a-co:co (end [3 4] eny.bowl))))
=/  =action:sur  [%evaluate id provider args]
;<  ~  bind:m  (poke-our:strandio %trill-ai-client %noun !>(action))
;<  ~  bind:m  (watch-our:strandio /result %trill-ai-client /response/[id])
;<  =cage  bind:m  (take-fact:strandio /result)
::  facts reach subscribers untyped, even ours: clam, not !<
=/  =outcome:sur  ;;(outcome:sur q.q.cage)
=/  e=(unit evaluation:sur)
  ?.  ?=([%response %ok *] outcome)  ~
  (evaluation:jev value.outcome)
?~  e
  (pure:m !>(`(each evaluation:sur outcome:sur)`[%| outcome]))
(pure:m !>(`(each evaluation:sur outcome:sur)`[%& u.e]))
