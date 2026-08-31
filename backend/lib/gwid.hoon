/=  gwid  /gwid/mnemonyms
/*  english       %txt   /gwid/wordlists/english/txt
/*  hanzi         %txt   /gwid/wordlists/hanzi/txt
|%
+$  wrapper
  $:  input=[hex=@ux p=@p]
      english=output
      hanzi=output
      tweak=?
      width=@ud
  ==   
+$  nyms
  $:  english=output
      hanzi=output
  ==   
+$  output
  $:  nym=@t
      abridged=@t
      foreshortened=@t
  ==
++  b
  =/  tweak  .n
  =/  width  128
  :: =/  width  256
  =/  en-me  ~(. me:gwid [tweak width english])
  =/  zh-me  ~(. me:gwid [tweak width hanzi])
  |%
  ++  make 
  |=  user=@  ^-  nyms
    ::  encode:me  should equal this 
    =/  hex  `@ux`user
    =/  nyms
      :-  (decode:en-me hex)
          (decode:zh-me hex)

      =/  english=output
        :+  -.nyms  
            (abridge:en-me -.nyms)
            (foreshorten:en-me -.nyms)
      =/  hanzi=output
        :+  +.nyms  
            (abridge:zh-me +.nyms)
            (foreshorten:zh-me +.nyms)
      [english hanzi]
  ++  make-v
  |=  user=@  ^-  wrapper
    =/  nyms  (make user)
    =/  hex  `@ux`user
    =/  p  `@p`hex
    [[hex p] -.nyms +.nyms tweak width]
  ++  validate
    |=  nym=@t  ^-  ?
    (validate:en-me nym)
  ++  grow
    |=  nym=@t  ^-  (unit @t)
    (grow:en-me nym)
  ++  complete
    |=  [query=@t nyms=(list @t)]
    ^-  (unit @t)
    (complete:en-me query nyms)
  ++  to-p
    |=  nym=@t
    ^-  (unit @p)
    =/  val  (validate nym)
    ~&  >>>  val=val  ?.  val  ~
    :: ?.  (validate nym)  ~
    =/  hex  (encode:en-me nym)
    %-  some  `@p`hex
  --
--
