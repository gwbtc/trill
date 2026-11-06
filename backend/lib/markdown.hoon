/-  m=markdown
::

=>  |%
    :: Normalize reference labels for case-insensitive matching, trimming
    :: leading/trailing whitespace and collapsing internal whitespace.
    ++  normalize-reference-label
      |=  label=@t
      =/  chars  (cass (trip label))
      =|  acc=tape
      =|  pending-space=?
      |-
      ?~  chars  (crip (flop acc))
      ?:  ?|  =(i.chars ' ')
              =(i.chars '\09')
              =(i.chars '\0a')
              =(i.chars '\0d')
          ==
        $(chars t.chars, pending-space %.y)
      =.  acc
        ?:  ?&  pending-space
                ?=(^ acc)
            ==
          [' ' acc]
        acc
      $(chars t.chars, acc [i.chars acc], pending-space %.n)
    :: Reconstruct the source-like label of a collapsed or shortcut link.
    :: Formatting delimiters are significant parts of reference labels.
    ++  reference-label
      =<  contents
      |%
      ++  escape-chars
        |=  [text=@t chars=(list @t)]
        ^-  tape
        %+  rash  text
        %+  cook
          |=(a=(list tape) `tape`(zing a))
        %-  star
        ;~  pose
          (cook |=(a=@t `tape`~['\\' a]) (mask chars))
          (cook trip prn)
        ==
      ::
      ++  url
        |=  u=url:ln:m
        ^-  tape
        ?:  has-triangle-brackets.u
          ;:(weld "<" (escape-chars text.u "<>") ">")
        (escape-chars text.u "()")
      ::
      ++  urlt
        |=  u=urlt:ln:m
        ^-  tape
        ?~  title-text.u  (url url.u)
        ;:(weld (url url.u) " \"" (escape-chars u.title-text.u "\"") "\"")
      ::
      ++  target
        |=  t=target:ln:m
        ^-  tape
        ?-    -.t
            %direct  ;:(weld "(" (urlt urlt.t) ")")
            %ref
          ?-  type.t
            %full       ;:(weld "[" (escape-chars label.t "[]") "]")
            %collapsed  "[]"
            %shortcut   ""
          ==
        ==
      ::
      ++  contents
        |=  contents=contents:inline:m
        ^-  tape
        (zing (turn contents element))
      ::
      ++  element
        |=  el=element:inline:m
        ^-  tape
        ?-    -.el
            %text             (trip text.el)
            %escape           (trip char.el)
            %entity           ;:(weld "&" (trip code.el) ";")
            %soft-line-break  "\0a"
            %line-break       "\\\0a"
            %autolink         ;:(weld "<" (trip text.target.el) ">")
            %task-checkbox    ;:(weld "[" ?:(is-checked.el "x" " ") "] ")
            %html             (trip text.el)
            %code-span
          ;:  weld
            (reap num-backticks.el '`')
            (trip text.el)
            (reap num-backticks.el '`')
          ==
        ::
            %strong
          ;:  weld
            (reap 2 emphasis-char.el)
            (contents contents.el)
            (reap 2 emphasis-char.el)
          ==
        ::
            %emphasis
          ;:  weld
            (trip emphasis-char.el)
            (contents contents.el)
            (trip emphasis-char.el)
          ==
        ::
            %strikethru
          ;:  weld
            (reap sig-count.el '~')
            (contents contents.el)
            (reap sig-count.el '~')
          ==
        ::
            %link
          ;:(weld "[" (contents contents.el) "]" (target target.el))
        ::
            %image
          ;:(weld "![" (contents contents.el) "]" (target target.el))
        ==
      --
    :: Extract the unformatted string content of inline elements.
    ++  plain-inline-text
      =<  contents
      |%
      ++  contents
        |=  contents=contents:inline:m
        ^-  tape
        (zing (turn contents element))
      ++  element
        |=  el=element:inline:m
        ^-  tape
        ?-    -.el
            %text             (trip text.el)
            %escape           (trip char.el)
            %entity           ;:(weld "&" (trip code.el) ";")
            %code-span        (trip text.el)
            %soft-line-break  "\0a"
            %line-break       "\0a"
            %autolink         (trip text.target.el)
            %task-checkbox    ""
            %html             ""
            %strong           (contents contents.el)
            %emphasis         (contents contents.el)
            %strikethru       (contents contents.el)
            %link             (contents contents.el)
            %image            (contents contents.el)
        ==
      --
    :: Set label for collapsed / shortcut reference links
    ++  backfill-ref-link
      |=  [a=link:inline:m]
      ^-  link:inline:m
      =/  t  target.a
      ?.  ?=(%ref -.t)     a        :: only reference links
      ?:  =(%full type.t)  a        :: only collapsed / shortcut links
      %_  a
        target  %_(t label (crip (reference-label contents.a)))
      ==
    :: Set label for collapsed / shortcut reference images
    ++  backfill-ref-image
      |=  [a=image:inline:m]
      ^-  image:inline:m
      =/  t  target.a
      ?.  ?=(%ref -.t)     a
      ?:  =(%full type.t)  a
      %_  a
        target  %_(t label (crip (reference-label contents.a)))
      ==
    ::
    ++  whitespace  (mask " \09\0d\0a")                  ::  whitespace: space, tab, or newline
    ::
    ++  all-link-ref-definitions                         :: Recursively get link ref definitions
      =<  process-nodes
      |%
      ++  process-nodes
        |=  [nodes=markdown:m]
        ^-  (map @t urlt:ln:m)
        %+  roll  nodes
        |=  [=node:markdown:m out=(map @t urlt:ln:m)]
        (~(uni by (process-node node)) out)
      ::
      ++  process-nodeses
        |=  [nodeses=(list markdown:m)]
        ^-  (map @t urlt:ln:m)
        %+  roll  nodeses
        |=  [=markdown:m out=(map @t urlt:ln:m)]
        (~(uni by (process-nodes markdown)) out)
      ::
      ++  process-node
        |=  [node=node:markdown:m]
        ^-  (map @t urlt:ln:m)
        ?-    -.node
            %leaf                         :: Leaf node: check if it's a link ref def
          =/  leaf=node:leaf:m  +.node
          ?.  ?=(%link-ref-definition -.leaf)  ~
          %+  ~(put by *(map @t urlt:ln:m))
            (normalize-reference-label label.leaf)
          urlt.leaf
        ::
            %container
          =/  container=node:container:m  +.node
          ?-    -.container
              %block-quote  (process-nodes markdown.container)
              %ol           (process-nodeses contents.container)
              %ul           (process-nodeses contents.container)
              %tl
            %-  process-nodeses
            (turn contents.container |=([is-checked=? =markdown:m] markdown))
          ==
        ==
      --
    ::
    ::  Get a preview-image for a document
    ++  get-preview-img
      =<  |=  [doc=markdown:m]
          ^-  (unit @t)
          =/  ref-links  (all-link-ref-definitions doc)
          (~(process-nodes . ref-links) doc)
      ::
      |_  [reference-links=(map @t urlt:ln:m)]
      ++  get-direct-link      :: DUPE: get-direct-link
        |=  [=target:ln:m]
        ^-  (unit urlt:ln:m)
        ?-    -.target
            %direct  `urlt.target
            %ref
          %-  ~(get by reference-links)
          (normalize-reference-label label.target)
        ==
      ++  process-nodes
        |=  [nodes=markdown:m]
        ^-  (unit @t)
        ?~  nodes  ~
        ?^  a=(process-node i.nodes)  a
        $(nodes t.nodes)
      ::
      ++  process-nodeses
        |=  [nodeses=(list markdown:m)]
        ^-  (unit @t)
        ?~  nodeses  ~
        ?^  a=(process-nodes i.nodeses)  a
        $(nodeses t.nodeses)
      ::
      ++  process-contents
        |=  [=contents:inline:m]
        ^-  (unit @t)
        ?~  contents  ~
        ?^  a=(process-inline i.contents)  a
        $(contents t.contents)
      ::
      ++  process-inline
        |=  [el=element:inline:m]
        ^-  (unit @t)
        ?+  -.el  ~
            %emphasis    (process-contents contents.el)
            %strong      (process-contents contents.el)
            %strikethru  (process-contents contents.el)
            %link        (process-contents contents.el)
            %image
          =/  resolved=(unit urlt:ln:m)  (get-direct-link target.el)
          ?~(resolved ~ [~ text.url.u.resolved])
        ==
      ::
      ++  process-node
        |=  [node=node:markdown:m]
        ^-  (unit @t)
        ?-    -.node
            %leaf           :: Leaf node: check if it's a link ref def
          =/  leaf=node:leaf:m  +.node
          ?+  -.leaf  ~
            %heading  (process-contents contents.leaf)
            %paragraph  (process-contents contents.leaf)
          ==
        ::
            %container
          =/  container=node:container:m  +.node
          ?-    -.container
              %block-quote  (process-nodes markdown.container)
              %ol           (process-nodeses contents.container)
              %ul           (process-nodeses contents.container)
              %tl
            %-  process-nodeses
            (turn contents.container |=([is-checked=? =markdown:m] markdown))
          ==
        ==
      --
    ++  get-headers
      =<  process-doc
      |%
      ++  process-doc
        |=  [doc=markdown:m]
        ^-  (list [lvl=@ txt=tape])
        %+  turn
          (skim doc |=(a=node:markdown:m ?=([%leaf %heading *] a)))
          |=  [h=node:markdown:m]
          ?>  ?=([%leaf %heading *] h)
          ^-  [lvl=@ txt=tape]
          [level.h (process-contents contents.h)]
      ++  process-contents
        |=  [=contents:inline:m]
        ^-  tape
        ?~  contents  ~
        %+  welp  (process-inline (head contents))
        $(contents +.contents)
      ++  process-inline
        |=  [el=element:inline:m]
        ^-  tape
        ?+  -.el  ~
          %text  (trip text.el)
          %code-span  (trip text.el)
          %autolink  (trip text.target.el)
          %escape  (trip char.el)
          %entity  `tape`~[code.el]  :: cheat
          %emphasis  (process-contents contents.el)
          %strong  (process-contents contents.el)
          %strikethru  (process-contents contents.el)
          %link  (process-contents contents.el)
          %image  (plain-inline-text contents.el)
        ==
      --
    --
::
::  Parse to and from Markdown text format
|%
++  de                                               ::  de:md  Deserialize (parse)
  =<
      |=  [t=@t]
      ^-  (unit markdown:m)
      (rush t markdown)
  |%
  ++  escaped
    |=  [char=@t]
    (cold char (jest (crip (snoc "\\" char))))
  ::
  ++  newline
    %+  cold  '\0a'                                :: EOL, with or without carriage return '\0d'
    ;~(pfix ;~(pose (just '\0d') (easy ~)) (just '\0a'))
  ++  line-end                                     :: Either EOL or EOF
    %+  cold  '\0a'
    ;~(pose newline (full (easy ~)))
  ::
  ++  capture
    |*  parser=rule
    |=  tub=nail
    ^-  (like tape)
    =/  vex  (parser tub)
    ?~  q.vex  vex
    =/  remaining  q.u.q.vex
    =/  consumed  (sub (lent q.tub) (lent q.remaining))
    [p=p.vex q=[~ u=[p=(scag consumed q.tub) q=remaining]]]
  ::
  ++  ln                                           ::  Links and urls
    |%
    ++  url
      =<  %+  cook  |=(a=url:ln:m a)                 :: Cast
          ;~(pose with-triangles without-triangles)
      |%
      ++  with-triangles
        ;~  plug
          %+  cook  crip
            %+  ifix  [gal gar]
            %-  star
            ;~  pose
              (escaped '<')
              (escaped '>')
              ;~(less gal gar line-end prn)    :: Anything except '<', '>' or newline
            ==
          (easy %.y)                               :: "yes triangles"
        ==
      ++  without-triangles
        |^
        ;~  plug
          %+  cook  |=(parts=(list tape) (crip `tape`(zing parts)))
            ;~  less
                gal                                :: Doesn't start with '<'
                %-  plus                           :: Non-empty
                  ;~  less
                      whitespace                   :: No whitespace allowed
                      ;~  pose
                        (cook trip (escaped '('))
                        (cook trip (escaped ')'))
                        parens-3
                        (cook trip ;~(less pal par line-end prn))
                      ==
                  ==
            ==
          (easy %.n)                               :: "no triangles"
        ==
        :: Preserve up to three nested levels of unescaped parentheses.
        ++  parens-1
          %+  cook
            |=  parts=(list tape)
            ;:(weld "(" `tape`(zing parts) ")")
          %+  ifix  [pal par]
          %-  star
          ;~  pose
            (cook trip (escaped '('))
            (cook trip (escaped ')'))
            (cook trip ;~(less whitespace pal par line-end prn))
          ==
        ++  parens-2
          %+  cook
            |=  parts=(list tape)
            ;:(weld "(" `tape`(zing parts) ")")
          %+  ifix  [pal par]
          %-  star
          ;~  pose
            parens-1
            (cook trip (escaped '('))
            (cook trip (escaped ')'))
            (cook trip ;~(less whitespace pal par line-end prn))
          ==
        ++  parens-3
          %+  cook
            |=  parts=(list tape)
            ;:(weld "(" `tape`(zing parts) ")")
          %+  ifix  [pal par]
          %-  star
          ;~  pose
            parens-2
            (cook trip (escaped '('))
            (cook trip (escaped ')'))
            (cook trip ;~(less whitespace pal par line-end prn))
          ==
        --
      --
    ::
    ++  title-separator
      ;~  pose
        (plus (mask " \09"))
        ;~(plug (star (mask " \09")) newline (star (mask " \09")))
      ==
    ++  title-newline
      %+  cold  '\0a'
      ;~  less
        ;~(plug newline (star (mask " \09")) newline)
        newline
      ==
    ::
    ++  urlt
      %+  cook  |=(a=urlt:ln:m a)                :: Cast
      ;~  plug
        url
        %-  punt                                 :: Optional title-text
          ;~  pfix  title-separator               :: Separated by spaces or one line ending
            %+  cook  crip  ;~  pose             :: Enclosed in single quote, double quote, or '(...)'
              (ifix [soq soq] (star ;~(pose (escaped '\'') title-newline ;~(less soq prn))))
              (ifix [doq doq] (star ;~(pose (escaped '"') title-newline ;~(less doq prn))))
              (ifix [pal par] (star ;~(pose (escaped '(') (escaped ')') title-newline ;~(less pal par prn))))
            ==
          ==
      ==
    ::
    ::  Labels are used in inline link targets and in a block-level element (labeled link references)
    ++  label
      %+  cook  crip
      %+  ifix  [sel ser]                        :: Enclosed in '[...]'
      %+  ifix  :-  (star whitespace)            :: Strip leading and trailing whitespapce
                    (star whitespace)
      %-  plus  ;~  pose                         :: Non-empty
        (escaped '[')
        (escaped ']')
        ;~(less sel ser prn)                     :: Anything except '[', ']' (must be escaped)
      ==
    ::
    ++  target                                   :: Link target, either reference or direct
      =<  %+  cook  |=(a=target:ln:m a)
          ;~(pose target-direct target-ref)
      |%
      ++  target-direct
        %+  cook  |=(a=target:ln:m a)
        %+  stag  %direct
        %+  ifix  [pal par]                        :: Direct links are enclosed in '(...)'
        %+  ifix  :-  (star whitespace)            :: Strip leading and trailing whitespace
                      (star whitespace)
        urlt                                       :: Just the target
      ++  target-ref
        %+  cook  |=(a=target:ln:m a)
        %+  stag  %ref
        ;~  pose
          %+  stag  %full  label
          %+  stag  %collapsed  (cold '' (jest '[]'))
          %+  stag  %shortcut  (easy '')
        ==
      --
    --
  ++  inline       :: Inline elements
    |%
    +$  boundary  ?(%white %punct %other)
    +$  token
      $%  [%node =element:inline:m]
          [%delimiter char=@t count=@ can-open=? can-close=?]
      ==
    +$  opener  [index=@ char=@t count=@ can-close=?]
    +$  pair  [open-index=@ close-index=@ use-count=@]
    ::
    ++  contents
      %+  cook  resolve-delimiters
      (star raw-token)
    ::
    ++  raw-token
      (raw-token-with ;~(pose link image) fail)
    ::
    ++  label-contents
      |*  [nested=rule stopper=rule]
      %+  cook  resolve-delimiters
      (star (raw-token-with nested stopper))
    ::
    ++  raw-token-with
      |*  [nested=rule stopper=rule]
      ;~  pose
        (cook |=(e=element:inline:m `token`[%node e]) html)
        (cook |=(e=element:inline:m `token`[%node e]) escape)
        (cook |=(e=element:inline:m `token`[%node e]) entity)
        emphasis-delimiter
        tilde-token
        (cook |=(e=element:inline:m `token`[%node e]) code)
        (cook |=(e=element:inline:m `token`[%node e]) literal-tics)
        (cook |=(e=element:inline:m `token`[%node e]) nested)
        (cook |=(e=element:inline:m `token`[%node e]) autolink)
        (cook |=(e=element:inline:m `token`[%node e]) (text-with nested stopper))
        (cook |=(e=element:inline:m `token`[%node e]) softbrk)
        (cook |=(e=element:inline:m `token`[%node e]) hardbrk)
      ==
    ::
    ++  emphasis-delimiter
      ;~  pose
        %+  cook
          |=(run=tape `token`[%delimiter '*' (lent run) %.n %.n])
        (plus tar)
        %+  cook
          |=(run=tape `token`[%delimiter '_' (lent run) %.n %.n])
        (plus cab)
      ==
    ::
    ++  tilde-token
      %+  cook
        |=  run=tape
        ^-  token
        ?:  (lte (lent run) 2)
          [%delimiter '~' (lent run) %.n %.n]
        [%node [%text (crip run)]]
      (plus sig)
    ::
    ++  literal-tics
      %+  cook  |=(run=tape `text:inline:m`[%text (crip run)])
      (plus tic)
    ::
    ++  resolve-delimiters
      |=  tokens=(list token)
      ^-  contents:inline:m
      =/  annotated=(list token)  (annotate-delimiters tokens)
      |-  ^-  contents:inline:m
      =/  maybe-pair=(unit pair)  (find-pair annotated)
      ?~  maybe-pair
        (tokens-to-elements annotated)
      $(annotated (apply-pair annotated u.maybe-pair))
    ::
    ++  annotate-delimiters
      |=  tokens=(list token)
      ^-  (list token)
      =<  (walk tokens `@c`0)
      |%
      ++  walk
        |=  [remaining=(list token) previous=@c]
        ^-  (list token)
        ?~  remaining  ~
        =/  current=token  i.remaining
        =/  following=@c
          ?~  t.remaining
            `@c`0
          (first-boundary i.t.remaining)
        =/  next-previous=@c  (last-boundary current)
        ?-    -.current
            %node
          [current $(remaining t.remaining, previous next-previous)]
        ::
            %delimiter
          =/  previous-kind=boundary  (classify previous)
          =/  following-kind=boundary  (classify following)
          =/  left-flanking=?
            ?&  !=(%white following-kind)
                ?|  !=(%punct following-kind)
                    =(%white previous-kind)
                    =(%punct previous-kind)
                ==
            ==
          =/  right-flanking=?
            ?&  !=(%white previous-kind)
                ?|  !=(%punct previous-kind)
                    =(%white following-kind)
                    =(%punct following-kind)
                ==
            ==
          =/  can-open=?
            ?:  =('~' char.current)
              %.y
            ?:  =('*' char.current)
              left-flanking
            ?&  left-flanking
                ?|  !right-flanking
                    =(%punct previous-kind)
                ==
            ==
          =/  can-close=?
            ?:  =('~' char.current)
              %.y
            ?:  =('*' char.current)
              right-flanking
            ?&  right-flanking
                ?|  !left-flanking
                    =(%punct following-kind)
                ==
            ==
          :-  current(can-open can-open, can-close can-close)
          $(remaining t.remaining, previous next-previous)
        ==
      --
    ::
    ++  find-pair
      |=  tokens=(list token)
      ^-  (unit pair)
      =<  (walk tokens 0 ~)
      |%
      ++  walk
        |=  [remaining=(list token) index=@ openers=(list opener)]
        ^-  (unit pair)
        ?~  remaining  ~
        =/  current=token  i.remaining
        ?-    -.current
            %node
          $(remaining t.remaining, index +(index))
        ::
            %delimiter
          =/  maybe-opener=(unit opener)
            ?:  can-close.current
              (matching-opener openers current index)
            ~
          ?^  maybe-opener
            =/  use-count=@
              ?:  =('~' char.current)
                count.current
              ?:  ?&  (gte count.u.maybe-opener 2)
                      (gte count.current 2)
                  ==
                2
              1
            (some `pair`[index.u.maybe-opener index use-count])
          ::  No compatible opener; this run may still open emphasis.
          =/  next-openers=(list opener)
            ?:  can-open.current
              [[index char.current count.current can-close.current] openers]
            openers
          $(remaining t.remaining, index +(index), openers next-openers)
        ==
      ::
      ++  matching-opener
        |=  [openers=(list opener) closer=token closer-index=@]
        ^-  (unit opener)
        ?>  ?=(%delimiter -.closer)
        ?~  openers  ~
        =/  candidate=opener  i.openers
        ?:  ?|  !=(char.candidate char.closer)
                ?&  =('~' char.closer)
                    ?|  !=(count.candidate count.closer)
                        =(+(index.candidate) closer-index)
                    ==
                ==
            ==
          $(openers t.openers)
        ?:  =('~' char.closer)
          (some candidate)
        =/  odd-match=?
          ?&  ?|  can-close.candidate
                  can-open.closer
              ==
              =((mod (add count.candidate count.closer) 3) 0)
              ?|  !=((mod count.candidate 3) 0)
                  !=((mod count.closer 3) 0)
              ==
          ==
        ?:  odd-match
          $(openers t.openers)
        (some candidate)
      --
    ::
    ++  apply-pair
      |=  [tokens=(list token) match=pair]
      ^-  (list token)
      =/  opening=token  (snag open-index.match tokens)
      =/  closing=token  (snag close-index.match tokens)
      ?>  ?=(%delimiter -.opening)
      ?>  ?=(%delimiter -.closing)
      =/  middle=(list token)
        (scag (sub close-index.match +(open-index.match)) (slag +(open-index.match) tokens))
      =/  wrapped=element:inline:m
        ?:  =('~' char.opening)
          [%strikethru use-count.match (tokens-to-elements middle)]
        ?:  =(use-count.match 2)
          [%strong char.opening (tokens-to-elements middle)]
        [%emphasis char.opening (tokens-to-elements middle)]
      =/  opening-left=@  (sub count.opening use-count.match)
      =/  closing-left=@  (sub count.closing use-count.match)
      =/  replacement=(list token)
        [%node wrapped]~
      =.  replacement
        ?:  =(closing-left 0)
          replacement
        (snoc replacement closing(count closing-left))
      =.  replacement
        ?:  =(opening-left 0)
          replacement
        [opening(count opening-left) replacement]
      ;:  weld
        (scag open-index.match tokens)
        replacement
        (slag +(close-index.match) tokens)
      ==
    ::
    ++  tokens-to-elements
      |=  tokens=(list token)
      ^-  contents:inline:m
      %-  merge-text
      %+  turn  tokens
      |=  current=token
      ^-  element:inline:m
      ?-  -.current
        %node       element.current
        %delimiter  [%text (crip (reap count.current char.current))]
      ==
    ::
    ++  merge-text
      |=  elements=contents:inline:m
      ^-  contents:inline:m
      ?~  elements  ~
      =/  rest=contents:inline:m  $(elements t.elements)
      ?:  ?&  ?=(%text -.i.elements)
              ?=(^ rest)
              ?=(%text -.i.rest)
          ==
        :-  [%text (cat 3 text.i.elements text.i.rest)]
        t.rest
      [i.elements rest]
    ::
    ++  classify
      |=  character=@c
      ^-  boundary
      ?:  ?|  =(character 0)
              =(character 0x9)
              =(character 0xa)
              =(character 0xb)
              =(character 0xc)
              =(character 0xd)
              =(character 0x20)
              =(character 0xa0)
              ?&  (gte character 0x2000)
                  (lte character 0x200a)
              ==
              =(character 0x2028)
              =(character 0x2029)
              =(character 0x202f)
              =(character 0x205f)
              =(character 0x3000)
          ==
        %white
      ?:  ?|  ?&  (gte character 0x21)
                  (lte character 0x2f)
              ==
              ?&  (gte character 0x3a)
                  (lte character 0x40)
              ==
              ?&  (gte character 0x5b)
                  (lte character 0x60)
              ==
              ?&  (gte character 0x7b)
                  (lte character 0x7e)
              ==
              =(character 0xa3)
              =(character 0x20ac)
          ==
        %punct
      %other
    ::
    ++  first-boundary
      |=  current=token
      ^-  @c
      ?-  -.current
        %delimiter  (first-text-boundary char.current)
        %node       (first-element-boundary element.current)
      ==
    ::
    ++  last-boundary
      |=  current=token
      ^-  @c
      ?-  -.current
        %delimiter  (last-text-boundary char.current)
        %node       (last-element-boundary element.current)
      ==
    ::
    ++  first-text-boundary
      |=  value=@t
      ^-  @c
      =/  characters=(list @c)  (tuba (trip value))
      ?~(characters `@c`0 i.characters)
    ::
    ++  last-text-boundary
      |=  value=@t
      ^-  @c
      =/  characters=(list @c)  (tuba (trip value))
      ?~(characters `@c`0 (rear characters))
    ::
    ++  first-element-boundary
      |=  current=element:inline:m
      ^-  @c
      ?-  -.current
        %text             (first-text-boundary text.current)
        %escape           `@c`0x5c
        %entity           `@c`0x26
        %code-span        `@c`0x60
        %strong           (first-text-boundary emphasis-char.current)
        %emphasis         (first-text-boundary emphasis-char.current)
        %strikethru       `@c`0x7e
        %soft-line-break  `@c`0x20
        %line-break       `@c`0x20
        %link             `@c`0x5b
        %image            `@c`0x21
        %autolink         `@c`0x3c
        %task-checkbox    `@c`0x5b
        %html             `@c`0x3c
      ==
    ::
    ++  last-element-boundary
      |=  current=element:inline:m
      ^-  @c
      ?-  -.current
        %text             (last-text-boundary text.current)
        %escape           (last-text-boundary char.current)
        %entity           `@c`0x3b
        %code-span        `@c`0x60
        %strong           (last-text-boundary emphasis-char.current)
        %emphasis         (last-text-boundary emphasis-char.current)
        %strikethru       `@c`0x7e
        %soft-line-break  `@c`0x20
        %line-break       `@c`0x20
        %link             (last-target-boundary target.current)
        %image            (last-target-boundary target.current)
        %autolink         `@c`0x3e
        %task-checkbox    `@c`0x5d
        %html             `@c`0x3e
      ==
    ::
    ++  last-target-boundary
      |=  current=target:ln:m
      ^-  @c
      ?-  -.current
        %direct  `@c`0x29
        %ref     `@c`0x5d
      ==
    ::
    ++  html
      =<  parser
      |%
      ++  xml-node
        =,  de-xml:^html                           :: This is a copy-paste of `apex:de-xml:html` except
        =+  spa=;~(pose comt whit)                 :: it doesn't eat trailing whitespace
        %+  knee  *manx  |.  ~+
        ;~  pfix
          ;~(plug (more spa decl) (star spa))
          ;~  pose
            %+  sear  |=([a=marx b=marl c=mane] ?.(=(c n.a) ~ (some [a b])))
              ;~(plug head many tail)
            empt
          ==
        ==
      ::
      ++  any-character  ;~(pose newline prn)
      ++  horizontal  (mask " \09")
      ++  optional-tag-space
        ;~  pose
          ;~(plug (star horizontal) newline (star horizontal))
          (star horizontal)
        ==
      ++  tag-space
        ;~  pose
          ;~(plug (star horizontal) newline (star horizontal))
          (plus horizontal)
        ==
      ++  tag-name  ;~(plug alf (star ;~(pose alf nud hep)))
      ++  attribute-name
        ;~  plug
          ;~(pose alf cab col)
          (star ;~(pose alf nud cab dot col hep))
        ==
      ++  attribute-value
        ;~  pose
          %+  ifix  [doq doq]
          (star ;~(less doq any-character))
          %+  ifix  [soq soq]
          (star ;~(less soq any-character))
          (plus ;~(less (mask " \09\0d\0a\"'=<>`") prn))
        ==
      ++  attribute
        ;~  plug
          tag-space
          attribute-name
          %-  punt
          ;~  plug
            optional-tag-space
            tis
            optional-tag-space
            attribute-value
          ==
        ==
      ++  open-tag
        ;~  plug
          gal
          tag-name
          (star attribute)
          optional-tag-space
          (punt fas)
          gar
        ==
      ++  closing-tag
        ;~  plug
          gal
          fas
          tag-name
          optional-tag-space
          gar
        ==
      ++  comment
        ;~  pose
          (jest '<!-->')
          (jest '<!--->')
          ;~  plug
            (jest '<!--')
            (star ;~(less (jest '-->') any-character))
            (jest '-->')
          ==
        ==
      ++  processing-instruction
        ;~  plug
          (jest '<?')
          (star ;~(less (jest '?>') any-character))
          (jest '?>')
        ==
      ++  declaration
        ;~  plug
          (jest '<!')
          alf
          (star ;~(less gar any-character))
          gar
        ==
      ++  cdata
        ;~  plug
          (jest '<![CDATA[')
          (star ;~(less (jest ']]>') any-character))
          (jest ']]>')
        ==
      ++  raw
        ;~  pose
          open-tag
          closing-tag
          comment
          processing-instruction
          declaration
          cdata
        ==
      ++  parser
        %+  cook  |=(source=tape `html:inline:m`[%html (crip source)])
        %-  capture
        ;~(pose xml-node raw)
      --
    ::
    ++  text
      (text-with ;~(pose link image) fail)
    ::
    ++  text-with
      |*  [nested=rule stopper=rule]
      %+  knee  *text:inline:m  |.  ~+   :: recurse
      %+  cook  |=(a=text:inline:m a)
      %+  stag  %text
      %+  cook  crip
      %-  plus                                   :: At least one character
      ;~  less                                   :: ...which doesn't match any other inline rule
        ;~(simu gal html)
        escape
        entity
        nested
        autolink
        code
        softbrk
        hardbrk
        tar
        cab
        sig
        tic
        stopper
        :: ...etc
        prn
      ==
    ::
    ++  escape
      %+  cook  |=(a=escape:inline:m a)
      %+  stag  %escape
      ;~  pose
        ::  \!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_\`\{\|\}\~
        (escaped '!')   (escaped '"')   (escaped '#')   (escaped '$')
        (escaped '%')   (escaped '&')   (escaped '\'')  (escaped '(')
        (escaped ')')   (escaped '*')   (escaped '+')   (escaped ',')
        (escaped '-')   (escaped '.')   (escaped '/')   (escaped ':')
        (escaped ';')   (escaped '<')   (escaped '=')   (escaped '>')
        (escaped '?')   (escaped '@')   (escaped '[')   (escaped '\\')
        (escaped ']')   (escaped '^')   (escaped '_')   (escaped '`')
        (escaped '{')   (escaped '|')   (escaped '}')   (escaped '~')
      ==
    ++  entity
      %+  cook  |=(a=entity:inline:m a)
      %+  stag  %entity
      %+  ifix  [pam mic]
      %+  cook  crip
      ;~  pose
        ;~  plug                              :: '#' + 'x'/'X' + one to six hex digits
          hax
          (mask "xX")
          (stun [1 6] ;~(pose nud (shim 'a' 'f') (shim 'A' 'F')))
        ==
        ;~(plug hax (stun [1 7] nud))            :: '#' and one to seven digits
        ;~  plug                                 :: ASCII alphanumeric name
          alf
          (star ;~(pose alf nud))
        ==
      ==
    ::
    ++  softbrk                                  :: Newline
      %+  cook  |=(a=softbrk:inline:m a)
      %+  stag  %soft-line-break
      (cold ~ newline)
    ::
    ++  hardbrk
      %+  cook  |=(a=hardbrk:inline:m a)
      %+  stag  %line-break
      %+  cold  ~
      ;~  pose
        ;~(plug (jest '  ') (star ace) newline)   :: Two or more spaces before a newline
        ;~(plug (just '\\') newline)              :: An escaped newline
      ==
    ++  link
      %+  knee  *link:inline:m  |.  ~+   :: recurse
      %+  cook  backfill-ref-link
      %+  stag  %link
      ;~  plug
        %+  ifix  [sel ser]                      :: Display text is wrapped in '[...]'
          (label-contents image ser)
        target:ln
      ==
    ::
    ++  image
      %+  knee  *image:inline:m  |.  ~+
      %+  cook  |=(a=image:inline:m a)
      %+  cook  backfill-ref-image
      %+  stag  %image
      ;~  plug
        %+  ifix  [(jest '![') (just ']')]
          (label-contents ;~(pose link image) ser)
        target:ln
      ==
    ::
    ++  autolink
      |^
      %+  cook  |=(a=autolink:inline:m a)
      %+  stag  %autolink
      %+  ifix  [gal gar]
      ;~  pose
        %+  stag  %uri
        %+  cook  crip
        ;~  simu
          ;~(plug uri gar)
          (plus ;~(less gar next))
        ==
        %+  stag  %email
        %+  cook  crip
        ;~  simu
          ;~(plug email gar)
          (plus ;~(less gar next))
        ==
      ==
      :: URI schemes are 2-32 characters, beginning with a letter.
      ::
      ++  uri
        ;~  plug
          alf
          (stun [1 31] ;~(pose aln (mask "+.-")))
          col
          (star ;~(less ace gal gar prn))
        ==
      :: CommonMark email local-part and domain syntax.
      ::
      ++  email
        ;~  plug
          (plus ;~(pose aln tic kel ker (mask ".!#$%&'*+/=?^_|~-")))
          pat
          domain-label
          (star ;~(pfix dot domain-label))
        ==
      ::
      ++  domain-label
        %+  ifix  [;~(less hep (easy ~)) ;~(less hep (easy ~))]
        (stun [1 63] ;~(pose aln ;~(sfix hep ;~(simu aln (easy ~)))))
      --
    ::
    ++  code
      =<  parser
      |%
      ++  parser
        |=  tub=nail
        ^-  (like code:inline:m)
        =/  opener-vex  ((plus tic) tub)
        ?~  q.opener-vex  opener-vex
        =/  opening=tape  p.u.q.opener-vex
        =/  after-opening=nail  q.u.q.opener-vex
        =/  maybe-close=(unit [content=tape consumed=@])
          (find-close (lent opening) q.after-opening ~ 0)
        ?~  maybe-close
          [p.after-opening ~]
        =/  advance-vex
          ((stun [consumed.u.maybe-close consumed.u.maybe-close] next) after-opening)
        ?~  q.advance-vex  !!
        :+  p.advance-vex
          ~
        :-  [%code-span (lent opening) (crip (normalize content.u.maybe-close))]
        q.u.q.advance-vex
      ::
      ++  find-close
        |=  [opener-count=@ remaining=tape reversed=tape consumed=@]
        ^-  (unit [content=tape consumed=@])
        ?~  remaining  ~
        ?:  =(i.remaining `@tD`0x60)
          =/  run-count=@  (count-run remaining)
          ?:  =(run-count opener-count)
            (some [(flop reversed) (add consumed run-count)])
          %+  find-close  opener-count
          :+  (slag run-count `tape`remaining)
            (weld (reap run-count `@tD`0x60) reversed)
          (add consumed run-count)
        (find-close opener-count t.remaining [i.remaining reversed] +(consumed))
      ::
      ++  count-run
        |=  remaining=tape
        ^-  @
        =+  count=0
        |-
        ?~  remaining
          count
        ?:  !=(i.remaining `@tD`0x60)
          count
        $(remaining t.remaining, count +(count))
      ::
      ++  normalize
        |=  content=tape
        ^-  tape
        =/  normalized=tape  (normalize-lines content)
        ?~  normalized  normalized
        ?:  ?|  !=(' ' i.normalized)
                !=(' ' (rear normalized))
                !(contains-non-space normalized)
            ==
          normalized
        (snip (slag 1 `tape`normalized))
      ::
      ++  normalize-lines
        |=  content=tape
        ^-  tape
        ?~  content  ~
        ?:  =('\0d' i.content)
          ?:  ?&  ?=(^ t.content)
                  =('\0a' i.t.content)
              ==
            [' ' $(content t.t.content)]
          [' ' $(content t.content)]
        ?:  =('\0a' i.content)
          [' ' $(content t.content)]
        [i.content $(content t.content)]
      ::
      ++  contains-non-space
        |=  content=tape
        ^-  ?
        ?~  content  %.n
        ?:  !=(' ' i.content)
          %.y
        $(content t.content)
      --
    --
  ::
  ++  leaf
    |%
    ++  node
      %+  cook  |=(a=node:leaf:m a)
      ;~  pose
        blank-line
        break
        heading
        codeblk-indent
        codeblk-fenced
        html
        link-ref-def
        :: ...etc
        table
        paragraph
      ==
    ++  blank-line
      %+  cook  |=(a=blank-line:leaf:m a)
      %+  stag  %blank-line
      (cold ~ newline)
    ++  heading
      =<  %+  cook  |=(a=heading:leaf:m a)
          %+  stag  %heading
          ;~(pose atx setext)
      |%
      ++  atx
        =/  atx-eol   ;~  pose
                        line-end               :: just end-of-line
                        ;~  plug
                          (plus ace)
                          (star hax)
                          (star ace)
                          line-end
                        ==
                      ==
        %+  stag  %atx
        %+  cook                               :: Parse heading inline content
          |=  [level=@ text=tape]
          [level (scan text contents:inline)]
        ;~  pfix
          (stun [0 3] ace)                     :: Ignore up to 3 leading spaces
          ;~  plug
            (cook |=(a=tape (lent a)) (stun [1 6] hax))                   :: Heading level
            %+  ifix  [(plus ace) atx-eol]     :: One leading space is required; rest is ignored
              %-  star
              ;~(less atx-eol prn)             :: Trailing haxes/spaces are ignored
          ==
        ==
      ++  setext
        %+  stag  %setext
        %+  cook
          |=  [text=tape level=@]
          [level (scan text contents:inline)]
        ;~  plug                                   :: Wow this is a mess
          %+  ifix  [(stun [0 3] ace) (star ace)]  :: Strip up to 3 spaces, and trailing space
            (star ;~(less ;~(pfix (star ace) newline) prn))     :: Any text...
          ;~  pfix
            newline                         :: ...followed by newline...
            (stun [0 3] ace)                     :: ...up to 3 spaces (stripped)...
            ;~  sfix
              ;~  pose                             :: ...and an underline
                (cold 1 (plus (just '-')))         :: Underlined by '-' means heading lvl 1
                (cold 2 (plus (just '=')))         :: Underlined by '=' means heading lvl 2
              ==
              ;~(plug (star ace) line-end)
            ==
          ==
        ==
      --
    ++  break
      %+  cook  |=(a=break:leaf:m a)
      %+  stag  %break
      %+  cook
        |=  [first-2=@t trailing=tape]
        [(head trailing) (add 2 (lent trailing))]
      %+  ifix  :-  (stun [0 3] ace)                  :: Strip indent and trailing space
                    ;~  plug
                      (star (mask " \09"))
                      line-end                    :: No other chars allowed on the line
                    ==
        ;~  pose
          ;~(plug (jest '**') (plus tar))       :: At least 3, but can be more
          ;~(plug (jest '--') (plus hep))
          ;~(plug (jest '__') (plus cab))
        ==
    ::
    ++  codeblk-indent
      =>  |%
          ++  indented-chunk                   :: A block of indented code, delimited by newlines
            %+  cook  |=(a=(list tape) (zing a))
            %-  plus                           :: 1 or more lines
            ;~  pfix  (jest '    ')            :: with 4 leading spaces
              %+  cook  snoc  ;~  plug
                (star ;~(less line-end prn))
                line-end
              ==
            ==
          --
      %+  cook  |=(a=codeblk-indent:leaf:m a)
      %+  stag  %indent-codeblock
      %+  cook  |=([a=tape b=(list tape)] (crip (welp a (zing b))))
      ;~  plug                                   :: 1 or more chunks
        indented-chunk
        %-  star
        %+  cook  |=([newlines=tape chunk=tape] `tape`(welp newlines chunk))
        ;~  plug
          (star newline)                         :: separated by zero or more blank lines
          indented-chunk
        ==
      ==
    ::
    ++  codeblk-fenced
      =+  |%
          :: Returns a 3-tuple:
          :: - indent size
          :: - char type
          :: - fence length
          ++  code-fence
            ;~  plug
              %+  cook  |=(a=tape (lent a))  (stun [0 3] ace)
              %+  cook  |=(a=tape [(head a) (lent a)])   :: Get code fence char and length
              ;~  pose
                (stun [3 999.999.999] sig)
                (stun [3 999.999.999] tic)
              ==
            ==
          ::
          ++  info-string
            |=  fence-char=@t
            %+  cook  crip
            %+  ifix  [(star ace) line-end]    :: Strip leading whitespace
            ?:  =(fence-char '`')
              (star ;~(less line-end tic prn)) :: No backticks after a backtick fence
            (star ;~(less line-end prn))       :: Tilde fences may contain backticks
          --
      |*  =nail
      :: Get the marker and indent size
      =/  vex  (code-fence nail)
      ?~  q.vex  vex  :: If no match found, fail
      =/  [indent=@ char=@t len=@]  p:(need q.vex)
      =/  closing-fence
        ;~  plug
          (star ace)
          (stun [len 999.999.999] (just char))   :: Closing fence must be at least as long as opener
          (star ace)                             :: ...and cannot have any following text except space
          line-end
        ==
      :: Read the rest of the list item block
      %.
        q:(need q.vex)
      %+  cook  |=(a=codeblk-fenced:leaf:m a)
      %+  stag  %fenced-codeblock
      ;~  plug
        %+  cook  |=(a=@t a)  (easy char)
        (easy len)
        %+  cook  |=(a=@t a)  (info-string char)
        (easy indent)
        %+  cook  |=(a=(list tape) (crip (zing a)))
        ;~  sfix
          %-  star                               :: Any amount of lines
          ;~  less  closing-fence                :: ...until the closing code fence
            ;~  pfix  (stun [0 indent] ace)      :: Strip indent up to that of the opening fence
              %+  cook  |=(a=tape a)
              ;~  pose                           :: Avoid infinite loop at EOF
                %+  cook  trip  newline     :: A line is either a blank line...
                %+  cook  snoc
                ;~  plug                         :: Or a non-blank line
                  (plus ;~(less line-end prn))
                  line-end
                ==
              ==
            ==
          ==
          ;~(pose closing-fence (full (easy ~)))
        ==
      ==
    ::
    ++  link-ref-def
      %+  cook  |=(a=link-ref-def:leaf:m a)
      %+  stag  %link-ref-definition
      %+  ifix  [(stun [0 3] ace) line-end]            :: Strip leading space
        ;~  plug
          ;~(sfix label:ln col)                 :: Label (enclosed in "[...]"), followed by col ":"
          ;~  pfix                                :: Optional whitespace, including up to 1 newline
            (star ace)
            (stun [0 1] newline)
            (star ace)
            urlt:ln
          ==
        ==
    ::
    ++  html-rules
      |%
      ++  source-line
        ;~  pose
          %+  cook
            |=  [body=tape ending=@t]
            (snoc body ending)
          ;~  plug
            (star ;~(less line-end prn))
            newline
          ==
          (plus ;~(less line-end prn))
        ==
      ::
      ++  starts-with
        |=  [prefix=tape text=tape]
        ^-  ?
        ?~  prefix  %.y
        ?~  text  %.n
        ?.  =(i.prefix i.text)  %.n
        $(prefix t.prefix, text t.text)
      ::
      ++  contains
        |=  [needle=tape text=tape]
        ^-  ?
        ?~  needle  %.y
        ?~  text  %.n
        ?:  (starts-with needle text)  %.y
        $(text t.text)
      ::
      ++  strip-line-end
        |=  line=tape
        ^-  tape
        =/  reversed  (flop line)
        ?~  reversed  ~
        ?.  =('\0a' i.reversed)  line
        =/  without-lf=tape  t.reversed
        ?~  without-lf  ~
        ?:  =('\0d' i.without-lf)  (flop t.without-lf)
        (flop without-lf)
      ::
      ++  strip-indent
        |=  [line=tape count=@]
        ^-  tape
        ?:  ?|  =(3 count)
                ?=(~ line)
            ==
          line
        ?.  =(' ' i.line)  line
        $(line t.line, count +(count))
      ::
      ++  prepared-line
        |=  line=tape
        ^-  tape
        (strip-indent (strip-line-end line) 0)
      ::
      ++  is-horizontal
        |=  char=@t
        ?|  =(' ' char)
            =('\09' char)
        ==
      ::
      ++  is-blank
        |=  line=tape
        ^-  ?
        =.  line  (strip-line-end line)
        ?~  line  %.y
        ?.  (is-horizontal i.line)  %.n
        $(line t.line)
      ::
      ++  is-alpha
        |=  char=@t
        ?|  ?&  (gte char 'A')
                (lte char 'Z')
            ==
            ?&  (gte char 'a')
                (lte char 'z')
            ==
        ==
      ::
      ++  is-digit
        |=  char=@t
        ?&  (gte char '0')
            (lte char '9')
        ==
      ::
      ++  is-tag-char
        |=  char=@t
        ?|  =(char '-')
            (is-alpha char)
            (is-digit char)
        ==
      ::
      ++  take-tag-name
        |=  [text=tape name=tape]
        ^-  [name=tape rest=tape]
        ?~  text  [(flop name) ~]
        ?:  =(%.n (is-tag-char i.text))  [(flop name) text]
        $(text t.text, name [i.text name])
      ::
      ++  first-tag
        |=  line=tape
        ^-  (unit [closing=? name=tape rest=tape])
        =.  line  (prepared-line line)
        ?~  line  ~
        ?.  =('<' i.line)  ~
        =/  after-open=tape  t.line
        =/  tag-head=[closing=? rest=tape]
          ?~  after-open  [%.n ~]
          ?:  =('/' i.after-open)  [%.y t.after-open]
          [%.n after-open]
        =/  closing  closing.tag-head
        =/  tag-text=tape  rest.tag-head
        ?~  tag-text  ~
        ?.  (is-alpha i.tag-text)  ~
        =/  result  (take-tag-name tag-text ~)
        `[closing (cass name.result) rest.result]
      ::
      ++  named-tag-start
        |=  [names=(list tape) line=tape]
        ^-  ?
        =/  tag  (first-tag line)
        ?~  tag  %.n
        ?.  (lien names |=(name=tape =(name name.u.tag)))  %.n
        =/  rest  rest.u.tag
        ?~  rest  %.y
        ?|  (is-horizontal i.rest)
            =('>' i.rest)
            ?&  =('/' i.rest)
                ?=(^ t.rest)
                =('>' i.t.rest)
            ==
        ==
      ::
      ++  type-one-start
        |=  line=tape
        =/  tag  (first-tag line)
        ?~  tag  %.n
        ?:  closing.u.tag  %.n
        =/  names=(list tape)  ~["pre" "script" "style" "textarea"]
        ?.  (lien names |=(name=tape =(name name.u.tag)))
          %.n
        =/  rest  rest.u.tag
        ?~  rest  %.y
        ?|  (is-horizontal i.rest)
            =('>' i.rest)
        ==
      ++  type-one-end
        |=  line=tape
        =/  lower  (cass line)
        ?|  (contains "</pre>" lower)
            (contains "</script>" lower)
            (contains "</style>" lower)
            (contains "</textarea>" lower)
        ==
      ++  type-two-start  |=(line=tape (starts-with "<!--" (prepared-line line)))
      ++  type-two-end    |=(line=tape (contains "-->" line))
      ++  type-three-start  |=(line=tape (starts-with "<?" (prepared-line line)))
      ++  type-three-end    |=(line=tape (contains "?>" line))
      ++  type-four-start
        |=  line=tape
        =.  line  (prepared-line line)
        ?:  =(%.n (starts-with "<!" line))  %.n
        =.  line  (slag 2 line)
        ?~  line  %.n
        (is-alpha i.line)
      ++  type-four-end  |=(line=tape (contains ">" line))
      ++  type-five-start  |=(line=tape (starts-with "<![CDATA[" (prepared-line line)))
      ++  type-five-end    |=(line=tape (contains "]]>" line))
      ::
      ++  block-tags
        ^-  (list tape)
        :~  "address"
            "article"
            "aside"
            "base"
            "basefont"
            "blockquote"
            "body"
            "caption"
            "center"
            "col"
            "colgroup"
            "dd"
            "details"
            "dialog"
            "dir"
            "div"
            "dl"
            "dt"
            "fieldset"
            "figcaption"
            "figure"
            "footer"
            "form"
            "frame"
            "frameset"
            "h1"
            "h2"
            "h3"
            "h4"
            "h5"
            "h6"
            "head"
            "header"
            "hr"
            "html"
            "iframe"
            "legend"
            "li"
            "link"
            "main"
            "menu"
            "menuitem"
            "nav"
            "noframes"
            "ol"
            "optgroup"
            "option"
            "p"
            "param"
            "search"
            "section"
            "summary"
            "table"
            "tbody"
            "td"
            "tfoot"
            "th"
            "thead"
            "title"
            "tr"
            "track"
            "ul"
        ==
      ++  type-six-start  |=(line=tape (named-tag-start block-tags line))
      ::
      ++  tag-name
        ;~(plug alf (star ;~(pose alf nud hep)))
      ++  attribute-name
        ;~  plug
          ;~(pose alf cab col)
          (star ;~(pose alf nud cab dot col hep))
        ==
      ++  attribute-value
        ;~  pose
          %+  ifix  [doq doq]
          (star ;~(less doq prn))
          %+  ifix  [soq soq]
          (star ;~(less soq prn))
          (plus ;~(less (mask " \09\"'=<>`") prn))
        ==
      ++  attribute
        ;~  plug
          (plus (mask " \09"))
          attribute-name
          %-  punt
          ;~  plug
            (star (mask " \09"))
            tis
            (star (mask " \09"))
            attribute-value
          ==
        ==
      ++  open-tag
        ;~  plug
          gal
          tag-name
          (star attribute)
          (star (mask " \09"))
          (punt fas)
          gar
        ==
      ++  closing-tag
        ;~  plug
          gal
          fas
          tag-name
          (star (mask " \09"))
          gar
        ==
      ++  type-seven-start
        |=  line=tape
        =/  source  (prepared-line line)
        =/  parsed  (rust source ;~(pose open-tag closing-tag))
        ?=(^ parsed)
      ::
      ++  matching-line
        |=  predicate=$-(tape ?)
        %+  sear
          |=  line=tape
          ^-  (unit tape)
          ?:  (predicate line)  `line
          ~
        source-line
      ::
      ++  terminated
        |=  [start=$-(tape ?) end=$-(tape ?)]
        ;~  pose
          %-  matching-line
          |=  line=tape
          ?&  (start line)
              (end line)
          ==
          %+  cook
            |=  [first=tape middle=(list tape) last=(unit tape)]
            ^-  tape
            =/  suffix=tape  ?~(last ~ u.last)
            ;:(weld first `tape`(zing middle) suffix)
          ;~  plug
            %-  matching-line
            |=  line=tape
            ?&  (start line)
                =(%.n (end line))
            ==
            %-  star  %-  matching-line
            |=(line=tape =(%.n (end line)))
            (punt (matching-line end))
          ==
        ==
      ::
      ++  blank-terminated
        |=  start=$-(tape ?)
        %+  cook
          |=  [first=tape rest=(list tape)]
          ^-  tape
          (weld first `tape`(zing rest))
        ;~  plug
          (matching-line start)
          %-  star  %-  matching-line
          |=(line=tape =(%.n (is-blank line)))
        ==
      ::
      ++  interrupting
        ;~  pose
          (terminated type-one-start type-one-end)
          (terminated type-two-start type-two-end)
          (terminated type-three-start type-three-end)
          (terminated type-four-start type-four-end)
          (terminated type-five-start type-five-end)
          (blank-terminated type-six-start)
        ==
      ++  block
        %+  cook  |=(text=tape [%html (crip text)])
        ;~  pose
          interrupting
          (blank-terminated type-seven-start)
        ==
      --
    ::
    ++  html  block:html-rules
    ++  html-interrupting  interrupting:html-rules
    ::
    ++  paragraph
      %+  cook  |=(a=paragraph:leaf:m a)
      %+  stag  %paragraph
      %+  cook                                   :: Reparse the paragraph text as elements
        |=  lines=(list tape)
        =/  source=tape  (paragraph-source lines)
        (scan source contents:inline)
      %-  plus                                   :: Read lines until a non-paragraph object is found
        ;~  less
          heading
          break
          codeblk-fenced
          html-interrupting
          interrupting-node:container        :: Block quotes and eligible lists can interrupt paragraphs
          %+  cook  snoc  ;~  plug
            %-  plus  ;~(less line-end prn)  :: Lines must be non-empty
            line-end
          ==
        ==
    :: Remove the synthetic line ending added by the block parser, along with
    :: trailing spaces which cannot form a hard break at the end of a block.
    ++  paragraph-source
      |=  lines=(list tape)
      ^-  tape
      =/  split=[preceding=(list tape) final=tape]  (split-last-line lines)
      =/  final=tape  (snip `tape`final.split)
      (weld (join-lines preceding.split) (trim-terminal-spaces final))
    ::
    ++  split-last-line
      |=  lines=(list tape)
      ^-  [(list tape) tape]
      ?>  ?=(^ lines)
      ?~  t.lines
        [~ i.lines]
      =/  rest=[preceding=(list tape) final=tape]  $(lines t.lines)
      [[i.lines preceding.rest] final.rest]
    ::
    ++  join-lines
      |=  lines=(list tape)
      ^-  tape
      ?~  lines  ~
      (weld i.lines $(lines t.lines))
    ::
    ++  trim-terminal-spaces
      |=  line=tape
      ^-  tape
      (flop (drop-spaces (flop line)))
    ::
    ++  drop-spaces
      |=  characters=tape
      ^-  tape
      ?:  ?&  ?=(^ characters)
              =(' ' i.characters)
          ==
        $(characters t.characters)
      characters
    ::
    ++  table
      =>  |%
          +$  cell-t    [len=@ =contents:inline:m]
          ++  raw-line  (plus ;~(less line-end prn))
          ++  drop-horizontal
            |=  text=tape
            ^-  tape
            ?~  text  ~
            ?:  ?|  =(' ' i.text)
                    =('\09' i.text)
                ==
              $(text t.text)
            text
          ::
          ++  trim-cell
            |=  cell=tape
            ^-  tape
            (flop (drop-horizontal (flop (drop-horizontal cell))))
          ::
          ++  unescape-pipes
            |=  cell=tape
            ^-  tape
            ?~  cell  ~
            ?:  ?&  =('\\' i.cell)
                    ?=(^ t.cell)
                    =('|' i.t.cell)
                ==
              ['|' $(cell t.t.cell)]
            [i.cell $(cell t.cell)]
          ::
          ++  split-row-inner
            |=  [remaining=tape current=tape cells=(list tape) escaped=? saw-bar=?]
            ^-  [saw-bar=? cells=(list tape)]
            ?~  remaining
              =/  cells  [i=(flop current) t=cells]
              [saw-bar (flop cells)]
            =/  char  i.remaining
            ?:  ?&  =('|' char)
                    =(%.n escaped)
                ==
              %=  $
                remaining  t.remaining
                current    ~
                cells      [i=(flop current) t=cells]
                escaped    %.n
                saw-bar    %.y
              ==
            =/  next-escaped
              ?&  =('\\' char)
                  =(%.n escaped)
              ==
            %=  $
              remaining  t.remaining
              current    [i=char t=current]
              escaped    next-escaped
            ==
          ::
          ++  split-row
            |=  raw=tape
            ^-  (list tape)
            =/  result  (split-row-inner raw ~ ~ %.n %.n)
            =/  cells  cells.result
            =.  cells
              ?:  ?&  ?=(^ cells)
                      saw-bar.result
                      =("" (trim-cell i.cells))
                  ==
                t.cells
              cells
            =/  reversed  (flop cells)
            =.  cells
              ?:  ?&  ?=(^ reversed)
                      saw-bar.result
                      =("" (trim-cell i.reversed))
                  ==
                (flop t.reversed)
              cells
            cells
          ::
          ++  row
            %+  cook
              |=  raw=tape
              %+  turn  (split-row raw)
              |=  cell=tape
              :-  p=(lent cell)
              q=(scan (unescape-pipes (trim-cell cell)) contents:inline)
            raw-line
          ::
          ++  delimiter-cell
            %+  ifix  [(star (mask " \09")) (star (mask " \09"))]
            %+  cook
              |=  [left=? heps=tape right=?]
              :-  ;:(add (lent heps) ?:(left 1 0) ?:(right 1 0))
              ?:(right ?:(left %c %r) ?:(left %l %n))
            ;~  plug
              (cook |=(colon=tape .?(colon)) (stun [0 1] col))
              (stun [3 999.999.999] hep)
              (cook |=(colon=tape .?(colon)) (stun [0 1] col))
            ==
          ::
          ++  parse-delimiters
            |=  cells=(list tape)
            ^-  (unit (list [len=@ al=?(%c %r %l %n)]))
            ?~  cells  `~
            =/  parsed  (rust i.cells delimiter-cell)
            ?~  parsed  ~
            =/  rest  (parse-delimiters t.cells)
            ?~  rest  ~
            `[u.parsed u.rest]
          ::
          ++  delimiter-row
            %+  sear
              |=  raw=tape
              (parse-delimiters (split-row raw))
            raw-line
          ::
          ++  fit-row
            |=  [width=@ row=(list cell-t)]
            ^-  (list cell-t)
            ?:  =(0 width)  ~
            ?~  row
              :-  [0 ~]
              $(width (dec width))
            :-  i.row
            $(width (dec width), row t.row)
          --
      |*  =nail :: Make it a (redundant) gate so I can use `=>` to add a helper core
      %.  nail  :: apply the following parser
      %+  sear
        |=  [hdr=(list cell-t) del=(list [len=@ al=?(%c %r %l %n)]) bdy=(list (list cell-t))]
        ^-  (unit table:leaf:m)
        =/  column-count  (lent hdr)
        ?:  ?|  =(0 column-count)
                !=(column-count (lent del))
            ==
          ~
        =.  bdy  (turn bdy |=(body-row=(list cell-t) (fit-row column-count body-row)))
        =/  widths=(list @)  (turn del |=([len=@ al=*] len))
        =/  rows=(list (list cell-t))  (snoc bdy hdr)  :: since they're the same data type
        =/  computed-widths
          |-
          ?~  rows  widths
          %=  $
            rows    (tail rows)
            widths  =/  row=(list cell-t)  (head rows)
                    |-
                    ?~  row  ~
                    :-  (max (head widths) len:(head row))
                    %=  $
                      widths  (tail widths)
                      row     (tail row)
          ==        ==
        =/  result=table:leaf:m
          :*  %table
              computed-widths
              (turn hdr |=(cell=cell-t contents.cell))
              (turn del |=([len=@ al=?(%c %r %l %n)] al))
              (turn bdy |=(body-row=(list cell-t) (turn body-row |=(cell=cell-t contents.cell))))
          ==
        `result
      ;~  plug
        ;~(sfix row line-end)
        ;~(sfix delimiter-row line-end)
        (star ;~(sfix row line-end))
      ==
    --
  ::
  ++  container
    =+  |%
        ::
        ++  line                                 :: Read a line of plain text
          %+  cook  |=([a=tape b=tape] (weld a b))
          ;~  plug
            (star ;~(less line-end prn))
            (cook trip line-end)
          ==
        ::
        ++  blank-line-text
          %+  cook  snoc
          ;~(plug (star ace) newline)
        ::
        ++  line-with-blanks
          %+  cook  |=([a=tape b=tape c=tape] ;:(weld a b c))
          ;~  plug
            (star ;~(less line-end prn))
            (cook trip line-end)
            (star newline)
          ==
        ::
        ++  block-quote-marker
          ;~  plug           :: Single char '>'
            (stun [0 3] ace) :: Indented up to 3 spaces
            gar
            (stun [0 1] ace) :: Optionally followed by a space
          ==
        ::
        ++  block-quote-line
          %+  cook  snoc
          ;~  plug                 :: Single line...
            ;~  pfix  block-quote-marker           :: ...starting with ">..."
              (star ;~(less line-end prn))         :: can be empty
            ==
            line-end
          ==
        ::
        +$  ul-marker-t  [indent=@ char=@t len=@]
        ++  ul-marker
          %+  cook                               :: Compute the length of the whole thing
            |=  [prefix=tape bullet=@t suffix=tape]
            ^-  ul-marker-t
            :*  (lent prefix)
                bullet
                ;:(add 1 (lent prefix) (lent suffix))
            ==
          ;~  plug
            (stun [0 3] ace)
            ;~(pose hep lus tar)                 :: Bullet char
            ;~  pose
              (stun [1 4] ace)
              ;~(simu line-end (easy ""))
            ==
          ==
        ::
        ::  Produces a 4-tuple:
        ::  - bullet char (*, +, or -)
        ::  - indent level (number of spaces before the bullet)
        ::  - optional task-list state
        ::  - item contents (markdown)
        +$  ul-item-t  [char=@t indent=@ task=(unit ?) =markdown:m]
        ++  ul-item
          |*  =nail
          :: Get the marker and indent size
          =/  vex  (ul-marker nail)
          ?~  q.vex  vex  :: If no match found, fail
          =/  mrkr=ul-marker-t  p:(need q.vex)
          :: Read the rest of the list item block
          %.
            q:(need q.vex)
          %+  cook
            |=  [task=(unit ?) a=(list tape)]
            ^-  ul-item-t
            :*  char.mrkr
                indent.mrkr
                task
                =/  doc  (scan (zing a) markdown)
                ?:  ?&  ?=(^ doc)
                        ?=(~ t.doc)
                        ?=([%leaf %blank-line *] i.doc)
                    ==
                  ~
                doc
            ==
          ;~  plug
            %-  punt
            ;~(sfix tl-checkbox ace)
            line                                 :: First line
            %-  star
            ;~  pose
              ;~  pfix
                (stun [len.mrkr len.mrkr] ace)   :: Indented continuation
                line
              ==
              %+  cook
                |=  [blanks=(list tape) next=tape]
                (zing (weld blanks ~[next]))
              ;~  plug
                (plus blank-line-text)
                ;~(pfix (stun [len.mrkr len.mrkr] ace) line)
              ==
              lazy-line                          :: Lazy paragraph continuation
            ==
          ==
        ::
        +$  ol-marker-t  [indent=@ char=@t number=@ len=@]
        ++  ol-marker
          %+  cook                               :: Compute the length of the whole thing
            |=  [prefix=tape number=@ char=@t suffix=tape]
            ^-  ol-marker-t
            :*  (lent prefix)
                char
                number
                ;:(add 1 (lent (a-co:co number)) (lent prefix) (lent suffix))
            ==
          ;~  plug
            (stun [0 3] ace)
            %+  cook
              |=  digits=tape
              (scan digits dem)
            (stun [1 9] nud)
            ;~(pose dot par)                 :: Bullet char
            ;~  pose
              (stun [1 4] ace)
              ;~(simu line-end (easy ""))
            ==
          ==
        ::
        ::  Produces a 4-tuple:
        ::  - delimiter char: either dot '.' or par ')'
        ::  - list item number
        ::  - indent level (number of spaces before the number)
        ::  - item contents (markdown)
        +$  ol-item-t  [char=@t number=@ indent=@ =markdown:m]
        ++  ol-item
          |*  =nail
          ::^-  edge
          :: Get the marker and indent size
          =/  vex  (ol-marker nail)
          ?~  q.vex  vex  :: If no match found, fail
          =/  mrkr=ol-marker-t  p:(need q.vex)
          :: Read the rest of the list item block
          %.
            q:(need q.vex)
          %+  cook
            |=  [a=(list tape)]
            ^-  ol-item-t
            :*  char.mrkr
                number.mrkr
                indent.mrkr
                =/  doc  (scan (zing a) markdown)
                ?:  ?&  ?=(^ doc)
                        ?=(~ t.doc)
                        ?=([%leaf %blank-line *] i.doc)
                    ==
                  ~
                doc
            ==
          ;~  plug
            line                                 :: First line
            %-  star
            ;~  pose
              ;~  pfix
                (stun [len.mrkr len.mrkr] ace)   :: Indented continuation
                line
              ==
              %+  cook
                |=  [blanks=(list tape) next=tape]
                (zing (weld blanks ~[next]))
              ;~  plug
                (plus blank-line-text)
                ;~(pfix (stun [len.mrkr len.mrkr] ace) line)
              ==
              lazy-line                          :: Lazy paragraph continuation
            ==
          ==
        ::
        ++  tl-checkbox
          %+  ifix  [sel ser]
          ;~  pose
            (cold %.y (mask "xX"))
            (cold %.n ace)
          ==
        ::
        ++  lazy-line
          %+  cook  snoc
          ;~  less
            heading:leaf
            break:leaf
            codeblk-fenced:leaf
            block-quote-marker
            ul-marker
            ol-marker
            line-end
            ;~  plug
              (plus ;~(less line-end prn))
              line-end
            ==
          ==
        ::
        ::  Produces a 4-tuple:
        ::  - bullet char (*, +, or -)
        ::  - indent level (number of spaces before the bullet)
        ::  - is-checked
        ::  - item contents (markdown)
        +$  tl-item-t  [char=@t indent=@ is-checked=? =markdown:m]
        ++  tl-item
          |*  =nail
          :: Get the marker and indent size
          =/  vex  (;~(plug ul-marker ;~(sfix tl-checkbox ace)) nail)
          ?~  q.vex  vex  :: If no match found, fail
          =/  [mrkr=ul-marker-t is-checked=?]  p:(need q.vex)
          :: Read the rest of the list item block
          %.
            q:(need q.vex)
          %+  cook
            |=  [a=(list tape)]
            ^-  tl-item-t
            :*  char.mrkr
                indent.mrkr
                is-checked
                (scan (zing a) markdown)
            ==
          ;~  plug
            line-with-blanks                     :: Legacy task-list parser
            %-  star
            ;~  pose
              ;~  pfix
                (stun [len.mrkr len.mrkr] ace)
                line-with-blanks
              ==
              %+  cook
                |=  [blanks=(list tape) next=tape]
                (zing (weld blanks ~[next]))
              ;~  plug
                (plus blank-line-text)
                ;~(pfix (stun [len.mrkr len.mrkr] ace) line)
              ==
              lazy-line
            ==
          ==
        ::
        ++  add-task-checkbox
          |=  [task=(unit ?) doc=markdown:m]
          ^-  markdown:m
          ?~  task  doc
          |-
          ?~  doc  ~
          =/  node=node:markdown:m  i.doc
          ?:  ?=([%leaf %paragraph *] node)
            =/  para=paragraph:leaf:m  +.node
            :_  t.doc
            [%leaf %paragraph (weld ~[[%task-checkbox u.task]] contents.para)]
          [node $(doc t.doc)]
        ::
        ++  list-items
          |=  [item=markdown:m rest=(list [separated=? next=markdown:m])]
          ^-  (list markdown:m)
          ?~  rest  ~[item]
          =/  entry  i.rest
          =/  item
            ?:  separated.entry
              (snoc item [%leaf %blank-line ~])
            item
          :-  item
          (list-items next.entry t.rest)
        --
    |%
    ++  node
      %+  cook  |=(a=node:container:m a)
      ;~  pose
        block-quote
        ul
        ol
      ==
    ++  interrupting-node
      %+  cook  |=(a=node:container:m a)
      ;~  pose
        block-quote
        ul
        %+  sear
          |=  o=ol:container:m
          ^-  (unit ol:container:m)
          ?.  =(1 start-num.o)  ~
          `o
        ol
      ==
    ::
    ++  block-quote
      %+  cook  |=(a=block-quote:container:m a)
      %+  stag  %block-quote
      %+  cook  |=  a=(list tape)
                (scan (zing a) markdown)
      ;~  plug
        block-quote-line
        %-  star                                   :: At least one line
        ;~  pose
          block-quote-line
          %+  cook  zing
          %-  plus              :: Paragraph continuation (copied from `paragraph` above)
          ;~  less                     :: ...basically just text that doesn't matchZ anything else
            heading:leaf
            break:leaf
            :: ol
            :: ul
            block-quote-marker                   :: Can't start with ">"
            line-end                             :: Can't be blank
            %+  cook  snoc
            ;~  plug
              (star ;~(less line-end prn))
              line-end
            ==
          ==
        ==
      ==
    ::
    ++  ul
      |*  =nail
      :: Start by finding the type of the first bullet (indent level and bullet char)
      =/  vex  (ul-item nail)
      ?~  q.vex  vex  :: Fail if it doesn't match a list item
      =/  first-item=ul-item-t  p:(need q.vex)
      :: Check for more list items
      %.
        q:(need q.vex)
      %+  cook
        |=  rest=(list [separated=? item=markdown:m])
        ^-  ul:container:m
        :*  %ul
            indent.first-item
            char.first-item
            (list-items (add-task-checkbox task.first-item markdown.first-item) rest)
        ==
      %-  star
      ;~  pose
        %+  sear
          |=  [item=ul-item-t]
          ^-  (unit [separated=? item=markdown:m])
          ?.  =(char.item char.first-item)  ~
          `[%.n (add-task-checkbox task.item markdown.item)]
        ul-item
        ;~  pfix
          (plus blank-line-text)
          %+  sear
            |=  [item=ul-item-t]
            ^-  (unit [separated=? item=markdown:m])
            ?.  =(char.item char.first-item)  ~
            `[%.y (add-task-checkbox task.item markdown.item)]
          ul-item
        ==
      ==
    ::
    ++  ol
      |*  =nail
      :: Start by finding the first number, char, and indent level
      =/  vex  (ol-item nail)
      ?~  q.vex  vex  :: Fail if it doesn't match a list item
      =/  first-item=ol-item-t  p:(need q.vex)
      :: Check for more list items
      %.
        q:(need q.vex)
      %+  cook
        |=  rest=(list [separated=? item=markdown:m])
        ^-  ol:container:m
        :*  %ol
            indent.first-item
            char.first-item
            number.first-item
            (list-items markdown.first-item rest)
        ==
      %-  star
      ;~  pose
        %+  sear
          |=  [item=ol-item-t]
          ^-  (unit [separated=? item=markdown:m])
          ?.  =(char.item char.first-item)  ~
          `[%.n markdown.item]
        ol-item
        ;~  pfix
          (plus blank-line-text)
          %+  sear
            |=  [item=ol-item-t]
            ^-  (unit [separated=? item=markdown:m])
            ?.  =(char.item char.first-item)  ~
            `[%.y markdown.item]
          ol-item
        ==
      ==
    ::
    ++  tl
      |*  =nail
      :: Start by finding the type of the first bullet (indent level and bullet char)
      =/  vex  (tl-item nail)
      ?~  q.vex  vex  :: Fail if it doesn't match a list item
      =/  first-item=tl-item-t  p:(need q.vex)
      :: Check for more list items
      %.
        q:(need q.vex)
      %+  cook  |=(a=tl:container:m a)
      %+  stag  %tl
      ;~  plug                                     :: Give the first item, first
        (easy indent.first-item)
        (easy char.first-item)
        (easy [is-checked.first-item markdown.first-item])
        %-  star
          %+  sear                                 :: Reject items that don't have the same bullet char
            |=  [item=tl-item-t]
            ^-  (unit [is-checked=? markdown:m])
            ?.  =(char.item char.first-item)
              ~
            `[is-checked.item markdown.item]
          tl-item
      ==
    --
  ::
  ++  markdown
    %+  cook  |=(a=markdown:m a)
    %-  star  ;~  pose
      (stag %container node:container)
      (stag %leaf node:leaf)
    ==
  --
