::  json-wallet: %trill-wallet's pokes as json, from our own UI
::
::    {"add-mint": {"url": "https://..."}}
::    {"del-mint": {"url": "https://..."}}
::    {"deposit": {"mint": "https://...", "amount": 100}}
::    {"withdraw": {"mint": "https://...", "invoice": "lnbc..."}}
::    {"send": {"mint": "https://...", "amount": 21, "memo": "thanks" | null}}
::    {"receive": {"token": "cashuB..."}}
::    {"check": {"mint": "https://..."}}
::    {"restore": {"mint": "https://..."}}
::    {"sync": {"on": true}}
::    {"set-phrase": {"words": "twelve words ..."}}
::    {"nwc-connect": {"uri": "nostr+walletconnect://..."}}
::    {"nwc-disconnect": null}
::    {"nwc-pay": {"invoice": "lnbc..."}}
::    {"nwc-invoice": {"amount": 21, "description": ""}}
::    {"nwc-refresh": null}
::    {"zap": {"to": "<hex pubkey>", "amount": 21, "comment": "",
::             "about": {"id": "<hex event id>", "kind": 1} | null}}
::
::    what %nostrill sends it (%signed, %nostr-event, %nostr-eose) has no
::    json: those come as nouns
::
/-  sur=wallet
|%
++  de
  =,  dejs:format
  |%
  ++  action
    |=  j=json
    ^-  action:sur
    %.  j
    %-  of
    :~  add-mint+(ot ~[url+so])
        del-mint+(ot ~[url+so])
        deposit+(ot ~[mint+so amount+ni])
        withdraw+(ot ~[mint+so invoice+so])
        send+(ot ~[mint+so amount+ni memo+(mu so)])
        receive+(ot ~[token+so])
        check+(ot ~[mint+so])
        restore+(ot ~[mint+so])
        sync+(ot ~[on+bo])
        set-phrase+(ot ~[words+so])
        nwc-connect+(ot ~[uri+so])
        nwc-disconnect+ul
        nwc-pay+(ot ~[invoice+so])
        nwc-invoice+(ot ~[amount+ni description+so])
        nwc-refresh+ul
        :-  %zap
        %-  ot
        :~  to+(su hex)
            amount+ni
            comment+so
            about+(mu (ot ~[id+(su hex) kind+ni]))
        ==
    ==
  --
--
