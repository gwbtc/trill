|%
::  +provider: an endpoint speaking the Responses API, e.g.
::  https://api.openai.com/v1, and our key for it ('' for none, as
::  with a local server). we append /responses and /models
::
++  provider
  $:  base-url=@t
      api-key=@t
  ==
::  +suggestions: base urls offered when adding a provider; any other
::  works as well
::
++  suggestions
  ^-  (list [name=@tas base-url=@t])
  :~  [%openai 'https://api.openai.com/v1']
      [%openrouter 'https://openrouter.ai/api/v1']
  ==
::
++  request-args
  $:  model=@t
      input=@t
      max-output-tokens=(unit @ud)
  ==
::
++  response
  $%  [%ok =response-header:http body=@t value=json]
      [%error =response-header:http body=@t value=(unit json)]
      [%invalid-json =response-header:http body=@t]
  ==
::
++  outcome
  $%  [%response response]
      [%transport-error reason=@tas]
  ==
::
::  +action: pokes from our own ship, %json from the UI or %noun
::
++  action
  $%  ::  add a provider, or change one. api-key ~: keep the one we have
      $:  %set-provider
          name=@tas
          base-url=@t
          api-key=(unit @t)
      ==
      [%del-provider name=@tas]
      [%list-models request-id=@tas provider=@tas]
      $:  %call
          request-id=@tas
          provider=@tas
          model=@t
          input=@t
          max-output-tokens=(unit @ud)
      ==
  ==
--
