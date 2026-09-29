::  Send %trill-ai-client any request and wait for what comes back, as an
::  agent would: poke, watch /response/<id>, take the fact. the action's
::  own request id is used, so make it a fresh one
::
::    arg: an action from sur/ai-client.hoon, e.g.
::    -nostrill!ask [%speech %s1 %omnivoice ['omnivoice' 'Hello there' ~ ~ `%wav ~]]
::    -nostrill!ask [%list-models %m1 %openrouter]
::
::    returns the outcome; bytes (%data: audio, plain text) as their
::    type and size, with plain text shown
::
/-  spider, sur=ai-client
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  from dojo the arg comes wrapped in a unit; from agents, bare
=/  bare=vase  ?.(?=([~ *] q.arg) arg (slot 3 arg))
=/  =action:sur  !<(action:sur bare)
=/  id=@tas
  ?+  -.action  ~|(%not-a-request !!)
    %list-models  request-id.action
    %call         request-id.action
    %evaluate     request-id.action
    %speech       request-id.action
    %transcribe   request-id.action
    %translate    request-id.action
  ==
;<  ~  bind:m  (poke-our:strandio %trill-ai-client %noun !>(action))
;<  ~  bind:m  (watch-our:strandio /result %trill-ai-client /response/[id])
;<  =cage  bind:m  (take-fact:strandio /result)
::  facts reach subscribers untyped, even ours: clam, not !<
=/  =outcome:sur  ;;(outcome:sur q.q.cage)
?.  ?=([%response %data *] outcome)  (pure:m !>(outcome))
=/  status  status-code.response-header.outcome
=/  text=(unit @t)
  ?.  =("text/" (scag 5 (trip type.outcome)))  ~
  `q.data.outcome
(pure:m !>([%data status=status type=type.outcome bytes=p.data.outcome text=text]))
