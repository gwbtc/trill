::  Painstakingly built utility functions by Sortug Development Ltd.
::  There's more where it came from
|%
++  jikan
|%
++  from-unix  |=  ts=@  ^-  @da
  (from-unix:chrono:userlib ts)
++  to-unix-ms  |=  da=@da  ^-  @ud
  (unm:chrono:userlib da)
++  to-unix-secs  |=  da=@da  ^-  @ud
  (unt:chrono:userlib da)
++  add-to-date  |=  [base=date diff=date]  ^-  date
  =/  t=tarp        (add-to-tarp t.base t.diff)
  =/  month-sum     (add m.base m.diff)
  =/  month-years   (div month-sum 12)
  =/  months-mod    (mod month-sum 12)
  =.  y.diff        (add y.diff month-years)
  =/  months        ?:  .=(months-mod 0)  m.base  months-mod
  =/  baseyear      (new:si -.base)
  =/  diffyear      (new:si -.diff)
  =/  yearsi        (sum:si baseyear diffyear)
  =/  year          (old:si yearsi)  
  =/  d=date  [year months t]  
   d
++  add-to-tarp  |=  [base=tarp diff=tarp]  ^-  tarp
  =/  days     (add d.base d.diff)
  =/  hours    (add h.base h.diff)
  =/  minutes  (add m.base m.diff)
  =/  seconds  (add s.base s.diff)
  =/  ms       (add-ms base diff)
  =/  t=tarp  [days hours minutes seconds ~]
  =/  t2  %-  yell  %+  add  (yule t)  ms
  t2
++  add-ms  |=  [a=tarp b=tarp]  ^-  @d
  =/  t1  a(d 0, h 0, m 0, s 0)
  =/  t2  b(d 0, h 0, m 0, s 0)
  =/  sum  %+  add  (yule t1)  (yule t2)
  sum
--
++  b64  (bass 64 (plus siw:ab))
++  b16  (bass 16 (plus six:ab))
++  scot
=|  min-chars=@ud
|=  [mod=@tas a=@]  ^-  @t
  %-  crip  (scow mod a)
++  scow
=|  min-chars=@ud
|=  [mod=@tas a=@]  ^-  tape
  ?+  mod  ""
  %s   (signed-scow a)
  %ud  (a-co:co a)
  %ux  ((x-co:co min-chars) a)
  %uv  ((v-co:co min-chars) a)
  %uw  ((w-co:co min-chars) a)
  ==
++  signed-scow  |=  a=@s  ^-  tape
  =/  old  (old:si a)
  =/  num  (scow %ud +.old)
  =/  sign=tape  ?:  -.old  ""  "-"
  "{sign}{num}"
++  slaw
  |=  [mod=@tas txt=@t]  ^-  (unit @)
  ?+  mod  ~
  %ud  (rush txt dem)
  %ux  (rush txt b16)
  %uv  (rush txt vum:ag)
  %uw  (rush txt b64)
  ==
::  secs
++  timestamp  |=  s=@t  ^-  (unit @da)
  =/  un  (slaw %ud s)  ?~  un  ~
  =/  secs  (from-unix:jikan u.un)
  (some secs)


++  csplit  |*  =rule  
  (more rule (cook crip (star ;~(less rule next))))
:: List utils
++  foldi
  |*  [a=(list) b=* c=_|=(^ +<+)]
  =|  i=@ud
  |-  ^+  b 
  ?~  a  b
  =/  nb  (c i i.a b)
  $(a t.a, b nb, i +(i))
++  parsing
  |%
  ++  as-soft  |*  wit=fist:dejs-soft:format  ^-  fist:dejs-soft:format
    |=  jon=json
    =/  res  %-  (ar:dejs-soft:format wit)  jon
    ?~  res  ~  `(silt u.res)
  ++  link  auri:de-purl:html
  ++  para
    |%
    ++  eof        ;~(less next (easy ~))
    ++  white      (mask "\09 ")
    ++  blank      ;~(plug (star white) (just '\0a'))
    ++  hard-wrap  (cold ' ' ;~(plug blank (star white)))
    ++  one-space  (cold ' ' (plus white))
    ++  empty
      ;~  pose
        ;~(plug blank (plus blank))
        ;~(plug (star white) eof)
        ;~(plug blank (star white) eof)
      ==
    ++  para
      %+  ifix
        [(star white) empty]
      %-  plus
      ;~  less
        empty
        next
      ==
    --
  ++  trim  para:para  ::  from whom/lib/docu

  ++  url
  |=  txt=@t
    =/  parsed=(unit purl:eyre)  (de-purl:html txt)
    :: =/  parsed  (rush txt link)
    ?~  parsed  ~
    =/  prl  u.parsed
    =/  https  p.p.prl
    =/  port  q.p.prl
    =/  is-ip  !-.r.p.prl
    =/  domain  p.r.p.prl
    =/  path  q.q.prl
    =/  ext  p.q.prl
    parsed


  ++  youtube
    ;~  pfix
      ;~  plug
          (jest 'https://')
          ;~  pose
              (jest 'www.youtube.com/watch?v=')
              (jest 'youtube.com/watch?v=')
              (jest 'youtu.be/')
          ==
      ==
      ;~  sfix
          (star aln)
          (star next)
      ==
    ==
  ++  twatter
    ;~  pfix
      ;~  plug
          (jest 'https://')
          ;~  pose
              (jest 'x.com/')
              (jest 'twitter.com/')
          ==
          (star ;~(less fas next))
          (jest '/status/')
      ==
      ;~  sfix
          (star nud)
          (star next)
      ==
    ==
  ++  img-set
    %-  silt
    :~  ~.webp
        ~.png
        ~.jpeg
        ~.jpg
        ~.svg
    ==
  ++  is-img
  |=  t=@ta
    (~(has in img-set) t)
  ++  is-image
  |=  url=@t  ^-  ?
    =/  u  (^url url)
      ?~  u  .n
    =/  ext  p.q.u.u
    ?~  ext  .n
    (~(has in img-set) u.ext)
  --
++  string
|%
++  replace
  |=  [bit=tape bot=tape =tape]
  ^-  ^tape
  |-
  =/  off  (find bit tape)
  ?~  off  tape
  =/  clr  (oust [(need off) (lent bit)] tape)
  $(tape :(weld (scag (need off) clr) bot (slag (need off) clr)))
  ::
++  split
  |=  [str=tape delim=tape]
    ^-  (list tape)
    (split-rule str (jest (crip delim)))
  ++  split-rule
    |*  [str=tape delim=rule]
    ^-  (list tape)
    %+  fall
      (rust str (more delim (star ;~(less delim next))))
    [str ~]
--
--
