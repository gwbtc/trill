::  Minimal client primitives for OpenAI-compatible Responses APIs.
::
/-  llm-client
|%
++  endpoint
  'https://openrouter.ai/api/v1/responses'
::
++  request-args
  request-args:llm-client
::
++  response
  response:llm-client
::
++  endpoint-for
  |=  provider=provider:llm-client
  ^-  @t
  ?-  provider
    %openai      'https://api.openai.com/v1/responses'
    %openrouter  endpoint
  ==
::
++  models-endpoint-for
  |=  provider=provider:llm-client
  ^-  @t
  ?-  provider
    %openai      'https://api.openai.com/v1/models'
    %openrouter  'https://openrouter.ai/api/v1/models'
  ==
::
++  request-json
  |=  args=request-args
  ^-  json
  =,  enjs:format
  =/  fields=(list [@t json])
    :~  ['model' s+model.args]
        ['input' s+input.args]
    ==
  =?  fields  ?=(^ max-output-tokens.args)
    (weld fields ~[['max_output_tokens' (numb u.max-output-tokens.args)]])
  (pairs fields)
::
++  build-request
  |=  args=request-args
  (build-request-at endpoint args)
::
++  build-provider-request
  |=  [provider=provider:llm-client args=request-args]
  (build-request-at (endpoint-for provider) args)
::
++  build-request-at
  |=  [request-endpoint=@t args=request-args]
  ^-  request:http
  =/  authorization=@t  (cat 3 'Bearer ' api-key.args)
  =/  body=@t  (en:json:html (request-json args))
  =/  headers=header-list:http
    :~  ['Authorization' authorization]
        ['Content-Type' 'application/json']
    ==
  :*  method=%'POST'
      url=request-endpoint
      header-list=headers
      (some (as-octs:mimes:html body))
  ==
::
++  build-models-request
  |=  [provider=provider:llm-client api-key=@t]
  ^-  request:http
  =/  authorization=@t  (cat 3 'Bearer ' api-key)
  :*  method=%'GET'
      url=(models-endpoint-for provider)
      header-list=~[['Authorization' authorization]]
      body=~
  ==
::
++  parse-response
  |=  [=response-header:http body=@t]
  ^-  response
  =/  value=(unit json)  (de:json:html body)
  ?:  &((gte status-code.response-header 200) (lth status-code.response-header 300))
    ?~  value
      [%invalid-json response-header body]
    [%ok response-header body u.value]
  [%error response-header body value]
::
++  outcome-json
  |=  result=outcome:llm-client
  ^-  json
  =,  enjs:format
  ?-  -.result
    %transport-error
      (pairs ~[['kind' s+'transport-error'] ['reason' s+reason.result]])
    %response
      =/  rep=response:llm-client  +.result
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
