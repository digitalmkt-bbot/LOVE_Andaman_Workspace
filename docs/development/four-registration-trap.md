# The four-registration trap

> LAM-28 (S2-04). Source of truth: `allotment_v2/docs/workflows/07-data-persistence-api.md`
> §4 ("Adding a new persisted field") and §10 invariant 5. This document is a companion —
> read those sections first; this one adds the CI check and the scaffolding tool that back
> them.

## The trap

**A new persisted field needs FOUR registrations — persist helper, both client load paths,
`field_mapping.json`, `operation_schemas_model.json` — plus a real database column. Miss any
one and the data silently disappears.**

The symptom is always identical and always misread as a UI bug: *you fill the field in, it
saves with no error, you refresh, it's gone.* There are several different root causes with
that one symptom — which registration got skipped determines when and for whom the data
vanishes:

| Skipped step | Symptom |
|---|---|
| Persist helper never writes the field | Never leaves the browser tab that entered it. Lost on that user's own refresh. |
| `_laReloadData()` (the second load path) never reads it | Survives a hard reload, then vanishes the moment *anyone* saves anything and the SSE refresh fires. |
| `field_mapping.json` has no entry | Blob round-trip through the relational layer drops the key; a fresh load from Postgres never has it. |
| `operation_schemas_model.json` has no matching column | The mapper has nowhere to put the value even if `field_mapping.json` names it; the `INSERT` column list omits it. |
| No real DB column | The above two files agree the field exists, but the write fails or is silently truncated by Postgres — the mapping is "correct" and still lies. |

Two of these five (`field_mapping.json` and `operation_schemas_model.json`) are static JSON
that can be cross-checked without a database or a browser. That is what
`tools/check-mapping-drift.mjs` does, on every PR, via `npm run check:mapping-drift`. It
cannot see the other three — the persist helper and the two client load paths are structural
JavaScript inside the ~46k-line `allotment_v2.html`, not tabular data — so it does not replace
the checklist below, only the two steps that are easy to get right for the JSON files and easy
to silently drift for anyone editing them by hand later.

The database-column side (step 7 below, and the DDL) is covered separately by
`.github/workflows/ci-boot-smoke.yml` (LAM-16), which boots `server.js` against a scratch
Postgres and asserts `/api/version`'s `map.*`/`db.*` drift counters and `mig.failed`/
`mig.pending` are all zero.

## The checklist (from workflow §4)

1. **Add the field to the client global** and give it a default. Never rename or delete an
   existing field — mark it inactive instead.
2. **Persist it.** Extend the store's existing persist helper. Read-modify-write; assign only
   your keys.
3. **Load it — in BOTH places.** This is the most-missed step, because there are two
   independent load paths:
   - the store's own boot IIFE / `flLoad()` / `loadData()`;
   - **`window._laReloadData()` at `allotment_v2.html:41535`**, used by every soft-refresh and
     by the async-load recovery.
   Miss the second and the value survives a hard reload but vanishes the moment a colleague
   saves anything (that fires an SSE refresh). The source says so itself at `:41561`:
   > *"ต้องโหลดตรงนี้ด้วย ไม่งั้น key ที่ persist แล้วแต่ไม่มีใครโหลด = หายทุกครั้งที่ refresh
   > (บั๊กนี้เคยกิน `sb_bookings` มาแล้ว)"*
4. **Use the right load condition.** Arrays: `if(Array.isArray(d.k)) G = d.k;` — accepts an
   empty array so a deliberately-cleared list **stays cleared** and does not revert to seed.
   Maps: `if(d.k) G = d.k;`.
5. **Add the column to the mapper** — `os-backend/src/mapping/field_mapping.json`. Choose the
   kind: `scalar` for a plain value; `json_text` for a nested object/array you don't want to
   shred into a child table; a `map_key`/`map_value_json` pair for an open-ended keyed map —
   never one column per key.
6. **Add the column to `operation_schemas_model.json`** — `OS_COLS` is built from it and drives
   the `INSERT` column list on every save.
