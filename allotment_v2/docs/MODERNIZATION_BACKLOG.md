# Love Andaman — Modernization Backlog

Scrum epics and sprint plan derived **only** from `docs/workflows/01`–`08` and their cited code.
Every story below traces to a documented, line-cited finding. Nothing here is aspirational
best-practice filler.

Baseline commit: `094dde1` on `refactor/booking-v2-migration`.

## Planning assumptions (change these before you commit to dates)

| Assumption | Value | Why |
|---|---|---|
| Sprint length | 2 weeks / 10 working days | Not specified in any local doc — pick your own |
| Team | 2–3 developers | Not specified in any local doc |
| Capacity | ~40 points/sprint | Derived from the above; recalibrate after Sprint 1 |
| Point scale | Fibonacci; 1 pt ≈ half a day | — |
| Definition of Done | Change is covered by a test that fails without it, and the doc in `docs/workflows/` describing the behavior is updated in the same PR | The workflow docs are now the only surviving history — `CHANGELOG.md` does not exist |

**Sequencing constraint that overrides everything:** Sprint 1 is not negotiable. The server does not
boot and there are no tests, so any story from a later epic shipped before Sprint 1 completes is
unverifiable by construction.

---

# Epics

| ID | Epic | Theme | Why it exists |
|---|---|---|---|
| E1 | Restore a Working Build | Blocker | `server.js` cannot start; the mapper and every maintenance script are deleted |
| E2 | Stop Data Loss | Correctness | Six documented paths silently discard user work |
| E3 | Regression Safety Net | Foundation | Zero automated tests exist against a transactional multi-store write path |
| E4 | Persistence Hardening | Architecture | A new field needs **four** correct registrations or it vanishes |
| E5 | Money Correctness | Correctness | Documented 17× cost overstatement; VAT/WHT/void gaps |
| E6 | Purge Seed Mutations from Production | Correctness | Demo seeders rewrite real agent data on every boot |
| E7 | Runtime Errors & Timezone | Correctness | A known thrown exception in the agent UI; `toISOString` date drift |
| E8 | Permission Model Coherence | Correctness | Edit-area gates disagree between callers and callees |
| E9 | Documentation Truth | Foundation | 12 documented drift items; the cited history file does not exist |
| E10 | Observability & Drift Detection | Foundation | Drift checks exist as endpoints but their tooling was deleted |
| E11 | Modularize `allotment_v2.html` | Architecture | 83,629 lines, one file, one global scope |
| E12 | Multi-day / OVN Correctness | Correctness | `bk.ops` is day-1-only; every OVN bug traces to direct access |
| E13 | Fleet Data Integrity | Correctness | Four writers bypass `flSave()`; dead snapshot system |
| E14 | Performance & Load Path | Quality | Whole-blob load, brotli-tuned cache, synchronous render assumptions |

---

# Sprint 1 — Make it run, make it verifiable

**Sprint goal:** the server boots from a clean checkout, CI proves it, and the two data-loss defects
that need no test infrastructure are closed.

**Committed: 39 points**

### S1-01 · Restore `os-backend/` and `db/migrations/` — 3 pts · E1

`server.js:34-35` unconditionally requires `./os-backend/src/mapping/os_repo.js`; commit `094dde1`
deleted that tree (83 files). The require is at module top level, so it fires in blob mode too, not
only under `DATA_BACKEND=relational`. Verified: `node -e "require('./server.js')"` →
`Cannot find module`. (07 §0)

- [ ] `git checkout HEAD~1 -- os-backend db/migrations`
- [ ] `node -e "require('./server.js')"` exits 0
- [ ] Decide explicitly whether the deletion was intentional; if so this story becomes "inline the
      mapper" and is re-estimated at 13 pts
- [ ] `.railwayignore`'s "os-backend kept" comment matches reality again

**AC:** clean clone + `npm ci` + `npm start` serves without throwing.

### S1-02 · CI boot smoke test — 3 pts · E1, E10

Nothing in the repo would have caught S1-01. (07 §0)

