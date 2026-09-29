# The Trill wallet

Trill has a bitcoin wallet built into the ship. It holds two kinds of money:

- **Cashu ecash.** Bearer tokens issued by a Cashu mint and backed by the
  mint's bitcoin. The ship holds the tokens itself. Ecash moves instantly and
  privately, and it can be sent as a string, over Lightning, or as a
  **nutzap** on Nostr. The wallet follows the Nostr ecash standards (NIP-60 and
  NIP-61), so the same wallet opens in other Nostr clients.
- **Lightning, through Nostr Wallet Connect (NWC).** A Lightning wallet the
  user already has (Alby Hub, coinos, …), driven from Trill over NIP-47. Trill
  doesn't hold these funds. It asks the user's wallet to pay and to make
  invoices.

The two are shown side by side. The balance card shows the total, split into
Lightning and ecash, and one Activity list covers both.

All of it runs in one Gall agent, `%trill-wallet`, on the user's own ship. The
browser is only a view of it. Nothing about the wallet lives on a server.


## Contents

1. [What it does](#what-it-does)
2. [How it works](#how-it-works)
   - [Ecash in one page](#ecash-in-one-page)
   - [The agent](#the-agent)
   - [Operations](#operations)
   - [The seed phrase and restoring](#the-seed-phrase-and-restoring)
   - [Nostr: NIP-60 backup](#nostr-nip-60-backup)
   - [Nostr: NIP-61 nutzaps](#nostr-nip-61-nutzaps)
   - [Lightning: Nostr Wallet Connect](#lightning-nostr-wallet-connect)
   - [Keeping secrets](#keeping-secrets)
   - [The UI](#the-ui)
3. [Code map](#code-map)
4. [Interfaces](#interfaces)
5. [Testing](#testing)
6. [What's missing, and what could be better](#whats-missing-and-what-could-be-better)
7. [Specifications](#specifications)
8. [Appendix: fast point multiplication via the ECDSA recovery jet](#appendix-fast-secp256k1-point-multiplication-in-hoon-via-the-ecdsa-recovery-jet)


## What it does

**Ecash (Cashu)**

- **Mints:** add a mint by its URL. Its keysets are fetched and each keyset
  id is checked against the keys it names. A mint the wallet holds nothing at
  can be removed.
- **Deposit over Lightning:** ask a mint for an invoice, pay it from any
  Lightning wallet, and the ecash is minted once the mint sees the payment.
- **Pay a Lightning invoice** with ecash (a "melt"). The mint pays it and
  returns change.
- **Send a token:** make a `cashuB…` token for an amount, to copy or show as
  a QR code. The recipient swaps it for their own ecash.
- **Receive a token:** paste a `cashuA…` or `cashuB…` token. It's swapped at
  its mint, so the sender can't spend it again.
- **Check:** ask a mint which of the wallet's proofs are already spent, and
  drop those.
- **Restore from the seed phrase:** ask a mint to sign again everything this
  seed ever made, then keep what isn't spent. This also runs by itself when a
  mint is added.
- **Seed phrase:** 12 BIP-39 words, created on first run. Another phrase can
  be imported while the wallet is empty.

**Nostr**

- **Backup (NIP-60):** the wallet's ecash is mirrored to the user's relays,
  encrypted to their Nostr key, as the standard NIP-60 events. Other NIP-60
  wallets can open it. On by default, and it can be turned off.
- **Receiving nutzaps (NIP-61):** the wallet announces where and how it takes
  nutzaps (kind 10019), watches the relays for nutzaps to the user (kind 9321)
  and redeems them automatically.
- **Sending nutzaps:** the zap button on a post sends ecash to the post's
  author as a nutzap, tagged with the post if it's a Nostr event.

**Lightning (NWC)**

- **Connect** a wallet by pasting its `nostr+walletconnect://` string.
- **See its balance,** refreshed after every payment and on demand.
- **Pay invoices** from it.
- **Receive:** have it make an invoice, show it as a QR code, and see it
  arrive.

**Everywhere**

- **One history (Activity)** of deposits, payments, tokens made and received,
  and nutzaps in and out, with fees.
- **Notifications:** what finishes in the background (a deposit minted, a
  nutzap redeemed, anything that failed) appears as a toast wherever the user
  is in the app.
- **Hide balance:** amounts are blurred until tapped.


## How it works

### Ecash in one page

A Cashu mint signs secrets blindly, so it can't link what it signs to what it
later redeems.

1. **Blinding.** The wallet picks a secret, hashes it to a curve point `Y`,
   and blinds it: `B_ = Y + r·G` for a random `r`. It sends `B_` with an
   amount.
2. **Signing.** The mint signs with its private key for that amount:
   `C_ = k·B_`. It also sends a DLEQ proof that it used the key it advertises
   (NUT-12).
3. **Unblinding.** The wallet computes `C = C_ − r·K`. The pair
   `(secret, C)` is a **proof**: ecash worth that amount. Only the holder of
   the secret can spend it.
4. **Spending** a proof means handing it to the mint in a request: a
   **swap** for new outputs (NUT-03), a **melt** to pay an invoice (NUT-05), or
   a **mint** of fresh ecash after a Lightning deposit (NUT-04). The mint
   records the secret as spent.

Amounts come in powers of two, one mint key per amount. A mint groups its keys
in **keysets**, and spending can cost a small **fee** per proof (NUT-02, in
parts per thousand, rounded up per request).

A **token** is proofs packed into a string for someone else: `cashuA` is JSON,
`cashuB` is CBOR (NUT-00). Whoever holds the string can spend it until the
recipient swaps it.

All the cryptography is in `lib/cashu.hoon`. Point multiplication would be
slow in plain Hoon, so it goes through a jetted ECDSA function; see the
[appendix](#appendix-fast-secp256k1-point-multiplication-in-hoon-via-the-ecdsa-recovery-jet).

### The agent

```
 browser (ui/)                        %trill-wallet                      outside
 ─────────────                        ─────────────                      ───────
 Wallet page ──json pokes──────────▶  act ──────iris HTTP────────────▶  Cashu mints
             ◀──/ui watch (json)────  ui    ◀────────────────────────
                                       │
                                       ├──%sign / %watch pokes──▶ %nostrill ──▶ your relays
                                       │  ◀──%signed / %nostr-event──           (NIP-60, NIP-61)
                                       │
                                       └──its own websocket──────────────────▶  NWC relay
                                                                                 (wallet service)
```

- **Mints** are called over HTTP through Iris. Each request's wire names the
  operation it belongs to.
- **Nostr relays** go through %nostrill. It holds the user's Nostr key and
  their relay connections. The wallet drafts events, and %nostrill encrypts,
  signs and publishes them, then pokes back their ids. The wallet also asks
  %nostrill to watch the relays for it and to forward what it finds.
- **The NWC relay** is a websocket the wallet opens itself. That relay is
  usually not one of the user's social relays, and the connection has its own
  key rather than the user's Nostr key.
- **The browser** subscribes to `/ui` and gets the whole wallet as JSON, then
  again after anything changes. Actions are JSON pokes.

The ship is always the source of truth. What's on relays is a mirror of it.

### Operations

Anything that takes more than one request to a mint is an **operation**
(`op` in `sur/wallet.hoon`), kept in the agent's state step by step. Its
inputs and outputs are saved before the request that uses them goes out. So
if something goes wrong halfway, the wallet knows exactly what it was doing.

| Operation | NUTs | Steps |
|---|---|---|
| `add-mint` | 01, 02 | fetch `/v1/keysets`, then each keyset's keys; check every keyset id |
| `deposit` | 04 | mint quote (a Lightning invoice), poll every 3 s until paid, mint on blinded outputs |
| `receive` | 03, 12 | check the token's DLEQs, swap its proofs for ours |
| `send` | 03 | pick proofs; if they add up exactly, they're the token as they are, with no fee; else swap into the amount plus change |
| `withdraw` | 05, 08 | melt quote, then melt with the proofs and blank outputs for the change; poll if pending |
| `check` | 07 | ask the state of our proofs, 100 at a time; drop the spent |
| `restore` | 09, 13 | per keyset, from counter 0, 25 outputs at a time, until 3 empty batches in a row; then a check |
| `zap` | 11 | fetch the recipient's 10019, swap into proofs locked to their key, publish a 9321 |

Proofs being spent are taken out of the wallet while the request is out. If
the mint refuses, and not because they're already spent, they come back.

### The seed phrase and restoring

The wallet's secrets aren't random. They come from a BIP-39 seed phrase by the
NUT-13 derivation, with a counter per keyset. So the phrase alone can recover
all ecash that hasn't been spent, from every mint the wallet used:

1. The wallet re-derives the blinded outputs it would have made at counters 0,
   1, 2… and asks the mint whether it signed them (NUT-09).
2. The mint returns the signatures it has, and the wallet rebuilds the proofs.
3. A state check drops the ones already spent.

Adding a mint runs a restore automatically whenever the seed has never been
used there. That covers importing a phrase, and a wallet rebuilt from scratch.
It also moves the counters past what the mint already signed. Without that,
the wallet would reuse outputs the mint has seen before, and the mint would
answer "Duplicate outputs".

The phrase also gives the wallet's **P2PK key** for nutzaps (NUT-13's
`m/129373'/10'/0'/0'/0`).

### Nostr: NIP-60 backup

While sync is on, the wallet mirrors itself to the user's relays:

- **kind 17375**, the wallet event: the P2PK key and the mint list, encrypted.
  Published when the mints change.
- **kind 7375**, token events: one mint's proofs, at most 50 per event,
  encrypted. Whenever a mint's proofs change, the wallet publishes new token
  events. Each lists in `del` the events it replaces, and a **kind 5** deletes
  those (tagged `k=7375`).
- **kind 7376**, history: the change in balance, and which token events were
  created and destroyed.

"Encrypted" means NIP-44, to the user's own key. %nostrill does the
encrypting and signing, so the key never leaves it. A sync takes two rounds:

1. The wallet event, token events and deletions.
2. Once %nostrill returns their ids, the history events that refer to them.

Only one sync is out at a time. Changes made during a sync go into the next
one. If %nostrill refuses a round, the wallet rolls back to what the relays
have, so the next sync sends it again.

### Nostr: NIP-61 nutzaps

**Receiving**

- With the wallet event goes a **kind 10019**: the user's relays, their mints,
  and the P2PK public key to lock ecash to (`02` followed by the key's x).
- The wallet asks %nostrill for an ongoing watch: kind 9321 events that
  p-tag the user at one of their mints.
- Each nutzap is checked:
  - it's at one of our mints, in sats;
  - every proof is P2PK-locked to our key alone (NUT-11, `SIG_INPUTS`);
  - its DLEQs verify.
- Then the wallet signs each proof with the P2PK key and swaps them in.
- The history event that records it carries public `e … redeemed` and `p`
  tags, as NIP-61 asks.
- A nutzap is remembered once it's redeemed, or once the mint says it's spent.
  If something else goes wrong, the relays' next copy of it gets another try.
- While a restore runs, nutzaps wait: the counters may be behind. When the
  restore ends, the watch is renewed, so the relays send them again.

**Sending**

1. %nostrill fetches the recipient's 10019 from the relays; they get 8 s to
   answer.
2. The wallet picks one of the recipient's mints where it holds enough, and
   swaps its proofs into outputs locked to their key. These have random
   secrets: they're not ours to restore. Our change still comes from the
   seed.
3. %nostrill signs the 9321 with the user's key and sends it to the
   recipient's relays and ours.

### Lightning: Nostr Wallet Connect

The user pastes the connection string their Lightning wallet gives them:
`nostr+walletconnect://<service pubkey>?relay=…&secret=…`.

- **The secret** is a key for this connection only. The wallet stores it and
  never shows it.
- **The link:** the wallet opens a websocket to the connection's relay. Once
  it's open, it subscribes to:
  - the service's **kind 13194** info event: which methods it supports, and
    which encryption;
  - **kind 23195** answers p-tagged to our connection key.
- **Requests** are **kind 23194** events, NIP-44 encrypted to the service and
  signed with the connection secret. Requests made while the link is down are
  queued and sent once it's open.
- **Answers** are accepted only if their id, signature, author and p tag are
  right. Then they're decrypted.
- **Methods used:**
  - `get_balance`, on connect and after payments;
  - `pay_invoice`;
  - `make_invoice`, then `lookup_invoice` every 3 s until the invoice is paid
    or expires.
- **Timeouts:** one timer drops requests that got no answer within a minute.
  A payment with no answer after three minutes is only noted, never marked
  failed: it may still go through.
- **Reconnecting:** when the socket drops, the wallet reconnects, backing off
  2 s, 10 s, 30 s, 2 min, then every 10 min.

Only NIP-44 is spoken. A wallet service that only knows NIP-04 is detected and
flagged in the UI.

### Keeping secrets

Gall has no read permissions: **any agent on the ship can scry any agent**,
and anything in `dbug` is readable too. The wallet's secrets are the seed
phrase, the tokens it made (they're bearer money), the proofs and the NWC
secret. So:

- `%trill-wallet` is not wrapped in `dbug`.
- The one scry, `/x/wallet`, leaves the tokens out.
- The full wallet (`/ui`) and the seed phrase (`/phrase`, sent once, then
  the subscription ends) are watches that only Eyre may make. Gall gives a
  watch the provenance of its maker (`sap.bowl`), and an agent's own watches
  and pokes always come as `/gall/<agent>`. So another agent on the ship can't
  subscribe to them.
- The NWC secret is in no JSON at all, not even `/ui`.
- The user's Nostr key stays in %nostrill. The wallet asks it to sign by poke,
  and %nostrill only takes requests from agents on the same ship
  (provenance `/gall/<agent>`). The wallet only takes `%signed` and
  `%nostr-event` pokes from `/gall/nostrill`, and socket messages only from
  Iris.

Without Gall permissions this can't be airtight: any agent on the ship can
still poke %nostrill to sign something. It can't take a key away, though.

### The UI

- `pages/Wallet.tsx` shows:
  - the balance card (total, Lightning and ecash, backup status);
  - Receive and Send;
  - operations in progress ("Show invoice" while a deposit waits);
  - mints;
  - tokens made;
  - Activity.
- `components/modals/WalletModal.tsx`:
  - **Receive:** Lightning (an invoice into the Lightning wallet or a mint,
    with a QR code) or a pasted token.
  - **Send:** pay an invoice from the Lightning wallet or a mint, or make a
    token.
  - **Add a mint.**
  - **Settings:** hide balance, Nostr backup on or off, mints (default,
    restore), the Lightning wallet, the recovery phrase.
- `components/modals/ZapSheet.tsx`: the zap button's sheet. It nutzaps with
  ecash.
- `state/state.ts` subscribes to `/ui` on load. It toasts each new log line
  as a success or a failure, so work that finishes later is still announced.
- `logic/walletPrefs.ts` keeps per-browser preferences in localStorage: hide
  balance and the default mint.
- QR codes are drawn by `components/wallet/QrCode.tsx`, with `uqr`.


## Code map

**Backend** (`backend/`)

| File | What's in it |
|---|---|
| `app/trill-wallet.hoon` | the agent: state, operations, mint requests, NIP-60 sync, nutzaps, NWC |
| `sur/wallet.hoon` | types: keysets, proofs, operations, history, the NWC link, actions |
| `lib/cashu.hoon` | the cryptography: hash-to-curve, blinding, unblinding, DLEQ, P2PK signatures, fast point multiplication |
| `lib/cashu-wire.hoon` | the mint API: JSON in and out, tokens (V3 JSON, V4 CBOR), keyset ids, fees, denominations |
| `lib/cashu-seed.hoon` | NUT-13: secrets and blinding factors from the seed, the P2PK key |
| `lib/cbor.hoon` | CBOR, for `cashuB` tokens |
| `lib/bip32.hoon`, `lib/bip39.hoon`, `lib/bip39/english.hoon` | key derivation and seed phrases |
| `lib/nip44.hoon` | NIP-44 v2 encryption |
| `lib/nip60.hoon` | the NIP-60 and NIP-61 events' contents and tags |
| `lib/nwc.hoon` | NIP-47: the connection string, requests, checking and reading answers, BOLT11 amounts |
| `lib/json/wallet.hoon` | the JSON actions |
| `tests/cashu.hoon`, `cashu-wire.hoon`, `cashu-seed.hoon`, `nip44.hoon`, `nwc.hoon` | unit tests, against the specs' test vectors where they have them |

**In %nostrill**, for the wallet:

- `sur/nostrill/comms.hoon`: `%sign`, `%watch` and `%fetch` pokes from local
  agents.
- `lib/nostrill/relay.hoon`: `+sign-drafts`, `+watch`, `+unwatch`,
  `+forward`, `+publish-to`, and relay liveness (`+handle-ping`).

**UI** (`ui/src/`)

- `logic/wallet.ts`: types, parsing the agent's JSON, helpers such as BOLT11
  amounts and mint names.
- `logic/walletPrefs.ts`, `pages/Wallet.tsx`,
  `components/modals/WalletModal.tsx`, `components/modals/ZapSheet.tsx`,
  `components/wallet/QrCode.tsx`, `styles/Wallet.css`.
- `logic/requests/nostrill.ts`: `subscribeWallet`, `walletAction`,
  `walletPhrase`.
- `tests/wallet/nwc-mock.js`: a mock NWC wallet service for testing (see
  below).


## Interfaces

**JSON pokes** to `%trill-wallet`, from the browser (see
`lib/json/wallet.hoon`):

```json
{"add-mint": {"url": "https://mint.example.com"}}
{"del-mint": {"url": "https://mint.example.com"}}
{"deposit": {"mint": "https://…", "amount": 100}}
{"withdraw": {"mint": "https://…", "invoice": "lnbc…"}}
{"send": {"mint": "https://…", "amount": 21, "memo": "thanks"}}
{"receive": {"token": "cashuB…"}}
{"check": {"mint": "https://…"}}
{"restore": {"mint": "https://…"}}
{"sync": {"on": true}}
{"set-phrase": {"words": "twelve words …"}}
{"zap": {"to": "<hex pubkey>", "amount": 21, "comment": "", "about": {"id": "<hex event id>", "kind": 1}}}
{"nwc-connect": {"uri": "nostr+walletconnect://…"}}
{"nwc-disconnect": null}
{"nwc-pay": {"invoice": "lnbc…"}}
{"nwc-invoice": {"amount": 21, "description": ""}}
{"nwc-refresh": null}
```

The same actions work as `%noun` pokes from the dojo, e.g.
`:trill-wallet [%add-mint 'https://testnut.cashu.space']`. A refusal crashes
the poke with a readable message, which the UI shows as a toast.

**Watches** (Eyre only):

- `/ui`: the wallet JSON, then again after every change.
- `/phrase`: the seed phrase, once.

**Scry:** `/x/wallet/json`: the same JSON as `/ui`, but without tokens. It's
handy from the dojo or the MCP.

The JSON has:

- `balance`, `mints` (url, balance, proofs, keysets);
- `ops` (operations in progress);
- `history`;
- `sent` (the tokens made);
- `log` (the last 50 notes, newest first);
- `lightning` (link, balance, relay, Lightning address, methods, pending
  invoices);
- `nostr` (sync, token events, whether a sync is out).


## Testing

### Unit tests

Run them with the MCP's `run-tests` tool, or from the dojo with
`-test /=nostrill=/tests/<name> ~`:

- `/tests/cashu`: NUT-00 hash-to-curve and blinding, NUT-12 DLEQ, NUT-11
  signatures, against the NUTs' test vectors.
- `/tests/cashu-wire`: tokens V3 and V4 (the NUT-00 vectors), keyset ids
  (NUT-02), full ids, denominations, error messages, CBOR.
- `/tests/cashu-seed`: NUT-13 secrets and blinding factors, from the NUT's
  vectors.
- `/tests/nip44`: the NIP-44 v2 vectors.
- `/tests/nwc`: connection strings, BOLT11 amounts, and a request and its
  answer made with keys for both sides; forged and misaddressed answers must
  be refused.

`%trill-wallet` imports the test files, so `|commit` type-checks them too.

### A test mint

[testnut.cashu.space](https://testnut.cashu.space) is a public test mint. It
marks its own invoices paid within a few seconds, so deposits need no real
bitcoin. Other invoices (to pay them with ecash) have to be real ones, for
example from coinos; the test mint "pays" them without paying anything.

From the dojo on a fake ship:

```
:trill-wallet [%add-mint 'https://testnut.cashu.space']
:trill-wallet [%deposit 'https://testnut.cashu.space' 100]
:trill-wallet [%send 'https://testnut.cashu.space' 21 ~]
:trill-wallet [%receive 'cashuB…']
:trill-wallet [%check 'https://testnut.cashu.space']
```

And watch it with `.^(json %gx /=trill-wallet=/wallet/json)`, or in the
browser at `/apps/nostrill/wallet`.

**Restoring:** note the phrase (Settings → Recovery phrase), then
`|nuke %trill-wallet, =hard &`. Then:

```
:trill-wallet [%set-phrase '<the words>']
:trill-wallet [%add-mint 'https://testnut.cashu.space']
```

Adding the mint restores by itself. The balance should come back exactly.
(Before launch there are no state migrations: a change to the agent's state
means nuking it, and this is how to get the test sats back.)

### Checking what's on the relays

The NIP-60 events should decrypt with any NIP-44 implementation.
nostr-tools, which the UI already depends on, can check them: fetch the
user's kinds 17375, 7375, 7376 and 5, call `verifyEvent` on each, and
`nip44.v2.decrypt(content, getConversationKey(sk, pk))` with the ship's Nostr
secret key. On a fake ship, that key is in %nostrill's `keys` (`:nostrill
+dbug`). There's deliberately no scry for it.

### Nutzaps against another implementation

Nutzaps were tested against [cashu-ts](https://github.com/cashubtc/cashu-ts)
in both directions:

- **Receiving:** a small script, acting as the sender:
  1. reads the ship's 10019 from nos.lol;
  2. mints at testnut with `wallet.ops.mintBolt11(amount, quote).asLocked({ pubkey })`;
  3. publishes a 9321 with the proofs as `proof` tags.

  The ship redeems it within seconds, and the history event carries the
  `redeemed` tag.
- **Sending:** the script publishes a 10019 for a throwaway key, waits for the
  9321, checks each proof's lock and DLEQ (`hasValidDleq`), and redeems with
  `wallet.receive(proofs, { privkey })`.
- **Without a script:** zap a post of your own ship from the UI. The nutzap
  goes to your own key, comes back through the relays, and is redeemed.

### Lightning without a Lightning wallet

`ui/tests/wallet/nwc-mock.js` is a mock NWC wallet service: real NIP-47 over a
public relay, with fake Lightning behind it. It starts with 21,000 sats. An
invoice it makes is marked paid 6 s later, and it "pays" any invoice with an
amount.

```sh
cd ui && bun tests/wallet/nwc-mock.js      # RELAY=wss://… to pick the relay
```

It prints a `nostr+walletconnect://` string. Paste it in Settings → Lightning
wallet, or poke `{"nwc-connect": {"uri": "…"}}`. Then try Receive (into the
Lightning wallet) and Send (pay an invoice from it). The mock logs every
request it gets.

### After a change to the backend

Commit with the urbit MCP's `commit-desk` tool rather than `|commit` in the
dojo: it returns the build or load error if there is one. If the wallet's
state type changed, nuke it first (see Restoring).


## What's missing, and what could be better

**Ecash**

- **Only sats.** Mints also issue other units, such as usd or eur. The wallet
  takes only sat keysets and tokens.
- **Interrupted operations** are saved step by step, but they aren't resumed
  automatically when the agent reloads. A restore recovers the ecash, but a
  pending melt, for example, isn't polled again.
- **No fee preview before paying an invoice.** The melt quote's fee reserve
  is taken, and the fee is known only afterwards.
- **"Tokens you made" doesn't know when a token is claimed.** It could ask the
  mint (NUT-07) and mark or drop claimed tokens. One that's never claimed
  could be reclaimed by swapping it back.
- **Mint info (NUT-06) isn't read.** So the wallet doesn't check that a mint
  supports P2PK, DLEQ or restore before relying on it, and it doesn't show the
  mint's name, icon or message.
- **Proof selection is simple:** largest first, or an exact match. It could
  weigh fees, and keep a spread of denominations.
- **DLEQ:** checked when a proof carries one; a token without one is accepted.

**Nostr**

- **Reading a NIP-60 wallet back from relays isn't built.** The mirror only
  goes one way. With it, a wallet made in another client could be opened in
  Trill, and leftover token events (from before a rebuild) cleaned up.
- **Nutzaps:**
  - only `SIG_INPUTS` locks to our key alone are redeemed; no locktime,
    refund keys or multisig;
  - the `since` filter from NIP-61 isn't used, so relays send every old nutzap
    again on each re-watch (they're recognised and skipped);
  - nutzaps aren't shown on posts (counts, who zapped);
  - sending needs ecash at one of the recipient's mints. It could mint there
    over Lightning first.
- **Where events go:** everything goes to all of %nostrill's relays. NIP-61
  asks for 7376 redemptions to also go to the sender's relays. NIP-65 relay
  lists aren't used.
- **A relay that's down misses events.** Turning sync off and on again
  republishes everything.

**Lightning**

- **Only NIP-44 wallet services.** NIP-04, the older NWC encryption, isn't
  supported.
- **Only the connection's first relay** is used.
- **No Lightning zaps (NIP-57):** the zap button sends nutzaps only.
- **No `list_transactions`:** only payments made from Trill appear in
  Activity.
- **Not tried against a real NWC wallet** yet, only against the mock.
- **Moving money between the two sides** (paying a mint's deposit invoice
  from the Lightning wallet, or withdrawing ecash to it) takes two steps by
  hand. It could be one button.

**Elsewhere**

- **Fiat values:** there's no exchange rate, so no fiat amounts.
- **No camera:** there's no QR scanning; invoices and tokens are pasted.
- **Websockets depend on the Iris and vere fixes** made alongside this work.
  Iris's `%born` tells apps their sockets are gone after a restart, and vere
  pings and closes dead sockets. On a ship without them, a vere restart
  silently kills the NWC link and %nostrill's relay connections. %nostrill's
  own liveness ping covers its relays either way; the wallet's NWC link has no
  such check.


## Specifications

The specs are in `bulk/specs/` (not in git). Online:

- **Cashu:** [NUTs](https://github.com/cashubtc/nuts): 00 (tokens, blind
  signatures), 01 and 02 (keys, keysets, fees), 03 (swap), 04 (mint), 05
  (melt), 07 (state check), 08 (change), 09 (restore), 10 and 11 (spending
  conditions, P2PK), 12 (DLEQ), 13 (deterministic secrets).
- **Nostr:** [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md)
  (encryption), [NIP-60](https://github.com/nostr-protocol/nips/blob/master/60.md)
  (Cashu wallets), [NIP-61](https://github.com/nostr-protocol/nips/blob/master/61.md)
  (nutzaps), [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md)
  (Nostr Wallet Connect), [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md)
  (deletion).
- **Bitcoin:** BIP-32, BIP-39, BIP-340 (Schnorr), BOLT11 (invoices).


## Appendix: fast secp256k1 point multiplication in Hoon, via the ECDSA recovery jet

Cashu wallets and mints are mostly point multiplications on secp256k1:
blinding (`B_ = Y + r·G`), unblinding (`C = C_ − r·K`), signing (`C_ = k·B_`)
and DLEQ proofs (`s·G − e·A`, `s·B_ − e·C_`). In zuse, `mul-point-scalar`
and `priv-to-pub` are plain Hoon (Jacobian double-and-add), not jetted.
Each call takes about **13 ms** on a fake ship. A wallet restore (NUT-09)
blinds hundreds of outputs, so it takes the better part of a minute.

The only secp256k1 operations vere jets are ECDSA signing (`%sign`),
recovery (`%reco`), nonce derivation (`%make`), and Schnorr signing and
verification (`%sosi`, `%sove`). Recovery can be made to do arbitrary
point arithmetic.

### The trick

`ecdsa-raw-recover:secp256k1:secp:crypto` takes a hash `z` and a signature
`[v r s]`, and returns the public key

```
Q = r⁻¹ · (s·R − z·G)
```

where `R` is the curve point with x-coordinate `r` and the y-parity in
`v`'s low bit. It runs in C (libsecp256k1).

To get `k·P + j·G` for any point `P` and scalars `k` and `j`, choose:

- `r = x(P)` and `v = y(P) mod 2`, so that `R = P`
- `s = k·r mod n`
- `z = −j·r mod n`

Then:

```
Q = r⁻¹ · (k·r·P + j·r·G) = k·P + j·G
```

In Hoon (`n` is the group order):

```hoon
::  k·P + j·G, in libsecp256k1
++  lin
  |=  [p=point k=@ j=@]
  ^-  point
  =/  r  x.p
  %+  ecdsa-raw-recover:secp256k1:secp:crypto
    (mod (sub n (mod (mul j r) n)) n)        ::  z = −j·r
  [(mod y.p 2) r (mod (mul k r) n)]         ::  v, r, s = k·r
```

### What each operation becomes

- `k·P` is `(lin p k 0)`.
- `k·G` is `(lin g k 0)`: `G` is just another point.
- Blinding, `Y + r·G`, is `(lin y 1 r)`, one call.
- Unblinding, `C_ − r·K`, is `C_ + (lin k (n − r) 0)`. A single point
  addition in Hoon is cheap.
- The first DLEQ term, `s·G − e·A`, is `(lin a (n − e) s)`, one call.
- The second DLEQ term, `s·B_ − e·C_`, is two calls and an addition.

### Caveats

- **`x(P)` must be less than `n`.** `v`'s second bit would cover
  `r = x − n`, but zuse's recovery doesn't take that. It happens for
  about one point in 2¹²⁸; fall back to `mul-point-scalar` there.
- **`k` must be non-zero mod `n`,** because `s = 0` isn't a valid
  signature. For `k = 0`, compute `j·G` as `(lin g j 0)`.
- **A point at infinity result is untested.** If `k·P + j·G` is the point
  at infinity, recovery fails or crashes. Honest inputs never produce it;
  treat it as a refusal.

### Measured

On a fake ship (vere 4.x), 1,000 multiplications of a random point by
random 256-bit scalars:

| | total | per multiplication |
|---|---|---|
| `mul-point-scalar` (Hoon) | 12.9 s | ~13 ms |
| `lin` through the `%reco` jet | 0.16 s (with some tool overhead in it) | ≤ 0.2 ms |

That's at least 70× faster, with identical results. In trill's wallet
(`backend/lib/cashu.hoon`), every Cashu point operation goes through it:
blinding, unblinding and DLEQ checks. It still passes the NUT-00, NUT-12
and NUT-13 test vectors.
