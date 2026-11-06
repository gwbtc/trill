::  Cooperative, bounded topic jobs. Spider is not a separate CPU: every
::  expensive phase is followed by a real Behn wake, not just a monadic bind.
/-  sur=topics
/+  lib=topics, strandio
=,  strand=strand:rand
|%
++  pause  (div ~s1 100)
++  max-body  262.144
++  max-item  8.192
++  max-items  30
::
+$  cursor
  $:  rest=tape
      current=tape
      size=@ud
      cdata=?
      comment=?
      channel=?
      closed=?
      count=@ud
  ==
::  Consume at most 1024 characters per wake. CDATA and comments cannot
::  introduce phantom RSS items. Items are parsed independently, not as one
::  large recursive XML document.
++  scan
  |=  c=cursor
  ^-  [next=cursor item=(unit @t) error=(unit @t)]
  =/  left=@ud  1.024
  |-
  ?:  (gth size.c max-item)  [c ~ `'rss item exceeds 8192 bytes']
  ?~  rest.c
    ?:  |(cdata.c comment.c (gth size.c 0))
      [c ~ `'incomplete rss item, comment or cdata']
    [c ~ ~]
  ?:  =(0 left)  [c ~ ~]
  ?:  &(cdata.c =(`tape`"]]>" (scag 3 `tape`rest.c)))
    =/  moved  (advance c 3)
    $(c moved(cdata %.n), left (sub left (min left 3)))
  ?:  &(comment.c =(`tape`"-->" (scag 3 `tape`rest.c)))
    =/  moved  (advance c 3)
    $(c moved(comment %.n), left (sub left (min left 3)))
  ?:  |(cdata.c comment.c)
    $(c (advance c 1), left (dec left))
  ?:  =(`tape`"<![CDATA[" (scag 9 `tape`rest.c))
    =/  moved  (advance c 9)
    $(c moved(cdata %.y), left (sub left (min left 9)))
  ?:  =(`tape`"<!--" (scag 4 `tape`rest.c))
    =/  moved  (advance c 4)
    $(c moved(comment %.y), left (sub left (min left 4)))
  ?:  =(`tape`"<channel" (scag 8 `tape`rest.c))
    =/  moved  (advance c 8)
    $(c moved(channel %.y), left (sub left (min left 8)))
  ?:  =(`tape`"</channel>" (scag 10 `tape`rest.c))
    =/  moved  (advance c 10)
    $(c moved(closed %.y), left (sub left (min left 10)))
  ?:  =(`tape`"<item>" (scag 6 `tape`rest.c))
    ?:  (gth size.c 0)  [c ~ `'nested rss item']
    ?:  (gte count.c max-items)  [c(rest ~) ~ ~]
    =/  moved  (advance c(size 1) 6)
    $(c moved(size 6), left (sub left (min left 6)))
  ?:  &(=(`tape`"</item>" (scag 7 `tape`rest.c)) (gth size.c 0))
    =/  done  (advance c 7)
    ?:  (gth size.done max-item)  [done ~ `'rss item exceeds 8192 bytes']
    :-  done(current ~, size 0, count +(count.c))
    [`(crip (flop current.done)) ~]
  $(c (advance c 1), left (dec left))
::
++  advance
  |=  [c=cursor n=@ud]
  ^-  cursor
  %=  c
    rest     (slag n rest.c)
    current  ?:(=(0 size.c) current.c (weld (flop (scag n rest.c)) current.c))
    size     ?:(=(0 size.c) 0 (add size.c n))
  ==
::
++  millis
  |=  [start=@da end=@da]
  ^-  @ud
  (div (mul (sub end start) 1.000) ~s1)
::  Reject pathological nesting before entering the recursive JSON parser.
++  safe-json
  |=  body=@t
  ^-  ?
  =/  chars  (trip body)
  =/  depth=@ud  0
  =/  quoted=?  %.n
  =/  escaped=?  %.n
  |-
  ?~  chars  &(!quoted =(depth 0))
  =/  ch  i.chars
  ?:  escaped  $(chars t.chars, escaped %.n)
  ?:  &(quoted =(ch '\\'))  $(chars t.chars, escaped %.y)
  ?:  =(ch '"')  $(chars t.chars, quoted !quoted)
  ?:  quoted  $(chars t.chars)
  ?:  |(=(ch '[') =(ch '{'))
    ?:  (gte depth 32)  %.n
    $(chars t.chars, depth +(depth))
  ?:  |(=(ch ']') =(ch '}'))
    ?:  =(depth 0)  %.n
    $(chars t.chars, depth (dec depth))
  $(chars t.chars)
::
++  stamp
  |=  [j=job:sur r=raw:lib]
  ^-  topic:sur
  ?:  &(?=(%gnews kind.source.j) ?=(^ hint.source.j))
    [id.j (silt ~[u.hint.source.j]) %source r]
  =/  [cats=(set category:sur) how=?(%rules %hint %unclassified)]
    (classify:lib [title.r (turn links.r |=(l=link:sur title.l))] hint.source.j)
  [id.j cats how r]
::  Returns failures as data, so callers can retain their previous snapshot.
++  process
  |=  [j=job:sur now=@da body=@t]
  =/  m  (strand ,job-result:sur)
  ^-  form:m
  =/  stats=timing:sur  [(met 3 body) 0 0 0 0]
  ?:  (gth bytes.stats max-body)
    (pure:m [[%| 'response exceeds 256 KiB'] stats])
  ;<  ~  bind:m  (sleep:strandio pause)
  ;<  start=@da  bind:m  get-time:strandio
  =/  raws=(list raw:lib)  ~
  =/  parsed-ms=@ud  0
  =/  classified-ms=@ud  0
  =/  out=(list topic:sur)  ~
  ?:  ?=(%hn kind.source.j)
    ?:  (gth bytes.stats 65.536)
      (pure:m [[%| 'hacker news response exceeds 64 KiB'] stats])
    ?.  (safe-json body)
      (pure:m [[%| 'hacker news has invalid or excessive nesting'] stats])
    =/  parsed  (parse:lib %hn now body)
    ;<  ~  bind:m  (sleep:strandio pause)
    ;<  end=@da  bind:m  get-time:strandio
    ?:  ?=(%| -.parsed)  (pure:m [[%| p.parsed] stats])
    =.  raws  (scag max-items p.parsed)
    =.  parsed-ms  (millis start end)
    (classify j raws out stats(parse-ms parsed-ms) classified-ms)
  =/  c=cursor  [(trip body) ~ 0 %.n %.n %.n %.n 0]
  |-
  =/  [next=cursor item=(unit @t) error=(unit @t)]  (scan c)
  ;<  ~  bind:m  (sleep:strandio pause)
  ;<  end=@da  bind:m  get-time:strandio
  ?^  error  (pure:m [[%| u.error] stats(parse-ms (millis start end))])
  ?^  item
    ::  A hard bound on XML structure as well as byte length.
    ?:  (gth (lent (skim (trip u.item) |=(ch=@t =(ch '<')))) 256)
      (pure:m [[%| 'rss item has excessive markup'] stats])
    =/  parsed
      (parse:lib kind.source.j now (rap 3 ~['<rss><channel>' u.item '</channel></rss>']))
    ;<  ~  bind:m  (sleep:strandio pause)
    ;<  after=@da  bind:m  get-time:strandio
    ?:  ?=(%| -.parsed)  (pure:m [[%| p.parsed] stats])
    $(c next, raws (weld raws p.parsed))
  ?^  rest.next  $(c next)
  ?.  channel.next
    (pure:m [[%| 'rss has no channel'] stats])
  ?.  |(closed.next (gte count.next max-items))
    (pure:m [[%| 'rss channel is incomplete'] stats])
  (classify j raws out stats(parse-ms (millis start end)) classified-ms)
::  One topic per event, so classification never runs over a whole feed.
++  classify
  |=  [j=job:sur raws=(list raw:lib) out=(list topic:sur) stats=timing:sur elapsed=@ud]
  =/  m  (strand ,job-result:sur)
  ^-  form:m
  ?~  raws
    =/  result=job-result:sur
      [[%& (flop out)] stats(items (lent out), classify-ms elapsed)]
    (pure:m result)
  ;<  start=@da  bind:m  get-time:strandio
  =/  t  (stamp j i.raws)
  ;<  ~  bind:m  (sleep:strandio pause)
  ;<  end=@da  bind:m  get-time:strandio
  $(raws t.raws, out [t out], elapsed (add elapsed (millis start end)))
::
++  fetch
  |=  j=job:sur
  =/  m  (strand ,job-result:sur)
  ^-  form:m
  ;<  start=@da  bind:m  get-time:strandio
  =/  req=request:http  (request:lib source.j prefs.j)
  =/  hops=@ud  0
  |-
  ;<  sent=@da  bind:m  get-time:strandio
  =/  deadline  (add sent ~s20)
  ;<  ~  bind:m  (send-wait:strandio deadline)
  ;<  ~  bind:m
    (send-raw-card:strandio %pass /request %arvo %i %request req [0 0])
  ;<  reply=(each client-response:iris @t)  bind:m  (response deadline)
  ;<  ~  bind:m
    (send-raw-card:strandio %pass /wait/(scot %da deadline) %arvo %b %rest deadline)
  ;<  received=@da  bind:m  get-time:strandio
  =/  stats=timing:sur  [0 0 (millis start received) 0 0]
  ?:  ?=(%| -.reply)
    ;<  ~  bind:m  send-cancel-request:strandio
    (pure:m [[%| p.reply] stats])
  =/  res  p.reply
  ?.  ?=(%finished -.res)
    (pure:m [[%| 'request cancelled'] stats])
  =/  code  status-code.response-header.res
  ?:  (~(has in (silt ~[301 302 303 307 308])) code)
    =/  loc  (location headers.response-header.res)
    ?:  |(?=(~ loc) (gte hops 3))
      (pure:m [[%| 'redirect missing location or exceeds three hops'] stats])
    ?.  (web:lib u.loc)
      (pure:m [[%| 'redirect is not an HTTP URL'] stats])
    $(req req(url u.loc), hops +(hops))
  ?.  =(200 code)
    (pure:m [[%| (crip "http {<code>}")] stats])
  ?~  full-file.res
    (pure:m [[%| 'empty response body'] stats])
  ;<  result=job-result:sur  bind:m  (process j received q.data.u.full-file.res)
  =.  fetch-ms.timing.result  fetch-ms.stats
  ~&  [%topics-job-done id.j timing.result]
  (pure:m result)
::  Progress is observed so large downloads can be cancelled before parsing.
::  Deadline failures return as data: the caller explicitly cancels Iris and Behn.
++  response
  |=  deadline=@da
  =/  m  (strand ,(each client-response:iris @t))
  ^-  form:m
  |=  tin=strand-input:rand
  ?+  in.tin  `[%skip ~]
      ~  `[%wait ~]
    ::
      [~ %sign [%wait @ ~] %behn %wake *]
    ?.  =((scot %da deadline) i.t.wire.u.in.tin)  `[%skip ~]
    `[%done [%| 'request timed out after 20 seconds']]
    ::
      [~ %sign [%request ~] %iris %http-response *]
    =/  res=client-response:iris  client-response.sign-arvo.u.in.tin
    ?-  -.res
      %cancel  `[%done [%| 'request cancelled']]
      %finished  `[%done [%& res]]
      %progress
        ?:  |((gth bytes-read.res max-body) (gth (fall expected-size.res 0) max-body))
          `[%done [%| 'response exceeds 256 KiB']]
        `[%wait ~]
    ==
  ==
::
++  location
  |=  headers=header-list:http
  ^-  (unit @t)
  ?~  headers  ~
  ?:  =('location' (crip (cass (trip key.i.headers))))  `value.i.headers
  $(headers t.headers)
--
