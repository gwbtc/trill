/-  tp=trill-post
|%
::  generic type wrappers
::  A Result type of sorts.
++  deferred
  |$  t
  $:  msg=@t
  $=  p
  $@  %thinking
      [%done (approval t)]
  ==
++  approval
  |$  t
  $@  %ng
      [%ok data=t]
::  +enbowl adds bowl information (source, timestamp) to a type
::  Useful to pass around data received on pokes on different context,
:: helps avoid defining duplicate types for essentially the same data
++  enbowl
  |$  t
  $:  =user
      ts=@da
      p=t
  ==
+$  user  user:tp
--
