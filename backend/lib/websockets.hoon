/+  sr=sortug, server
|%
  ++  connect  |=  [endpoint=@t =bowl:gall]
    ^-  card:agent:gall
    =/  =task:iris  [%websocket-connect dap.bowl endpoint]
    ::  the url in the wire tags every %websocket-response sign
    ::  (%accept/%reject/%disconnect) with its relay
    [%pass /ws-connect/(scot %t endpoint) %arvo %i task]

  ++  cancel-connect  |=  wid=@ud
    ^-  card:agent:gall
    =/  =task:iris  [%cancel-websocket wid]
    [%pass /ws-connect %arvo %i task]

  ++  disconnect  |=  wid=@ud
    ^-  card:agent:gall
    =/  =path  /websocket-client/(scot %ud wid)
    =/  ws-paths  :~(path)
    [%give %fact ws-paths %disconnect !>(~)]
  :: 
  :: as client
  ++  give-ws-payload-client
    |=  [wid=@ msg=websocket-message:eyre]
    ^-  card:agent:gall
    =/  =cage
      [%message !>(msg)]
    =/  wsid  (scot %ud wid)
    [%give %fact ~[/websocket-client/[wsid]] cage]

  
  ++  close-ws-client
    |=  wid=@
    ^-  card:agent:gall
      =/  =cage
        [%disconnect !>(~)]
      =/  wsid  (scot %ud wid)
      [%give %fact ~[/websocket-client/[wsid]] cage]

  ++  one-off
    |=  [endpoint=@t wmsg=websocket-message:eyre =bowl:gall]
    ^-  card:agent:gall
      [%pass /ws-oneoff %arvo %k %fard dap.bowl %ws noun+!>([endpoint wmsg])] 
  :: 
  ::  as server
  ++  give-ws-payload-server
    |=  [wid=@ event=websocket-event:eyre]
    ^-  card:agent:gall
    =/  =cage
      [%websocket-response !>([wid event])]
    =/  wsid  (scot %ud wid)
    [%give %fact ~[/websocket-server/[wsid]] cage]
  
  ++  give-ws-payload-server-all
    |=  [=bowl:gall event=websocket-event:eyre]
    ^-  (list card:agent:gall)
    =/  inc-subs  ~(tap by sup.bowl)
    %+  roll  inc-subs  |=  [i=[=duct =ship pat=(pole knot)] acc=(list card:agent:gall)]
      ?.  ?=([%websocket-server wid=@ ~] pat.i)  acc
      =/  wid  (slaw:sr %ud wid.pat.i)
      ?~  wid  acc
      =/  =cage  [%websocket-response !>([u.wid event])]
      =/  card  [%give %fact ~[pat.i] cage]
      [card acc]

  ++  list-client-conns
    |=  =bowl:gall  ^-  (list path)
      =/  inc-subs  ~(tap by sup.bowl)
      %+  roll  inc-subs  |=  [i=[=duct =ship =path] acc=(list path)]
        ?.  ?=([%websocket-client *] path.i)  acc
        [path.i acc]
  ++  list-server-conns
    |=  =bowl:gall  ^-  (list path)
      =/  inc-subs  ~(tap by sup.bowl)
      %+  roll  inc-subs  |=  [i=[=duct =ship =path] acc=(list path)]
        ?.  ?=([%websocket-server *] path.i)  acc
        [path.i acc]
      
  ::
  ++  string-message
    |=  s=@t  ^-  websocket-message:eyre
      =/  octs  (json-to-octs:server %s s)
      =/  wmsg=websocket-message:eyre  [1 `octs]
      wmsg

  
  ++  accept-handshake  |=  wid=@
    =/  response  [%accept ~]
    :~
    (give-ws-payload-server wid response)
    ==
  ++  refuse-handshake  |=  wid=@
    =/  response  [%reject ~]
    :~
    (give-ws-payload-server wid response)
    ==
::  %iris scries
  +$  socket  [wid=@ud url=@t status=$?(%accepted %pending)]
  ++  get-url
    |=  [wid=@ud =bowl:gall]  ^-  (unit socket)
    =/  scry-path=path  /(scot %p our.bowl)//(scot %da now.bowl)/ws/[dap.bowl]/id/(scot %ud wid)
    .^((unit socket) %ix scry-path)
  ++  check-connected
    |=  [url=@t =bowl:gall]  ^-  (unit socket)
    =/  scry-path=path  /(scot %p our.bowl)//(scot %da now.bowl)/ws/[dap.bowl]/url/[url]
    .^((unit socket) %ix scry-path)

  ++  list-connected
    |=  =bowl:gall  ^-  (list socket)
    =/  scry-path=path  /(scot %p our.bowl)//(scot %da now.bowl)/ws/[dap.bowl]
    .^((list socket) %ix scry-path)
--