::
::  Enserialize (write out as text)
++  en
  =<  markdown
  |%
  ++  escape-chars
    |=  [text=@t chars=(list @t)]
    ^-  tape
    %+  rash  text
    %+  cook
      |=(a=(list tape) `tape`(zing a))
    %-  star  ;~  pose
      (cook |=(a=@t `tape`~['\\' a]) (mask chars))
      (cook trip prn)
    ==
  ::
  ++  ln
    |%
    ++  url
      =<  |=  [u=url:ln:m]
          ^-  tape
          ?:  has-triangle-brackets.u
            (with-triangles text.u)
          (without-triangles text.u)
      |%
      ++  with-triangles
        |=  [text=@t]
        ;:  weld
          "<"                    :: Put it inside triangle brackets
          (escape-chars text "<>") :: Escape triangle brackets in the text
          ">"
        ==
      ++  without-triangles
        |=  [text=@t]
        (escape-chars text "()")               :: Escape all parentheses '(' and ')'
      --
    ++  urlt
      |=  [u=urlt:ln:m]
      ^-  tape
      ?~  title-text.u      :: If there's no title text, then it's just an url
        (url url.u)
      ;:(weld (url url.u) " \"" (escape-chars (need title-text.u) "\"") "\"")
    ++  label
      |=  [text=@t]
      ^-  tape
      ;:(weld "[" (escape-chars text "[]") "]")
    ++  target
      |=  [t=target:ln:m]
      ^-  tape
      ?-  -.t
        %direct   ;:(weld "(" (urlt urlt.t) ")")          :: Wrap in parentheses
        ::
        %ref      ?-  type.t
                    %full       (label label.t)
                    %collapsed  "[]"
                    %shortcut   ""
                  ==
      ==
    --
  ::
  ++  inline
    |%
    ++  contents
      |=  [=contents:inline:m]
      ^-  tape
      (zing (turn contents element))
    ++  element
      |=  [e=element:inline:m]
      ?-  -.e
        %text  (text e)
        %link  (link e)
        %escape  (escape e)
        %entity  (entity e)
        %code-span  (code e)
        %strong  (strong e)
        %emphasis  (emphasis e)
        %strikethru  (strikethru e)
        %soft-line-break  (softbrk e)
        %line-break  (hardbrk e)
        %image  (image e)
        %autolink  (autolink e)
        %task-checkbox  (task-checkbox e)
        %html  (html e)
      ==
    ++  task-checkbox
      |=  [t=task-checkbox:inline:m]
      ^-  tape
      ;:(weld "[" ?:(is-checked.t "x" " ") "] ")
    ++  html
      |=  [h=html:inline:m]
      ^-  tape
      (trip text.h)
    ++  text
      |=  [t=text:inline:m]
      ^-  tape
      (trip text.t)                                     :: So easy!
    ::
    ++  entity
      |=  [e=entity:inline:m]
      ^-  tape
      ;:(weld "&" (trip code.e) ";")
    ::
    ++  link
      |=  [l=link:inline:m]
      ^-  tape
      ;:  weld
        "["
        (contents contents.l)
        "]"
        (target:ln target.l)
      ==
    ::
    ++  image
      |=  [i=image:inline:m]
      ^-  tape
      ;:  weld
        "!["
        (contents contents.i)
        "]"
        (target:ln target.i)
      ==
    ::
    ++  autolink
      |=  [a=autolink:inline:m]
      ^-  tape
      ;:  weld
        "<"
        (trip text.target.a)
        ">"
      ==
    ::
    ++  escape
      |=  [e=escape:inline:m]
      ^-  tape
      (snoc "\\" char.e)                 :: Could use `escape-chars` but why bother-- this is shorter
    ::
    ++  softbrk
      |=  [s=softbrk:inline:m]
      ^-  tape
      "\0a"
    ++  hardbrk
      |=  [h=hardbrk:inline:m]
      ^-  tape
      "\\\0a"
    ++  code
      |=  [c=code:inline:m]
      ^-  tape
      =/  content=tape  (trip text.c)
      =/  padded=tape
        ?~  content  content
        ?:  ?&  =(' ' i.content)
                =(' ' (rear content))
                (lien `tape`content |=(character=@tD !=(' ' character)))
            ==
          ;:(weld " " content " ")
        content
      ;:(weld (reap num-backticks.c '`') padded (reap num-backticks.c '`'))
    ::
    ++  strong
      |=  [s=strong:inline:m]
      ^-  tape
      ;:  weld
        (reap 2 emphasis-char.s)
        (contents contents.s)
        (reap 2 emphasis-char.s)
      ==
    ::
    ++  emphasis
      |=  [e=emphasis:inline:m]
      ^-  tape
      ;:  weld
        (trip emphasis-char.e)
        (contents contents.e)
        (trip emphasis-char.e)
      ==
    ::
    ++  strikethru
      |=  [s=strikethru:inline:m]
      ^-  tape
      ;:  weld
        (reap sig-count.s '~')
        (contents contents.s)
        (reap sig-count.s '~')
      ==
    --
  ::
  ++  leaf
    |%
    ++  node
      |=  [n=node:leaf:m]
      ?-  -.n
        %blank-line  (blank-line n)
        %break  (break n)
        %heading  (heading n)
        %indent-codeblock  (codeblk-indent n)
        %fenced-codeblock  (codeblk-fenced n)
        %html  (html n)
        %link-ref-definition  (link-ref-def n)
        %paragraph  (paragraph n)
        %table  (table n)
        :: ...etc
      ==

    ++  blank-line
      |=  [b=blank-line:leaf:m]
      ^-  tape
      "\0a"
    ::
    ++  break
      |=  [b=break:leaf:m]
      ^-  tape
      (weld (reap char-count.b char.b) "\0a")
    ::
    ++  heading
      |=  [h=heading:leaf:m]
      ^-  tape
      ?-  style.h
        %atx
          ;:(weld (reap level.h '#') " " (contents:inline contents.h) "\0a")
        %setext
          =/  line  (contents:inline contents.h)
          ;:(weld line "\0a" (reap (lent line) ?:(=(level.h 1) '-' '=')) "\0a")
      ==
    ::
    ++  codeblk-indent
      |=  [c=codeblk-indent:leaf:m]
      ^-  tape
      %+  rash  text.c
      %+  cook
        |=  [a=(list tape)]
        ^-  tape
        %-  zing  %+  turn  a  |=(t=tape (weld "    " t))
      %-  plus  %+  cook  snoc  ;~(plug (star ;~(less (just '\0a') prn)) (just '\0a'))
    ::
    ++  codeblk-fenced
      |=  [c=codeblk-fenced:leaf:m]
      ^-  tape
      ;:  weld
        (reap indent-level.c ' ')
        (reap char-count.c char.c)
        (trip info-string.c)
        "\0a"
        ^-  tape  %+  rash  text.c
        %+  cook  zing  %-  star                   :: Many lines
          %+  cook  |=  [a=tape newline=@t]        :: Prepend each line with "> "
                    ^-  tape
                    ;:  weld
                        ?~(a "" (reap indent-level.c ' '))   :: If the line is blank, no indent
                        a
                        "\0a"
                    ==
          ;~  plug                                 :: Break into lines
            (star ;~(less (just '\0a') prn))
            (just '\0a')
          ==
        (reap indent-level.c ' ')
        (reap char-count.c char.c)
        "\0a"
      ==
    ::
    ++  link-ref-def
      |=  [l=link-ref-def:leaf:m]
      ^-  tape
      ;:  weld
        "["
        (trip label.l)
        "]: "
        (urlt:ln urlt.l)
        "\0a"
      ==
    ::
    ++  html
      |=  [h=html:leaf:m]
      ^-  tape
      (trip text.h)
    ::
    ++  table
      =>  |%
          ++  escape-pipes
            |=  text=tape
            ^-  tape
            ?~  text  ~
            ?:  ?&  =('\\' i.text)
                    ?=(^ t.text)
                    =('|' i.t.text)
                ==
              :-  '\\'
              :-  '|'
              $(text t.t.text)
            ?:  =('|' i.text)
              :-  '\\'
              :-  '|'
              $(text t.text)
            :-  i.text
            $(text t.text)
          ++  cell
            |=  [width=@ c=contents:inline:m]
            ^-  tape
            =/  contents-txt  (escape-pipes (contents:inline c))
            =/  used-width  (add 1 (lent contents-txt))
            =/  padding
              ?:  (gth used-width width)  1
              (sub width used-width)
            ;:  weld
              " "
              contents-txt
              (reap padding ' ')
              "|"
            ==
          ++  row
            |=  [widths=(list @) cells=(list contents:inline:m)]
            ^-  tape
            ;:  weld
              "|"
              |-
                ^-  tape
                ?~  widths  ~
                %+  weld
                  (cell (head widths) (head cells))
                $(widths (tail widths), cells (tail cells))
              "\0a"
            ==
          ++  delimiter-row
            |=  [widths=(list @) align=(list ?(%l %c %r %n))]
            ^-  tape
            ;:  weld
              "|"
              |-
                ^-  tape
                ?~  align  ~
                ;:  weld
                  " "
                  ?-  (head align)
                    %l  (weld ":" (reap ;:(sub (head widths) 3) '-'))
                    %r  (weld (reap ;:(sub (head widths) 3) '-') ":")
                    %c  ;:(weld ":" (reap ;:(sub (head widths) 4) '-') ":")
                    %n  (reap ;:(sub (head widths) 2) '-')
                  ==
                  " |"
                  $(align (tail align), widths (tail widths))
                ==
              "\0a"
            ==
          --
      |=  [t=table:leaf:m]
      ^-  tape
      ;:  weld
        (row widths.t head.t)
        (delimiter-row widths.t align.t)
        =/  rows  rows.t
        |-
          ^-  tape
          ?~  rows  ~
          %+  weld  (row widths.t (head rows))  $(rows (tail rows))
      ==
    ::
    ++  paragraph
      |=  [p=paragraph:leaf:m]
      ^-  tape
      =/  rendered=tape  (contents:inline contents.p)
      ?:  ?&  ?=(^ rendered)
              =('\0a' (rear rendered))
          ==
        rendered
      (snoc rendered '\0a')
    --
  ::
  ++  container
    =>  |%
        ++  line
          %+  cook  snoc
          ;~  plug
            (star ;~(less (just '\0a') prn))
            (just '\0a')
          ==
        --
    |%
    ++  node
      |=  [n=node:container:m]
      ?-  -.n
        %block-quote  (block-quote n)
        %ul           (ul n)
        %ol           (ol n)
        %tl           (tl n)
      ==
    ::
    ++  block-quote
      |=  [b=block-quote:container:m]
      ^-  tape
      %+  scan  (markdown markdown.b)            :: First, render the contents
      %+  cook  zing  %-  plus                   :: Many lines
        %+  cook  |=  [a=tape newline=@t]        :: Prepend each line with "> "
                  ^-  tape
                  ;:  weld
                    ">"
                    ?~(a "" " ")                 :: If the line is blank, no trailing space
                    a
                    "\0a"
                  ==
        ;~  plug                                 :: Break into lines
          (star ;~(less (just '\0a') prn))
          (just '\0a')
        ==
    ::
    ++  ul
      |=  [u=ul:container:m]
      ^-  tape
      %-  zing  %+  turn  contents.u             :: Each bullet point...
        |=  [item=markdown:m]
        ^-  tape
        %+  scan  (markdown item)                   :: First, render bullet point contents
        %+  cook  zing
        ;~  plug
          %+  cook  |=  [a=tape]                 :: Prepend 1st line with indent + bullet char
                    ;:  weld
                      (reap indent-level.u ' ')
                      (trip marker-char.u)
                      " "
                      a
                    ==
            line  :: first line
          %-  star
            %+  cook  |=  [a=tape]               :: Subsequent lines just get indent
                      ?:  ?|  =("" a)
                              =("\0a" a)
                          ==
                        a
                      ;:  weld
                        (reap indent-level.u ' ')
                        "  "  :: 2 spaces, to make it even with the 1st line
                        a
                      ==
              line  :: second and thereafter lines
        ==
    ++  tl
      |=  [t=tl:container:m]
      ^-  tape
      %-  zing  %+  turn  contents.t             :: Each bullet point...
        |=  [is-checked=? item=markdown:m]
        ^-  tape
        %+  scan  (markdown item)                   :: First, render bullet point contents
        %+  cook  zing
        ;~  plug
          %+  cook  |=  [a=tape]                 :: Prepend 1st line with indent, bullet char, checkbox
                    ;:  weld
                      (reap indent-level.t ' ')
                      (trip marker-char.t)
                      " ["
                      ?:(is-checked "x" " ")
                      "] "
                      a
                    ==
            line  :: first line
          %-  star
            %+  cook  |=  [a=tape]               :: Subsequent lines just get indent
                      ?:  ?|  =("" a)
                              =("\0a" a)
                          ==
                        a
                      ;:  weld
                        (reap indent-level.t ' ')
                        "  "  :: 2 spaces, to make it even with the 1st line
                        a
                      ==
              line  :: second and thereafter lines
        ==
    ::
    ++  ol
      |=  [o=ol:container:m]
      ^-  tape
      %-  zing  %+  turn  contents.o             :: Each item...
        |=  [item=markdown:m]
        ^-  tape
        %+  scan  (markdown item)                   :: First, render item contents
        %+  cook  zing
        ;~  plug
          %+  cook  |=  [a=tape]                 :: Prepend 1st line with indent + item number
                    ;:  weld
                      (reap indent-level.o ' ')
                      (a-co:co start-num.o)
                      (trip marker-char.o)
                      " "
                      a
                    ==
            line  :: first line
          %-  star
            %+  cook  |=  [a=tape]               :: Subsequent lines just get indent
                      ?:  ?|  =("" a)
                              =("\0a" a)
                          ==
                        a
                      ;:  weld
                        (reap indent-level.o ' ')
                        (reap (lent (a-co:co start-num.o)) ' ')
                        "  "  :: 2 spaces, to make it even with the 1st line
                        a
                      ==
              line  :: second and thereafter lines
        ==
    --
  ::
  ++  markdown
    |=  [a=markdown:m]
    ^-  tape
    %-  zing  %+  turn  a   |=  [item=node:markdown:m]
                            ?-  -.item
                              %leaf  (node:leaf +.item)
                              %container  (node:container +.item)
                            ==
  --
  ::
  ::  Enserialize as Sail (manx and marl)