- [ ] CI job runs `require('./server.js')` and one `/api/version` request against a scratch DB
- [ ] Job is required to merge
- [ ] Fails loudly if `map.*` or `db.*` drift counters are non-zero, or `mig.failed`/`mig.pending` > 0 (07 §10.18)

### S1-03 · Fix the accounting/operations permission gate — 5 pts · E2, E8

`sbInvoicesPersist:42846` gates on `laCanEditArea('accounting')` but calls `acctPersistBookings:42877`,
gated on `'operations'`. An accounting-only user's invoice saves; the linked booking's `invoiceId`,
`paymentStatus` and history stay in RAM and are lost on refresh — the booking looks un-invoiced next
session even though the invoice exists. Same shape: `ckPersist` accepts `pier`, `acctPersistBookings`
does not (03 §9.8). (06 §10.1)

- [ ] Decide the rule: either accounting implies operations-write-on-bookings, or the booking stamp
      moves to a persist path accounting may call
- [ ] No persist helper may call another with a stricter area than its own — add a test asserting this
- [ ] Audit all six areas (`operations`, `accounting`, `sales`, `fleet`, `pier`, `config`) for the same shape

**AC:** an `accounting`-only user creates an invoice, reloads, and the booking still shows invoiced.

### S1-04 · Weather reschedule must clear `bk.ops` — 3 pts · E2, E12

`bkV2WeatherResolveOne:60032` moves `trip.date` without clearing `bk.ops` boat/van/check-in.
`bkV2RescheduleBooking:77572` and the edit-path date change `:76886` both clear it. A
weather-rescheduled booking silently keeps the previous day's boat and van. (01 §7)

- [ ] Reuse the existing clear from `:76886` rather than writing a third variant
- [ ] Respect `bkOpsRead`/`bkOpsFor` per-day semantics — do not clear other days (03 §9.1)

### S1-05 · Partial cancel must return seat-lock draws — 5 pts · E2

`bkV2PartialCancel:77728` reduces pax and money but never returns the corresponding
`trips[].lockDraws`, and never touches the invoice. `lockDraws` — not the `used` counter — is the
source of truth for lock usage (01 §7.6), so seats stay consumed against `getAllotment` forever.

- [ ] Return draws proportional to the pax reduction, mirroring the full-cancel path
- [ ] Flag the invoice as needing adjustment; do not auto-edit money (see S3-04)

### S1-06 · Fix `esc` undefined in the rate-type picker — 2 pts · E7

`allotment_v2.html:63867` inside `agEditBuildRateTypePicker` calls a bare `esc(...)` in the branch
taken whenever the agent has a sales owner. No global `esc` exists in this file. Expected symptom:
the picker throws and renders nothing for most agents. (02 §9.20)

- [ ] Add a local `const esc=` per the file convention (08 §5.1)
- [ ] Grep every top-level render fn for bare `esc(`/`escapeHTML(` and fix the same class

### S1-07 · Spike — catalogue every unpersisted write — 5 pts · E2, E4

Four documented instances, likely not all of them: `SB_ADDON_SVCS`/`aosSaveModal:79018` never reads
or writes the blob, yet `a.addonServices[].svcId` points into it (02 §9.11); `ctRenewActivate:65317`
mutates contract version/history and returns without `sbAgentsPersist()` (02 §9.21);
`flSaveAssignment`, `flCancelAssignment`, `flAutoUpdateAssignments`, `fuelSetBudget` write
localStorage directly instead of via `flSave()` (05 §10.19).

- [ ] Produce a table: mutation site → store → persisted? → lost on reload?
- [ ] Rank by blast radius; feed Sprint 2
- [ ] **Output is a document, not a fix** — fixes are separate stories

### S1-08 · Stand up the test harness — 8 pts · E3

No test framework is wired for the areas that matter. `db/test_seat_lock_race.mjs` and `db/rt.cjs`
exist but are not a suite.

- [ ] Runner chosen and wired into CI
- [ ] Ephemeral Postgres per run, provisioned from `db/migrations/` (depends on S1-01)
- [ ] One end-to-end proof: create a booking through the real write path, assert the row in Postgres
- [ ] Fixture helper to build a booking without going through the DOM

