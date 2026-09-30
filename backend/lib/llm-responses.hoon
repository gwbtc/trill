::  Minimal client primitives for OpenAI-compatible Responses APIs,
::  at any provider's base url
::
/-  sur=ai-client
|%
++  provider      provider:sur
++  request-args  request-args:sur
++  response      response:sur
::  +base-url: a provider's url as we keep it, without trailing
::  slashes, or ~ if it isn't http(s)
::
++  base-url
  |=  url=@t
  ^-  (unit @t)
  =/  t=tape  (trip url)
  =/  scheme=@ud
    ?:  =("https://" (scag 8 t))  8
    ?:  =("http://" (scag 7 t))  7
    0
  ?:  =(0 scheme)  ~
  =/  r=tape  (flop t)
  |-
  ?:  &(?=(^ r) =('/' i.r))  $(r t.r)
  ?:  (lte (lent r) scheme)  ~
  `(crip (flop r))
::
++  endpoint
  |=  [p=provider path=@t]
  ^-  @t
  (rap 3 ~[base-url.p '/' path])
::  +auth: no Authorization header without a key
::
++  auth
  |=  p=provider
  ^-  header-list:http
  ?:  =('' api-key.p)  ~
  ~[['Authorization' (cat 3 'Bearer ' api-key.p)]]
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
  |=  [p=provider args=request-args]
  ^-  request:http
  =/  body=@t  (en:json:html (request-json args))
  :*  method=%'POST'
      url=(endpoint p 'responses')
      header-list=(weld (auth p) ~[['Content-Type' 'application/json']])
      (some (as-octs:mimes:html body))
  ==
::
++  build-models-request
  |=  p=provider
  ^-  request:http
  :*  method=%'GET'
      url=(endpoint p 'models')
      header-list=(auth p)
      body=~
  ==
::
::  +parse-response: a 2xx that says it's json (or doesn't say what it is)
::  is parsed; any other 2xx, like audio or plain text, is kept as bytes
::
++  parse-response
  |=  [=response-header:http file=(unit mime-data:iris)]
  ^-  response
  =/  body=@t  ?~(file '' q.data.u.file)
  =/  type=@t  ?~(file '' type.u.file)
  ?.  &((gte status-code.response-header 200) (lth status-code.response-header 300))
    [%error response-header body (de:json:html body)]
  =/  as-json=?
    ?|  =('' type)
        =('application/octet-stream' type)
        ?=(^ (find "json" (trip type)))
    ==
  ?.  as-json
    [%data response-header type ?~(file [0 0] data.u.file)]
  =/  value=(unit json)  (de:json:html body)
  ?~  value
    [%invalid-json response-header body]
  [%ok response-header body u.value]
--
