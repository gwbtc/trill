/-  feed=trill-feed, post=trill-post, sur=nostrill
/+  lib=nostrill, sr=sortug, constants
|%
++  latest-page
=/  count  feed-page-size:constants
|=  f=feed:feed  ^-  fc:feed
  =/  nodelist  (tap:orm:feed f)
  =/  subset  (scag count nodelist)
  ?~  subset  [f ~ ~]
  =/  start  `-.i.subset
  =/  rev  (flop subset)
  ?~  rev  [f ~ ~]
  =/  end  `-.i.rev
  =/  nf  (gas:orm:feed *feed:feed subset)
  [nf start end]
::
:: 
:: NOTE START IS OLD, END IS NEW

++  subset
=/  count  feed-page-size:constants
|=  [=fc:feed replies=? now=@da]  ^-  fc:feed
  ?:  ?&(?=(%~ start.fc) ?=(%~ end.fc))  (latest-page feed.fc)

  =/  start  ?~  start.fc  0    u.start.fc  
  =/  end    ?~  end.fc    now  u.end.fc
  =/  nodelist  (tap:orm:feed feed.fc)

  =/  threads  %+  skim  nodelist 
  |=  [=id:post =post:post]  ^-  ?
  ?.  replies
  ?&
    ?=  %~  parent.post
    (lte id start)  (gte id end)
  ==
  ?&  (lte id start)  (gte id end)  ==
  =/  thread-count  (lent threads)
  :: TODO I remember something was weird about this
  :: =/  result=(list [id:post post:post])  ?:  newest  (scag count threads)  (flop (scag count (flop threads)))
  =/  result=(list [id:post post:post])  (scag count threads)
  =/  cursors=[(unit @da) (unit @da)]  ?~  result  [~ ~]  ?~  threads  [~ ~]  :-
  ?:  .=((head result) (head threads))  ~  `id:(head result)
  ?:  .=((rear result) (rear threads))  ~  `id:(rear result)
  [(gas:orm:feed *feed:feed result) -.cursors +.cursors]
::  full nodes  (posts with children as a tree of posts)
++  node-to-full
|=  [p=post:post f=feed:feed]  ^-  full-node:post
  p(children (convert-children children.p f))
++  convert-children
|=  [children=(set id:post) f=feed:feed]
  ^-  internal-graph:post
  =/  g=full-graph:post  %-  ~(rep in children)
    |=  [=id:post acc=full-graph:post]
    =/  n  (get:orm:feed f id)
    ?~  n  acc
    =/  full-node  (node-to-full u.n f)
    (put:form:post acc id full-node)
  ?~  children  [%empty ~]
  :-  %full  g

++  print-full-node
  =|  nested=@
  =|  child-count=@
  |=  n=full-node:post  ^-  @  ::  the total descendant count
  :: ~&  nested=nested
  :: ~&  count=total-child-count
  =/  ignore
    ?~  parent.n
    ~&  >  op=id.n  ~
    =/  indentape  "{(scow %da id.n)}"
    =/  indent  |-  ?:  .=(nested 0)  indentape
                  $(nested (dec nested), indentape ['-' indentape])
    ~&  >>  indent  ~
  =/  child-list=(list [* full-node:post])
    ?:  ?=(%empty -.children.n)
    :: ~&  "/>"
    ~
    (tap:form:post p.children.n)
    =.  nested  +(nested) 
    =|  subcount=@
  %+  add  child-count
    |-  ?~  child-list  subcount
     =/  child=full-node:post  +.i.child-list
     :: ~&  child=[id=id.child par=parent.child ted=thread.child]
     =/  callback  print-full-node
     =.  subcount  %-  callback(nested nested)  child
      $(child-list t.child-list)
::
++  extract-thread
  =|  l=(list full-node:post)
  |=  n=full-node:post  ^-  (list full-node:post)
  =.  l  [n l]
  ?:  ?=(%empty -.children.n)  (flop l)
  =/  child-list=(list [@ full-node:post])  %-  flop  (tap:form:post p.children.n)  ::  we want the oldest post, not newest
  |-  ?~  child-list  (flop l)
      =/  child=full-node:post  +.i.child-list
      =/  parent-id  (need parent.child)
      ?:  ?&  .=(author.n author.child)  .=(id.n parent-id)  ==
      ^$(n child)
      ::
      $(child-list t.child-list)
    
