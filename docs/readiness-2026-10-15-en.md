# Replacement Readiness — 2026-10-15

## Verdict

**BLOCK — do not replace `lk-inbox` yet. The data is ready; the screens are not.**

- **Data — ready.** The full legacy import was rehearsed end to end on a local copy; every booking,
  passenger and money difference traces to the 22 B2C lines the owner accepted (P13). Side by side,
  bookings match lk-inbox **100% field by field** (305 bookings over 14–17 Oct). Every endpoint the
  frontend needs exists and is live.
- **Screens — not ready, but close.** After the lk-inbox sync and a full import of every area
  (13 importers, the one-day cutover order), **31 of 70 screens are identical, 20 close (≥90%), 18
  different**. Of those 18: 2 are a test-timing artifact (Accounting, Booking Flow fill after ~4 s),
  3 are the agreed server-row redesigns (Travel Summary, Daily Report, Van Bill) and 1 is the dev
  log (not migrated) — leaving **12 screens to trace**, starting with By-Trip's day view and Van
  Jobs. None of the 13–15 Oct work has had a live click-through yet.

The earlier docs measured *wiring* (does each function reach the server?). That is essentially
done. What decides replacement is *sameness* (does staff see the same thing and can they do the
same work?), traced screen by screen from the identity run — a finite list, not open-ended wiring.

What still blocks, in order: By-Trip and Van Jobs differences (staff live in them), the deploy
build (not running on Railway), the pier roster regression, live acceptance of the shipped waves
and the pier office, the lk-inbox features that need server support (below), and the operator data
fixes.

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
| Dry run, all six importers | exit 0; no refusal guard tripped — **but see the correction below: the guard could not see bookings made on main** |
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
- **Rate types, a boat and two agent bindings (first run) → runbook gap, now closed.** The first
  run used the importers' defaults, which still treat rate types, boats, agents, markets and
  salespeople as operation-backend's since 9 Oct, so it skipped 5 rate types legacy added later,
  boat BMP, and two agents' rate bindings (Monkey Dive Thailand, KL Beim). The owner's decision is
  **one full replacement on one day: legacy is master of everything until cutover**. Re-run with
  `seed:boats --commit` and `import:legacy --commit --sales --rate-types`: BMP added, all 5 rate
  types present, both agents bound as in legacy; rate types, deployments and boats-per-day verify
  with 0 differences. What still differs is only the P13 lines above.

**Correction — the import guard was blind to bookings made on main (found 15 Oct, fixed, not yet
shipped).** `legacy-import-guard.ts` treated every booking carrying an `external_id` as a Love Kingdom
push, and main's own bookings carry their `BK-…` code there, so "no booking made here" was never
proven. The fix (operation-backend branch `docs/one-time-cutover`) recognises a push by the B2C rule
(agent `a_b2c` or a `b2c_` id) and honours `--remove`. Run read-only against production, the fixed
guard REFUSES on exactly **one staff-made booking: `BK-26100428-0Z7P`** (BIG COUNTRY, ฿6,700, travel
29 Dec, entered on main by Pier.Asst on 13 Oct), **which staff also entered in lk-inbox as
`BK-26100689-GRA5`**. Importing both would have duplicated it. No invoices, payments or refunds were
made on main on imported records. **Owner decision (15 Oct): drop main's copy** — on cutover day the
import runs with `--remove=booking_4f58c78f-be3f-4b14-9983-004af80990e0`; legacy's BK-26100689-GRA5
stays (operation-backend `todo/cutover-checks.md` §4). Re-run the dry run before the day and reconcile
any other booking made on main the same way.

**Cutover-day notes from the rehearsal:**
- The guards refuse a re-import once staff have made bookings, invoices or payments on
  operation-backend (`import:legacy`, overridable only with `--force-replace`), or used the pier
  area / day money here (`import:pier-office`, `import:day-money` — **no override at all**). Run
  the dry run first on the day; it says which state production is in.
- `import:all` (the pipeline) does **not** forward `--force-replace`, and runs neither
  `import:users` nor `import:addon-services` — run those two explicitly.
- **One-day cutover: carry the master data too.** The importers' defaults still assume some areas
  moved here on 9 Oct (superseded). On the day run `seed:boats --commit` and `import:legacy --commit
  --sales --rate-types`, or legacy's later rate types, boats and agent bindings stay behind.
  Legacy-sync stays all-or-nothing (`LA_LEGACY_SYNC`); there is no per-area switch-over.

