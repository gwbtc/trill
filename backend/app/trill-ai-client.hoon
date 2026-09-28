::  trill-ai-client: calls AI models over HTTP for other agents and the UI
::
::    providers are ours to name: a base url speaking the Responses API
::    and a key for it (sur/ai-client.hoon suggests some). calls are
::    fire-and-forget pokes; results are scried by request id
::
::    scries (json):
::      /x/providers          [{name, baseUrl, hasKey}], never the keys
::      /x/suggestions        [{name, baseUrl}]
::      /x/response/<id>      a call's outcome, or null while pending
::
/-  *ai-client
/+  default-agent, rl=llm-responses, jl=json-llm-client
::
|%
+$  card  card:agent:gall
+$  pending-call  [provider=@tas model=@t]
+$  state-0
  $:  %0
      providers=(map @tas provider)
      pending=(map @tas pending-call)
      responses=(map @tas outcome)
  ==
::  +fresh-call: the provider for a new request id
::
++  fresh-call
  |=  [state=state-0 id=@tas name=@tas]
  ^-  provider
  ?:  |((~(has by pending.state) id) (~(has by responses.state) id))
    ~|([%duplicate-request-id id] !!)
  =/  p  (~(get by providers.state) name)
  ?~  p  ~|([%no-such-provider name] !!)
  u.p
::
++  send
  |=  [id=@tas =request:http]
  ^-  card
  [%pass /responses/[id] %arvo %i %request request *outbound-config:iris]
--
::
=|  state=state-0
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  `this
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
    =/  old  (~(get by providers.state) name.act)
    =/  key=@t
      ?^  api-key.act  u.api-key.act
      ?~(old '' api-key.u.old)
    =.  providers.state  (~(put by providers.state) name.act [u.url key])
    `this
  ::
      %del-provider
    =.  providers.state  (~(del by providers.state) name.act)
    `this
  ::
      %list-models
    =/  p  (fresh-call state request-id.act provider.act)
    =.  pending.state
      (~(put by pending.state) request-id.act [provider.act 'models'])
    [~[(send request-id.act (build-models-request:rl p))] this]
  ::
      %call
    =/  p  (fresh-call state request-id.act provider.act)
    =/  args=request-args  [model.act input.act max-output-tokens.act]
    =.  pending.state
      (~(put by pending.state) request-id.act [provider.act model.act])
    [~[(send request-id.act (build-request:rl p args))] this]
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
  ::
      [%x %response @tas ~]
    =/  request-id=@tas  i.t.t.path
    =/  result=(unit outcome)  (~(get by responses.state) request-id)
    ?~  result
      ``json+!>(~)
    ``json+!>((outcome:en:jl u.result))
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?.  ?=([%responses @tas ~] wire)
    (on-arvo:def wire sign-arvo)
  ?.  ?=(%http-response +<.sign-arvo)
    (on-arvo:def wire sign-arvo)
  =/  request-id=@tas  i.t.wire
  ~|  [%unknown-request-id request-id]
  ?>  (~(has by pending.state) request-id)
  =/  res=client-response:iris  +>.sign-arvo
  ?:  ?=(%progress -.res)
    `this
  =.  pending.state  (~(del by pending.state) request-id)
  =/  result=outcome
    ?-  -.res
      %cancel  [%transport-error %cancelled]
      %finished
        =/  body=@t
          ?~(full-file.res '' q.data.u.full-file.res)
        [%response (parse-response:rl response-header.res body)]
    ==
  =.  responses.state
    (~(put by responses.state) request-id result)
  [~ this]
::
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
