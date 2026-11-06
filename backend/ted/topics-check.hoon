::  Repeatable worker integration scenario; no HTTP or agent state mutations.
::  Run -trill!topics-check. The report includes measured yields and item counts.
/-  spider, sur=topics
/+  worker=topics-job, ops=topics-agent, strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  now=@da  bind:m  get-time:strandio
=/  j=job:sur  [%fixture [%gnews 'WORLD' `%world %.y] default-prefs:ops]
=/  rss=@t
  '<rss><channel><item><title>Election - Example</title><source>Example</source><link>https://example.test/story</link></item></channel></rss>'
;<  good=job-result:sur  bind:m  (process:worker j now rss)
?>  ?=([%& ^] out.good)
?>  =('Election' title.i.p.out.good)
?>  =(%source classification.i.p.out.good)
?>  =(1 items.timing.good)
;<  empty=job-result:sur  bind:m
  (process:worker j now '<rss><channel></channel></rss>')
?>  =([%& ~] out.empty)
;<  incomplete=job-result:sur  bind:m
  (process:worker j now '<rss><channel>')
?>  ?=(%| -.out.incomplete)
;<  bad=job-result:sur  bind:m
  (process:worker j now '<rss><channel><item>unfinished')
?>  ?=(%| -.out.bad)
;<  phantom=job-result:sur  bind:m
  (process:worker j now '<rss><channel><!-- <item>phantom</item> --><![CDATA[<item>phantom</item>]]></channel></rss>')
?>  =([%& ~] out.phantom)
;<  large=job-result:sur  bind:m
  (process:worker j now (crip (reap 262.145 'x')))
?>  ?=(%| -.out.large)
;<  large-item=job-result:sur  bind:m
  (process:worker j now (rap 3 ~['<rss><channel><item><title>' (crip (reap 8.193 'x')) '</title></item></channel></rss>']))
?>  ?=(%| -.out.large-item)
::  Enough items to exercise scan continuations and the bounded selection.
=/  item=@t
  '<item><title>Election - Example</title><source>Example</source><link>https://example.test/story</link></item>'
;<  many=job-result:sur  bind:m
  (process:worker j now (rap 3 ~['<rss><channel><!--' (crip (reap 1.030 'x')) '-->' (rap 3 (reap 40 item)) '</channel></rss>']))
?>  ?=([%& ^] out.many)
?>  =(30 items.timing.many)
;<  hn=job-result:sur  bind:m
  (process:worker j(source [%hn '' ~ %.y]) now '{"hits":[{"title":"New software research","objectID":"42","url":"https://example.test/hn","points":12}]}')
?>  ?=([%& ^] out.hn)
?>  (~(has in categories.i.p.out.hn) %technology)
;<  nested=job-result:sur  bind:m
  (process:worker j(source [%hn '' ~ %.y]) now (rap 3 ~['{"hits":' (crip (reap 33 '[')) '0' (crip (reap 33 ']')) '}']))
?>  ?=(%| -.out.nested)
::  Drive the real Behn timeout branch without any external HTTP service.
;<  before=@da  bind:m  get-time:strandio
=/  deadline  (add before (div ~s1 100))
;<  ~  bind:m  (send-wait:strandio deadline)
;<  expired=(each client-response:iris @t)  bind:m  (response:worker deadline)
?>  ?=(%| -.expired)
?>  =('request timed out after 20 seconds' p.expired)
;<  end=@da  bind:m  get-time:strandio
?>  (gth end now)
(pure:m !>([%topics-worker-check %passed [%rss timing.good] [%many timing.many] [%hn timing.hn] [%elapsed-ms (millis:worker now end)]]))
