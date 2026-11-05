# Repository Guidelines

## Project Overview
Trill is a fullstack Urbit social application with native posts, Nostr interoperability, direct messages, debates, trending topics, and Cashu/Lightning wallet features. `ui/` is the browser frontend; `backend/` is the Hoon desk. The product is called Trill, but frontend URLs, the Airlock desk, and many API names still use `nostrill`. Preserve those identifiers unless explicitly migrating them.

This guide covers both the Gall backend and browser frontend. Read `WALLET.md` and `TOPICS_API.md` before changing those integrations. Backend details below describe the inspected source, not live-ship verification.

## Backend Structure & Ownership
Use the `urbit` skill when reviewing or changing Hoon. Read imports and nearby molds first. Paths in this section are relative to `backend/`.

| Location | Responsibility |
| --- | --- |
| `app/` | Gall agents, persisted state, event dispatch, watches, scries, and external effects. |
| `sur/` | Shared molds and protocols; `sur/old.hoon` preserves the main agent's old state and migration. |
| `lib/nostrill/` | Main-agent engines: posts, follows, profiles, relay connections/requests, private lists, permissions requests, and debug helpers. |
| `lib/json/` | Browser JSON encoders/decoders for each domain; these define the actual wire contract. |
| `lib/trill/` | Native post construction/Markdown conversion, ordered feed operations, thread extraction, and gates. |
| `lib/nostr/` | Nostr request construction, relay protocol parsing/sending, event conversion/signing, and keys. |
| `lib/scri.hoon`, `lib/nostrill.hoon` | Main-agent read models/scries and shared state/card helpers. |
| `lib/chat.hoon`, `lib/debates.hoon` | Messaging engine and debate rules/state transformations. |
| `lib/cashu*.hoon`, `lib/nip*.hoon`, `lib/nwc.hoon`, `lib/bip*/` | Wallet protocol, serialization, derivation, encryption, and cryptography. |
| `ted/` | Effectful one-shot threads; `beg` requests peer feeds/threads, `ws` sends one-off relay messages, `ask`/`evaluate` exercise AI requests. |
| `mar/` | Marks and data conversion; includes contacts protocol versions and `%nostrill-ted`. |
| `tests/` | Existing Hoon test cores, especially cryptographic and wallet protocol vectors. |
| `gwid/` | Groundwire identity support and wordlists. |

`desk.bill` starts seven agents: `%nostrill`, `%n-contacts`, `%noschat`, `%trill-ai-client`, `%topics`, `%debates`, and `%trill-wallet`. `%hark`, settings, storage, Spider, and runtime vanes are external dependencies. `sys.kelvin` targets Zuse 408. Docket metadata names base `nostrill` and references a hosted frontend glob; the deployment workflow mounts backend source on desk `trill`. Check the target desk instead of assuming all these names are interchangeable.

## Main Gall Agent & Persistence
`app/nostrill.hoon` owns the state in `sur/nostrill.hoon`. Its arms delegate to doors with sample `[state bowl]`; helpers return cards plus replacement state, usually threaded through `=^  cards  state`. Keep state changes and their emitted facts together.

The main state is tagged `%2`. `on-load` accepts preserved `%0`/`%1` molds from `sur/old.hoon`, migrates them, repairs a zero current signing key, and reconciles relay connections. Native profile/feed/graph keys are now bare `@p`; Nostr selections, users, and sourced feeds live under `nostr-data`. Legacy raw events are rekeyed by `[created-at event-id]` and regrouped by author. Old Nostr feeds already converted to native posts cannot reconstruct missing original signed events; their membership is retained. A persistent mold change needs a deliberate migration; do not reinterpret an old version tag or silently reset feeds, follows, or keys.

Several ancillary agents still cast their `%0` state directly and have comments describing prelaunch reset workflows. Those comments are not authorization to nuke a running agent, especially a wallet. Establish the target ship, desk, revision, and migration/recovery path before live operations.

