# Spike: `trips` per-boat hardcoded columns (LAM-30)

> Status: **spike / decision document only**. No SQL, mapping file, or code was changed to produce this
> report — see the Verification section for exactly what was inspected and how.
> Downstream of **LAM-73** (still To Do) — see "Dependency on LAM-73" below.

## 1. What actually exists today (verified against the repo, not assumed)

### 1.1 The Jira claim, checked

> "trips maps to b1_route, b1_type, b1_booked, b1_charterbookingid and so on per boat. b8/b14/b15 were
> missing from the start and their assignments vanished on sync (server.js:1637-1644)."

Confirmed accurate, with one nuance below.

`server.js:1637-1644` (current content):

```js
// §trips: ตารางนี้ map แบบระบุชื่อเรือตายตัว (b1_route, b2_route, …) และตกหล่น b8/b14/b15 ไปตั้งแต่ต้น
// → ถ้าจัด Tadeo / Juliet / Rolanda ลงเส้นทาง การจัดนั้นจะหายตอน sync. เติมคอลัมน์ให้ครบ.
// ⚠ โครงนี้ยังเปราะ — เรือลำใหม่หลังจากนี้ก็ต้องมาเติมมืออีก (ดู BACKLOG)
for(const _b of ['b8','b14','b15']){
  for(const [_c,_t] of [['route','text'],['type','text'],['booked','bigint'],['charterbookingid','text']]){
    await sq(`trips.${_b}_${_c} col`, `ALTER TABLE ${OS_SCHEMA}."trips" ADD COLUMN IF NOT EXISTS "${_b}_${_c}" ${_t}`);
  }
}
```

This is a boot-time patch (2026-07-25, per `BACKLOG.md`) that retroactively adds the four columns for boats
`b8` (Tadeo), `b14` (Juliet), `b15` (Rolanda) — confirmed against `DEFAULT_BOATS` in
`allotment_v2/allotment_v2.html` (`id:'b8'`/`name:'Tadeo'`, `id:'b14'`/`name:'Juliet'`,
`id:'b15'`/`name:'Rolanda'`). The comment says these three were "outside 'available' status" when the
original column set was generated, so the gap was never noticed until they came into service.

### 1.2 The real, current bN_* column list (not just b8/b14/b15)

`os-backend/src/mapping/operation_schemas_model.json` → `trips.columns` (this is the mapper's live schema
snapshot, i.e. what the mapping engine believes the `trips` table looks like — see §2 for how that file is
produced) currently lists **50 boat-scoped columns**, `id` and `key` aside:

| Boat | `route` | `type` | `booked` | `charterbookingid` |
|---|---|---|---|---|
| b1–b5, b7, b9–b12 (11 boats) | ✓ | ✓ | ✓ | **✗ missing** |
| b6 | ✓ | ✓ | ✓ | ✓ |
| b8 | ✓ | ✓ | ✓ | ✓ |
| b13 | ✓ | ✓ | ✓ | ✓ |
| b14 | ✓ | ✓ | ✓ | ✓ |
| b15 | ✓ | ✓ | ✓ | ✓ |

