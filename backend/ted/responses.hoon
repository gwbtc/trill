::  Call OpenRouter's non-streaming Responses API.
::
/-  spider
/+  openrouter, strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-
  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  args=request-args:openrouter  !<(request-args:openrouter arg)
=/  request=request:http  (build-request:openrouter args)
;<  ~  bind:m  (send-request:strandio request)
;<  res=client-response:iris  bind:m  take-client-response:strandio
?.  ?=(%finished -.res)
  (strand-fail %incomplete-http-response ~)
?~  full-file.res
  (strand-fail %missing-response-body ~)
=/  body=@t  q.data.u.full-file.res
=/  parsed=response:openrouter
  (parse-response:openrouter response-header.res body)
(pure:m !>(parsed))