Hoon conventions: preserve two-space tall-form layout, normalize vases/JSON at entry points, use explicit result molds on public/nontrivial arms, and use standard map/set/ordered-map helpers. `unit` represents expected absence; distinguish a missing value from a known empty collection.

## Backend Interfaces & Data Flow
There are separate browser, peer, and relay protocols:

- **Browser:** `%json` pokes decode through `lib/json/`; Airlock watches deliver JSON facts. `%nostrill` `/ui` permits the local ship and immediately emits `{ state: ... }`; later `cards:lib/nostrill` updates emit `{ fact: ... }`. The initial snapshot includes profiles, own feed, followed feeds, timeline, relay state, sourced Nostr feeds, graph, public key, and private lists. These collections are not currently bounded by a general bootstrap page limit.
- **Urbit peers:** `sur/nostrill/comms.hoon` defines typed `%noun` engagement pokes and feed/profile facts. `/follow` is a continuing peer subscription; `/profile` is a one-shot profile response. `/beg/feed` and `/beg/thread/<id>` use watches for one-shot requests, wrapped for the browser by `ted/beg.hoon`.
- **Permissions:** `lib/nostrill/reqs.hoon` applies `lib/trill/gate.hoon` to feed/thread requests, records rulings, and notifies Hark. Deferred responses encode as `"maybe"`, denied responses as `null`, and accepted responses as data. Preserve that distinction. Some gate features remain TODOs; the presence of a UI editor or mold is not proof that a poke is implemented.
- **Relays:** Iris handles outbound WebSockets through `lib/websockets.hoon`; relay JSON is distinct from browser JSON. Incoming server paths `/nostrill` and `/nostrill-ui` are experimental: the UI path is an authenticated echo stub, and the Nostr-server handlers do not implement a full relay. The production UI state path is Airlock/Gall subscriptions, not this echo socket.

The main JSON decoder accepts `fols`, `begs`, `post`, `prof`, `keys`, `rela`, `lists`, and `topics`. `begs` is executed through its thread rather than main `on-ui`; topics actions are forwarded to `%topics`. Invalid main-agent JSON may be logged and ignored with a normal return. A Gall poke acknowledgement therefore confirms handler completion, not necessarily a domain action or downstream delivery. Correlate asynchronous results with facts before reporting completion.

`lib/json/common.hoon` defines compact tagged users, e.g. `{ urbit: "~nec" }` and `{ nostr: "<hex>" }`. Rich identities use `json/gwid` or Nostr full-ID encoders. Ship points and native post IDs are decimal strings; Nostr keys/event IDs use padded hex strings. Preserve these widths and lossless numbers. Cursor encoders and display timestamps are not interchangeable; inspect the specific codec. A stable post reference includes its protocol and host/event ID, not just a timestamp.

When changing a contract, trace all four pieces together: the Hoon mold, JSON codec, TypeScript wire type/parser, and snapshot/incremental store handlers. Peer noun protocols and browser JSON need not expose the same shape.

## Follows, Profiles & Feed Semantics
Current persisted structures are:

- `following=(map @p feed:trill)`: native cached feeds, not a complete pending-membership/status registry.
- `follow-graph=(map @p (set user))`: native-source relationship sets, also used to record requested native follows via empty entries.
- `profiles=(map @p user-profile)`: native metadata plus following/follower lists and counts.
- `timeline`: an ordered merged native feed. `nostr-data` holds `feeds` (request-name → relay-URL → cached events/request state), `following` (selected pubkeys), and `user-map` (per-pubkey raw notes, optional metadata/contact lists, and other events).

`lib/nostrill/follows.hoon` inserts an empty graph entry on add. Urbit adds open a peer watch; accepted responses populate `following`, profile, and timeline and add an edge under our own graph entry. Deferred/denied responses do not populate a feed. Nostr add/remove updates the separate selected-pubkey set and emits a Nostr data fact; adding does not itself establish a relay request. `%new-nostr` exists in types/codecs, but no producer was found in the current backend.

