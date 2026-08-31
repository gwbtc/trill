/-  sur=nostr
/+  common=json-common, sr=sortug
|%
++  en
=,  enjs:format  
  |%
  ::  relay comms
  ++  req  |=  req=client-msg:sur  ^-  json
    :-  %a  :-  s+(crip (cuss (trip -.req)))
    ?-  -.req
      %req    (enreq +.req)
      %event  :_  ~  (event +.req)
      %auth   :_  ~  (event +.req)
      %close  :_  ~  [%s +.req]
    ==
++  enreq
  |=  [sub-id=@t fs=(list filter:sur)]
  ^-  (list json)
  :-  [%s sub-id]
  %+  turn  fs  filter

    ::
  ::  +raw-event: the nip-01 id preimage. keys are x-only (32
  ::  bytes) and every hex field must be zero-padded to its full
  ::  width, or the serialization (and so the id) is wrong
  ::
  ++  raw-event  |=  raw-event:sur
    :-  %a  :~
      [%n '0']
      (hex:en:common pubkey)
      (numb created-at)
      (numb kind)
      a+(turn tags tag)
      s+content
    ==
  ++  wevent
  |=  w=wevent:sur  ^-  json
    =/  base  (event +.w)
    ?>  ?=(%o -.base)
    =.  p.base  (~(put by p.base) 'relays' [%a (turn relays.w cord:en:common)])
    base
  ::  +event: wire/frontend form. same x-only pubkey as the id
  ::  preimage; sig is 64 bytes so it pads to 128 hex chars
  ::
  ++  event
  |=  e=event:sur  ^-  json
    %:  pairs
      id+(hex:en:common id.e)
      pubkey+(hex:en:common pubkey.e)
      sig+(hexn:en:common 128 sig.e)
      ['created_at' (numb created-at.e)]
      kind+(numb kind.e)
      content+s+content.e
      tags+a+(turn tags.e tag)
    ~
    ==
  ++  tag
  |=  t=tag:sur  ^-  json  [%a (turn t cord:en:common)]
    :: :-  s+key.t
    :: :-  s+value.t
    :: (turn rest.t |=(tt=@t s+tt))
    :: 
  ++  filter
  |=  f=filter:sur  ^-  json
    =|  l=(list [key=@t jon=json])
    =.  l  ?~  ids.f      l  :_  l  ['ids' %a (turn ~(tap in u.ids.f) hex:en:common)]
    =.  l  ?~  authors.f  l  :_  l  ['authors' %a (turn ~(tap in u.authors.f) hex:en:common)]
    =.  l  ?~  kinds.f    l  :_  l  ['kinds' %a (turn ~(tap in u.kinds.f) numb)]
    =.  l  ?~  tags.f     l  %+  weld  l  (tags u.tags.f)

    =.  l  ?~  since.f    l  :_  l  ['since' (sect u.since.f)]
    =.  l  ?~  until.f    l  :_  l  ['until' (sect u.until.f)]
    =.  l  ?~  limit.f    l  :_  l  ['limit' (numb u.limit.f)]
    ::
    %-  pairs  l


  ++  tags
  |=  tm=(map @t (list @t))  ^-  (list [@t json])  ::  entries to the filter obeject
    %+  turn  ~(tap by tm)    |=  [key=@t values=(list @t)]
      =/  nkey  (cat 3 '#' key)
      [nkey %a (turn values cord:en:common)]

  ++  user-meta
  |=  meta=user-meta:sur
    %-  pairs  (user-meta-pairs meta)

  ++  user-meta-pairs
  |=  meta=user-meta:sur  ^-  (list [@t json])
    %+  weld  ^-  (list [@t json])
    :~  name+s+name.meta
        about+s+about.meta
        picture+s+picture.meta
    ==
    %+  turn  ~(tap by other.meta)  |=  a=[@t json]  a
    
  ++  relay-msg  |=  msg=relay-msg:sur  ^-  json
  =/  head  [%s -.msg]
  :-  %a  :-  head
  ?-  -.msg
    %event   ~[[%s sub-id.msg] (event event.msg)]
    %ok      ~[(hex:en:common id.msg) [%b accepted.msg] [%s msg.msg]]
    %eose    ~[[%s sub-id.msg]]
    %closed  ~[[%s sub-id.msg]]
    %notice  ~[[%s msg.msg]]
    %auth    ~[[%s challenge.msg]]
  ==
  --
