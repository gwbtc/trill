::  OpenAI's audio endpoints, at any provider's base url: speech from
::  text (/audio/speech), and text from speech, in its own language
::  (/audio/transcriptions) or in english (/audio/translations)
::
/-  sur=ai-client
/+  rl=llm-responses
|%
::  +problem: why the API would refuse these, if it would
::
++  speech-problem
  |=  a=speech-args:sur
  ^-  (unit @t)
  ?:  =('' model.a)  `'no model'
  ?:  =('' input.a)  `'nothing to say'
  ?:  (gth (lent (tuba (trip input.a))) 4.096)  `'at most 4096 characters'
  ?:  ?&  ?=(^ instructions.a)
          (gth (lent (tuba (trip u.instructions.a))) 4.096)
      ==
    `'instructions: at most 4096 characters'
  ?:  ?&  ?=(^ speed.a)
          |((lth:rd u.speed.a .~0.25) (gth:rd u.speed.a .~4))
      ==
    `'speed: from 0.25 to 4'
  ~
::
++  file-problem
  |=  [model=@t file=audio-file:sur]
  ^-  (unit @t)
  ?:  =('' model)  `'no model'
  ?:  =(0 p.data.file)  `'no audio'
  ?:  =('' name.file)  `'the file needs a name, with its extension'
  ~
::
++  build-speech
  |=  [p=provider:sur a=speech-args:sur]
  ^-  request:http
  =,  enjs:format
  =/  fields=(list [@t json])
    :~  model+s+model.a
        input+s+input.a
    ==
  =?  fields  ?=(^ voice.a)
    :_  fields
    :-  'voice'
    ?@(u.voice.a s+u.voice.a (pairs ~[id+s+id.u.voice.a]))
  =?  fields  ?=(^ instructions.a)  [instructions+s+u.instructions.a fields]
  =?  fields  ?=(^ format.a)  [['response_format' s+u.format.a] fields]
  =?  fields  ?=(^ speed.a)  [speed+(real u.speed.a) fields]
  =/  body=@t  (en:json:html (pairs fields))
  :*  %'POST'
      (endpoint:rl p 'audio/speech')
      (weld (auth:rl p) ~[['Content-Type' 'application/json']])
      `(as-octs:mimes:html body)
  ==
::
++  build-transcription
  |=  [p=provider:sur a=transcription-args:sur]
  ^-  request:http
  ::  each part typed on its own: ;: weld over them fuse-loops
  =/  fields=(list [@t @t])  ~[['model' model.a]]
  =?  fields  ?=(^ language.a)  (snoc fields ['language' u.language.a])
  =?  fields  ?=(^ prompt.a)  (snoc fields ['prompt' u.prompt.a])
  =?  fields  ?=(^ format.a)
    (snoc fields ['response_format' (wire-format u.format.a)])
  =?  fields  ?=(^ temperature.a)
    (snoc fields ['temperature' (real-text u.temperature.a)])
  =/  grains=(list [@t @t])
    %+  turn  granularities.a
    |=(g=?(%word %segment) [`@t`'timestamp_granularities[]' `@t`g])
  (upload p 'audio/transcriptions' (weld fields grains) file.a)
::
++  build-translation
  |=  [p=provider:sur a=translation-args:sur]
  ^-  request:http
  =/  fields=(list [@t @t])  ~[['model' model.a]]
  =?  fields  ?=(^ prompt.a)  (snoc fields ['prompt' u.prompt.a])
  =?  fields  ?=(^ format.a)
    (snoc fields ['response_format' (wire-format u.format.a)])
  =?  fields  ?=(^ temperature.a)
    (snoc fields ['temperature' (real-text u.temperature.a)])
  (upload p 'audio/translations' fields file.a)
::  +wire-format: %verbose-json is 'verbose_json' to the API
::
++  wire-format
  |=  f=text-format:sur
  ^-  @t
  (rep 3 (turn (rip 3 f) |=(c=@ ?:(=('-' c) '_' c))))
::  +real-text: '.~0.25' is how @rd prints; untyped, so it fits both
::  a cord and a json number
::
++  real-text  |=(r=@rd (rsh [3 2] (scot %rd r)))
++  real  |=(r=@rd `json`n+(real-text r))
::  +upload: a multipart/form-data POST of the fields and the file
::
++  upload
  |=  [p=provider:sur path=@t fields=(list [@t @t]) file=audio-file:sur]
  ^-  request:http
  =/  b  (boundary fields file)
  :*  %'POST'
      (endpoint:rl p path)
      %+  weld  (auth:rl p)
      ~[['Content-Type' (rap 3 ~['multipart/form-data; boundary=' b])]]
      `(multipart b fields file)
  ==
::  +boundary: from the content, so the same request is the same bytes
::  (and the cache knows it: see +cache-key in app/trill-ai-client.hoon)
::
++  boundary
  |=  [fields=(list [@t @t]) file=audio-file:sur]
  ^-  @t
  (cat 3 'trill-' (crip ((x-co:co 32) (end [3 16] (sham [fields file])))))
::  +multipart: the body, byte for byte: the file may hold anything
::
++  multipart
  |=  [b=@t fields=(list [@t @t]) file=audio-file:sur]
  ^-  octs
  =/  crlf  '\0d\0a'
  ::  typed apart: welding a turn onto a literal list fuse-loops
  =/  field-parts=(list octs)
    %+  turn  fields
    |=  [name=@t value=@t]
    ^-  octs
    %-  as-octs:mimes:html
    %+  rap  3
    :~  '--'  b  crlf
        'Content-Disposition: form-data; name="'  name  '"'  crlf
        crlf
        value  crlf
    ==
  =/  file-parts=(list octs)
    :~  %-  as-octs:mimes:html
        %+  rap  3
        :~  '--'  b  crlf
            'Content-Disposition: form-data; name="file"; filename="'
            name.file  '"'  crlf
            'Content-Type: '  type.file  crlf
            crlf
        ==
        data.file
        (as-octs:mimes:html (rap 3 ~[crlf '--' b '--' crlf]))
    ==
  =/  parts=(list octs)  (weld field-parts file-parts)
  :-  (roll parts |=([o=octs n=@ud] (add n p.o)))
  (can 3 parts)
--
