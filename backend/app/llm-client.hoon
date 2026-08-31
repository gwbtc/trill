/-  *llm-client
/+  default-agent, openrouter
::
|%
+$  card  card:agent:gall
+$  pending-call  [=provider model=@t]
+$  state-0
  $:  %0
      keys=(map provider @t)
      pending=(map @tas pending-call)
      responses=(map @tas outcome)
  ==
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
  =.  state  !<(state-0 old-state)
  `this
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?.  =(%llm-client-action mark)
    (on-poke:def mark vase)
  ?>  =(our src):bowl
  =/  act=action  !<(action vase)
  ?-  -.act
    %set-key
      =.  keys.state
        (~(put by keys.state) provider.act api-key.act)
      `this
    %list-models
      ~|  [%duplicate-request-id request-id.act]
      ?>  ?&  !(~(has by pending.state) request-id.act)
              !(~(has by responses.state) request-id.act)
          ==
      =/  key=(unit @t)  (~(get by keys.state) provider.act)
      ~|  [%missing-api-key provider.act]
      ?>  ?=(^ key)
      =/  request=request:http
        (build-models-request:openrouter provider.act u.key)
      =.  pending.state
        (~(put by pending.state) request-id.act [provider.act 'models'])
      =/  request-wire=wire  /responses/[request-id.act]
      =/  effect=card
        :*  %pass  request-wire  %arvo  %i  %request
            request  *outbound-config:iris
        ==
      [[effect ~] this]
    %call
      ~|  [%duplicate-request-id request-id.act]
      ?>  ?&  !(~(has by pending.state) request-id.act)
              !(~(has by responses.state) request-id.act)
          ==
      =/  key=(unit @t)  (~(get by keys.state) provider.act)
      ~|  [%missing-api-key provider.act]
      ?>  ?=(^ key)
      =/  args=request-args:openrouter
        [u.key model.act input.act max-output-tokens.act]
      =/  request=request:http
        (build-provider-request:openrouter provider.act args)
      =.  pending.state
        (~(put by pending.state) request-id.act [provider.act model.act])
      =/  request-wire=wire  /responses/[request-id.act]
      =/  effect=card
        :*  %pass  request-wire  %arvo  %i  %request
            request  *outbound-config:iris
        ==
      [[effect ~] this]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
      [%x %providers ~]
    =/  names=(list json)
      %+  turn  ~(tap by keys.state)
      |=  [name=provider key=@t]
      s+name
    ``json+!>(a+names)
  ::
      [%x %response @tas ~]
    =/  request-id=@tas  i.t.t.path
    =/  result=(unit outcome)  (~(get by responses.state) request-id)
    ?~  result
      ``json+!>(~)
    ``json+!>((outcome-json:openrouter u.result))
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
        [%response (parse-response:openrouter response-header.res body)]
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
