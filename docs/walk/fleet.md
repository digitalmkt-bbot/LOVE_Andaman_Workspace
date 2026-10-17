# Fleet walk-through report (browser vs real seeded backend)

Test: `node test/ui/t_walk_fleet.mjs` (about 4 min). Real UI clicks and typed fields, server asked directly.
49 checks. No page errors. No wiring bug found, so no `fix(ops)` commit.

IMPORTANT: this branch (`walk/fleet`, from main 097dffc5) does NOT contain several wiring commits that sit on
`wire/fn-02/03/04`. To walk them I cherry-picked four of them on a scratch branch `walk/fleet-held`
(flSaveMemo `c492aed6`, daily-log readers/issue-item add `becb15ad`, projects `7e9eb262`, incident status `a4c0c0a2`).
The test file is the same on both branches. Items 4, 5 (add item, previous meter, raw readers) and 7 need those
commits; on plain `walk/fleet` they fail because the function is not wired.
Not applied (cherry-pick conflicted or was blocked): `285b263c` (fuel intelligence), `547529ff` (assign-engine info).

| # | Function | Result | Evidence |
|---|---|---|---|
| 1 | saveBoat | PASS | add -> POST /v1/boats (cap 18, licence 20, crew 2), edit -> PATCH, survives reload; seats 16 -> 8 on a day with 14 pax: 409 seats_sold, confirm shown with the server text, resent with capacity_anyway, server cap 8 |
| 2 | saveRoute | PASS | add -> POST /v1/routes (pier panwa, family similan), edit -> PATCH (name, pier tublamu); body has no daily_cap; modal closes, ROUTES holds the server id |
| 3 | bsCleanupLog | PASS | on a stale screen copy: one DELETE and one PATCH status-log/{id} sent; server log now [12-01..12-09, 12-20..12-22]. (Overlap had to be made on the screen copy because the server never lets the log overlap.) |
| 4 | memos flSaveMemo / receive state | PASS (needs held commit c492aed6) | create -> POST /v1/fleet/memos, server totals 1000 / 1070; edit via flEditMemo -> PATCH, 2 lines, 1200 / 1284; memoRecvState and flwMemoLabour equal server receive_state / labor_only after a partial receive |
| 5 | issue items, daily log, water, prev meter, fuel price | PASS (needs held commit becb15ad) | flIssueQuickAdd -> POST issue-items (unit, pier); switch off then add same name -> one item turned on; PUT water x2 (used 40), PUT issues (5), PUT fuel-prices (38.5, flFuelPriceEff {price 38.5, src pier}), PATCH fuel; flPrevMeter 120 for the later day, null before the first; raw readers flWaterAll / flIssueAll hold server values |
| 6 | Fuel Intelligence | NOT-REACHABLE | `_fuelAgg` / `_fuelWkAgg` are not wrapped in this build (wiring commit 285b263c is on wire/fn-03 and did not apply). Server answers GET /v1/fleet/reports/fuel (fuel 200 L, 1 boat). Screen still uses the legacy browser sum |
| 7 | Projects | PASS (needs held commit 7e9eb262) | phases, current phase, health, bill gate, cost on screen equal the server; flProjSetPhase -> PATCH {phase}; flProjMarkComplete with an open gate opens the bill dialog and sends no complete; "wait" -> POST work-done (awaiting_bill, note kept); close again: 0 baht with empty note refused on screen, with a reason -> POST complete {no_cost_reason}, server completed |
| 8 | Job start gear | PASS | keep -> start {gear:keep}, gearbox stays on engine; stash -> {gear:stash, stash_location}, gearbox and propeller become spares; swap -> {gear:swap}, old engine off the boat, picker shown; install -> POST engines/{spare}/install, spare engine on b13; skip -> no install, PATCH old engine spare_location, dialog closed |
| 9 | Quick swap / propeller cascade | PASS | gearbox with a propeller: cascade dialog asked, ONE POST incidents/{id}/swap with propellers [{action: stock}], spare gearbox on the engine, propeller spare; propeller swap: one POST, spare propeller on the gearbox. (Server refuses a spare not kept at `pier:...` or of another brand/size with 409 spare_not_compatible, shown as written) |
| 10 | Safety / documents / inventory / assign-engine | PASS except assign-engine | wizard sends labour 300 and the server puts it on the job as a part "ค่าแรง" 300 (memo keeps only the 500 part); state EXPIRED / OK and life-jacket shortfall (need 48, have 5, short 43) equal the server; boat document status warn30 / exp / ok equals GET /v1/boats/b7/documents; stock in warehouse tublamu is listed under pier:tublamu, not panwa. assign-engine next service: NOT-REACHABLE (547529ff not in the build, `_fromOpsBackend` not used in flAssignEng) |
| 11 | Job board, consumable, repair cost, pax | PASS | flBoardSilent / Blocks / Lane equal server silent_days / blocks_boat / lane for all 5 jobs, and a lane set on the server shows; consumable 3 x 50 = 150 equals server cost; repair cost month b7 900 equals GET reports/upkeep (first draw is the browser figure 800, replaced by the server figure, as designed); flBoatBookingsFor pax 3 equals server pax_booked |

## Commits
- Tests: `test(walk): fleet items 1-3 ...` and the final `test(walk): fleet walk` + `walk-report.md` on `walk/fleet`.
- Fixes: none (no wiring bug found).
- Scratch branch `walk/fleet-held` holds four cherry-picked held wiring commits plus the same test. Do not merge it as is.

## For the developer to decide
1. Held wiring commits not on main: flSaveMemo, daily-log readers and issue-item add, projects (phases, bill gate), incident status are on `wire/fn-03` only and are not in main; fuel intelligence (285b263c) and assign-engine info (547529ff) conflict or were not applied. Until they are merged, items 4, 5, 6, 7 and part of 10 do not work on main.
2. `flBoatRepairCostMonth` draws the browser figure first and the server figure a moment later (visible flicker, 800 then 900). Its own comment says this is intended.
3. bsCleanupLog: the clean-up can only produce server writes when the screen copy has overlaps; the server never allows them, so on a healthy log it does nothing (same as legacy intent, but the button is now mostly a no-op).