Unfollow deletes the cached feed and removes an edge from our own graph set, but leaves the target's graph key. Thus neither graph-key presence nor a nonempty adjacency set is a reliable membership/status test. An empty adjacency set cannot distinguish pending, unavailable, or genuinely following nobody. UI union/deduplication is an interim workaround, not a canonical backend model.

`enfollowing` and `engraph` now send native ship-keyed JSON objects. `nostr` snapshots and `%nostr %data` facts encode the separate Nostr data subtree through `lib/json/nostr.hoon`; `/j/nostr` retains the sourced-feeds read endpoint. Nostr kind-0/kind-3 responses populate optional metadata/contact values under `user-map`, and notes populate raw per-author feeds. Keep unknown (`null`) distinct from known empty lists. Frontend types and parsers must follow this contract; legacy disaggregation code is not automatically compatible.

Native posts use ordered maps keyed by `@da`, with thread/reply relationships and engagement stored in the post. `lib/nostrill/posts.hoon` updates native feeds and emits add/update/delete facts. `lib/scri.hoon` serves feed/thread reads; feed scries accept count/order arguments, but `sfeed` still has TODOs for actually enforcing count/order. Do not advertise complete pagination until those paths are verified.

## Relay Engine & Update Costs
`lib/nostrill/relay.hoon` keys configured relays by URL; `wid` is the current, replaceable Iris socket ID. A nullable connection status marks deliberate closure. Reconnects preserve requested ongoing subscriptions, replay them on a fresh socket, and use retry/ping timers that validate themselves against current state. Keep the full lifecycle intact when changing relay deletion or reconnect behavior; URL-based removal also reaches relays without a socket.

Events are stored by request name and relay URL to retain provenance. Kind 0 updates optional user metadata, kind 3 updates optional contact lists, and kind 1 stores notes in sourced feeds and the author's raw Nostr feed. Before EOSE, events accumulate; ongoing subscriptions can emit individual event facts afterward. EOSE can emit merged feed/thread results, profiles, EOSE, and a full relay map. Author-filtered requests do not emit their feed subset there; the frontend compensates with `/j/nostr` scries.

These are concrete optimization targets: the UI re-reads the entire sourced-feed tree on EOSE, profile updates may send the whole profile map, and bootstrap duplicates posts across feeds/timeline/sourced data. Nostr ordered maps and `make-wfeed` use `[created-at event-id]` keys, ordered by timestamp and then event ID, so distinct same-second events survive. Retain those composite keys and relay provenance when redesigning storage, deduplication, or pagination.

## Ancillary Agents
| Agent | State and browser/agent interface |
| --- | --- |
| `%noschat` | `sur/chat.hoon` and `lib/chat.hoon`: conversations, requests, delivery outbox, mute/block policy. `/ui` gives an initial inbox summary (up to three messages per conversation); `/dm/<peer>` gives peer data. Updates can target both paths. `/j/dms` and `/j/dm/<peer>` are JSON reads. Peer transport is Urbit messaging; do not infer Nostr DMs from identity types. |
| `%debates` | Host is authoritative; guests mirror `/debate/<id>` noun updates. `lib/debates.hoon` checks actor permissions and stage transitions. Local `/ui` gives `{ all: ... }`, then updates/invitations/presence/errors; `/presence` is a peer watch. Initial debate histories are trimmed and older messages requested separately. Preserve redaction and host enforcement. |
| `%topics` | Fetches Google Trends, Google News, and Hacker News through Iris; stores source snapshots, preferences, errors, schedule, and spam verdicts. `lib/topics.hoon` parses/classifies. Its scries are nouns; `%nostrill` builds the browser JSON read model. Default refresh is hourly. UI settings are forwarded actions; the UI polls rather than receiving a topics stream. |
| `%trill-ai-client` | Named model providers, asynchronous HTTP, request IDs, pending/ready answers, and a successful-response cache wiped hourly. Callers poke, then watch `/response/<id>` for a noun result and kick. JSON provider reads expose `hasKey`, not keys. Cache keys use method/URL/body without headers; do not assume credential-specific cache isolation. |
| `%trill-wallet` | Durable Cashu proofs, derivation counters, pending mint/melt operations, history, NIP-60/61 sync, and NWC state. Uses `%nostrill` to seal/sign/publish drafts; maintains its own NWC relay socket. `/ui` sends a full wallet projection when state changes. Seed phrase is a separate one-shot watch. |
| `%n-contacts` | Versioned contacts/rolodex service with peer subscriptions and retry state. Its older/newer molds, marks, and JSON adapters live under `sur/contacts*`, `mar/contact/`, and `lib/contacts/`; keep its protocol separate from Trill follows. |