### S1-09 · `ARCHITECTURE.md` pointing at the workflow docs — 2 pts · E9

`CLAUDE.md` cites `CHANGELOG.md` six times; it does not exist and was never tracked in git.
`README.md` says data lives in localStorage — the opposite of the truth. (07 §10 drift table)

- [ ] Delete or rewrite the dead `CHANGELOG.md` references in `CLAUDE.md` and `SYSTEM_MAP.md`
- [ ] Fix `README.md`: `ADMIN_USER`/`ADMIN_PASS`, not `APP_USER`/`APP_PASS` (`server.js:19-20`)
- [ ] Fix the `start_server.command` path and state that it gives you no `/api`

### S1-10 · Backup and restore drill — 3 pts · E1

`flListSnapshots()`/`flRestoreSnapshot(N)` are listed in `CLAUDE.md` §4 as a live safety system and
are **dead on the real dataset** (07 §9.7). Confirm a real recovery route exists before touching
write paths.

- [ ] Verify the Railway Postgres backup exists and is current
- [ ] Restore into a scratch database and boot the app against it
- [ ] Write the runbook; if snapshots are truly dead, remove the claim from `CLAUDE.md`

---

# Sprint 2 — Lock the write path

**Sprint goal:** the booking write path is covered by tests that fail on regression, and the
"four registrations" trap becomes impossible to get wrong silently.

**Committed: 42 points**

### S2-01 · Regression suite for the edit-preserve block — 8 pts · E3, E2

`bkV2CommitBooking` rebuilds `newBk` from the form; anything not copied in the `if(editing){…}`
block at `:76855` is destroyed. Required carry-overs: `history`, `weatherResolve`, `rebook`,
`invoiceId`, `paymentStatus`, `ops`, `b2cOverride`, `upgrades`, `feeItems`, `reschedule`,
`partialCancels`, `cancellation`, `cancelCategory`, resolved `approval`, decided `focApproval`.
Losing `ops` once already wiped every boat/van assignment (fixed 2026-06-14). (01 §7.1)

- [ ] One test per carry-over field: set it, edit an unrelated field, assert it survives
- [ ] Data-driven from a single list so a new field is one line
- [ ] Deliberately delete a carry-over line and confirm the suite goes red

### S2-02 · Seat-lock and allotment invariant tests — 8 pts · E3

The rules are precise and interlocking: children contribute 0 to the pool
(`bkV2LockPoolHold:41783`); month locks use rolling per-trip release, not a global expiry (`:41696`);
`lockDraws` is truth, not `used`; over-capacity pendings hold no seats (`bkPendHoldsSeat:12040`);
charter never consumes seats. (01 §7.2–7.7, §7.12)

- [ ] One test per invariant, each named after the rule it protects
- [ ] Cover the hard-block vs soft-confirm split at `:76672` — a lock violation is a hard block with
      no override; physical oversell within licence is a confirm
- [ ] Cover the cancelled-status exclusion triple across all six documented aggregate sites

### S2-03 · Single source of truth for cancelled statuses — 3 pts · E4

`['cancelled','cancelled_weather','rejected']` is duplicated as a literal roughly ten times
(03 §9.15), and `ACCT_PAID_STATES` is the same list under a misleading name (06 §10.2).

- [ ] One exported constant; all call sites reference it
- [ ] Rename `ACCT_PAID_STATES` → `ACCT_EXCLUDED_STATES`
- [ ] Lint rule or test that fails on a new inline literal

### S2-04 · Make the four-registration trap loud — 8 pts · E4

A new persisted field needs the persist helper, **both** client load paths, `field_mapping.json`,
and `operation_schemas_model.json`, plus a real column. Miss any one and the data silently
disappears. (07 §4, §10.5)

- [ ] Drift check failing CI when a model field has no mapping entry, or a mapping entry has no
      column — restores the capability of the deleted `check_mapping_drift.js` (07 §0)
