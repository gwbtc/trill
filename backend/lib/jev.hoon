::  Evaluations with TypeSafe's Jev models: typed questions about some
::  content, typed answers back. POST to a provider's eval-url, or
::  <base-url>/systemone (TypeSafe's own). OpenRouter serves the same
::  API at its own url, see +suggestions in sur/ai-client.hoon
::
/-  sur=ai-client
/+  rl=llm-responses
|%
++  endpoint
  |=  p=provider:sur
  ^-  @t
  ?^  eval-url.p  u.eval-url.p
  (endpoint:rl p 'systemone')
::  +problem: why the API would refuse these args, if it would
::
++  problem
  |=  args=evaluate-args:sur
  ^-  (unit @t)
  ?:  =('' model.args)  `'no model'
  ?:  =(~ questions.args)  `'no questions'
  =/  qs  ~(tap by questions.args)
  |-
  ?~  qs  ~
  =/  [id=@t q=question:sur]  i.qs
  ?-  -.q
      %noul  $(qs t.qs)
      %choice
    =/  n  ~(wyt by options.q)
    ?:  =(0 n)  `(rap 3 ~[id ': a choice needs options'])
    ?:  (gth n 255)  `(rap 3 ~[id ': at most 255 options'])
    $(qs t.qs)
  ::
      %score
    =/  n  (lent levels.q)
    ?:  (lth n 2)  `(rap 3 ~[id ': a score needs at least 2 levels'])
    ?:  (gth n 10)  `(rap 3 ~[id ': at most 10 levels'])
    $(qs t.qs)
  ==
::
++  request-json
  |=  args=evaluate-args:sur
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  state+subject.args
      model+s+model.args
      :-  %questions
      %-  pairs
      %+  turn  ~(tap by questions.args)
      |=  [id=@t q=question:sur]
      [id (question-json q)]
  ==
::
++  question-json
  |=  q=question:sur
  ^-  json
  =,  enjs:format
  %-  pairs
  :*  type+s+-.q
      instructions+instructions.q
      ?-  -.q
          %noul
        =/  c=(list [@t json])
          %+  weld
            ?~(yes.q ~ ~[['true' u.yes.q]])
          ?~(no.q ~ ~[['false' u.no.q]])
        ?~(c ~ ~[criteria+(pairs c)])
      ::
          %choice
        :~  :-  %criteria
            %-  pairs
            %+  turn  ~(tap by options.q)
            |=([o=@t d=(unit json)] [o ?~(d ~ u.d)])
        ==
      ::
          %score  ~[criteria+a+levels.q]
      ==
  ==
::
++  build-request
  |=  [p=provider:sur args=evaluate-args:sur]
  ^-  request:http
  =/  body=@t  (en:json:html (request-json args))
  :*  method=%'POST'
      url=(endpoint p)
      header-list=(weld (auth:rl p) ~[['Content-Type' 'application/json']])
      (some (as-octs:mimes:html body))
  ==
::  +evaluation: an %ok response's value, typed, for agents that asked
::
++  evaluation
  |=  j=json
  ^-  (unit evaluation:sur)
  =,  dejs-soft:format
  %.  j
  %-  ot
  :~  model+so
      answers+(om answer)
      usage+(ot ~['input_tokens'^ni 'output_tokens'^ni])
  ==
::
++  answer
  |=  j=json
  ^-  (unit answer:sur)
  =,  dejs-soft:format
  ?.  ?=([%o *] j)  ~
  =/  prob  (om ne)
  ?+  (~(get by p.j) 'type')  ~
      [~ %s %noul]
    %+  bind  ((ot ~[noul+ne]) j)
    |=(p=@rd [%noul p])
  ::
      [~ %s %choice]
    %+  bind  ((ot ~[choice+so probabilities+prob confidence+ne]) j)
    |=([c=@t ps=(map @t @rd) f=@rd] [%choice c ps f])
  ::
      [~ %s %score]
    %+  bind
      ((ot ~[score+ne legend+(om so) probabilities+prob confidence+ne]) j)
    |=([s=@rd l=(map @t @t) ps=(map @t @rd) f=@rd] [%score s l ps f])
  ==
--
