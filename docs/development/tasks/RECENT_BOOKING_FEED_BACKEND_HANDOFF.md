# recent-booking-feed: implementation handoff (partial)

**Status: work in progress — not ready to deploy or integrate as authoritative metrics.**

## Input contract

- Requested outcome: B2C ingestion, recent creation-time feed and optional daily aggregates; push current work when requested.
- Acceptance: scoped authenticated feeds, Bangkok dates, stable pagination, source/payment/cancellation fidelity and idempotent ingestion.
- Scope: backend booking stores, routes, migration and documentation only.
- Constraints: no legacy `/api/load`, browser preload or frontend changes. **B2C database queries are excluded by the user; they will change separately.**
- Base: `main`. The developer approved the design note, then requested this partial snapshot be pushed.

## Implemented so far

| Area | Before | Current implementation |
|---|---|---|
| Booking list | Travel-date filters only | Separate `/v1/bookings/recent` creation-time route |
| Stores | No creation range/source filtering | Both stores support `createdFrom`, exclusive `createdTo`, `source` |
| Source | No durable columns | Migration 223 adds `source`, `channel`, and source/creation index |

### Current endpoint (not final contract)

```http
GET /v1/bookings/recent?created_from=2026-10-01&created_to=2026-10-07&source=b2c&limit=100
Authorization: Bearer <token>
```

- Both dates required, YYYY-MM-DD; reversed ranges rejected.
- Inclusive Bangkok days: start at 00:00 +07:00; end is midnight after `created_to`.
- `source`: `all` (default), `b2c`, `b2b`.
- Default limit 100; allowed 1–200.
- Sort descending by `(created_at, id)`.
- Current response is the existing booking page: `{ bookings, total, next_cursor? }`.
  At exhaustion `next_cursor` is omitted, **not null**. Booking rows are full existing views,
  not the proposed compact projection. Missing totals are not replaced with zero.
- Cancelled/rejected rows are retained. Travel-date endpoint semantics are unchanged.
- Existing cursor encoding is reused: base64url JSON of creation time and ID. **Not signed or bound to query filters.**
- Route handler applies agent filtering, but the central ownership hook currently mistakes `recent`
  for a booking ID and returns 404 for agents. **Fix before frontend adoption.**
- Staff reads follow existing authentication, including the existing auth-disabled local mode.

### Current source behavior

New bookings are classified from agent ID: `a_b2c` → `b2c`/`website`, other agents → `b2b`,
no agent → `staff`. This is not yet trusted-integration provenance. Explicit source/channel input
is not parsed or refused. The approved authority rules are therefore not finished.

Migration 223 backfills `a_b2c` as `b2c`, all others as `b2b`. It leaves channel null and defaults
source to `b2b`. Legacy ID-prefix B2C records without that agent are not covered. Legacy imports
have not been updated to populate these fields. No legacy counts or migration rehearsal were run.

`created_at` still means the existing stored creation time. Source-created time on ingestion has
not been implemented. Existing payment/cancellation fields and commands are unchanged.

## Files changed

- `src/domain/operations.ts`: source types/fields and in-memory range/source filtering.
- `src/domain/postgres-operations.ts`: source persistence, mapper and SQL range/source filtering.
- `src/routes/operations.ts`: recent route, parser and initial source classification.
- `migrations/223_booking_source.sql`: source/channel columns, backfill and index.
- `todo/recent-booking-feed-model.md`: original proposed design (approval in conversation; not all decisions implemented).
- This handoff and `.agent-reports/recent-booking-feed.json`: status/evidence.

## Verification evidence

- `npm run check`: passed on this snapshot.
- `npm test`: 581 tests; 573 passed, 0 failed, 8 skipped (in-process suite).
- PostgreSQL suite: **not run**. Use a fresh local database, apply migrations, then
  `DATABASE_URL=<fresh-local-db> npm test`.
- Dedicated recent endpoint/date/auth/cursor tests: not added. Existing green tests do not prove this feature.

## Remaining implementation

1. Fix agent authorization for the static recent route; add staff/view-only/agent/no-token tests.
2. Validate real calendar dates and malformed cursors; bind cursor to filters and agent scope.
   Decide signature/key handling and final null/omitted cursor response.
3. Finalize durable classification/backfill/import behavior; reject attempts to overwrite owned
   fields. Count legacy data read-only before changing constraints or classifications.
4. Resolve source-created versus server-ingested timestamp; preserve source creation on retries.
5. Build ingestion adapter/webhook, durable replay handling and health diagnostics independently
   of the deferred B2C database query. No poller/webhook/health implementation exists in this snapshot.
6. Implement optional `/v1/dashboard/booking-activity` after agreeing revenue, pax and cancellation
   semantics. Do not label current results as completed dashboard KPIs.
7. Add README/OpenAPI and Love Kingdom integration contract documentation; implement focused tests
   and run both stores, including migration rehearsal.

## Frontend handoff

Do not remove the temporary fallback in production on the strength of this snapshot. Once the above
work is complete: request only visible recent rows, use Bangkok creation-day ranges, keep Calendar
and By-trip travel-scoped, cache by complete parameters and invalidate after writes/change-feed
notifications. Show loading/error rather than authoritative zero. No aggregate endpoint is shipped.

## Git and rollback

- Branch: `feat/recent-booking-feed`; worktree: `D:/projects/operation-backend`.
- Commit: `ab80b796bf7d4877906a2e7ce95b45f84e330a61` (implementation snapshot).
- PR: none requested; push only. Do not merge this partial snapshot.
- Rollback: revert this feature commit before deployment. If migration 223 was applied, reverting
  code does not undo its columns/index; a separately reviewed migration would be required to drop them.
- Unrelated untracked `.claude/`, `docs/performance/`, and `verify.json` left untouched.