::
++  add-new-feed
|=  [global=global-feed:sur new=feed:feed]  ^-  global-feed:sur
  =/  poasts  (tap:orm:feed new)
  |-  ?~  poasts  global
    =/  poast  +.i.poasts
    =.  global  (insert-to-global global poast)
    $(poasts t.poasts)

++  consolidate-feeds
|=  feeds=(list [* feed:feed])  ^-  global-feed:sur
  =|  gf=global-feed:sur
  |-  ?~  feeds  gf
    =/  poasts  (tap:orm:feed +.i.feeds)
    =.  gf  |-  ?~  poasts  gf
      =/  poast  +.i.poasts
      =.  gf  (insert-to-global gf poast)
      $(poasts t.poasts)
    $(feeds t.feeds)

++  delete-with-children
  |=  [f=feed:feed p=post:post]  ^-  feed:feed
  =.  f  =<  +  (del:orm:feed f id.p)
  =.  f  (update-parent-on-delete f p)
  (delete-children f p)

++  update-parent-on-delete
  |=  [f=feed:feed p=post:post]  ^-  feed:feed
  ?~  parent.p  f
  =/  parent  (get:orm:feed f u.parent.p)
  ?~  parent  ~&  "parent not found"  f
  =/  nc  (~(del in children.u.parent) id.p)
  =/  np  u.parent(children nc)
  (put:orm:feed f id.u.parent np)

++  delete-children
  |=  [f=feed:feed p=post:post]  ^-  feed:feed
  ?~   ~(tap in children.p)  f
  =/  children  ~(tap in children.p)
  |-  ^-  feed:feed
  ?~  children  f
  ?~  child=(get:orm:feed f i.children)
    $(children t.children)
  =/  nf  =<  +  (del:orm:feed f id.u.child)
  $(children t.children, f nf)
::
++  delete-nested-children
  |=  [f=feed:feed p=post:post]  ^-  feed:feed
  ?~   ~(tap in children.p)  f
  =/  children=(list id:post)  ~(tap in children.p)
  |-  ^-  feed:feed
  ?~  children  f
  ?~  child=(get:orm:feed f i.children)
    $(children t.children)
  =/  nf  =<  +  (del:orm:feed f id.u.child)
  =/  grandc=(list id:post)
    ~(tap in `(set id:post)`children.u.child)
  ?~  grandc
    $(children t.children, f nf)
  $(children (welp (tail children) grandc), f nf)
::   global
++  insert-to-global
  |=  [gf=global-feed:sur p=post:post]  ^-  global-feed:sur
  =/  host  (atom-to-user:lib host.p)
  =/  =upid:sur  [host id.p]
  (put:uorm:sur gf upid p)

++  delete-from-global
|=  [gf=global-feed:sur p=post:post]  ^-  global-feed:sur
  (delete-with-children-g gf p)

++  delete-with-children-g
  |=  [gf=global-feed:sur p=post:post]  ^-  global-feed:sur
  =/  host  (atom-to-user:lib host.p)
  =/  =upid:sur  [host id.p]
  =.  gf  =<  +  (del:uorm:sur gf upid)
  =.  gf  (update-parent-on-delete-g gf p)
  (delete-children-g gf p)

++  update-parent-on-delete-g
  |=  [gf=global-feed:sur p=post:post]  ^-  global-feed:sur
  ?~  parent.p  gf
  =/  host  (atom-to-user:lib host.p)
  =/  par-id=upid:sur  [host u.parent.p]
  =/  parent  (get:uorm:sur gf par-id)
  ?~  parent  ~&  "parent not found"  gf
  =/  nc  (~(del in children.u.parent) id.p)
  =/  np  u.parent(children nc)
  (put:uorm:sur gf [host id.u.parent] np)

++  delete-children-g
  |=  [gf=global-feed:sur p=post:post]  ^-  global-feed:sur
  =/  host  (atom-to-user:lib host.p)

  ?~   ~(tap in children.p)  gf
  =/  children  ~(tap in children.p)
  |-  ^-  global-feed:sur
  ?~  children  gf
  =/  cid=upid:sur  [host i.children]
  ?~  child=(get:uorm:sur gf cid)
    $(children t.children)
  =/  nf  =<  +  (del:uorm:sur gf cid)
  $(children t.children, gf nf)


--