++  de
=,  dejs-soft:format
  |%
    :: relay
  ++  msg
    %-  ot  :~
      relay+so
      msg+relay-msg
    ==
  ++  relay-msg
    |=  jon=json  ^-  (unit relay-msg:sur)
    ?.  ?=(%a -.jon)  ~
    ?~  p.jon  ~
    =/  head  i.p.jon
    ?~  t.p.jon  ~
    =/  second  i.t.p.jon
    ?.  ?=(%s -.head)  ~
    :: TODO make sure they're always caps
    ?+  p.head  ~
      %'EVENT'
        =/  d  (so second)  ?~  d  ~
         ?~  t.t.p.jon  ~  
         =/  third  i.t.t.p.jon
         =/  t  (event third)   ?~  t  ~
        `[%event u.d u.t] 
      %'OK'
         =/  d  (hex:de:common second)  ?~  d  ~
         ?~  t.t.p.jon  ~  
         =/  third  i.t.t.p.jon
         =/  t  (bo third)   ?~  t  ~
         ?~  t.t.t.p.jon  ~  
         =/  fourth  i.t.t.t.p.jon
         =/  f  (so fourth)   ?~  f  ~
        `[%ok u.d u.t u.f]  
      %'CLOSED'
         =/  d  (so second)  ?~  d  ~
         ?~  t.t.p.jon  ~  
         =/  third  i.t.t.p.jon
         =/  t  (so third)   ?~  t  ~
        `[%closed u.d u.t]
      %'EOSE'
         =/  d  (so second)  ?~  d  ~
        `[%eose u.d]
      %'NOTICE'
         =/  d  (so second)  ?~  d  ~
        `[%notice u.d]
      %'AUTH'
         =/  d  (so second)  ?~  d  ~
        `[%auth u.d]
    ==
  ++  client-msg
    |=  jon=json  ^-  (unit client-msg:sur)
    ?.  ?=(%a -.jon)  ~
    ?~  p.jon  ~
    =/  head  i.p.jon
    ?~  t.p.jon  ~
    =/  second  i.t.p.jon
    ?.  ?=(%s -.head)  ~
    :: TODO make sure they're always caps
    ?+  p.head  ~
      %'EVENT'
        =/  d  (event second)  ?~  d  ~
        `[%event u.d] 
      %'REQ'
         =/  d  (so second)  ?~  d  ~
         =/  rest=(list json)  t.t.p.jon
         =/  d2  ((ar filter) [%a rest])  ?~  d2  ~
        `[%req u.d u.d2]  
      %'CLOSE'
         =/  d  (so second)  ?~  d  ~
        `[%close u.d]
      %'AUTH'
         =/  d  (event second)  ?~  d  ~
        `[%auth u.d]
    ==
    ++  filter  |=  jon=json  ^-  (unit filter:sur)
      ?.  ?=(%o -.jon)  ~
      =/  f  *filter:sur
      =/  entries  ~(tap by p.jon)
      |-  ?~  entries  `f
        =/  entry=[@t json]  i.entries
        =.  f
          ?:  .=('ids' -.entry)
            =/  vl  ((ar hex:de:common) +.entry)
            ?~  vl  f
            =/  values  (silt u.vl)
            f(ids `values)
          ?:  .=('authors' -.entry)
            =/  vl  ((ar hex:de:common) +.entry)
            ?~  vl  f
            =/  values  (silt u.vl)
            f(authors `values)
          ?:  .=('kinds' -.entry)
            =/  vl  ((ar ni) +.entry)
            ?~  vl  f
            =/  values  (silt u.vl)
            f(kinds `values)
          ?:  .=('limit' -.entry)
            =/  value  (ni +.entry)
            f(limit value)
          ?:  .=('since' -.entry)
            =/  value  (du:de:common +.entry)
            f(since value)
          ?:  .=('until' -.entry)
            =/  value  (du:de:common +.entry)
            f(until value)
        ::   ::  anything else is a tag
            =/  vl  ((ar so) +.entry)
            ?~  vl  f
            =/  ctags  ?~  tags.f  *(map @t (list @t))  u.tags.f
            =/  ntags  (~(put by ctags) -.entry u.vl)
            f(tags `ntags)
        $(entries t.entries)
      
      
      
    
    :: | { event: { subscription_id: string; event: NostrEvent } }
    :: | { ok: { event_id: string; accepted: boolean; message: string } }
    :: | { eose: string }
    :: | { closed: { subscription_id: string; message: string } }
    :: | { notice: string }
    :: // this is ours
    :: | { error: string };
  ++  event-sub
    %-  ot  :~
      ['subscription_id' so]
      event+event
    ==
  ++  relay-ok
    %-  ot  :~
      ['event_id' hex:de:common]
      accepted+bo
      message+so
    ==
  ++  closed
    %-  ot  :~
      ['subscription_id' so]
      message+so
    ==
  ++  event
    %-  ot  :~
      id+hex:de:common
      pubkey+hex:de:common
      ['created_at' ni]
      kind+ni
      tags+(ar (ar so))
      content+so
      sig+hex:de:common
    ==
  ++  user-meta  |=  jon=json
    ^-  (unit user-meta:sur)
    ?.  ?=(%o -.jon)  ~
    =|  um=user-meta:sur
    =/  fields  ~(tap by p.jon)
    |-  ?~  fields  (some um)
      =/  k  -.i.fields
      =/  jn=json  +.i.fields
      ?+  k
        =/  ot  (~(put by other.um) k jn)
        =.  um  um(other ot)  $(fields t.fields)
      %'name'             
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(name u.crd))
      %'display_name'
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(name u.crd))
      %'displayName'
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(name u.crd))
      %'about'
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(about u.crd))
      %'picture'
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(picture u.crd))
      %'image'
        =/  crd  (so jn)
        ?~  crd  $(fields t.fields)  $(fields t.fields, um um(picture u.crd))
      ==
  --
--
