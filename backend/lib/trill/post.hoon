/-  tp=trill-post, md=markdown
/+  sr=sortug, mdlib=markdown
|%

++  get-ref
  |=  p=post:tp
  ^-  (unit [ship @da])
  =/  refs=(list block:tp)
    %-  zing
    %+  turn  (tap:corm:tp contents.p)
    |=  [t=time cl=content-list:tp]
    %+  skim  cl
    |=(b=block:tp =(%ref -.b)) 
  ?~  refs  ~
  =/  ref  (head refs)
  ?.  ?=([%ref @ ship=@ path=*] ref)  ~
  ?~  ref-id=(slaw:sr %ud (head path.ref))  ~
  `[ship.ref u.ref-id]

++  build-sp
  |=  [host=@p author=@p input=@t parent=(unit @) thread=(unit @)]
  ^-  sent-post:tp
  =/  cl  (tokenise input)
  ~|  "parsing error!!"
  ?:  ?=(%| -.cl)  !!
  =|  sp=sent-post:tp
  %=  sp
    host      host
    author    author
    contents  +.cl
    parent    parent
    thread    thread
  ==
++  build-post
  |=  [now=@da pubkey=@ux sp=sent-post:tp]
  ^-  post:tp
  =/  cm  (init-content-map contents.sp now)
  =/  thread  ?~  thread.sp  now  u.thread.sp
  =/  =post:tp
    :*  id=now
        host.sp
        author.sp
        thread
        parent.sp
        ~
        cm
        perms.sp
        *engagement:tp
        `@uvH`pubkey
        *signature:tp
        ~
    ==
  post
:: new! using wispem's lib
++  tokenise
|=  t=@t  ^-  (each content-list:tp @t)
  =/  parsed  (rush t markdown:de:mdlib)
  ?~  parsed  [%| 'parsing error']
  :-  %&
  %+  turn  u.parsed  de-node  
++  de-node  |=  =node:markdown:md  ^-  block:tp
  ?~  node  [%paragraph ~]
  ?-  -.node
    %leaf       (de-leaf +.node)
    %container  (de-cont +.node)
  ==

++  de-leaf  |=  =node:leaf:markdown:md  ^-  block:tp
  ?~  node  [%paragraph ~]
  ?-  -.node
    %heading              (de-heading node)
    %break                [%paragraph :~([%break ~])]
    %indent-codeblock     [%codeblock text.node '']
    %fenced-codeblock     [%codeblock text.node info-string.node]
    :: %html                 [%codeblock text.node 'html']
    %link-ref-definition  [%paragraph :~([%link '' label.node])]
    %paragraph            [%paragraph (de-inline contents.node)]
    %blank-line           [%paragraph :~([%break ~])]
    %table                [%paragraph :~([%break ~])]  :: TODO
  ==
++  de-heading  |=  h=heading:leaf:markdown:md
  :+  %heading  (flatten-inline contents.h)
  ?:  .=(1 level.h)  %h1
  ?:  .=(2 level.h)  %h2
  ?:  .=(3 level.h)  %h3
  ?:  .=(4 level.h)  %h4
  ?:  .=(5 level.h)  %h5  %h6
++  de-inline  |=  inls=contents:inline:md
  =|  res=(list inline:tp)
  |-  ?~  inls  (flop res)
    =/  inl  i.inls
    =/  r=inline:tp  ?-  -.inl
      %escape           [%codespan char.inl]
      %entity           [%codespan code.inl]
      %code-span        [%codespan text.inl]
      %line-break       [%break ~]
      %soft-line-break  [%break ~]
      %text             (de-inline-text text.inl)
      %emphasis         (de-strong +.inl)
      %strong           (de-strong +.inl)
      %strikethru       [%strike (flatten-inline contents.inl)]
      %link             [%link (de-target target.inl) (flatten-inline contents.inl)]
      %image            [%link (de-target target.inl) (de-target target.inl)]
      :: TODO
      :: %image            [%img (de-target target.inl) alt-text.inl]
      %autolink         [%text '']
      :: %html             [%codespan text.inl]
    ==
    $(inls t.inls, res [r res])
++  de-inline-text  |=  txt=@t
  =/  murl  (url:parsing:sr txt)
  ?~  murl  [%text txt]
  :: =/  mext  p.q.u.murl
  :: ?~  mext  [%link txt txt]
  :: ?.  (is-img:sr u.mext)
      [%link txt txt]
  ::     [%img txt txt]

++  de-strong  |=  [char=@t inls=contents:inline:md]
?:  .=('_' char)  [%italic (flatten-inline inls)]
                  [%bold (flatten-inline inls)]
++  de-target  |=  tar=target:ln:md
:: TODO lotsa stuff here
  ?-  -.tar
    %direct  text.url.urlt.tar
    %ref     label.tar
  ==
++  flatten-inline  |=  inls=contents:inline:md  ^-  @t
  =/  res  ""
  |-  ?~  inls  (crip res)
    =/  inl  i.inls
    =/  r  ?+  -.inl  ""
      %escape           (trip char.inl)
      %entity           (trip code.inl)
      %code-span        (trip text.inl)
      %text             (trip text.inl)
      %emphasis         (trip (flatten-inline contents.inl))
      %strong           (trip (flatten-inline contents.inl))
      %link             (trip (flatten-inline contents.inl))
      %image            (trip (de-target target.inl))
      :: %html             (trip text.inl)
    ==
    $(inls t.inls, res "{res} {r}")
++  de-cont  |=  =node:container:markdown:md  ^-  block:tp
  ?~  node  [%paragraph ~]
  ?-  -.node
    %block-quote  [%blockquote (denest +.node)]
    %ol           [%list (de-list contents.node) .y]
    %ul           [%list (de-list contents.node) .n]
    %tl  [%paragraph ~]
  ==
++  de-list  |=  lmd=(list markdown:md)  ^-  (list inline:tp)
:: TODO
~
  :: =|  res=(list li:tp)
  :: |-  ?~  lmd  (flop res)
  ::   =/  nodelist  i.lmd
  ::   =/  blocks=(list block:tp)
  ::     %+  turn  nodelist  de-node
  ::   $(lmd t.lmd, res [blocks res])
    
++  denest  |=  mde=markdown:md  ^-  paragraph:tp
  =|  res=paragraph:tp
  |-  ?~  mde  (flop res)
    =/  block  (de-node i.mde)
    =/  r=paragraph:tp  (break-block block)
    =/  nr  (weld res r)
    $(mde t.mde, res nr)

++  break-block  |=  =block:tp  ^-  paragraph:tp
?+  -.block  ~
  %paragraph   p.block
  %blockquote  p.block
  %heading     :~([%text p.block])
  %codeblock   :~([%text code.block])
  %eval        :~([%text hoon.block])
  :: %list        (break-list p.block)
==
:: post:trill -> (markdown) tape for display
++  block-to-md
|=  b=block:tp  ^-  tape
  ?+  -.b  ""
%paragraph    
  %^  foldi:sr  p.b  ""  |=  [in=@ud i=inline:tp acc=tape]
    =/  il  (inline-to-tape i)  
    ?:  .=(+(in) (lent p.b))
    "{acc}{il}"
    "{acc}{il} "
%blockquote   
  %+  weld  "> "
  %^  foldi:sr  p.b  ""  |=  [in=@ud i=inline:tp acc=tape]
  =/  il  (inline-to-tape i)  
  ?:  .=(+(in) (lent p.b))
  "{acc}{il}"
  "{acc}{il} "
%list  
  %^  foldi:sr  p.b  ""  |=  [in=@ud i=inline:tp acc=tape]
  =/  li-tape  (inline-to-tape i)
  =/  line  ?:  ordered.b  
  "{<+(in)>}. {li-tape}"
  "- {li-tape}"
  ?:  .=(+(in) (lent p.b))
  "{acc}{line}"
  "{acc}{line}\0a"
%media  
  ?+  -.media.b  "![{(trip p.media.b)}]({(trip p.media.b)})"
  :: TODO
%images
  :: %^  foldi:sr  p.media.b  ""  |=  [i=@ud [url=@t caption=@t] acc=tape]
  :: =/  line  "![{(trip caption)}]({(trip url)})"
  :: ?:  .=(+(i) (lent p.media.b))
  :: "{acc}{line}"
  :: "{acc}{line}\0a"
  ""
  ==
%codeblock
  """
  ```
  {(trip code.b)}
  ```
  """
%heading  =/  dashes=tape  ?-  q.b
  %h1  "# "
  %h2  "## "
  %h3  "### "
  %h4  "#### "
  %h5  "##### "
  %h6  "###### "
  ==  "{dashes}{(trip p.b)}"
:: %tasklist  ""  ::TODO
  ::
  :: %table  acc
  :: %eval  acc
  :: %ref   acc
  :: %json  acc
  ==  
++  content-map-to-md  |=  cm=content-map:tp  ^-  tape
  =/  latest  (latest-post-content cm)
  (content-list-to-md latest)

++  latest-post-content
|=  cm=content-map:tp  ^-  content-list:tp
  =/  last  (pry:corm:tp cm)
  ?~  last  ~
  +.u.last

++  content-list-to-md
|=  =content-list:tp  ^-  tape
  %^  foldi:sr  content-list  ""  |=  [i=@ud b=block:tp acc=tape]
  =/  block-tape  (block-to-md b)
  ?:  .=(+(i) (lent content-list))
  "{acc}{block-tape}"
  "{acc}{block-tape}\0a\0a"
++  inline-to-tape
|=  i=inline:tp  ^-  tape
  ?+  -.i  ""
  %text  (trip p.i)
  %italic  "_{(trip p.i)}_"
  %bold    "*{(trip p.i)}*" 
  %strike   "~~{(trip p.i)}~~"
  %ship     (scow %p p.i)
  %codespan   "`{(trip p.i)}`"  
  %link   "[{(trip show.i)}]({(trip href.i)})"
  :: %img    "![{(trip alt.i)}]({(trip src.i)})"
  %break  "\0a"
  ==
++  init-content-map  |=  [cl=content-list:tp date=@da]  ^-  content-map:tp
  (put:corm:tp *content-map:tp date cl)

::  +extract-mentions: every valid ~ship named in the RAW post
::    text, minus the ignore set. this must run on the unparsed
::    input: the markdown tokeniser consumes sigs as strikethrough
::    delimiters, so patps are unrecoverable after parsing
::
++  extract-mentions
|=  [raw=@t ignore=(set @p)]  ^-  (list @p)
  ~(tap in (~(dif in (scan-text-mentions raw)) ignore))
::  +scan-text-mentions: every valid ~ship name appearing in a cord
::
++  scan-text-mentions
|=  txt=@t  ^-  (set @p)
  =|  ships=(set @p)
  =/  t  (trip txt)
  |-  ^-  (set @p)
  ?~  t  ships
  ?.  =('~' i.t)  $(t t.t)
  ::  take the [a-z-] run after the sig and try it as a @p
  =/  run
    =|  acc=(list @t)
    =/  rest  t.t
    |-  ^-  [(list @t) (list @t)]
    ?~  rest  [(flop acc) ~]
    ?.  ?|(&((gte i.rest 'a') (lte i.rest 'z')) =(i.rest '-'))
      [(flop acc) rest]
    $(rest t.rest, acc [i.rest acc])
  ?~  -.run  $(t +.run)
  =/  mship  (slaw %p (crip ['~' -.run]))
  ?~  mship  $(t +.run)
  $(t +.run, ships (~(put in ships) u.mship))
--



