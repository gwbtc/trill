# Tlon chat migration

The first step is the transport/contract layer in `ui/src/logic/tlon/`.
`IO.getTlonChat()` reuses the already authenticated Airlock connection and
returns one client instance. It does not start watches until requested.
The current screens still use `%noschat`; this change does not switch them,
remove its agent, erase history, or import that history into Tlon.

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
changes. The adapter reports typed event categories; applying deltas to a
shared store belongs to the next migration step.

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

## Next steps

1. Connect a dedicated chat store to this adapter. Subscribe before loading
   the inbox and buffer/reconcile facts during initialization. Keep chat
   availability/loading/errors separate from the main Trill initialization.
2. Move the inbox and conversation views onto the new model, with stable
   club IDs, member/author labels, pending requests and paginated history.
   Preserve drafts and surface failed acknowledgements.
3. Add multi-person DM creation/membership UI. Review `%activity` notification
   volumes before implementing mute; `%chat` watch/unwatch is not a mute API.
   Preserve pinned-chat preferences through an explicit settings migration.
4. Replace the `%noschat` startup/subscriptions and user-entry flows once the
   new screens pass browser tests. Keep old history available until a separate
   archive/import decision; removing `%noschat` from `desk.bill` is deliberate.
5. Add group/channel navigation and its `%channels` APIs as a separate phase.

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