## Side-by-side results (2026-10-15, local stack, vs production lk-inbox `bb05572`)

Both apps on the freshly imported data; the main side is this frontend plus the lk-inbox sync below.
Every test browser blocks production hosts (0 requests escaped).

**Data comparison (`compare.mjs`).** Bookings per date — 14 Oct 38/38, 15 Oct 139/139, 16 Oct
58/60, 17 Oct 70/70 — matched with **0 field differences**; the 2 on 16 Oct are the accepted P13
transfer lines (LOV-6882506_3/_4). Boot: main is ready in 1.6 s vs lk-inbox 8.6 s (but 18 MB vs 6 MB
transferred — the deploy build would cut that).

**Screen identity (`allviews.mjs`, 70 menu screens).** Three runs on 15 Oct, each on the same lk-inbox:

| Run | Identical | Close (≥90%) | Different |
| --- | --- | --- | --- |
| Shipped main, bookings-only import | 15 | 16 | 38 |
| + lk-inbox sync | 17 | 18 | 34 |
| + full import of every area (one-day cutover order, 13 importers) | **31** | **20** | **18** |

(1 not compared: lk-inbox freezes on Market Data, known.) The "fleet data drift" of earlier runs was
the two systems holding different fleet data: with fleet, fleet-stock and costing imported, Fleet
Maintenance, Incidents, Work, Boat Status, Consumables and Daily Report are 100%, Fleet Calendar
99.7%, Fleet Cost 99%, Insights 98.9%, Deployment 98.4%; Rate Admin 100%, Trip P&L 99.9%. Earlier
wins kept: Action Board 54→94%, Pickup Setup 74→100%, Add-on Services 24→100%, Staff 28→100%.

Still different (18): Accounting and Booking Flow (fill after ~4 s, past the capture window —
slow, not broken); Travel Summary, Daily Report, Van Bill (agreed server-row redesigns); Dev log (not
migrated); and **12 to trace**: Pier Office Tub Lamu 42%, FOC detail 52%, B2B dashboard 54% (prior
period depends on what the browser loaded), Pier Activity Panwa 60% (roster over-count), Rate Types
65%, Contract template 67%, Fleet Fuel 74%, Fleet Projects 80%, Van Jobs 83%, Daily availability
85% (was 95% before the full import — check), Calendar 85%, Dashboard 88%. Plus By-Trip's day
view, which the per-date booking comparison scores 85–90%.

**Traced so far:**
- **By-Trip (day view, 85–90%)** — seat counts match (14/38, 66/66, 24 free). Different: lk-inbox
  shows van group cards with vehicle, plate, driver and phone; main does not. lk-inbox marks
  bookings that drew from a seat lock (🔒 agent); main does not. Main raises "return van not
  assigned" warnings lk-inbox does not. Main lacks the route's combined "รวม 80/104" chip. Payment
  labels differ on the three C3 agents (operator fix). **Not yet fixed — first item to trace.**
- **Van Jobs 15 Oct (83%)** — 247 unassigned pax in lk-inbox vs 244 on main (Similan Speedboat 52
  vs 49), and main lists one extra return passenger: one booking classified differently.
- **B2B dashboard** — current figures identical; the "last period" comparison depends on which
  months the browser happened to load (order-dependent partial data, pre-existing).
- Daily PFM 91% / Rate Types 60% — master-data drift and the C3 agents (operator actions below).

## Release blockers

