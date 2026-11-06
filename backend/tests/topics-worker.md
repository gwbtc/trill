# Topics worker acceptance scenarios

Enumerated before implementation. Exercise through a running development ship's
Khan/Spider workflow; preserve the returned report as the verification artifact.

- A valid RSS response produces the same topics, links and source categories.
- Hacker News parsing and keyword classification complete across separate events.
- Empty valid feeds replace old snapshots with a known empty result.
- Invalid XML/JSON, HTTP errors, cancellation and timeouts preserve the last good
  snapshot and record a source-specific error.
- Oversized bodies/items, excessive nesting and excessive item counts cannot
  trigger unbounded parsing in an event. Never truncate XML/JSON and parse it as
  if it were complete.
- Feed descriptions containing CDATA or comments do not create phantom items.
- Timer ticks and repeated manual refreshes cannot create overlapping jobs.
- Removed/disabled sources and changed preferences invalidate in-flight results.
- Loading old agent state preserves preferences, snapshots, timer and verdicts.
- Reloading during a job cannot leave refresh permanently stuck.
- Stage diagnostics report source, bytes, item count and elapsed durations, without
  logging response bodies or credentials.
- A heartbeat timer continues to run during a multi-item fixture refresh.

## Repeatable checks

On the development desk, run `-trill!topics-check`. This executes worker
continuations through Spider/Behn and returns a `%passed` report. It covers RSS
and HN parsing/classification, empty and malformed feeds, body/item/nesting
limits, CDATA/comments across scan batches, the 30-item cap, and a real timeout.

For live transport, run `:topics [%fetch ~]` twice while work is active. Scry
`/diagnostics/noun` during processing: one active source, a bounded queue and
responsive reads should remain. At completion, active and pending are `~` and
`/status/noun` reports per-source fetch times/errors. Inspect `/x/tree` on Spider
if checking thread cleanup alongside unrelated threads on the ship.

Verified on ~zod / %trill on 2026-11-06: fixture passed, ten live sources
completed, errors were empty, and the hourly schedule was retained. Existing
snapshot timestamps survived the `%0` migration and failed-start scenarios.
Wall-clock measurements include the intentional yields. These checks do not
constitute a hard CPU preemption guarantee; threads share Arvo's event loop.