- [ ] `npm run` script scaffolding all registrations for one new field
- [ ] Commit the worked example (`ops.pierNote`, 07 §4.1) into the repo, not just the doc

### S2-05 · Fix or document the three revert-to-seed stores — 3 pts · E4

`pier_lic_types`, `pier_lic_classes`, `pier_codes` load with `Array.isArray(x) && x.length`, so
clearing the list reverts it to seed — breaking the deliberate rule that an empty array stays empty.
(07 §10.6)

- [ ] Determine whether it is intentional
- [ ] Either drop the `.length` guard, or comment it as deliberate at all three sites

### S2-06 · `trips` hardcoded per-boat columns — 8 pts · E4

`trips` maps to `b1_route`, `b1_type`, `b1_booked`, `b1_charterbookingid`, … per boat.
`b8`/`b14`/`b15` were missing from the start and their assignments vanished on sync
(`server.js:1637-1644`). Every new boat needs manual columns. (07 §10.12)

- [ ] Spike first: normalize to a child table vs. generate columns from `BOATS`
- [ ] Whichever wins, adding a boat must require zero schema edits
- [ ] Migration preserves existing `bN_*` data

### S2-07 · Disambiguate the two `save()` functions — 4 pts · E4

Two unrelated `save()` functions exist and the wrong one is easy to call (07 §1.3). `flSave()` also
persists `BOATS`, because fleet mutates `b.log` constantly and the sales-side `save()` is never
called from there (05 §10.1).

- [ ] Rename to intent-revealing names
- [ ] Document why `flSave()` owns `BOATS`
- [ ] Test: a boat status change made from the fleet UI survives a reload

---

# Sprint 3 — Money and truth

**Sprint goal:** no code path silently reports a wrong number, and no seeder mutates production data.

**Committed: 40 points**

### S3-01 · Remove demo seeders from the boot path — 5 pts · E6

`_seedContractExpiryVariety():39725` force-sets `contractEnd` on agents `a01`/`a10`/`a30` to
"today + 25 days" and expires `a40` **on every boot**, relative to a hard-coded `2026-09-02`, against
whatever data is loaded. `SB_AGENT_PRICES` is regenerated from `_seedAgentPrices():39914` on every
boot and never persisted — so the renewal snapshot that captures it (`:65332`) records synthetic
prices, not real ones. (02 §9.22–9.23)

- [ ] Gate both seeders to a demo dataset, or delete them
- [ ] Assess whether real contract dates have already been corrupted in production — **do this before
      the fix ships**, since the fix removes the evidence
- [ ] Test: boot twice, assert agent records are byte-identical

### S3-02 · Order-driven cost lines — 8 pts · E5

A documented incident (`:56152-56153`): a 35-pax boat with 2 real longtail-join customers was costed
at the per-head formula rate × all 35 heads — **17× over**. `ctOdQty`/`pxLongtail` exist to feed the
real ordered quantity into `ctCalc` for `od:true` lines. Any new order-driven line not marked
`od:true` with its quantity threaded through `ctx.odQty` repeats the bug. (06 §10.12)

- [ ] Audit every cost line for a missing `od:true`
- [ ] Test reproducing the 35-pax/2-order case, asserting 2× not 35×
- [ ] Make `od` the default for anything longtail/charter/van shaped

### S3-03 · Trip P&L trustworthiness signals — 5 pts · E5

A trip with no Costing plan still "computes" ฿0 cost rather than refusing; `nNoPlan` is the only
signal that the profit figure is meaningless (06 §10.10). Trip P&L revenue is also independent of
invoicing — `tsTripAmount` reads the frozen booking price and never consults
`SB_INVOICES`/`SB_PAYMENTS`, so P&L and the Accounting "Outstanding" KPI answer different questions
and will never reconcile (06 §10.8).

- [ ] A day total containing an unplanned boat is visibly marked, not silently summed
- [ ] Both screens state what they measure

### S3-04 · Invoice lifecycle gaps — 8 pts · E5