| Area | State | Still open |
| --- | --- | --- |
| **Deploy build** | **still not running**: production serves 725 separate `<script>` tags, no `booking.bundle.js`, `08-app.js` unminified | Railway dashboard check (operator). Also decision #11: 662 tags (mostly `js/booking/*.js`) have **no `?v=` at all** while js is served immutable for a year — an edit to them never reaches a browser that cached it. Running `build:deploy` fixes both |
| **Pier roster over-count (live regression)** | `d808304` over-counts unplaced slots (Panwa 391 vs 171, Tub Lamu 701 vs 281) on a staff-facing screen | trace against lk-inbox on the stack (`C-pier-roster-overcount`) |
| Pier office | **wired since 13 Oct** — `05842c1` (settings, licences, roster, pay, stock, sign-out sheets, day close), `701ccce` (stock ledger, boat outstanding), `06ffcad` (boat close); `48-ops-pier-office.js` intercepts `poPersist()` per area, unit-tested (`ops-pier-office.test.mjs`). The 13–14 Oct docs carried it as "still browser-local" because the screens still *call* `poPersist()` — that is the adapter's contract, not a gap | **never browser-verified**: one live pass of the pier screens (3 piers × office/activity/job/duty/checkin) on the stack, which also covers the roster regression above and the pier identity drops |
| Browser acceptance of today's waves | all unit-tested with fail-without proofs and verified; **live click-through deferred** (the stack was down) | the deferred checks listed per batch in `goal.md` — popups on guide-order print, COT 409 path, config `stale_version` with two browsers, check-in after reload, dashboard unbilled, resync-contract |
| **lk-inbox features needing server support** | **Synced** (94 commits, `bb05572`, merge `095ded1`, supersedes the unpushed 13 Oct sync; served locally with 0 page errors). Display features work. Not yet in ops mode: Park ticket sets + per-type prices (saved in one browser only), park matrix Thai/foreign/FOC columns and times, departure time per boat (lost on reload), cross-pier crew warning, open-ended pier assignment (saves +7 days), planKeep2, user rename, return van for self-arrive bookings, the new B2C typing rules for Love Kingdom's own pushes | operation-backend items B19–B31 (`HANDOFF-BACKEND.md`), then the matching `js/ops` ports |
| **Alt pickups wiped on save (fixed in this push)** | every booking save from main zeroed each extra pickup's head counts and blanked its name, place and zone (the adapter sent only area/drop fields to a replace-whole-list API). 8 bookings / 11 alt pickups on the 13 Oct copy, 4 upcoming | fixed `4665417`; **check production** for alt pickups with 0 heads on bookings edited since 12 Oct |
| Server gaps behind degraded screens | Daily Report ops pane (boats/vans/meals/docs/return leg), scoped Travel Summary head counts, booked-date trend by market — each shown with a visible note today | `HANDOFF-BACKEND.md` B16–B18 |
| Client wiring still owed for shipped endpoints | rate-expiry scanner on agent `rate_seasons` (triage #35, B11), internal/company booking year list (triage #140, B14) | small client batch |
| Final unwired scan | not yet run on `c33fecc` | recipe in `goal.md` §Scan |

## Operator actions (production — commands are in `HANDOFF-BACKEND.md` / the batch-9 report)

1. **C3** (three agents → `proforma`): **no production write needed** — legacy is master until
   cutover, and `import:legacy --sales` brings them over as `proforma` (verified on the local copy).
   The `PATCH` commands in `HANDOFF-BACKEND.md` stay as a fallback only.
2. **C5**: the "cancelled due to weather" on Early Tratato 15 Oct is a stray
   `POST /v1/weather-closures` by `admin` on cutover day (`wx_c484dc1f…`, no bookings tagged) —
   read first, then `POST /v1/weather-closures/<id>/undo`.
3. **Master data** (5 rate types, boat BMP, two agent bindings): **carried by the cutover import**
   (`seed:boats`, `import:legacy --sales --rate-types`) — nothing to recreate by hand.
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

Decided later on 15 Oct: **#12 yes** — roster route codes (WS/KB, guessed from route names as legacy
does) and their pay rules come back · **#13 yes** — the Daily Report and daily booking counts count
the company's ฿0 internal bookings in pax and bookings, as lk-inbox does · **#14 yes** — Travel
Summary lists every recorded date move (more complete than lk-inbox, which lists only moves it had
snapshotted) · **double-entered booking** — drop main's copy at cutover (above).

Open: **#6** delete the obsolete `handoff/b2-c-20261014` branch · **#10** guide-order design
(may numbers reset, pmap toggles shared or per user, guide list its own endpoints, …) ·
**#11** stamp policy (run the deploy build vs stamp all 662 tags at once).

## Cutover rule

**One full replacement on one day, every area at once** (owner, 15 Oct; supersedes the 9 Oct
per-area idea). Until that day legacy is master of everything and the importers mirror it. Do not
schedule it until every blocker above is resolved and the browser acceptance list passes. On the
day: stop legacy writes; dry-run, then run with `--commit`: `seed:boats`, `import:attachments`,
`import:legacy --sales --rate-types`, `import:day-money`, `import:pier-office`, `import:users`,
`import:addon-services`; `verify:import` (only the P13 lines may differ); then staff enter data only
here. Rehearsed in full on the 13 Oct copy (15 Oct) with exactly this order.