++  sail-en
  =<  |=  [document=markdown:m]
      =/  link-ref-defs  (all-link-ref-definitions document)
      ^-  manx
      ;div
        ;*  (~(markdown sail-en link-ref-defs) document)
      ==
  ::
  |_  [reference-links=(map @t urlt:ln:m)]
  ++  inline
    =>  |%
        :: Percent-encode bytes which cannot appear literally in an HTML URI.
        :: HTML escaping of safe '&' and '\'' characters is left to Sail.
        ++  escape-uri
          |=  source=tape
          ^-  tape
          ?~  source  ~
          ?:  (uri-safe i.source)
            [i.source $(source t.source)]
          :-  '%'
          :-  (hex-digit (rsh [0 4] i.source))
          :-  (hex-digit (end [0 4] i.source))
          $(source t.source)
        ++  uri-safe
          |=  character=char
          ^-  ?
          ?:  ?|  ?&  (gte character 'a')
                      (lte character 'z')
                  ==
                  ?&  (gte character 'A')
                      (lte character 'Z')
                  ==
                  ?&  (gte character '0')
                      (lte character '9')
                  ==
              ==
            %.y
          ?=(^ (find [character ~] "-_.+!*'(),%#@?=;:/&$~"))
        ++  hex-digit
          |=  digit=@
          ^-  char
          ?:  (lth digit 10)
            (add '0' digit)
          (add 'A' (sub digit 10))
        ++  resolve-target
          |=  [=target:ln:m]
          ^-  (unit urlt:ln:m)
          ?-  -.target
            %direct  `urlt.target
            %ref     (~(get by reference-links) (normalize-reference-label label.target))
          ==
        ++  get-direct-link  :: DUPE: get-direct-link
          |=  [=target:ln:m]
          ^-  urlt:ln:m
          (need (resolve-target target))
        --
    |%
    ++  contents
      |=  [=contents:inline:m]
      ^-  marl
      %-  zing
      %+  turn  contents
      |=  e=element:inline:m
      ^-  marl
      ?+  -.e     ~[(element e)]
        %link     (link-nodes e)
        %image    (image-nodes e)
      ==
    ++  element
      |=  [e=element:inline:m]
      ^-  manx
      ?-  -.e
        %text  (text e)
        %link  (link e)
        %code-span  (code e)
        %escape  (escape e)
        %entity  (entity e)
        %strong  (strong e)
        %emphasis  (emphasis e)
        %strikethru  (strikethru e)
        %soft-line-break  (softbrk e)
        %line-break  (hardbrk e)
        %image  (image e)
        %autolink  (autolink e)
        %task-checkbox  (task-checkbox e)
        %html  (html e)
      ==
    ++  task-checkbox
      |=  [t=task-checkbox:inline:m]
      ^-  manx
      ?:  is-checked.t
        ;input(type "checkbox", checked "true", disabled "disabled");
      ;input(type "checkbox", disabled "disabled");
    ++  html
      |=  [h=html:inline:m]
      ^-  manx
      =/  parsed  (de-xml:^html text.h)
      ?~  parsed
        (text [%text text.h])
      u.parsed
    ++  text
      |=  [t=text:inline:m]
      ^-  manx
      [[%$ [%$ (trip text.t)] ~] ~]  :: Magic; look up the structure of a `manx` if you want
    ++  escape
      |=  [e=escape:inline:m]
      ^-  manx
      [[%$ [%$ (trip char.e)] ~] ~]  :: Magic; look up the structure of a `manx` if you want
    ++  entity
      |=  [e=entity:inline:m]
      ^-  manx
      =/  fulltext  (crip ;:(weld "&" (trip code.e) ";"))
      [[%$ [%$ `tape`[fulltext ~]] ~] ~]             :: We do a little sneaky
    ++  softbrk
      |=  [s=softbrk:inline:m]
      ^-  manx
      (text [%text ' '])
    ++  hardbrk
      |=  [h=hardbrk:inline:m]
      ^-  manx
      ;br;
    ++  code
      |=  [c=code:inline:m]
      ^-  manx
      ;code: {(trip text.c)}
    ++  link
      |=  [l=link:inline:m]
      ^-  manx
      =/  =urlt:ln:m  (get-direct-link target.l)
      =/  href=tape  (escape-uri (trip text.url.urlt))
      ?~  title-text.urlt
        ;a(href href)
          ;*  (contents contents.l)
        ==
      ;a(href href, title (trip u.title-text.urlt))
        ;*  (contents contents.l)
      ==
    ++  link-nodes
      |=  [l=link:inline:m]
      ^-  marl
      ?^  (resolve-target target.l)  ~[(link l)]
      ?>  ?=([%ref *] target.l)
      =/  suffix=tape
        ?-  type.target.l
          %full       ;:(weld "][" (trip label.target.l) "]")
          %collapsed  "][]"
          %shortcut   "]"
        ==
      ;:  weld
        ~[(text [%text '['])]
        (contents contents.l)
        ~[(text [%text (crip suffix)])]
      ==
    ++  image
      |=  [i=image:inline:m]
      ^-  manx
      =/  =urlt:ln:m  (get-direct-link target.i)
      =/  alt-text  (plain-inline-text contents.i)
      =/  src=tape  (escape-uri (trip text.url.urlt))
      ?~  title-text.urlt
        ;img(src src, alt alt-text);
      ;img(src src, alt alt-text, title (trip u.title-text.urlt));
    ++  image-nodes
      |=  [i=image:inline:m]
      ^-  marl
      ?^  (resolve-target target.i)  ~[(image i)]
      ?>  ?=([%ref *] target.i)
      =/  suffix=tape
        ?-  type.target.i
          %full       ;:(weld "][" (trip label.target.i) "]")
          %collapsed  "][]"
          %shortcut   "]"
        ==
      ~[(text [%text (crip ;:(weld "![" (reference-label contents.i) suffix))])]
    ++  autolink
      |=  [a=autolink:inline:m]
      ^-  manx
      =/  link-text  (trip text.target.a)
      ?-  -.target.a
        %uri    ;a(href (escape-uri link-text)): {link-text}
        %email  ;a(href (escape-uri (weld "mailto:" link-text))): {link-text}
      ==
    ++  emphasis
      |=  [e=emphasis:inline:m]
      ^-  manx
      ;em
        ;*  (contents contents.e)
      ==
    ++  strong
      |=  [s=strong:inline:m]
      ^-  manx
      ;strong
        ;*  (contents contents.s)
      ==
    ++  strikethru
      |=  [s=strikethru:inline:m]
      ^-  manx
      ;del
        ;*  (contents contents.s)
      ==
    --
  ++  leaf
    |%
    ++  node
      |=  [n=node:leaf:m]
      ^-  manx
      ?-  -.n
        %blank-line  (blank-line n)
        %break  (break n)
        %heading  (heading n)
        %indent-codeblock  (codeblk-indent n)
        %fenced-codeblock  (codeblk-fenced n)
        %html  (html n)
        %table  (table n)
        %paragraph  (paragraph n)
        %link-ref-definition  (text:inline [%text ' '])  :: Link ref definitions don't render as anything
        :: ...etc
      ==
    ++  heading
      |=  [h=heading:leaf:m]
      ^-  manx
      :-
        :_  ~   ?+  level.h  !!                     :: Tag and attributes; attrs are empty (~)
                  %1  %h1
                  %2  %h2
                  %3  %h3
                  %4  %h4
                  %5  %h5
                  %6  %h6
                ==
      (contents:inline contents.h)
    ++  blank-line
      |=  [b=blank-line:leaf:m]
      ^-  manx
      (text:inline [%text ' '])
    ++  break
      |=  [b=break:leaf:m]
      ^-  manx
      ;hr;
    ++  codeblk-indent
      |=  [c=codeblk-indent:leaf:m]
      ^-  manx
      ;pre
        ;code: {(trip text.c)}
      ==
    ++  codeblk-fenced
      |=  [c=codeblk-fenced:leaf:m]
      ^-  manx
      =/  info  (trip info-string.c)
      =/  language  =/  space  (find " " info)
                     ?~(space info (scag u.space info))
      ;pre
        ;+  ?:  =(language "")
              ;code: {(trip text.c)}
            ;code(class (weld "language-" language)): {(trip text.c)}
      ==
    ++  html
      |=  [h=html:leaf:m]
      ^-  manx
      =/  wrapped  (crip ;:(weld "<div>" (trip text.h) "</div>"))
      =/  parsed  (de-xml:^html wrapped)
      ?~  parsed
        (text:inline [%text text.h])
      u.parsed
    ++  table
      |=  [t=table:leaf:m]
      ^-  manx
      ;table
        ;thead
          ;tr
            ;*  =/  hdr  head.t
                =/  align  align.t
                |-
                  ?~  hdr  ~
                  :-  ;th(align ?-((head align) %c "center", %r "right", %l "left", %n ""))
                        ;*  (contents:inline (head hdr))
                      ==
                  $(hdr (tail hdr), align (tail align))

          ==
        ==
        ;tbody
          ;*  %+  turn  rows.t
              |=  [r=(list contents:inline:m)]
              ^-  manx
              ;tr
                ;*  =/  row  r
                    =/  align  align.t
                    |-
                      ?~  row  ~
                      :-  ;td(align ?-((head align) %c "center", %r "right", %l "left", %n ""))
                            ;*  (contents:inline (head row))
                          ==
                      $(row (tail row), align (tail align))
              ==
        ==
      ==
    ++  paragraph
      |=  [p=paragraph:leaf:m]
      ^-  manx
      ;p
        ;*  (contents:inline contents.p)
      ==
    --
  ::
  ++  container
    |%
    ++  node
      |=  [n=node:container:m]
      ^-  manx
      ?-  -.n
        %block-quote  (block-quote n)
        %ul           (ul n)
        %ol           (ol n)
        %tl           (tl n)
      ==
    ::
    ++  block-quote
      |=  [b=block-quote:container:m]
      ^-  manx
      ;blockquote
        ;*  (~(. markdown reference-links) markdown.b)
      ==
    ::
    ++  ul
      |=  [u=ul:container:m]
      ^-  manx
      =/  tight  (is-tight contents.u)
      =/  has-tasks  (lien contents.u is-task-item)
      =/  items=marl
        %+  turn  contents.u
        |=  item=markdown:m
        ^-  manx
        =/  body=marl  (item-nodes tight item)
        ?:  (is-task-item item)
          ;li(class "task-list-item")
            ;*  body
          ==
        ;li
          ;*  body
        ==
      ?:  has-tasks
        ;ul(class "task-list")
          ;*  items
        ==
      ;ul
        ;*  items
      ==
    ::
    ++  ol
      |=  [o=ol:container:m]
      ^-  manx
      =/  tight  (is-tight contents.o)
      ;ol(start (a-co:co start-num.o))
        ;*  %+  turn  contents.o
            |=  item=markdown:m
            ^-  manx
            ;li
              ;*  (item-nodes tight item)
            ==
      ==
    ::
    ++  tl
      |=  [t=tl:container:m]
      ^-  manx
      ;ul.task-list
        ;*  %+  turn  contents.t
            |=  [is-checked=? a=markdown:m]
            ^-  manx
            ;li
              ;+  ?:  is-checked
                    ;input(type "checkbox", checked "true", disabled "disabled");
                  ;input(type "checkbox", disabled "disabled");
              ;*  (~(. markdown reference-links) a)
      ==    ==
    ::
    ++  is-tight
      |=  items=(list markdown:m)
      ^-  ?
      ?!  %+  lien  items
          |=  item=markdown:m
          (lien item |=(node=node:markdown:m ?=([%leaf %blank-line *] node)))
    ::
    ++  is-task-item
      |=  item=markdown:m
      ^-  ?
      ?~  item  %.n
      ?.  ?=([%leaf %paragraph *] i.item)  %.n
      =/  para=paragraph:leaf:m  +.i.item
      ?~  contents.para  %.n
      ?=(%task-checkbox -.i.contents.para)
    ::
    ++  item-nodes
      |=  [tight=? item=markdown:m]
      ^-  marl
      ?~  item  ~
      =/  node=node:markdown:m  i.item
      =/  rendered=marl
        ?:  ?&  tight
                ?=([%leaf %paragraph *] node)
            ==
          =/  para=paragraph:leaf:m  +.node
          (contents:inline contents.para)
        :_  ~
        ?-  -.node
          %leaf       (node:leaf +.node)
          %container  (node:container +.node)
        ==
      (weld rendered (item-nodes tight t.item))
    --
  ::
  ++  markdown
    |=  a=markdown:m
    ^-  marl
    %+  turn  a
    |=  item=node:markdown:m
    ?-  -.item
      %leaf       (node:leaf +.item)
      %container  (node:container +.item)
    ==
--  --
