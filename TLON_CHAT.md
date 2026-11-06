# Tlon chat migration

Trill's inbox and conversation screens now use Tlon's `%chat` agent for
one-to-one and multi-person DMs. `IO.getTlonChat()` shares the authenticated
Airlock connection; `state/chat.ts` owns chat state independently of the main
Trill store. `%noschat` is no longer queried or watched by the browser.
Its backend agent and persisted history remain intact; history is not imported
into Tlon by this switch.

## Installed backend

Inspected `/home/y/code/groundwire/piers/zod/groups` on 2026-11-06.
`%groups` is the desk; direct messages and multi-person DMs (clubs) are
served by `%chat`. Group/channel messaging is a later milestone.

Use the installed API v4, whose marks encode chat mold v7. The relevant
sources are `app/chat.hoon`, `sur/chat.hoon`, `lib/chat-json.hoon`,
`lib/story-json.hoon`, `lib/channel-json.hoon`, and `lib/dm.hoon` on that desk.
Do not assume current upstream Tlon and this Groundwire fork are identical.

| Read | Purpose |
| --- | --- |
| `/v4/heads` | Latest post/recency per conversation; omits empty conversations. |
| `/dm`, `/dm/invited`, `/dm/archive` | Direct-message membership and request/archive state. |
| `/clubs` | Multi-person DM IDs, metadata, accepted/invited members and state. |
| `/blocked` | Blocked ships. |
| `/unreads` | Nested unread point/count; the outer `count` is total messages. |
| `/v4/dm/<ship>/writs/newest/<count>/heavy` | Direct-message history. |
| `/v4/club/<club-id>/writs/older/<cursor>/<count>/heavy` | Older group history. |

Airlock scries omit `/x` and `.json`. Live subscriptions use `/v4`, `/unreads`
and `/dm/invited`. `/v4` includes message deltas, club changes and DM status
changes. `ChatSync` opens one set of watches for the shell, before loading the inbox,
and buffers facts during initialization. Routes share those watches; navigating
between DMs does not create additional subscriptions. Shell cleanup closes the
current watches, including watches created by a retry. Disable Airlock's
`resubOnQuit` for these subscriptions: a kick closes companion watches and
shows a retryable chat error rather than silently opening an orphan watch.

| Action mark on `%chat` | JSON outline |
| --- | --- |
| `chat-dm-action-2` | `{ship, diff: {id, delta: {add: {essay, time: null}}}}` |
| `chat-club-action-2` | `{id, diff: {uid, delta: {writ: messageDiff}}}` |
| `chat-club-create` | `{id, hive: [ships...]}` |
| `chat-dm-rsvp` | `{ship, ok}` |
| `chat-club-action-2` (RSVP) | `{id, diff: {uid, delta: {team: {ship: our, ok}}}}` |
| `chat-remark-action` | `{whom, diff: {read: null}}` |
| `chat-block-ship`, `chat-unblock-ship` | `{ship}` |

Essays retain their story structure, author, sent timestamp, `/chat` kind,
nullable metadata and blob. Rich authors can be strings or profile objects.
Tombstones are omitted from rendered history. No message or cursor ID passes
through JavaScript `Number`: wire message IDs include dotted `@ud` timestamps,
while returned time cursors are ungrouped decimal strings. History URLs must
format those cursors back to dotted `@ud`. Large club/action IDs similarly use
dotted groups of five base-32 digits. Millisecond `sent`/`recency` values are
ordinary JSON numbers.

Mutations wait for Gall acknowledgements. These confirm local processing,
not peer delivery. Subscription setup rolls back partially opened watches;
cleanup is idempotent and suppresses late events. A kicked subscription
reports an error and closes its companion watches.

## Frontend behavior

- The inbox preserves direct, invited, archived, blocked and multi-person
  conversations, including empty conversations absent from `/heads`.
  Club membership filters out declined groups that remain in `/clubs`.
- Direct routes use ships; group routes use stable club IDs. The picker can
  invite two or more other people into a new group. Headers expose joined and
  invited members, and group messages show their author.
- Conversation history loads 50 messages at a time. Older pages preserve scroll
  position, and incoming edits/deletions take precedence over in-flight reads.
  Reconnect reloads history instead of treating stale cache as authoritative.
- Drafts stay in memory per conversation. Sending creates an optimistic row;
  acknowledgement clears the unchanged draft, rejection retains it and exposes
  retry. A retry reuses the same message ID. This is local acceptance, not a
  delivered/read receipt from another ship.
- Story rendering supports text formatting, lists, links, images, code and
  mentions without converting chat messages into native Trill posts. Search,
  media and link panels inspect loaded history; they are not full-history search.
  Citations currently display a placeholder; reactions and threaded chat replies
  are not part of this first UI milestone.
- Mute uses `%activity` `/v6/volume-settings` and `activity-action-2`:
  `{adjust: {source: {dm: {ship: "~nec"}}, volume: ...}}` (use `{club: id}` for
  groups). All six DM event types disable `unreads` and `notify`. Unmute clears
  the source override to inherited defaults. Settings load at connect/retry;
  external changes in Tlon's notification UI require reconnecting Trill.
- Pins write ship settings bucket `trill-chat`; if absent, the old `noschat`
  pinned list is read as a fallback and preserved on the first explicit write.
  Old mute/block policies are not copied across backends.

The upstream [web client](https://github.com/tloncorp/tlon-apps/tree/develop/apps/tlon-web)
uses shared [chat API helpers](https://github.com/tloncorp/tlon-apps/blob/develop/packages/api/src/client/chatApi.ts),
[request definitions](https://github.com/tloncorp/tlon-apps/blob/develop/packages/api/src/client/requests/chat.ts)
and [activity helpers](https://github.com/tloncorp/tlon-apps/blob/develop/packages/api/src/client/activityApi.ts).
These were cross-checked on 2026-11-06. Keep installed-backend codecs authoritative
where that checkout differs from upstream.

## Remaining phases

Group/channel navigation and `%channels` transport are separate work. Removing
`%noschat` from `desk.bill`, archiving/importing its history, richer citations,
chat reactions and threaded chat replies require explicit follow-up work.

## Verification

`cd ui && bun test tests/tlon.test.ts` runs nine contract scenarios written
before the adapter. They cover inbox merging, rich authors, exact IDs/cursors,
group routing, tombstones, invalid data, acknowledgement/nack behavior, group
creation, and subscription cleanup. These are isolated transport checks, not
browser or peer-delivery verification.

Read-only live scries verified the v4 heads, club, DM and unread endpoints on
zod (currently empty). Direct/group message, club creation and mark-read JSON
were also decoded through the installed Hoon `chat-json` library using
`-eval` with that library as a dependency. No test message was published.

The mocked Playwright scenarios in `ui/tests/e2e/app.spec.cjs` cover direct and
multi-person sending, exact pagination cursors, group creation, requests,
negative acknowledgements, per-conversation drafts, live updates during reads,
rich text safety, unavailable-agent recovery and subscription-kick cleanup.
Run `cd ui && bun run test:e2e -- --grep "Tlon|messages inbox|message requests|muted and blocked"`.
Successful group desktop/mobile, direct retry and unavailable-state screenshots
are saved in the corresponding `ui/test-results/playwright/` test directories.
These browser fixtures do not prove live peer delivery. The activity mute JSON
was independently decoded through installed `activity-json` without changing
any live notification settings.
