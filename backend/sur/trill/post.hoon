/-  gate=trill-gate
|%
+$  id  @da
+$  pid  [=ship =id]
::  +user: an identity on either network
::
+$  user  $%([%urbit p=@p] [%nostr p=@ux])
+$  upid  [=user =id]
:: anon post type?
+$  tag  @t
+$  post
  $:  =id
      host=ship
      author=ship
      thread=id
      parent=(unit id)
      children=(set id)
      contents=content-map
      =perms
      =engagement
      =hash  ::  We'll reuse this for the Nostr pubkey
      =signature
      tags=(set tag) ::TODO  make sure it's not infinite
  ==
+$  sent-post
  $:  host=ship
      author=ship
      thread=(unit id)
      parent=(unit id)
      contents=content-list
      =perms
      tags=(set tag) 
  ==
+$  full-node
  $:  =id
      host=ship
      author=ship
      thread=id
      parent=(unit id)
      children=internal-graph
      contents=content-map
      =perms
      =engagement
      =hash
      =signature
      tags=(set tag) 
  ==

+$  perms  [read=gate:gate write=gate:gate]
  
::  recursive types crash
+$  internal-graph
  $~  [%empty ~]
  $%  [%full p=full-graph] 
      [%empty ~]
  ==
+$  full-graph  ((mop id full-node) gth)
++  form  ((on id full-node) gth)
::  from post:graph-store
::  +sham (half sha-256) hash of +validated-portion
+$  hash  @uvH
::
+$  signature   [p=@uvH q=ship r=life]
+$  engagement
  $:
    =reacts
    quoted=(set signed-pid)
    shared=(set signed-pid)
  ==
+$  signed-pid  [=signature =pid]
+$  react  @t
+$  reacts  (map ship signed-react-2)
+$  signed-react  [=pid author=ship =react =signature]
+$  signed-react-2  [p=react q=signature]


+$  content-map  ((mop time content-list) gth)
++  corm  ((on time content-list) gth)
:: +$  content-list  contents:contents-1
+$  content-list  contents
+$  li     content-list
+$  contents  (list block)
+$  paragraph  (list inline)
+$  heading  $?(%h1 %h2 %h3 %h4 %h5 %h6)  
+$  block
  $%  [%paragraph p=(list inline)]
      [%blockquote p=(list inline)]
      [%table rows=(list (list contents))]
      [%heading p=cord q=heading]
      [%list p=(list inline) ordered=?]
      [%media =media]
      [%codeblock code=cord lang=cord]
      [%eval hoon=cord]
      ::
      [%ref type=term =ship =path]
      ::
      [%json origin=term content=@t]
      :: TODO get rid of this. should be a ref
      [%poll id=@da]
  ==
+$  poll-opt  [option=cord votes=@]
+$  media
  $%  [%images p=(list cord)]
      [%video p=cord]
      [%audio p=cord]
  ==
+$  inline
  $%  [%text p=cord]
      [%italic p=cord]
      [%bold p=cord]
      [%strike p=cord]
      [%codespan p=cord]
      [%link href=cord show=cord]
      [%break ~]
      :: not strictly markdown
      [%underline p=cord]
      [%sup p=cord]
      [%sub p=cord]
      [%ruby p=cord q=cord]
      :: custom types
      [%ship p=ship]
      :: TODO
      :: [%date p=@da]
  ==
--
