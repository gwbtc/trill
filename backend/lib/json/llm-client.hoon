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
