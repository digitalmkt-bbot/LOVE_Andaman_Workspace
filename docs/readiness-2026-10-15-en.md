# Replacement Readiness — 2026-10-15

## Verdict

**BLOCK — do not replace `lk-inbox` yet**, but the gap is much narrower than on 14 Oct. Today
two backend waves and one frontend wave shipped (every piece through its own verifier), and the
full legacy import was rehearsed end to end on a local copy. Every booking, passenger and money
difference it reported traces to the 22 B2C lines the owner accepted (P13).

What still blocks, in order: the deploy build (not running on Railway), one live regression on
the pier roster, browser acceptance (today's waves, and the pier office, which has been wired
since 13 Oct but never clicked through), legacy feature drift since 13 Oct, and a short list of
operator data fixes.

Supersedes `readiness-2026-10-14-en.md`. Working state lives in `D:/projects/compare-stack`
(`goal.md` = board + decisions, `HANDOFF-BACKEND.md`, `HANDOFF-CLIENT.md`,
`CHANGES-BEYOND-WIRING.md` = every fix/refactor/behaviour change made beyond pure wiring).

## Deploy state (2026-10-15)

| Repo | `main` | Verified live |
| --- | --- | --- |
| operation-backend | `9d116c9` | `/api/health` reports `9d116c9`. Carries B1–B10 (14 Oct), B11–B15 (agent seasons, booking purpose/internal filters, dashboard `unbilled`, `POST /v1/agents/:id/resync-contract`, add-on catalogue importer), G1 (guide orders + config store, migrations 251/252 ran cleanly at predeploy) and the guide-order issue fix |
| This frontend | `c33fecc` | production serves `62-ops-guide-orders.js?v=33ebc591`, `04-data-core.js?v=93a14a18` |

Shipped in today's frontend wave: C10 triage tail (incl. the live agent season-save fix and the
`thai_passengers` blocker) · check-in state survives a reload · Action Board and the agent
history tab count every booking (server stats / full agent history), not just loaded ranges ·
Travel Summary rebuilt on server rows (scope chips, VAT filter, slip and reference packs, a
cash-on-tour decision block, 14-day trend) · guide-order numbers issued by the server (no more
per-browser collisions), config store and daily-report settings on the server · dashboard
unbilled from the server · agent contract resync · **14 stale `?v=` stamps fixed** (these files
had changed without a bump, so cached browsers kept old code — incl. `04-data-core.js` and
`00-ops-core.js`).

**Correction to the 14 Oct doc:** the attachments "4 raw `api/attach` call sites" are covered —
`38-ops-attachments.js` intercepts every `fetch('/api/attach…')`; what remains are comments.
The remaining `/api/` strings in `js/` are the legacy sync paths behind `LA_LEGACY_UNAVAILABLE`
/ `LA_LEGACY_SYNC` and the user calls intercepted by `14-ops-users.js`; the final unwired scan
(below) confirms.

## Full legacy import rehearsal (2026-10-15, local Docker only)

Both local databases restored fresh from the 13 Oct dumps; API built from backend `9d116c9`
(migrations 246–252 applied cleanly); importers run in cutover order with explicit local
`SOURCE/TARGET_DATABASE_URL` (never `.env`).

| Step | Result |
| --- | --- |
| Dry run, all six importers | exit 0; **no refusal guard tripped** — the 13 Oct copy reads pre-cutover |
| `import:attachments` | 6,460 files named, 6,387 already present, 64 copied, 9 named but absent from legacy's store |
| `import:legacy` | 5,792 bookings · 5,804 trips · 1,655 seat locks (552 sub-groups) · 489 invoices · 409 payments · 168 pier payments · 53 vans · 5 weather closures |
| `import:day-money`, `import:pier-office`, `import:users`, `import:addon-services` | exit 0 |
| `verify:import` | 23 checks, 9 differ — **all explained**, see below |

