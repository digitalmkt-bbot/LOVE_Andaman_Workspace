# w3-costing · the costing design sheet wired to the server (2026-10-18)

Branch `wire/w3-costing`. Server side: operation-backend `todo/w2-costing-model.md` (the mapping, section 6 "what the frontend must change"), `todo/decisions-answers.md` Q37 and Q38.
Idiom: legacy functions are wrapped from `js/ops/44-ops-costing-pl.js` (`wrap(...)` for the commands, `wrapCalc(...)` for the sheet's maths); legacy answers outside ops mode.
No legacy file was edited. Everything is in `ops/44-ops-costing-pl.js` and `allotment_v2.html` (the `?v=` of that file).

Checks: `node --check` on the changed file; `node --test test/unit/ops-costing-pl.test.mjs` 8/8; `node test/ui/t_walk_costing.mjs` (new, 33 checks against the real backend) all green;
`t_ctv2`, `t_rentoffplan`, `t_rentzero`, `t_plankeep` (legacy mode) no failures; `node test/ui/t_ops.mjs` finishes with 3 failures in the booking section (edit re-price, reschedule, locks untouched) that this work does not touch
(before this work the file crashed at the third one, because its `ok()` printed `JSON.stringify(undefined).slice`; that is fixed so it reports instead). `t_assetver.mjs` fails on 108 files before and after (CRLF checkout: it hashes the working copy).

## How the live preview works (Q37)

The sheet's maths is called synchronously from many render paths, so it cannot wait for a request.

1. A **stored plan** shown on the costing screen is turned into a `POST /v1/costing/calc` body: the plan's fields (the API's names, via `planToServer`; without name, note, route key, tiers, itinerary, which move no figure), the template as the screen holds it now, and `pax`.
2. The call is **debounced 250 ms** after the last ask and goes through `laOps.queue`, so it runs after any pending save (a rent just edited is on the server first).
3. The answer is **cached** under plan + template (+ the rent record and boat seats of the pinned boat). The same plan edited again is a new key. 300 answers are kept; any write that is not costing clears the cache.
4. The wrapped sync functions read that cache and put the server's figures into legacy's own result object (same shape, so the markup is untouched). With no answer yet they return legacy's own arithmetic: the sheet never blanks.
5. When the last answer is in, the sheet is drawn once more (`ctRender`, which keeps focus and scroll). A failed call is remembered for that key and legacy stays on screen.
6. Plans that are not the stored plan (a copy with another price, used for the five price levels and the tiers; the boat-operation break-even with `_asOf`) are **not asked for** and keep legacy's arithmetic.

## 1. Functions done