Wallet boundaries are deliberate: `/wallet` scries omit bearer tokens; full `/ui` and `/phrase` watches require local Eyre provenance. `%trill-wallet` does not use the debug wrapper used by many other agents. `%nostrill`'s agent signing requests also check local agent provenance. Preserve these checks when splitting subscriptions or adding read models. Never expose phrase/proofs/NWC credentials through a general scry or debug path. Persist wallet counters and operations before external effects; changing state or resumption behavior requires reviewing the whole operation lifecycle in `WALLET.md`.

## Backend Validation & Deployment
There is no repository-wide Hoon shell build command. Compile/load on an explicitly selected development ship and desk using its tooling. A desk commit is a live operation and may reload agents. Importing test cores checks their types but does not run their assertions.

Existing vector suites can be run from a development ship's Dojo as documented in `WALLET.md`, e.g. `-test /=nostrill=/tests/nwc ~`; substitute the actual desk. Test cores return `tang` (`~` succeeds). For new behavior prefer a full poke/watch/scry scenario on a disposable ship and record reproducible inputs, acknowledgements, facts, and final state. Separate fixture tests from real peer/relay/mint verification. Browser mocks cannot validate Hoon decoding, state migration, authorization, or actual card ordering.

The deployment workflow rsyncs `backend/` and commits desk `%trill` on the distribution ship. It neither builds the UI nor updates the hosted frontend glob. Coordinate JSON changes with frontend delivery and preserve compatibility for already-open browsers; use a versioned contract for breaking changes.

## Backend–UI Contract Design Priorities
Each backend belongs to one user. Prioritize frontend responsiveness and simple, reliable state updates over minimizing server work or every transmitted byte. A useful initial snapshot is appropriate; do not apply assumptions about serving thousands of clients to this architecture.

For the proposed redesign, separate authoritative follow membership/status, cached feeds, and known social relationships. Have the backend provide protocol-separated keyed objects and useful display summaries so the browser does not repeatedly infer identities, union graph/feed keys, scan whole feeds for counts, or merge profile contact lists with graph data. Retain compact typed references for relationships; do not duplicate large feed bodies into display summaries.

Use snapshots to initialize/resynchronize and targeted replacements/removals to preserve unchanged frontend object references during normal updates. Small collections may use full replacement when simpler. Derive ordered display lists at the selector/view boundary. Measure browser parse time, store-update work, rerenders, and interaction latency before introducing more subscriptions, pagination machinery, or caching. This describes design direction; the current wire protocol is documented above.

## Frontend Stack & Organization
The frontend uses React 19, strict TypeScript, Vite 7, Bun, Wouter, Zustand, TanStack Query, Tailwind CSS 4, plain CSS, Lucide icons, and react-hot-toast. It is a client-rendered application.

Paths below are relative to `ui/src/`:

| Location | Responsibility |
| --- | --- |
| `main.tsx`, `App.tsx` | Mount React, initialize the ship connection, show startup errors/loading, install theme/query providers and toasts. |
| `Router.tsx` | Lazy-loaded routes, shared shell, global modal, welcome and relay-drop dialogs. |
| `pages/` | Route entry points; `pages/chat/` owns the messaging screens and supporting components. |
| `components/layout/` | Sidebar, page header, right rail, search entry, trending topics. |
| `components/feed/`, `post/`, `thread/` | Shared feed lists, post rendering/actions, and thread UI. |
| `components/nostr/`, `trill/` | Protocol-specific feed, profile, and thread loaders. |
| `components/composer/` | Inline/modal composition, contenteditable input, autocomplete, emoji, snippets, S3 media. |
| `components/modals/`, `ui/` | Feature dialogs and shared controls such as `TabStrip` and modal close buttons. |
| `components/profile/`, `permissions/`, `settings/`, `topics/`, `debates/`, `wallet/` | Feature-specific UI. |
| `state/state.ts` | Shared Zustand store, initialization, subscription processing, feeds, profiles, notifications, wallet and debate state. |
| `logic/` | API adapters, parsers, transformations, validation, identity, search, and feature helpers. |
| `hooks/` | Shared behavior for relay actions, access requests, identities, thread layout, and WebSockets. |
| `types/` | Urbit/Nostr wire and application types; `trill.ts` defines shared post/feed structures. |
| `styles/`, `assets/` | Themes, global/feature styles, and imported icons/images. |

`ui/public/` contains static assets, including fonts. Prefer the `@/` alias for imports under `ui/src/`; both TypeScript and Vite configure it.

## Startup, Routing & Navigation
`App.tsx` waits for the store's `init()` before rendering the application. Initialization is memoized with `initPromise`; preserve this to avoid duplicate subscriptions and timers. Completion of `init()` does not mean every subscription's first payload has arrived.

Wouter and Vite both use `/apps/nostrill`. Route paths below are relative to that base; use Wouter navigation within it.

| Route | Screen |
| --- | --- |
| `/` | Redirect to `/f`. |
| `/f`, `/f/:taip` | Home; default Nostr tab, plus Groundwire and Following feeds. |
| `/u/:user` | Profile resolved from Urbit/Groundwire identity or a Nostr key. |
| `/t/u/:host/:id` | Native Urbit thread. |
| `/t/n/:id` | Nostr thread; accepts decoded hex, note, or nevent identifiers. |
| `/fols`, `/bookmarks`, `/notif` | Connections, saved posts, notifications. |
| `/dms`, `/dms/:id` | Inbox and peer conversation. |
| `/debates`, `/debates/:host/:id` | Debate directory and room. |
| `/wallet`, `/sets`, `/search` | Wallet, settings, local search. |

The shell combines `Sidebar`, the main column, and `RightRail`. Keep lazy route imports and Suspense fallbacks. Profile, thread, and conversation loaders use identity-based React keys to reset local state on navigation; preserve that behavior so drafts and stale results do not carry between users or threads.

## Backend Communication & State Rules
`logic/api.ts` creates the `urbit-api` Airlock, discovers `/~/host`, opens the channel, and uses `http://localhost:8900` in development. Production uses the current origin. Vite does not configure a development proxy; live development requires a reachable, authenticated ship.

`logic/requests/nostrill.ts` exports `IO`, the central adapter for scries (reads), pokes (actions), threads, and subscriptions. Its default agent is `nostrill`; it also addresses `noschat`, `hark`, `trill-wallet`, `debates`, `trill-ai-client`, settings, and storage. Add request encoding here rather than duplicating wire payloads in components.