7. **Create the column in the database.** Either a new file in `db/migrations/` (auto-run at
   boot) or an `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in the `initDb()` relational block.
8. **Redeploy and read `/api/version`.** `map.tables`/`map.columns` and `db.missing` must both
   be 0.

Run `npm run scaffold:registration` (see below) to print this checklist pre-filled with your
field's name, table(s), and generated column name, so step 5/6's exact JSON snippets and step
7's `ALTER TABLE` are ready to paste rather than re-derived from scratch.

## Worked example — `ops.pierNote`

Booking gained "what the customer said at the pier" = `{t, at, by}`. This was the third time
the same class of bug shipped for a booking field before the checklist above existed. It lands
on the booking record at two levels — booking-level `ops` and per-trip `ops` — because a
booking has both, and adding the field to only one loses half the data. This is why
`ops_piernote` appears twice below: once under `sb_bookings`, once under
`sb_bookings__trips`. (`ops_vancheckin` / `ops_piercheckin` / `ops_boatsplits` are all done in
pairs for the same reason.)

This example is committed here **as documentation only** — it describes a registration that
already exists in the live mapping files (`field_mapping.json` / `operation_schemas_model.json`
already carry `ops_piernote` on both tables; `server.js` already has the matching
`ALTER TABLE … ADD COLUMN IF NOT EXISTS "ops_piernote" text` for both). It is not a new field
being introduced by this change.

| Step | Change |
|---|---|
| 1. client field | `bk.ops.pierNote = {t, at, by}` on the booking record |
| 2. persist | booking's persist helper writes `d.sb_bookings` wholesale — already covered |
| 3. load (both paths) | `_laReloadData` (`allotment_v2.html:41535`) reloads `sb_bookings` wholesale — already covered |
| edit-preserve (booking-specific, not one of the four, but the same failure shape) | `bkV2CommitBooking`'s `if(editing)` block must carry `ops` over — it rebuilds a fresh object on every edit |
| 4. mapper | `field_mapping.json`: `sb_bookings.ops_piernote` → `{"source": "ops.pierNote", "kind": "json_text", "db_type": "text"}`, and `sb_bookings__trips.ops_piernote` → `{"source": "trips[].ops.pierNote", "kind": "json_text", "db_type": "text"}` — whole blob in one column, so fields added *inside* the note later need no backend change |
| 5. model | `operation_schemas_model.json`: `ops_piernote text` on both `sb_bookings.columns` and `sb_bookings__trips.columns` |
| 6. DDL | `server.js:1628` — `ALTER TABLE … ADD COLUMN IF NOT EXISTS "ops_piernote" text`, run for both tables |

Reproduce the same printout for a hypothetical *new* field with:

```bash
node tools/scaffold-registration.mjs \
  --client-path "ops.pierNote" \
  --column ops_piernote \
  --kind json_text \
  --db-type text \
  --tables sb_bookings,sb_bookings__trips \
  --persist-helper sbBookingsPersist \
  --load-fn "window._laReloadData"
```

## The CI check

`tools/check-mapping-drift.mjs` (run via `npm run check:mapping-drift`, wired into
`.github/workflows/mapping-drift.yml` on every PR into `refactor/booking-v2-migration` and
`main`) statically compares `os-backend/src/mapping/field_mapping.json` against
`os-backend/src/mapping/operation_schemas_model.json`, table by table, and fails when:

- a column exists in `operation_schemas_model.json` with no matching field entry in
  `field_mapping.json` for that table ("model field has no mapping entry"), or
- a field entry exists in `field_mapping.json` with no matching column in
  `operation_schemas_model.json` for that table ("mapping entry has no column").

It needs no database and no sample data, so it runs in a few hundred milliseconds in CI.

It restores the *capability* — catching the two registrations most likely to silently drift —
of the deleted `os-backend/scripts/check_mapping_drift.js` (removed at `094dde1`, "chore:
remove os-backend, erp, db/migrations, and stale mockups"). It is not the same check: the
deleted script diffed a live data blob through a decompose/assemble round-trip against
`os_repo.js` and needed a real sample blob to run; this one is a pure structural diff of the
two mapping source files and needs neither a blob nor a database, which is what makes it
practical to run unconditionally on every PR.

**Result on the current repo (2026-08-19, HEAD `e7d28f0`):** `npm run check:mapping-drift`
reports **0 drift** — 130 tables compared, every model column has a mapping entry and every
mapping entry has a column. `field_mapping.json` and `operation_schemas_model.json` are
already kept in lockstep by whatever process produced the "Mapper update 2026-07: lossless
blob<->operation_schemas round-trip" commit (`b5e5c0f`); this check exists to keep them that
way as both files are hand-edited going forward, not because it found existing drift.

## The scaffolding tool

`tools/scaffold-registration.mjs` (run via `npm run scaffold:registration`) does not edit any
file — `field_mapping.json` and `operation_schemas_model.json` are live persistence mappings,
and a script has no business rewriting them unattended. It prints:

- the client-field default snippet (step 1),
- a pointer to the persist helper to extend (step 2),
- the two load paths to update, with the exact line/quote from the source (step 3),
- the `field_mapping.json` entry to paste, for every table given (step 4/5),
- the `operation_schemas_model.json` column entry to paste, for every table given (step 5/6),
- the `ALTER TABLE … ADD COLUMN IF NOT EXISTS` DDL for every table given (step 6/7),
- a reminder to check `bkV2CommitBooking`'s edit-preserve block if the field lives on a
  booking, and
- the `/api/version` check and the `npm run check:mapping-drift` command to close the loop.

Every flag has a default, so `node tools/scaffold-registration.mjs` with no arguments prints a
runnable template.