- **Bookings present (22), seat/charter pax on r10 07-04/07-06 and r6 11-20, July −฿59,300,
  Sep −฿2,683** → all the P13 B2C lines. July = test bookings BK-003_4 ฿33,400 + BK-003_1
  ฿10,400 + BK-002_1 ฿15,500 exactly; Sep = route-less transfer LOV-6882506_3 ฿2,683 exactly.
- **Locked seats on 14/15 Oct (6 route-days)** → snapshot artifact: those locks carry an explicit
  `expiry` of 13/14 Oct; legacy expires them in the browser (`bookingV2LockExpireSweep`), so the
  frozen rows still read active, while operation-backend evaluates expiry today. Same rule.
- **Real — master data created in legacy after rate types and boats moved here (9 Oct), which
  the import deliberately does not carry:** 5 rate types (NYM-MONKEY "Monkey Dive Rate",
  SILAN-KHAOLA, IRIS-IRISHO, SILAN-SILANK-2, PMAM-MAMKLB "Mam -KL Beim"); agent **Monkey Dive
  Thailand** has *no* rate type here; agent **KL Beim** is still on its old rate; boat **BMP**
  (speedboat, Tub Lamu) exists only in legacy. → operator check on production (below).

**Cutover-day notes from the rehearsal:**
- The guards refuse a re-import once staff have made bookings, invoices or payments on
  operation-backend (`import:legacy`, overridable only with `--force-replace`), or used the pier
  area / day money here (`import:pier-office`, `import:day-money` — **no override at all**). Run
  the dry run first on the day; it says which state production is in.
- `import:all` (the pipeline) does **not** forward `--force-replace`, and runs neither
  `import:users` nor `import:addon-services` — run those two explicitly.
- Rate types, boats, agents, markets and salespeople are mastered here since 9 Oct; anything staff
  created in legacy since must be recreated here by hand (the import only inserts unknown agents).

## Screen identity (2026-10-15 run — in progress)

Run on the code that just shipped vs **production lk-inbox `bb05572`** (not the stale
`3f43891` checkout the 14 Oct run used). lk-inbox froze on Market Data again (known), which cost
its last 28 screens; a second lk-only pass is queued. On the 42 screens with both sides:
improved — Action Board 54→93%, Pickup Setup 74→100%, Pier Office Panwa 85→100%, B2B dashboard
36→65%, Calendar 70→84%; dropped and **not yet explained** — Staff 100→28%, Pier Office Tub Lamu
88→38%, Fleet Calendar 84→48%, Van Jobs 100→83%, Pier Office Ranong 100→82%. Some of the drop is
likely the 68 lk-inbox commits since `3f43891` (feature drift, below); each will be traced from
the differing lines before it is called a regression. The data comparison (`compare.mjs`) is
running. This section will be updated with both results.

## Release blockers

