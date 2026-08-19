# Test harness (LAM-22 / S1-08)

Runs on Node's built-in test runner (`node:test`, stable since Node 18) — no test-framework
devDependency needed. Run everything with:

```sh
node --test
```

(Node's default discovery walks `test/` recursively for `*.test.mjs`; `test/fixtures/` and
`test/helpers/` are plain modules with no `test()` calls, so they show up as trivially-passing
"suites" with zero assertions — harmless.)

## Layout

- `test/fixtures/booking.mjs` — pure, DOM-free builder for a valid `SB_BOOKINGS` record
  (`buildBooking()`, `buildTrip()`, `buildPassenger()`). Field names verified against
  `os-backend/src/mapping/field_mapping.json`, the actual source the relational write path reads.
- `test/unit/booking-fixture.test.mjs` — validates the fixture's own shape. Always runs, no DB.
- `test/helpers/db.mjs` — thin `pg` wrapper: pool from `DATABASE_URL`, `hasBookingSchema()`
  precondition check, `fetchBookingRow()` / `deleteBooking()` for the e2e test.
- `test/helpers/server.mjs` — spawns the real `server.js` as a child process, waits for it to
  listen, and returns a session-cookie-bound HTTP client (`loginClient`).
- `test/e2e/booking-write-path.test.mjs` — the required end-to-end proof: logs in, `POST
  /api/v1/_batch` a fixture booking (the same endpoint `bkV2CommitBooking` hits in the browser),
  then reads the row back with an independent Postgres connection.

## Why the e2e test currently skips

It needs `operation_schemas.sb_bookings` (+ `sb_bookings__trips`, `sb_bookings__passengers`) and
`operation_schemas.users` to already exist on `DATABASE_URL`. Those tables are created by
`db/migrations/002_add_operation_schemas.sql`, which was deleted from this branch at `094dde1` and
has not been rebuilt/restored — that decision belongs to **LAM-73**. Until then:

- With no `DATABASE_URL` set: skips with `"DATABASE_URL not set — no Postgres reachable..."`.
- With `DATABASE_URL` set but the schema missing: skips with `"...blocked on LAM-73..."`.

No code change is needed here once LAM-73 lands — `hasBookingSchema()` will start returning `true`
and the test runs for real. See `docs/development/tasks/LAM-22.md` for the exact verification that
was run (a real, fully-isolated ephemeral Postgres, not the target CI's) proving this skip logic
is correct and that `server.js` itself boots safely — without crashing — against a Postgres that
has no `operation_schemas` tables at all.

## CI

`.github/workflows/tests.yml` provisions an ephemeral `postgres:16` service container, applies
`db/migrations/*.sql` if the directory exists (currently it does not — see above), runs `node
--test`, then runs the existing `db/test_seat_lock_race.mjs` concurrency proof (non-blocking — see
the workflow file's comment for a pre-existing, out-of-scope TLS bug in that script).
