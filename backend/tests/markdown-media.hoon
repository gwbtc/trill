:: Parser -> Trill content -> exported Markdown -> Trill content regression.
:: Failure cases: images downgraded to links, lost media during export,
:: empty-alt and encoded/query URLs, reference images, images nested in
:: formatting/quotes/lists, literal code/escapes mistaken for media, and new
:: HTML/task-checkbox nodes crashing the adapter.
/-  tp=trill-post
/+  post=trill-post
=>
|%
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
++  images
  |=  cl=content-list:tp
  ^-  (list @t)
  %-  zing
  %+  turn  cl
  |=  b=block:tp
  ^-  (list @t)
  ?:(?=([%media %images *] b) p.media.b ~)
++  check-images
  |=  [what=@t input=@t expected=(list @t)]
  ^-  tang
  =/  parsed  (tokenise:post input)
  ?:  ?=(%| -.parsed)  (check what %.n)
  =/  cl=content-list:tp  p.parsed
  =/  exported  (crip (content-list-to-md:post cl))
  =/  reparsed  (tokenise:post exported)
  ?:  ?=(%| -.reparsed)  (check what %.n)
  ;:  weld
    (check what =(expected (images cl)))
    (check what =(expected (images p.reparsed)))
  ==
--
|%
++  test-media-round-trips
  ^-  tang
  ;:  weld
    (check-images 'empty-alt' '![](https://example.test/image.png)' ~['https://example.test/image.png'])
    (check-images 'caption and encoded URL' 'Caption\0a\0a![](https://example.test/photo%20%231.png?x=1&y=2)' ~['https://example.test/photo%20%231.png?x=1&y=2'])
    (check-images 'multiple images' '![one](https://example.test/one.png) ![two](https://example.test/two.png)' ~['https://example.test/one.png' 'https://example.test/two.png'])
    (check-images 'reference image' '![Photo][Pic]\0a\0a[pic]: https://example.test/ref.png' ~['https://example.test/ref.png'])
    (check-images 'formatted image' '**![Photo](https://example.test/bold.png)**' ~['https://example.test/bold.png'])
    (check-images 'quoted image' '> ![Photo](https://example.test/quote.png)' ~['https://example.test/quote.png'])
    (check-images 'list image' '- ![Photo](https://example.test/list.png)' ~['https://example.test/list.png'])
    (check-images 'unresolved image' '![Photo][missing]' ~)
    (check-images 'ordinary link' '[Photo](https://example.test/link.png)' ~)
    (check-images 'literal code' '`![](https://example.test/code.png)`' ~)
    (check-images 'escaped image' '\\![](https://example.test/escape.png)' ~)
  ==
++  test-new-parser-nodes
  ^-  tang
  =/  html  (tokenise:post '<span>hello</span>')
  =/  tasks  (tokenise:post '- [x] done')
  ;:  weld
    (check 'HTML is literal text' ?=(%& -.html))
    (check 'task checkbox' ?=(%& -.tasks))
  ==
--