| Legacy name | File | Status | Endpoint / field |
|---|---|---|---|
| `ctCalc` | `ops/44` | WIRED | `calc.gross, vat_in, net, fixed_net, var_net, rows[]` of the draft; only for the sheet's own context (the plan's heads, engines, boats, fuel, boat); the rent object stays legacy's |
| `ctProfitAt` | `ops/44` | WIRED | `calc.profit, revenue, revenue_tour, revenue_on_demand, adults, children` at the plan's heads; other head counts that the server priced for its `sheet.curve[]` (`profit`, `revenue`); the rest legacy |
| `ctBreakEven` | `ops/44` | WIRED | `sheet.key_figures.break_even` (when `cap` = `sheet.capacity`, seats x boats) |
| `ctChdAt` | `ops/44` | WIRED | `sheet.children` (at the plan's heads) |
| `ctStepCount` | `ops/44` | WIRED | `sheet.step_count` (at the plan's heads) |
| `ctPlanSeats` | `ops/44` | WIRED | `seats` |
| `ctVatR` | `ops/44` | WIRED | `sheet.vat_share` (answer with the same template) |
| `ctCostPerHead` | `ops/44` | WIRED | `sheet.cost_per_head.amount` (for a plan; `ctCostPerHead(null)`, the base, stays legacy) |
| `ctOdQty` | `ops/44` | WIRED | `sheet.on_demand.lines[].expected_qty` (sheet context only; a `ctx.odQty` from the P&L stays legacy's) |
| `ctV2OvrTot` | `ops/44` | WIRED | `sheet.override_total { pax, gross, per_head }`: the "total per trip" row is built from it; a plan with no answer yet gets legacy's cell |
| `ctFactSheet` | `ops/44` | SKIPPED-DESIGN (partly) | asks for the plan; its key figures, cost table, curve and break-even come through `ctProfitAt` / `ctCalc` / `ctBreakEven` above. The rent block, the price levels, the contract by month and best/base/worst are still arithmetic in the legacy function: using `sheet.rent`, `sheet.price_levels`, `sheet.contract` means redrawing the 440-line renderer from the sheet, which is not a wrap. See decision 1 |
| `ctRentOf`, `_ctRentOfCalc` | `ops/44` | WIRED | the boat-rent record's `seats, total, run_days, per_day, per_trip, per_calendar_day` (read with `GET /v1/costing/boat-rents`, kept again from every `PUT`); used while the record on screen is the one the server answered for |
| `ctTplFill`, `ctTplOdSeed` | `ops/44` | WIRED | the template comes from the server already filled with the default lines and the on-demand seed (`effectiveTemplate`); in ops mode the two functions return the template untouched and no longer save one |
| `ctPartAmt` | `08-app.js` | SKIPPED-NOT-NEEDED | per-part leaf, called with any part and context; its sum is the server's `calc` through `ctCalc`. The server's per-part amounts (`sheet.line_parts`) are for a screen that explains a line, and none does |
| `ctPaxSplit` | `08-app.js` | SKIPPED-NOT-NEEDED | helper inside `ctPartAmt`; the server has no split field because no screen shows one |
| `ctEffLine` | `08-app.js` | SKIPPED-DESIGN | merges a template line with a plan's override for the override inputs; the server gives no effective-part values (only amounts), so the editor keeps it. See decision 2 |
| `ctGrpMul` | `08-app.js` | SKIPPED-NOT-NEEDED | `1 + pct/100` on the group % the person typed (a client fact); `sheet.group_settings[].multiplier` is the same number |
| `ctOdPct` | `08-app.js` | SKIPPED-NOT-NEEDED | a yes/no on the template line's first part (per head or per item); `sheet.on_demand.lines[].per` is the same |
| `ctOdRev` | `08-app.js` | SKIPPED-OTHER | the server gives the on-demand revenue only after VAT (`calc.revenue_on_demand`, `on_demand.kept_revenue`), legacy's function returns it before VAT and `ctFactSheet` shows it so. Used through `ctProfitAt` (`revOd`) already. See decision 3 |
| `ctRentActiveOn` | `08-app.js` | SKIPPED-NOT-NEEDED | compares a date to the contract's from/to; the server applies the same test inside its own calc |
| `ctBoatFuelMul` | `08-app.js` | SKIPPED-NOT-NEEDED | reads the stored fuel % of the boat's rent record (a client fact, `fuel_pct`); `sheet.boat_fuel_pct` is the same number |

### Q38

| Legacy name | File | Status | Endpoint / field |
|---|---|---|---|
| `ctFamSetPlan` | `ops/44` | WIRED | `PUT /v1/costing/route-plans/{key}` `{plan_id \| null}`; the screen changes at once (legacy's own effect), the plans are read again from the server after |
| `ctDelLine` | `ops/44` | WIRED | `DELETE /v1/costing/template/lines/{id}`: by the line's id, with legacy's confirm text; then the server's template and plans (override and on-demand figures cleared) are read |
| `ctRenameGroup` | `ops/44` | WIRED | `POST /v1/costing/template/rename-group` `{from, to}`: one step for the lines and the plans' group settings |
| `ctResetTpl` | `ops/44` | WIRED | `POST /v1/costing/template/reset`: one step for the template and the plans' overrides |
| `ctDelPlan` | `ops/44` | WIRED | `DELETE /v1/costing/plans/{id}`; the last plan goes to the server without the confirm and the screen shows the server's `409 last_plan` message ("ต้องเหลืออย่างน้อย 1 แผน") in an alert, as legacy did |
| `ctPlanSetOn` | `ops/44` (`writePlans`) | WIRED | the PATCH answer's `pax` (at least 1) and `pax_th` (at most `pax`) replace what the screen holds; legacy's clamp stays as the hint. The same goes for every plain edit (`ctPlanSet`), and for `route_key`: the plans that lost the key are cleared on screen |

Plain edits keep using `PUT /v1/costing/template` and `PATCH /v1/costing/plans/{id}`, which apply the same rules on the server.

## 2. Fields and rows created

No server field or row. Browser-side only (all in memory, nothing in localStorage):

| Name | Where | What it holds |
|---|---|---|
| `calc.ans`, `calc.order`, `calc.byTpl` | `ops/44`, exposed as `laOps.costingPL.calcState` | cached `POST /v1/costing/calc` answers, by plan + template (300 kept); `byTpl` the latest answer per template (for `ctVatR`) |
| `calc.wants`, `calc.busy`, `calc.failed` | same | the asks waiting for the debounce, in flight, and refused (not asked again until a write) |
| `cost.rentSrv` | `ops/44` | the rent numbers the server worked out for each boat, with the record they belong to |

## 3. Decisions needed

1. **`ctFactSheet` (print sheet and fact sheet): redraw it from `sheet.*`?** Today its key figures, cost table and break-even are the server's (through the primitives), but the rent block, the five price levels, the contract by month and the best/base/worst tables are still legacy arithmetic. The server gives all of them (`sheet.rent`, `price_levels`, `contract`). Doing it means replacing the 440-line renderer's arithmetic with reads of `sheet`, a larger edit in `08-app.js` than a wrap. Say yes and it is the next branch.
2. **`ctEffLine`** (effective parts of a line under a plan's override): the override editor shows the template value as the placeholder. The server returns amounts, not effective unit values. Keep as is, or add `sheet.line_parts[].parts[].effective` on the server?
3. **`ctOdRev`**: legacy returns the on-demand revenue before VAT; the server only gives it after VAT. Needed only inside `ctFactSheet`. Add a before-VAT field (`on_demand.revenue_gross`) on the server if decision 1 is yes.
4. **Plan tab fields `pax` and `pax_th`**: legacy does not clamp there (only the column header does), and the server stores 1 / the cut value. So that typing is not interrupted, the screen keeps the number being typed while the field has focus and shows the server's value after. Fine, or clamp as the column header does?
5. **Sending the whole template with every ask** (about 8 KB). The server also accepts no `template` (it uses the saved one), but then a template edit not yet saved would be missed. Kept the safe form; say if the size matters.
6. **Which answers are used**: the preview only runs on the costing screen and only for plans that are stored (also not-yet-saved new plans). Trip P&L and the boat-operation break-even (`_asOf`) still use their own paths (the first is the server's report, the second legacy's arithmetic); not part of this task.
7. **`t_ops.mjs` has 3 failing booking checks** (edit re-price, reschedule, locks untouched) unrelated to costing; the file crashed before reaching them. Someone who owns bookings should look.
