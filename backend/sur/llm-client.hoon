|%
++  provider
  ?(%openai %openrouter)
::
++  request-args
  $:  api-key=@t
      model=@t
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
++  action
  $%  [%set-key =provider api-key=@t]
      [%list-models request-id=@tas =provider]
      $:  %call
          request-id=@tas
          =provider
          model=@t
          input=@t
          max-output-tokens=(unit @ud)
      ==
  ==
--
