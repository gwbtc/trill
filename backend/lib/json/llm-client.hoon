::  json-llm-client: %trill-ai-client for the UI. keys are never sent out,
::  only whether a provider has one
::
/-  sur=ai-client
|%
++  en
=,  enjs:format
|%
++  providers
  |=  m=(map @tas provider:sur)
  ^-  json
  :-  %a
  %+  turn  ~(tap by m)
  |=  [name=@tas p=provider:sur]
  %-  pairs
  :~  name+s+name
      'baseUrl'^s+base-url.p
      'evalUrl'^?~(eval-url.p ~ s+u.eval-url.p)
      'hasKey'^b+!=('' api-key.p)
  ==
::
++  suggestions
  ^-  json
  :-  %a
  %+  turn  suggestions:sur
  |=  [name=@tas url=@t eval=(unit @t)]
  (pairs ~[name+s+name 'baseUrl'^s+url 'evalUrl'^?~(eval ~ s+u.eval)])
::
::  +evaluation: typed Jev answers (lib/jev.hoon), back as json
::
++  evaluation
  |=  e=evaluation:sur
  ^-  json
  %-  pairs
  :~  model+s+model.e
      'inputTokens'^(numb input-tokens.e)
      'outputTokens'^(numb output-tokens.e)
      :-  %answers
      %-  pairs
      %+  turn  ~(tap by answers.e)
      |=  [id=@t a=answer:sur]
      :-  id
      ?-  -.a
        %noul  (pairs ~[type+s+'noul' noul+(real p.a)])
          %choice
        %-  pairs
        :~  type+s+'choice'
            choice+s+choice.a
            probabilities+(reals probabilities.a)
            confidence+(real confidence.a)
        ==
          %score
        %-  pairs
        :~  type+s+'score'
            score+(real score.a)
            legend+(pairs (turn ~(tap by legend.a) |=([k=@t v=@t] [k s+v])))
            probabilities+(reals probabilities.a)
            confidence+(real confidence.a)
        ==
      ==
  ==
::  +real: '.~0.95' is how @rd prints
::
++  real  |=(r=@rd `json`n+(rsh [3 2] (scot %rd r)))
++  reals
  |=  m=(map @t @rd)
  ^-  json
  (pairs (turn ~(tap by m) |=([k=@t r=@rd] [k (real r)])))
::
++  outcome
  |=  result=outcome:sur
  ^-  json
  ?-  -.result
    %transport-error
      (pairs ~[['kind' s+'transport-error'] ['reason' s+reason.result]])
    %response
      =/  rep=response:sur  +.result
      ?-  -.rep
        %ok
          %-  pairs
          :~  ['kind' s+'ok']
              ['status' (numb status-code.response-header.rep)]
              ['body' s+body.rep]
              ['value' value.rep]
          ==
        %error
          %-  pairs
          :~  ['kind' s+'error']
              ['status' (numb status-code.response-header.rep)]
              ['body' s+body.rep]
              ['value' ?~(value.rep ~ u.value.rep)]
          ==
        %invalid-json
          %-  pairs
          :~  ['kind' s+'invalid-json']
              ['status' (numb status-code.response-header.rep)]
              ['body' s+body.rep]
          ==
      ==
  ==
--
::
++  de
=,  dejs-soft:format
|%
++  name  (su sym)
++  action
  ^-  $-(json (unit action:sur))
  %-  of
  :~  :-  %set-provider
      (ot ~[name+name 'baseUrl'^so 'evalUrl'^(mu so) 'apiKey'^(mu so)])
      [%del-provider (ot ~[name+name])]
      [%list-models (ot ~['requestId'^name provider+name])]
      :-  %call
      %-  ot
      :~  'requestId'^name
          provider+name
          model+so
          input+so
          'maxOutputTokens'^(mu ni)
      ==
    ::
      :-  %evaluate
      %-  ot
      :~  'requestId'^name
          provider+name
          :-  %args
          %-  ot
          :~  model+so
              state+some
              questions+(om question)
      ==  ==
  ==
::  +question: Jev's, tagged by its type field (see lib/jev.hoon)
::
++  question
  |=  j=json
  ^-  (unit question:sur)
  ?.  ?=([%o *] j)  ~
  =/  ins  (~(get by p.j) 'instructions')
  ?~  ins  ~
  =/  crit=json  (~(gut by p.j) 'criteria' ~)
  ?+  (~(get by p.j) 'type')  ~
      [~ %s %noul]
    =/  c=(map @t json)  ?:(?=([%o *] crit) p.crit ~)
    `[%noul u.ins (~(get by c) 'true') (~(get by c) 'false')]
  ::
      [~ %s %choice]
    ?.  ?=([%o *] crit)  ~
    `[%choice u.ins (~(run by p.crit) |=(v=json ?~(v ~ `v)))]
  ::
      [~ %s %score]
    ?.  ?=([%a *] crit)  ~
    `[%score u.ins p.crit]
  ==
--
--
