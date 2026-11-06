/-  spider, sur=topics
/+  job=topics-job
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  bare=vase  ?.(?=([~ *] q.arg) arg (slot 3 arg))
=/  input=job:sur  !<(job:sur bare)
;<  result=job-result:sur  bind:m  (fetch:job input)
(pure:m !>(result))