| Area | State | Still open |
| --- | --- | --- |
| **Deploy build** | **still not running**: production serves 725 separate `<script>` tags, no `booking.bundle.js`, `08-app.js` unminified | Railway dashboard check (operator). Also decision #11: 662 tags (mostly `js/booking/*.js`) have **no `?v=` at all** while js is served immutable for a year — an edit to them never reaches a browser that cached it. Running `build:deploy` fixes both |
| **Pier roster over-count (live regression)** | `d808304` over-counts unplaced slots (Panwa 391 vs 171, Tub Lamu 701 vs 281) on a staff-facing screen | trace against lk-inbox on the stack (`C-pier-roster-overcount`) |
| Pier office | **wired since 13 Oct** — `05842c1` (settings, licences, roster, pay, stock, sign-out sheets, day close), `701ccce` (stock ledger, boat outstanding), `06ffcad` (boat close); `48-ops-pier-office.js` intercepts `poPersist()` per area, unit-tested (`ops-pier-office.test.mjs`). The 13–14 Oct docs carried it as "still browser-local" because the screens still *call* `poPersist()` — that is the adapter's contract, not a gap | **never browser-verified**: one live pass of the pier screens (3 piers × office/activity/job/duty/checkin) on the stack, which also covers the roster regression above and the pier identity drops |
| Browser acceptance of today's waves | all unit-tested with fail-without proofs and verified; **live click-through deferred** (the stack was down) | the deferred checks listed per batch in `goal.md` — popups on guide-order print, COT 409 path, config `stale_version` with two browsers, check-in after reload, dashboard unbilled, resync-contract |
| **Legacy feature drift** | lk-inbox moved **68 commits** past `3f43891` (Park tickets · Ticket Management, VIP charter marks on boat job sheets, meal/PR-PO sheet changes); the 13 Oct sync branch `sync/lk-inbox-2026-10-13` (26 commits) is **still unpushed** | run the lk-inbox sync again on top of `main`, then wire whatever those features persist |
| Server gaps behind degraded screens | Daily Report ops pane (boats/vans/meals/docs/return leg), scoped Travel Summary head counts, booked-date trend by market — each shown with a visible note today | `HANDOFF-BACKEND.md` B16–B18 |
| Client wiring still owed for shipped endpoints | rate-expiry scanner on agent `rate_seasons` (triage #35, B11), internal/company booking year list (triage #140, B14) | small client batch |
| Final unwired scan | not yet run on `c33fecc` | recipe in `goal.md` §Scan |

## Operator actions (production — commands are in `HANDOFF-BACKEND.md` / the batch-9 report)

1. **C3**: three agents → `proforma` (TOUR POINT PHUKET, Incom Asia/Banmee, CKP Tour) — three
   `PATCH /v1/agents/:id {"pay_type":"proforma"}` with before/after reads.
2. **C5**: the "cancelled due to weather" on Early Tratato 15 Oct is a stray
   `POST /v1/weather-closures` by `admin` on cutover day (`wx_c484dc1f…`, no bookings tagged) —
   read first, then `POST /v1/weather-closures/<id>/undo`.
3. **Master data** from the rehearsal: check the 5 rate types, boat BMP, and the two agents'
   bindings (Monkey Dive Thailand, KL Beim) on production; recreate / rebind if missing.
4. **Add-on catalogue**: `import:addon-services` (dry run, then `--commit`) with explicit
   SOURCE/TARGET — legacy never saved its catalogue, so the importer carries its literal
   (3 services, 6 variants, prices empty for sales to fill).
5. **Railway**: the deploy-build dashboard check; `import:attachments --commit` re-run (226 docs
   dropped on 13 Oct).
6. **Guide-order numbers at cutover**: the importer for legacy's `go_no`/`go_cfg` is not written
   yet; issuing can no longer jam on a stale counter (`9d116c9`), but numbering should continue
   from legacy's last number.

## Owner decisions

Recorded (15 Oct): G1 keys → server homes (shipped) · Travel Summary / Daily Report → rebuild on
server rows (shipped, gaps B16–B18) · Excel agent import → stays refused · 64 accept-difference
rules → signed off · C3 lk-inbox is right · C5 not weather-cancelled · C1 import the add-on
catalogue (built) · P13 B2C lines live in B2C only · **#9 seat locks never auto-release** (same as
legacy since 29 Sep; the 901-vs-516 locked-seat figure is an open, stack-gated investigation —
likely legacy's calendar capping "locked" at the boats' free seats; if confirmed, the server
copies that capping).

Open: **#6** delete the obsolete `handoff/b2-c-20261014` branch · **#10** guide-order design
(may numbers reset, pmap toggles shared or per user, guide list its own endpoints, …) ·
**#11** stamp policy (run the deploy build vs stamp all 662 tags at once).

## Cutover rule (unchanged)

Do not schedule the one-day cutover until every blocker above is resolved and the browser
acceptance list passes. On the day: stop legacy writes, dry-run then run the importers
(`import:attachments`, `import:legacy`, `import:day-money`, `import:pier-office`,
`import:users`, `import:addon-services`), `verify:import`, then staff enter data only here.