So: **b8/b14/b15 are no longer missing** — the 2026-07-25 patch fixed `route`/`type`/`booked`/`charterbookingid`
for all three, and the mapper (`field_mapping.json`) and DB snapshot (`operation_schemas_model.json`) both
reflect it. What the Jira ticket did **not** call out, and what this spike found instead, is a **second,
still-live instance of the identical bug**: `charterbookingid` exists for only 5 of the 15 boats (`b6`, `b8`,
`b13`, `b14`, `b15`). For the other 11 boats, `trips[date][boatId].charterBookingId` has nowhere to land —
`os_repo.decomposeBlob` silently drops any field with no column in `field_mapping.json` (it only ever writes
`p.dataCols`, which is built from the mapping file, so an unmapped leaf is invisible to it, not an error).
Grep evidence: `charterbookingid` appears in `server.js` **exactly once**, in the b8/b14/b15 loop above — there
is no ALTER statement anywhere in the current `server.js` that ever added it for `b6` or `b13`, and none of
the other 11 boats have it at all. Those two most likely came from a manual one-off DDL run outside the
tracked migration path (matches the "backend-db-implementation branch does ad-hoc DB work" pattern flagged
elsewhere in this codebase's history). **Practical consequence:** today, if any boat other than
`b6/b8/b13/b14/b15` is used for a charter trip, `charterBookingId` for that trip silently fails to persist —
the exact "assignment vanishes on sync" symptom the ticket describes, just for a field instead of a whole boat.

Also confirmed: `database_migration/operation_schemas_model.json` (a second, older copy of the same file
checked into the repo) still lacks b8/b14/b15 **entirely** — it predates the 2026-07-25 patch and was never
regenerated. This is a live case of the schema-model-drift pattern already known in this codebase (compare the
`v_seat_availability` prod-drift precedent) — two "the schema is X" documents disagreeing with each other and
with the live database. Not in scope to fix here, but worth flagging: **whichever normalization plan is
picked, regenerate `database_migration/operation_schemas_model.json` from the live DB as its own step**, don't
assume it is current.

### 1.3 Confirmed shape of the data in the client

`TRIPS` (global, `loveandaman_v2.trips` in the blob) is a plain object keyed by date string:

```
TRIPS[dateStr][boatId] = { route, type, booked, charterBookingId }
```

Verified via `grep` for every `TRIPS[...][...].field` access pattern in `allotment_v2.html` — all instances
match `TRIPS[<dateExpr>][<boatIdExpr>].{route|type|charterBookingId}` (e.g.
`TRIPS[t.date][t.charterBoatId].charterBookingId`, `TRIPS[date][boatId].route`). There is no third nesting
level and no sibling key at the `TRIPS[date]` level other than boat ids — i.e. `TRIPS[date]` is a pure
`boatId → {route,type,booked,charterBookingId}` map. `field_mapping.json`'s `trips` entries confirm the same
thing from the mapper side: every column's `source` is `trips[key].bN.<field>` — a **fixed, enumerated set of
named children** (`b1`, `b2`, … `b15`) under the per-date map element, not a `[]`-array or `[key]`-keyed-map
that the generic mapping engine already knows how to flatten generically.

### 1.4 Why this keeps happening: how the columns actually get created

There is **no live code path** that looks at `BOATS`/`DEFAULT_BOATS` and generates `trips` columns from it.
The `bN_*` columns in `field_mapping.json`/`operation_schemas_model.json` are **snapshots produced by
introspecting a specific sample of the blob** at some point in the past (the doc drift table in
`allotment_v2/docs/workflows/07-data-persistence-api.md` §10 documents the same pattern for other tables).
Concretely:

- The *initial* column set (`b1`–`b7`, `b9`–`b13`, i.e. 13 boats, no `b8`/`b14`/`b15`) reflects whichever
  boats existed with data in `TRIPS` at generation time — b8/b14/b15 existed in `DEFAULT_BOATS` even then, but
  (per the code comment) were not yet in "available" status, so no `TRIPS[date].b8` entry had ever been
  written, so the introspection/generation pass never saw that key and never emitted a column for it.
- The `charterbookingid` sub-columns for only `b6`/`b8`/`b13`/`b14`/`b15` show the same mechanism one level
  deeper: those are the only boats that had ever actually run a charter trip (and so had a
  `charterBookingId` value written) by the time whatever snapshot produced the current mapping was taken.
- **New boats added through the live UI make this fundamentally worse, not just "needs a manual step".**
  `saveCharterBoat()` (quick charter-boat add) assigns `id:'b'+Date.now()` (e.g. `b1755600000000`).
  `fmBoatSave()`'s "ADD MODE" path (the regular Fleet → Boats → Add form) assigns `fields.id=LA_UID('b')`,
  where `LA_UID(p)` (`allotment_v2.html:16`) is `p + Date.now().toString(36) + Math.random().toString(36).slice(2,7)`
  — e.g. `blk3f8j2a9x7q1`. Only the original 15 seed boats use the clean sequential `b1..b15` scheme; every
  boat added since uses a long, effectively-random suffix. A "generate one column per boat id" scheme would
  have to turn arbitrary runtime strings into SQL identifiers (length limits, character sanitization,
  identifier-uniqueness against existing columns, and doing it *before* the first trip assignment is ever
  saved for that boat) — this is materially harder than "remember to add 4 ALTER statements," and nothing in
  the current code attempts it.

## 2. The existing mapping engine (`os_repo.js`) — what it can and can't already do

`os-backend/src/mapping/os_repo.js` is a generic, declarative blob⇄relational-rows engine driven entirely by
`field_mapping.json`. It already has four kinds of top-level/child table shapes:

1. **`scalars`** (`app_meta`): top-level blob keys spread as `key`/`value` rows.
2. **`array`**: blob array → one row per element, `idx` for order, e.g. `sb_bookings`.
3. **`map`** (keyed object): blob object → one row per key, key stored in a `key` column, e.g.
   `vanjob_driver`, `boat_capovr`, `travel_sum`, `ts_cot` (all confirmed via `field_mapping.json`: pattern
   `"<table> map key (original)"` / `"<table>[key].<field>"`).
4. **`map_value_json`**: like `map`, but the *entire* value is stored as one JSON-text column instead of being
   flattened into per-field columns — lossless for any shape, including future fields, with zero schema
   change. Used today for `sb_agents__contracthistory`-style and other "just store the object" cases.

None of these four generic shapes covers `trips[date].bN.field`, because `bN` is not a `[]` array element and
not a `[key]`-keyed map key **from the mapper's point of view** — it's a fixed, named sub-object per boat,
which is precisely why the mapper had to fall back to "flatten every (boat, field) combination into its own
column" instead of using its generic array/map machinery.

### 2.1 This exact problem was already solved once, in this codebase, one table over

`fleet_daily[day][boatId]` used to have **the identical shape and the identical bug** — see
`os_repo.js:119-127`:

> "Same trap as the old engines_e* scheme, one level up: the generated mapping gave `fleet_daily` one column
> per (boat, field) that happened to exist in the snapshot — `b2_fuel`, `b10_fuel`, `b6_fuel`, `b13_fuel`,
> `b12_fuel`, `b10_paxactual`, `b2_paxactual`. Any boat outside that list lost its litres on every save…"

The fix that shipped: a dedicated child table `fleet_daily__boat` with columns `(fleet_daily_id, key, value)`
— one row per `(day, boatId)`, `key = boatId`, `value = JSON.stringify({...every non-trips field for that
boat})`. `os_repo.js` hand-codes two small functions, `fleetDailyAssembleFix`/`fleetDailyDecompose`, that sit
outside the generic plan (because two levels of open-ended keying — day, then boat — is one level deeper than
the generic engine's single-level map/array plan currently reaches) and are called explicitly from
`assembleBlob`/`decomposeBlob`. The old `bN_fuel`-style columns were **left in place, unused for new writes**,
so no migration of historical data was required for that fix — it was pure copy of the fix comment, not
something this spike is proposing to imitate structurally (`trips` needs the old data actually migrated, see
§4, because `booked`/`route`/`type` are read on every Boat Operation page load, not just written).

`vanjob_driver` / `boat_capovr` (§2, point 3 above) are a second, simpler precedent: flat keyed maps
(`"date::boatId"` as one string key) that already support "any id, any day" with zero schema change, cited by
name in `BACKLOG.md` as "the pattern that's already correct, reference it."

**`trips` is structurally the closer match to `fleet_daily[day][boatId]`** (two real nesting levels: date,
then boat) than to `vanjob_driver` (one flat composite-string key) — so `fleet_daily__boat` is the more
directly reusable template of the two, both for the JSON-child-table option and for the "who else touches
this pattern" precedent when justifying the design to a reviewer.

## 3. Option comparison

### Option A — Normalize to a child table

Add `trips__byboat` (or similar): `(id, trips_id FK → trips.id, key text /* boatId */, value text /* JSON:
{route,type,booked,charterBookingId,...} */)`, exactly mirroring `fleet_daily__boat`. `os_repo.js` gets one
small hand-written assemble/decompose pair (or, if the generic `map_value_json` "child of an already-map
top-level table" shape is extended to support it declaratively — see 3.1 below — it needs no hand-written
code at all).

**What it costs on the `assembleBlob`/`decomposeBlob` path:**
- If done generically (extending the plan builder to recognize "value stored whole as JSON, keyed under a
  parent map's element" as a reusable child-table kind): **zero new hand-written functions**, just new
  `field_mapping.json` entries — the same effort as adding any other table today. This is the cleaner
  target if the generic engine is extended once.
- If done the way `fleet_daily__boat` was actually done (fastest, proven, no engine changes needed): two
  small functions (~15-25 lines total, closely following `fleetDailyAssembleFix`/`fleetDailyDecompose`)
  wired explicitly into `assembleBlob`/`decomposeBlob`, plus the `field_mapping.json`/model entries for the
  new table (marked so the generic per-column loop skips it, the same way `FD_TRIPS`/`FD_BOAT` are handled
  today — those two tables' rows aren't reconstructed by the generic per-column path either).
- Either way: **adding a boat requires zero schema edits, ever** — a new `boatId` is just a new `key` value in
  an existing table, indistinguishable in shape from the 16th boat vs. the 116th.
- One-time cost: a migration to read every existing `bN_route`/`bN_type`/`bN_booked`/`bN_charterbookingid`
  column pair on every row of `trips`, and write it into the new child table (§4). The old columns can be
  **left in place, unused**, exactly as `fleet_daily`'s old `bN_fuel` columns were left in place — this avoids
  a hard cutover and gives a trivial rollback (§ below).
- Ongoing cost: every `trips` read now does a second query/join (or a second parallel `SELECT` the way
  `relLoad` already fires ~103 parallel `SELECT`s per load — `fleet_daily__boat` already added exactly this
  cost with no reported issue) instead of the boat-scoped fields riding along in the same row as the date. For
  a table already following the "one query per relational table, assembled in memory" pattern the whole
  backend uses, this is proportionate, not novel overhead.

### Option B — Generate columns from `BOATS` (keep the fixed-column shape, just automate it)

Add code (client `save('operations')`, or a server boot step, or both) that diffs `BOATS`/`DEFAULT_BOATS`
against the known `bN_*` columns and emits `ALTER TABLE ... ADD COLUMN` for any boat missing all four columns.

**What it costs on the `assembleBlob`/`decomposeBlob` path:**
- The generic engine's column loop already works fine for scalar leaf paths, so no `os_repo.js` change is
  needed **once the columns exist** — but `field_mapping.json` (and `operation_schemas_model.json`, which is
  also `require()`'d directly by `server.js`) must be kept in lock-step with the live schema, since
  `buildPlan()` only knows about columns present in that static, checked-in JSON file. That means the
  generator has to **regenerate and commit `field_mapping.json` on every boat addition** — a code change,
  not just a DDL change, is required per new boat, or the new boat's data is written to Postgres but
  invisible to `assembleBlob` until the mapping file catches up. This is a strictly larger footprint than
  Option A's one-time migration; it's a *recurring* footprint, forever.
- The boat-id-as-SQL-identifier problem (§1.4): auto-added boats use `LA_UID('b')` / `'b'+Date.now()`
  suffixes, not small sequential integers. Turning those into SQL column-name fragments needs sanitization
  (Postgres identifier length is 63 bytes; the `bN_charterbookingid` pattern alone is already 21+ chars of
  overhead) and a defensible collision/quoting story for a value that ultimately comes from user-triggered
  boat creation. Sequential re-numbering (assign `b16`, `b17`, … regardless of the boat's real `id`) is
  possible but adds an *extra* generated-vs-real-id mapping to keep straight — one more place for the exact
  "silently drops a boat" class of bug to recur if that translation layer has its own gaps.
  **This makes Option B materially more code than "add columns from BOATS" sounds like at first glance** —
  it isn't a couple of `ALTER TABLE`s, it's an identifier-generation subsystem.
- Ongoing cost per boat: 4 new columns forever, `trips` keeps growing wider (currently 52 columns for 15
  boats; unbounded growth is the entire premise of the ticket). No new columns are needed for a query cost
  perspective, but the *documented, human-verifiable state of the schema* keeps drifting, which is exactly
  the failure this spike was opened to investigate — the two-tier problem in §1.4 (two of five patched boats
  only got half the columns because someone hand-added them) is a preview of what "automated but still
  bolted-on" looks like at scale.
- **Option B does not remove the "new field on an existing boat" failure mode either.** `charterBookingId`
  landing for only 5 of 15 boats happened *after* the base `route`/`type`/`booked` columns already existed
  for those boats — adding a new field to the per-boat shape (not just a new boat) is a second axis of the
  same bug that column-generation-from-`BOATS` does not address at all, because it only reacts to the boat
  list, not to new fields on the per-boat object. Option A/3.1's `value` JSON column absorbs new fields with
  no schema or mapping change, by construction.

### 3.1 Recommendation: Option A (normalize), following the `fleet_daily__boat` precedent

Reasoning, in order of weight:

1. **This exact design tradeoff was already made, in this codebase, for a structurally identical table**, and
   the JSON-child-table answer won — with a comment explaining why in the source. Diverging from that
   precedent for `trips` would need a reason specific to `trips` that doesn't apply to `fleet_daily`; none
   was found in this spike (same read/write frequency pattern — Boat Operation page loads a date range and
   assigns boats per date, structurally identical to Fleet Daily's per-day-per-boat editing).
2. **Option B is not actually simpler.** It looks smaller ("just add ALTER statements") until the boat-id
   sanitization problem (§1.4, §3-B) and the "must regenerate `field_mapping.json` on every boat addition"
   problem are accounted for — at that point it's a recurring, code-shaped obligation forever, versus
   Option A's one-time migration plus a stable generic shape.
3. **Option B leaves the `charterBookingId`-style "new field, not new boat" gap completely open.** This spike
   found that gap live, today, for 11 of 15 boats (§1.2). Option A closes it as a side effect (the whole
   per-boat object is one JSON blob); Option B would need a *third* mechanism on top of boat-column-generation
   to close it.
4. **Cost to the `assembleBlob`/`decomposeBlob` path is bounded and well-precedented** (§3-A) — reuse the
   `fleet_daily__boat` code shape almost verbatim, or invest once in generalizing the plan builder to handle
   "map of map, inner value stored whole as JSON" declaratively (worth doing regardless of `trips`, since it
   would also let a future table skip hand-written assemble/decompose functions the way `fleet_daily__boat`
   currently needs them).

## 4. Migration plan (prose — no SQL/code written for this spike)

1. **Confirm which columns are real before writing anything.** Re-run the equivalent of §1.2's introspection
   against the *live* production `trips` table right before the migration ships (not from either checked-in
   snapshot file, which this spike found already disagree with each other — §1.2). This mirrors the existing
   project rule ("build view migrations from `pg_get_viewdef`, never from the repo file") applied to a table
   instead of a view.
2. **Add the new table without touching the old columns.** `CREATE TABLE trips__byboat (row_pk text primary
   key, trips_id text references trips(id), key text /* boatId */, value text /* JSON */)`, plus its
   `field_mapping.json`/`operation_schemas_model.json` entries and (if going the hand-written route) the
   `assemble`/`decompose` pair modeled on `fleetDailyAssembleFix`/`fleetDailyDecompose`. This step alone is
   additive and safe to deploy — nothing reads from the new table yet, so no existing behavior can regress.
3. **Backfill.** One idempotent pass (same shape as the "back-fill migration pattern" this codebase already
   uses for `FL_DEFAULT_*` lists) that, for every row in `trips`, reads every `bN_route`/`bN_type`/
   `bN_booked`/`bN_charterbookingid` group that has any non-null value, and inserts one `trips__byboat` row
   per boat with `value = JSON.stringify({route,type,booked,charterBookingId})` (omitting null fields).
   Idempotency: skip a `(trips_id, key)` pair that already has a row, so re-running the backfill after a
   partial failure or a later deploy never double-writes or clobbers a value someone already edited through
   the new path. This step can run once at boot (like the existing `ALTER TABLE IF NOT EXISTS` blocks) or as
   a one-off ops script; either is consistent with existing patterns in `server.js:initDb`.
4. **Switch the read/write path.** `assembleBlob` starts reconstructing `TRIPS[date][boatId]` from
   `trips__byboat` instead of (or merged with, favoring the new table on conflict, the same "merge, never
   clobber" discipline this codebase already applies to the shared blob) the flat `bN_*` columns.
   `decomposeBlob` stops emitting `bN_*` values and starts emitting one `trips__byboat` row per boat present
   in `TRIPS[date]`. **The old `bN_*` columns are left in place, unused for new writes** — exactly as
   `fleet_daily`'s old `bN_fuel` columns were left in place after its equivalent fix — so there is no
   destructive `DROP COLUMN` step and the change is trivially reversible (see Rollback below).
5. **Verify with scratch records**, per this project's stated preference for E2E-against-live-DB over
   touching real data: create a `zz_test_*` trip-day entry, assign a boat whose id does **not** match any
   `bN_*` pattern (e.g. simulate a `LA_UID('b')`-style id), confirm it round-trips through save → reload →
   Boat Operation page with no code change required for that boat, then delete and confirm zero residue.
   Also verify an existing real boat's historical `route`/`type`/`booked`/`charterBookingId` values are
   readable through the new path exactly as before the cutover, for a date range that spans pre- and
   post-migration writes.
6. **Only after the read/write path has been on the new table in production for a full sales cycle** (so that
   any residual value is either migrated or genuinely stale) does dropping the old `bN_*` columns become a
   candidate for a later, separate cleanup task — not part of this migration.

**Adding a boat after this migration ships:** none of the steps above are boat-count-dependent. A sixteenth,
fortieth, or charter-quick-add boat with a `LA_UID('b')`-style id needs **zero schema edits** — it's simply a
new `key` value the next time `TRIPS[date][thatBoatId]` is written.

### Rollback

Because the old `bN_*` columns are never dropped, rollback is: revert the `assembleBlob`/`decomposeBlob`
change so the read/write path goes back to the flat columns. Any `trips__byboat` rows written *after* the
cutover (i.e. for boats/fields that never had a `bN_*` slot to begin with, or edits made only through the new
path) would not be visible again until the forward migration is re-applied — this is the same category of
one-directional-data-loss-on-rollback risk this codebase already accepts for its other additive-column
migrations (e.g. the `pierpayments`/`ops_vancheckin`/`ops_boatsplits`/`ops_piernote` additions all describe
exactly this shape of risk in their own comments). Flag this explicitly to whoever picks up the follow-up
implementation task, and keep the rollback window short (see step 6).

## 5. Dependency on LAM-73

**LAM-73 is still To Do** and, per its own scope, decides the fate of `db/migrations/` (currently deleted at
`094dde1`, restored to the mapping engine only — not the migrations folder — by `1c10d84`; see
`allotment_v2/docs/workflows/07-data-persistence-api.md` §0 for the full history). Whatever mechanism LAM-73
settles on for *how* schema migrations are written, tracked, and applied going forward (a `db/migrations/*.sql`
ladder, `initDb`'s inline `ALTER TABLE IF NOT EXISTS` blocks, or something else) is the mechanism the
migration plan in §4 above should be implemented through. This document does not assume an answer to that
question — it describes the migration in prose precisely so it can be slotted into whichever mechanism LAM-73
lands on, rather than being written now against a migration system that may not be there when it's actually
implemented.

## 6. Summary

| Question | Answer |
|---|---|
| Is the Jira claim (b8/b14/b15 missing, `server.js:1637-1644`) accurate? | Yes, and already patched for those 3 boats' `route`/`type`/`booked`/`charterbookingid`. |
| Is the underlying bug still live today? | Yes — `charterBookingId` still has no column for 11 of the 15 boats; same failure class, different field. |
| Normalize to a child table, or generate columns from `BOATS`? | **Normalize** (Option A), following the `fleet_daily__boat` precedent already in this codebase. |
| Cost on `assembleBlob`/`decomposeBlob`? | One new table + a small hand-written assemble/decompose pair (or a one-time generalization of the plan builder), modeled almost line-for-line on the existing `fleet_daily__boat` fix. |
| Does "add a boat" need schema edits after the fix? | No — zero, by construction, for any boat id shape including the non-sequential ids the app already generates at runtime. |
| Blocked on anything? | LAM-73 (still To Do) decides the migration *mechanism*; this plan is written to be mechanism-agnostic so it can slot into that decision once made. |
