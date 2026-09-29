|%
::  +provider: an endpoint speaking the Responses API, e.g.
::  https://api.openai.com/v1, and our key for it ('' for none, as
::  with a local server). we append /responses and /models.
::  evaluations (Jev, see +question) go to eval-url, or
::  <base-url>/systemone without one
::
++  provider
  $:  base-url=@t
      eval-url=(unit @t)
      api-key=@t
  ==
::  +suggestions: providers offered when adding one; any other works
::  as well
::
++  suggestions
  ^-  (list [name=@tas base-url=@t eval-url=(unit @t)])
  :~  [%openai 'https://api.openai.com/v1' ~]
      [%openrouter 'https://openrouter.ai/api/v1' `'https://openrouter.ai/api/alpha/decisions']
      [%typesafe 'https://api.typesafe.ai/v1' ~]
  ==
::
++  request-args
  $:  model=@t
      input=@t
      max-output-tokens=(unit @ud)
  ==
::
::  evaluations (TypeSafe's Jev models): typed questions about some
::  content, typed answers back. instructions and criteria are free
::  json: a string, or objects and arrays holding data they refer to
::
++  question
  $%  ::  yes or no; what a yes and a no mean, optionally
      [%noul instructions=json yes=(unit json) no=(unit json)]
      ::  one of the options (at most 255), each described or not
      [%choice instructions=json options=(map @t (unit json))]
      ::  a rating along 2 to 10 ordered levels
      [%score instructions=json levels=(list json)]
  ==
::
++  evaluate-args
  $:  model=@t                                ::  e.g. 'jev-latest'
      subject=json                            ::  the API's "state"
      questions=(map @t question)             ::  ids of our choosing
  ==
::
++  answer
  $%  [%noul p=@rd]                           ::  0 no, 1 yes
      $:  %choice
          choice=@t
          probabilities=(map @t @rd)
          confidence=@rd
      ==
      $:  %score
          score=@rd                           ::  can land between levels
          legend=(map @t @t)                  ::  level index to level
          probabilities=(map @t @rd)
          confidence=@rd
      ==
  ==
::
++  evaluation
  $:  model=@t
      answers=(map @t answer)
      input-tokens=@ud
      output-tokens=@ud
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
          eval-url=(unit @t)
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
      [%evaluate request-id=@tas provider=@tas args=evaluate-args]
  ==
--