- Result-returning methods resolve to `{ ok }` or `{ error }`. Check the discriminant or use `logic/result.ts`'s `unwrap` in a try/catch; both objects are truthy. Other helpers may reject, so inspect the method's contract.
- Mutation success waits for the agent acknowledgement, including negative acknowledgements. Keep failed drafts and show an error; sending the HTTP request alone is insufficient.
- UI `UserType` carries a full Urbit identity; wire users use `{ urbit: "~ship" }` or `{ nostr: "hex" }`. Preserve `toWireUser` conversions and thread `authorFull` normalization.
- Subscription deduplication keys include both agent and path: multiple agents expose `/ui`.
- `logic/stateFact.ts` normalizes initial state and incremental facts. Update these adapters and matching `types/` when backend JSON changes; cross-check `backend/lib/json/`.
- The default `useLocalState` export wraps selectors with `useShallow`. Create new Map/object references when updating state. Use `useStore.getState()` when long-lived callbacks need current values.
- Nostr `FC` values retain a raw event index and lazily materialize `.feed`. Use `nostrEventInFeed` for one-event lookups and `nostrEventsInFeed` for background text/metadata work; enumerating `.feed`, spreading an FC, or serializing it materializes that feed. Preserve event and collection references on unchanged updates so memoized rows and narrow selectors stay effective.
- Respect `stateLoaded`, `notificationsLoaded`, `debatesLoaded`, and nullable wallet state. An empty collection before initial data arrives is not evidence that the user has no data.

TanStack Query handles selected reads, including post/thread loading (`["trill-thread", host, id]`) and S3 listings. Most live application state comes from Zustand subscriptions. `logic/cache.ts` provides an IndexedDB utility but is not the active store persistence mechanism.

## Feature Flows & Constraints
- **Feeds and posts:** `Poast` and `FC` in `types/trill.ts` are shared rendering structures. `logic/nostrill.ts` converts Nostr events into them and merges feeds while preserving relay provenance. Reuse `components/post/` and `PostList`; keep event hashes distinct from timestamp-based feed keys.
- **Groundwire versus Nostr:** `components/feed/Global.tsx` connects directly through `NRelay1` to `GLOBAL_RELAY_URL` and streams kind 667 events. It aborts the previous request on resync and closes on unmount. Configured Nostr feeds use ship-managed relay requests. End-of-stored-events (EOSE) triggers a serialized `/j/nostr` refresh in the store; do not declare sync complete before the refreshed feed lands.
- **Composition:** `Composer.tsx` serves inline and modal flows; `composerData` selects reply, quote, shared-card, or topic context. `composerDom.ts` manages serialization and caret/media insertion. Preserve the character limit, failed drafts, and acknowledgement handling. Global-feed sharing is a ship-owned Settings preference (`posting.global`), enabled unless explicitly false; wait for settings before sending a new text/topic post. Keep this out of per-composer state. Explicit relay cross-posting currently excludes replies/quotes because the send path lacks Nostr threading tags.
- **Identity and threads:** Reuse `logic/gw.ts`, `nostr.ts`, `userDisplay.ts`, and `utils.ts` for parsing, display, and links. Native and Nostr threads have separate loaders. Nostr routes identify events by hash, not their feed-map key. `logic/nostrThread.ts` parses marked and legacy ancestor references; `useNostrAncestors` resolves raw cached events and bounded relay reads, caches successful reads with TanStack Query, and cancels on navigation. Keep mentions/quotes out of ancestry and retain the selected event as the reply target. Preserve pending access (`"maybe"`) versus denied access (`null`) handling.
- **Messaging and notifications:** `pages/chat/` and `logic/dms.ts` adapt `noschat` data, delivery/read state, requests, and muted/blocked conversations. Hark supplies notifications through the store; `logic/notifications.ts` adapts them. Preserve numeric ID normalization and the request/inbox distinction.
- **Lists and search:** Bookmarks, mutes, and reports are agent-owned (`logic/lists.ts`). Keep filtering consistent across feeds. `pages/Search.tsx` searches loaded profiles/posts and derives hashtags locally; `q` and `tab` are URL state, and recent queries use localStorage. Do not imply server-wide search coverage.
- **Topics and AI:** `TrendingTopics` polls the ship's topics data and refreshes after `TOPIC_PREFS_EVENT`. `logic/topics.ts` parses sources, preferences, related links, and spam review data. Provider settings use `trill-ai-client`; read `logic/aiClient.ts` and the IO methods for validation and key-update semantics.
- **Wallet and debates:** Wallet state comes from `trill-wallet`; actions and phrase access go through IO. `logic/walletPrefs.ts` stores only browser conveniences such as balance visibility and preferred mint. Debates use `logic/debates.ts`, live store updates, and `DebatePresenceSync`. Keep pending operations and agent refusals visible.