Three documented holes: `inv.whtAmount` is read by `acctInvoiceDocHtml:59202` but **nothing anywhere
writes it**, so every printed invoice shows ฿0.00 withholding tax regardless of reality;
`acctVoidInvoice` sets `status='void'` but leaves `SB_PAYMENTS` rows in place, so voiding does not
reverse the cash; `acctRecordPayment` does not cap payment at the invoice balance and the excess
becomes agent credit nowhere. (06 §10.3, §10.5, §10.6)

- [ ] Decide per item: implement, or remove from the printed document
- [ ] WHT especially — a permanent ฿0 tax line on a real invoice is a compliance question, not a
      display bug. Confirm with finance before choosing
- [ ] Void either reverses payments or refuses to void an invoice that has them

### S3-05 · Pricing layer inconsistencies — 8 pts · E5

Add-ons are priced from the base rate (`bkV2AddOnInfo:77190` → `bkV2GetRT()`) while seats and FOC use
`bkV2GetRTForTrip()`, so a promo changing longtail prices silently does not apply — currently
harmless only because no promos exist (02 §9.3). Rate validity dates never gate a price: an expired
rate still prices a booking, and only `active===false` removes it from pickers (02 §9.2). A `paid`
bundle suppresses `longtail-join` for the whole booking rather than per trip, so a two-route booking
drops the join charge on the route that did not bundle (02 §9.8).

- [ ] Fix the promo/base mismatch **before** any promo ships — latent, not current
- [ ] Decide whether expiry should block pricing; if not, document it as intentional
- [ ] Make bundle suppression per-trip

### S3-06 · Timezone sweep — 3 pts · E7

`bkV2LocalYMD` is the rule; several paths still use `toISOString().slice(0,10)` and land on the
previous day before 07:00 ICT: `bkV2CommitBooking`'s `createdAt`/`bookingDate` (`:76704`, `:76844`,
01 §7.8), `drDateShift:52758` (03 §9.13), `psuResolveProfile:40327` and `psuOpenCloneProfile:40763`
(04 §9).

- [ ] Replace all occurrences
- [ ] Lint rule banning `toISOString().slice(0,10)`
- [ ] Test executing at 00:30 ICT

### S3-07 · Missing status labels — 3 pts · E7

`bkV2StatusLabel:69213` has no entry for `pending_approval` or `cancelled_weather`; both render as
the raw status string. (01 §7)

---

# Product backlog (prioritized, unsequenced)

Everything below is real and cited, but does not need scheduling yet.

## High — correctness, user-visible

| ID | Story | Epic | Est |
|---|---|---|---|
| B-01 | `bkV2InferZone:69054` reads `bk.pickup`, a v1 field the v2 form never writes — calendar zone splits are effectively all `PK` | E7 | 3 |
| B-02 | `ckWrite` rebuilds the whole check-in object; anything not in `CK_STAGE_KEYS:47238` is lost on the next ± press | E2 | 5 |
| B-03 | `pjOf` field whitelist (`:82102-82104`) silently drops any new per-day job-sheet field on the next `pjSet` | E2 | 3 |
| B-04 | Audit every screen reading `bk.ops` directly instead of `bkOpsRead`/`bkOpsFor` with an explicit date — every OVN bug traces here | E12 | 8 |
| B-05 | Deposit application has no locking; two concurrent applications can jointly over-draw one deposit | E5 | 5 |
| B-06 | A booking can be invoiced while still `quote` or `pending_approval` | E5 | 3 |
| B-07 | `flProjMarkComplete` bypasses `flMaintClose`: no outcome, no asset status restore, no `repairHistory`, no incident auto-close | E13 | 5 |
| B-08 | `flUpdateAssignEngInfo:36278` still uses modulo for the service countdown instead of `lastServiceHours` | E13 | 2 |
| B-09 | `rtSaveDraft` prunes orphaned `seatRates`/`charterRates` but not `routeValidity`, `routeBundles`, `addOns.*.applies` | E5 | 3 |
| B-10 | `rtDeleteRT` detaches every bound agent, leaving agents with no price | E5 | 3 |
| B-11 | Rate-type price edits are not versioned at all; `agLog` caps `activity[]` at 200 and is the only audit trail | E5 | 8 |
| B-12 | Nothing blocks an under-licensed crew — `plBoatBad:81899` is advisory only | E12 | 3 |
| B-13 | Re-confirm has no permission guard; it relies on `acctPersistBookings` refusing | E8 | 2 |
| B-14 | `devlogIsAdmin()` returns `true` when there is no `LA_ME` — the degraded no-`/api` path gets full System Log access with no login | E8 | 2 |

