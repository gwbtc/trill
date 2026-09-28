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
      'hasKey'^b+!=('' api-key.p)
  ==
::
++  suggestions
  ^-  json
  :-  %a
  %+  turn  suggestions:sur
  |=  [name=@tas url=@t]
  (pairs ~[name+s+name 'baseUrl'^s+url])
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
      (ot ~[name+name 'baseUrl'^so 'apiKey'^(mu so)])
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
  ==
--
--
