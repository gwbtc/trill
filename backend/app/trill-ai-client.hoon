::  trill-ai-client: calls AI models over HTTP for other agents and the UI
::
::    providers are ours to name: a base url speaking the Responses API,
::    optionally a url for evaluations (Jev, lib/jev.hoon), and a key
::    (sur/ai-client.hoon suggests some)
::
::    agents on our ship poke a %call, %evaluate or %list-models with a
::    request id, then watch /response/<id> for the outcome (see
::    +on-watch; ted/evaluate.hoon does just that). nothing is kept
::    after it's given, except successful answers, cached by what was
::    asked for up to an hour: the same question to the same endpoint
::    isn't paid for twice
::
::    scries (json):
::      /x/providers          [{name, baseUrl, evalUrl, hasKey}], no keys
::      /x/suggestions        [{name, baseUrl, evalUrl}]
::
/-  *ai-client
/+  default-agent, dbug, rl=llm-responses, jev, jl=json-llm-client
::
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      providers=(map @tas provider)
      ::  requests out, and the cache key their answer goes under
      pending=(map @tas @uvH)
      ::  successful outcomes, by what was asked (+cache-key); wiped
      ::  every hour, with anything still in ready
      cache=(map @uvH outcome)
      ::  cached answers for new requests, until their caller watches
      ready=(map @tas outcome)
  ==
::
++  wipe-every  ~h1
::  +cache-key: a request without its headers, so without the api key:
::  the same question to the same endpoint
::
++  cache-key
  |=  =request:http
  ^-  @uvH
  (sham [method.request url.request body.request])
::  +provider-for: the provider for a new request id
::
++  provider-for
  |=  [state=state-0 id=@tas name=@tas]
  ^-  provider
  ?:  |((~(has by pending.state) id) (~(has by ready.state) id))
    ~|([%duplicate-request-id id] !!)
  =/  p  (~(get by providers.state) name)
  ?~  p  ~|([%no-such-provider name] !!)
  u.p
::  +ask: answer from the cache, or send the request
::
++  ask
  |=  [state=state-0 id=@tas =request:http]
  ^-  [(list card) state-0]
  =/  k  (cache-key request)
  =/  hit  (~(get by cache.state) k)
  ?^  hit
    [~ state(ready (~(put by ready.state) id u.hit))]
  :_  state(pending (~(put by pending.state) id k))
  ~[[%pass /responses/[id] %arvo %i %request request *outbound-config:iris]]
::
++  wipe-timer
  |=  now=@da
  ^-  card
  [%pass /wipe %arvo %b %wait (add now wipe-every)]
::
++  give
  |=  [id=@tas =outcome]
  ^-  (list card)
  :~  [%give %fact ~[/response/[id]] %noun !>(outcome)]
      [%give %kick ~[/response/[id]] ~]
  ==
--
::
=|  state=state-0
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  [~[(wipe-timer now.bowl)] this]
::
++  on-save
  !>(state)
::
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  ::  no migrations before launch: change state-0 in place and |nuke
  =.  state  !<(state-0 old-state)
  `this
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  =/  act=action
    ?+  mark  ~|([%bad-mark mark] !!)
      %noun  ;;(action q.vase)
    ::
        %json
      =/  a  (action:de:jl !<(json vase))
      ?~  a  ~|(%bad-llm-client-json !!)
      u.a
    ==
  ?-  -.act
      %set-provider
    =/  url  (base-url:rl base-url.act)
    ?~  url  ~|('the base url must start with http:// or https://' !!)
    =/  eval=(unit @t)
      ?~  eval-url.act  ~
      =/  e  (base-url:rl u.eval-url.act)
      ?~  e  ~|('the evaluations url must start with http:// or https://' !!)
      e
    =/  old  (~(get by providers.state) name.act)
    =/  key=@t
      ?^  api-key.act  u.api-key.act
      ?~(old '' api-key.u.old)
    =.  providers.state  (~(put by providers.state) name.act [u.url eval key])
    `this
  ::
      %del-provider
    =.  providers.state  (~(del by providers.state) name.act)
    `this
  ::
      %list-models
    =/  p  (provider-for state request-id.act provider.act)
    =^  cards  state
      (ask state request-id.act (build-models-request:rl p))
    [cards this]
  ::
      %call
    =/  p  (provider-for state request-id.act provider.act)
    =/  args=request-args  [model.act input.act max-output-tokens.act]
    =^  cards  state
      (ask state request-id.act (build-request:rl p args))
    [cards this]
  ::
      %evaluate
    =/  bad  (problem:jev args.act)
    ?^  bad  ~|(u.bad !!)
    =/  p  (provider-for state request-id.act provider.act)
    =^  cards  state
      (ask state request-id.act (build-request:jev p args.act))
    [cards this]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
      [%x %providers ~]
    ``json+!>((providers:en:jl providers.state))
  ::
      [%x %suggestions ~]
    ``json+!>(suggestions:en:jl)
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%wipe ~]
    ?.  ?=([%behn %wake *] sign-arvo)  `this
    =.  cache.state  ~
    =.  ready.state  ~
    [~[(wipe-timer now.bowl)] this]
  ::
      [%responses @tas ~]
    ?.  ?=([%iris %http-response *] sign-arvo)
      (on-arvo:def wire sign-arvo)
    =/  id=@tas  i.t.wire
    =/  k  (~(get by pending.state) id)
    ?~  k  `this
    =/  res=client-response:iris  +>.sign-arvo
    ?:  ?=(%progress -.res)
      `this
    =.  pending.state  (~(del by pending.state) id)
    =/  result=outcome
      ?-  -.res
        %cancel  [%transport-error %cancelled]
        %finished
          =/  body=@t
            ?~(full-file.res '' q.data.u.full-file.res)
          [%response (parse-response:rl response-header.res body)]
      ==
    ::  only answers are worth keeping: not errors, not a 429
    =?  cache.state  ?=([%response %ok *] result)
      (~(put by cache.state) u.k result)
    [(give id result) this]
  ==
::
::  /response/<id>: for agents on our ship. poke a %call, %evaluate or
::  %list-models, then watch its id: the outcome comes as a %noun fact
::  (untyped when it arrives: clam it with ;;), then a kick. a cached
::  answer comes at once
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%response @tas ~]
    ?>  =(our src):bowl
    =/  id=@tas  i.t.path
    =/  hit  (~(get by ready.state) id)
    ?^  hit
      =.  ready.state  (~(del by ready.state) id)
      :_  this
      :~  [%give %fact ~ %noun !>(u.hit)]
          [%give %kick ~ ~]
      ==
    ~|  [%no-such-request id]
    ?>  (~(has by pending.state) id)
    `this
  ==
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