## Medium — architecture and resilience

| ID | Story | Epic | Est |
|---|---|---|---|
| B-15 | Modularize `allotment_v2.html` (83,629 lines, one global scope) — spike the split first; domain boundaries are already mapped by docs 01–08 | E11 | 21 |
| B-16 | `_baChMemo` lives exactly one microtask (`:45332`); safe only because rendering is synchronous. Blocks any async render work | E11 | 5 |
| B-17 | `admin_devlog` is a double-encoded JSON string, not a collection | E4 | 2 |
| B-18 | `_bindVal` coercion (`server.js:114`) silently rounds floats into bigints — surface these instead of swallowing | E10 | 3 |
| B-19 | `fast_import` does not bump `app_state.version`, so open clients never notice an import | E10 | 2 |
| B-20 | `DATA_VERSION` is written but never checked (`:5790`) | E4 | 2 |
| B-21 | Three incompatible location vocabularies for parts / inventory / engines | E13 | 8 |
| B-22 | Two coexisting boat-status fields (`m.boatStatus`, legacy `m.setFixing`) must always be read together | E13 | 5 |
| B-23 | No one-click re-install of a stashed gearbox/propeller onto an engine | E13 | 5 |
| B-24 | Job orders and pickup map lazy-load html2canvas / Leaflet from CDNs — offline at the pier means no job order | E14 | 5 |
| B-25 | Doc-Check OCR needs internet, reads English only, never reads MRZ | E14 | 5 |
| B-26 | `/api/load` ships the whole blob; cache invalidates on every write (brotli q5 deliberately) | E14 | 13 |

## Low — hygiene

| ID | Story | Epic | Est |
|---|---|---|---|
| B-27 | Reconcile the remaining 12 documentation-drift items in 07 §10 | E9 | 5 |
| B-28 | `CLAUDE.md:51` lists pier `ranong` as "Planned"; the code has full first-class support (98 references, complete Pier-Office view family) | E9 | 1 |
| B-29 | `_bkV2` state comment (`:68863`) says 3 tabs; there are 6. `docs/BOOKING.md` is a stale Phase-1 spec | E9 | 1 |
| B-30 | `HANDOFF_2026-07-04.md` says 107 tables; the dictionary and structure SQL say 103 | E9 | 1 |
| B-31 | Normalize `'NoTransfer'` vs `'NT'` — both spellings are live | E4 | 3 |
| B-32 | `_acctFauxQR:59187` renders a decorative fake QR on invoices — remove it or make it real | E5 | 2 |
| B-33 | Standardize the local-`esc` convention; most fleet renderers inline `${...}` unescaped | E7 | 5 |
| B-34 | Sidebar/layout prefs are per-device by design — document, do not "fix" | E9 | 1 |

---

# Risks

| Risk | Impact | Mitigation |
|---|---|---|
| S1-01 was a deliberate architectural decision, not a mistake | Sprint 1 collapses; E1 re-scopes to ~13 pts | Confirm intent before Sprint 1 planning closes |
| Seeder corruption (S3-01) already reached production contract dates | Silent bad data of unknown age | Audit **before** removing the seeder |
| No local doc specifies team size, sprint length or velocity | Every date here is unfounded | Recalibrate after Sprint 1 |
| Docs 06 and 08 are visibly thinner than 01–05 and 07 | Accounting and shell findings may be incomplete | Re-document those two domains before relying on their backlog items |
| The workflow docs are read-only analysis, never executed | A "bug" may be intentional behavior | Reproduce before fixing; several items above say so explicitly |