## Styling, Accessibility & Browser Preferences
`styles/ThemeProvider.tsx` defines eight themes and applies CSS variables; `themeMetadata.ts` supplies related metadata. Reuse theme tokens and existing global/feature CSS. Match adjacent code: two-space indentation, double quotes, semicolons, PascalCase component files, and camelCase functions/variables. No formatter or lint command is configured in package scripts.

Use shared `Modal` behavior: Escape dismissal, Tab trapping, initial focus, focus restoration, and backdrop handling. Preserve keyboard navigation and prevent post actions/links from accidentally opening their parent thread. Check narrow-screen layouts and multiple themes for UI changes. Theme, thread layout, onboarding, search history, and wallet conveniences have browser-local preferences; distinguish them from ship-owned data.

## Development & Validation Commands
Run from `ui/` in the provided Nix environment. Do not launch another shell or install missing tools imperatively; ask for required tools in the environment.

| Command | Purpose |
| --- | --- |
| `bun install` | Resolve dependencies; local Urbit packages require `../../../urbit/bun/` relative to `ui/`. |
| `bun run dev` | Start Vite, normally at `http://localhost:5173/apps/nostrill/`. |
| `bun run check` | TypeScript project checks. |
| `bun run build` | Type-check and build into `ui/dist/`; Vite config controls vendor chunks and asset filenames. |
| `bun run preview` | Serve the production bundle locally. |
| `bun run test` | Existing Bun smoke suite in `tests/smoke.test.ts`. |
| `bun run test:e2e` | Playwright Chromium suite; starts/reuses Vite automatically. |
| `bun run test:e2e -- --grep "a rejected post"` | Run a focused browser regression scenario. |

Prefer E2E tests in `ui/tests/e2e/*.spec.cjs`. The suite mocks Urbit endpoints, channel acknowledgements, and subscription data; extend those fixtures when changing wire behavior. Use `tests/e2e/playwright-runtime.cjs`, which resolves Playwright locally or from the environment. `PLAYWRIGHT_NO_WEBSERVER=1` skips server startup when explicitly managing it yourself.

Produce repeatable evidence: save screenshots or a Playwright report/trace for the exercised scenario. Configuration retains screenshots and traces on failure under `ui/test-results/playwright/`; `ui/screenshots/playwright/` is the snapshot location. Failure-only capture does not automatically produce a success screenshot. These outputs are ignored by Git. Report mocked-browser checks separately from live ship, relay, wallet, or payment verification. No numeric coverage threshold is configured. Never write unit tests after implementation; if isolation is necessary, enumerate failure cases before writing code.

## Commits, Pull Requests & Workspace Safety
History uses short descriptive subjects, sometimes prefixed by area, such as `Wallet UI:`. Keep commits focused and preserve unrelated working-tree edits. PRs should explain behavior changes, list validation commands/results, link relevant issues, and include screenshots for UI changes. Pushes to `master` deploy the backend desk through `.github/workflows/deploy-desk.yml`; the workflow does not build the frontend.

Never edit or commit `NOTES.md`, or commit `bulk/`. `bun-deps` and `ts-topics` are ignored links to external checkouts. Keep wallet phrases, NWC secrets, AI keys, storage credentials, and deployment credentials out of source, logs, screenshots, and test artifacts.
