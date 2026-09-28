::  Call a provider's non-streaming Responses API.
::
::    arg: [provider request-args] from sur/ai-client.hoon, e.g.
::    -nostrill!responses [['https://openrouter.ai/api/v1' key] [model input ~]]
::
/-  spider, sur=ai-client
/+  rl=llm-responses, strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-
  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  from dojo the arg comes wrapped in a unit; from agents, bare
=/  bare=vase  ?.(?=([~ *] q.arg) arg (slot 3 arg))
=/  [p=provider:sur args=request-args:sur]
  !<([provider:sur request-args:sur] bare)
=/  url  (base-url:rl base-url.p)
?~  url
  (strand-fail %bad-base-url ~)
=/  request=request:http  (build-request:rl p(base-url u.url) args)
;<  ~  bind:m  (send-request:strandio request)
;<  res=client-response:iris  bind:m  take-client-response:strandio
?.  ?=(%finished -.res)
  (strand-fail %incomplete-http-response ~)
?~  full-file.res
  (strand-fail %missing-response-body ~)
=/  body=@t  q.data.u.full-file.res
=/  parsed=response:sur
  (parse-response:rl response-header.res body)
(pure:m !>(parsed))
