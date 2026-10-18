# Van Job Orders sheet (branch wire/vanjobs-sheet, 2026-10-17)

Backend Q41 (`todo/decisions-answers.md`): rewrite the sheet renderer from `GET /operations/van-jobs/{date}/{key}`. No backend change.
In ops mode the sheet is drawn from the server's rows; the browser reads, counts, groups, orders and merges nothing for it.
Legacy functions stay for non-ops mode (`wrap('fn', function(orig, ...){...})`).

Files: `js/ops/35-ops-van-job-sheet.js` (new, loads after `35-ops-van-jobs.js`), `js/ops/35-ops-van-jobs.js` (exposes the day read and job keys).
Evidence: `test/ui/t_walk_vanjobs.mjs` (screen = server), `test/ui/make_vanjobs_pdf.mjs` (PDFs and text dumps in `docs/walk/pdf/`).

## 1. Functions done

| Legacy name | File | Status | Server field |
|---|---|---|---|
| `vanJobsOrderInner` (the sheet: drawer preview, full screen, print window, save as image all call it) | `js/08-app.js`, wrapped in `js/ops/35-ops-van-job-sheet.js` | WIRED | `GET /operations/van-jobs/{date}/{key}`: `job, out, ret, ret_on_round_1, unassigned_on_route` (block table below). Falls back to the legacy function only when the sheet has no programme (`routeId` empty): the server's sheets are one programme each |
| `_collect`, `_section`, `_rowTime`, `_rank` (inside `vanJobsOrderInner`: which bookings, ordering, merging, numbering, totals) | `js/08-app.js` | WIRED (no longer run in ops mode) | `out.rows`, `ret.rows`, `no`, `merged_parts`, `struck`, `totals` |
| `vjRoundOf` (round of one group: drawer title, print window title, image file name, the sheet's round tag) | `js/08-app.js`, wrapped | WIRED | day read `jobs[].round {no, of, time}` found by van, route and `group_number`; `null` when the job has no round |
| `bookingV2VanJobOrder` (print window) | `js/booking/bookingV2VanJobOrder.js`, wrapped | WIRED | Opens at once when the sheet is in hand (younger than 30 s), else loads the sheet first. Layout and CSS are legacy's |
| `vanJobsSaveImage` | `js/08-app.js`, wrapped | WIRED | the same |
| `renderVanJobs` list band (hero banner, per-van rows, filters, rail, edit panel) | `js/08-app.js`, `js/ops/35-ops-van-jobs.js` | KEPT-LEGACY | The list is still counted from the local bookings. A rewrite needs the per-leg booking counts the job lacks (section 3, no. 7) and a copy of the 290-line renderer. The drawer and full-screen sheet inside it are WIRED through `vanJobsOrderInner`. See decision 1 |
| `vjRoundAll`, `vjRoundAllC`, `vjRoundPick`, `vehDayRoundN` | `js/08-app.js` | KEPT-LEGACY | The list's job keys, the Transfer Fleet month matrix and By-trip van mode ask them for days with no job read. The sheet no longer calls any of them |
| `vanJobsBookingsFor` | `js/08-app.js` | KEPT-LEGACY | Only the list's expanded edit panel (special request per booking) uses it, and it needs the booking objects |
| `bkDropOf` | `js/08-app.js` | KEPT-LEGACY | The sheet no longer calls it (server `drop_off`, `drop_own`). The alternate-pickup editor and `bookingV2SyncAltPickupSplits` still do |
| `_ovnOutDate` | `js/08-app.js` | KEPT-LEGACY | `vanJobsOrderInner` never called it (the "went out on" date is not on the legacy sheet). Eight other screens use it |

## 2. Block of the legacy sheet -> server field

| Block of the sheet | Server field |
|---|---|
| Header: van name, plate, pin on a day plate | `job.van.name`, `job.driver.plate`, `job.driver.plate_override` |
| Header: driver, phone, "updated today" pin | `job.driver.name`, `.phone`, `.override` |
| Header: company / partner van, zone base | `job.van.ownership`, `.partner_name`, `.zone_base` |
| Header: date label | the date asked for (formatted in the browser, as legacy) |
| Header: "ขาไป N คน · ขากลับ M คน" | `out.totals.pax`, `ret.totals.pax` (round 2+: no return count, as legacy); "ไม่มี booking" when `out` and `ret` are both null |
| Round tag (header, big band, purple box "รอบ n / of · ออก hh:mm") | `job.round {no, of, time}` |
| Route name in the big band | `job.route_name` |
| Red banner "เส้นทางนี้ยังมี N booking (M คน) ที่ยังไม่ได้จัดรถ" and its route line | `unassigned_on_route {bookings, pax}`, `job.route_name` |
| Purple banner "รถปนกันในกรุ๊ป" (van-group conflict) | none: a group has one van on the server, so it cannot arise. Not drawn. See decision 3 |
| Outbound / return tables: which rows, their order, numbering | `out.rows`, `ret.rows` (`no`) |
| Row: voucher, lead name | `voucher`, `lead_pax` |
| Row: other names (two, then "+N more") | `other_names` |
| Row: AD / CHD / INF / FOC, purple AD for a split part | `ad`, `chd`, `inf`, `foc`; `split` not null |
| Row: "จุดหลัก / แยกรับ / แยกส่ง · who · เดียวกัน voucher" | `split {kind: main / pickup / drop / manual, who}` |
| Row: "รับจุดเดียวกัน N กลุ่ม · ขากลับแยกส่ง" (merged parts) | `merged_parts` (the row's pax are already added up) |
| Row: pick-up time (outbound), "—" (return) | `pickup_time` |
| Row: pick-up place, Thai name under it | `pickup` (the pier on the return leg), `pickup_th` |
| Row: room, zone with Thai name | `room`, `zone`, `zone_th` |
| Row: drop-off cell, "→ ท่าเรือ", "↩ กลับ:" | `drop_off` |
| Row: "✂ แยกส่ง · who" tag | `drop_own`, `split.who` |
| Row: "↩ ขากลับ โดย <van>" (outbound) | `return_van_id` (van name from the van catalogue the screen holds) |
| Row: "กลับคันเดิม" / "มาจากรถอื่น (ขาไป <van>)" (return) | `from_van_id` (null prints "กลับคันเดิม", see section 3, no. 4) |
| Row: amber background for a row on another van | `extra` |
| Row: bags, special request | `bags`, `special_request` |
| Row: overnight out ("ค้างคืนบนเกาะ · กลับ <date>", OVN tag) | `ovn: "out"`, `ovn_return_date` |
| Row: overnight leg ("ส่งกลับ · มาจากเกาะ", OVN tag) | `ovn: "leg"` |
| Return row tag "✗ ไม่ได้เดินทาง · ไม่ต้องรอ" | `loss` (`no_show + cxl` at least the row's `pax`) |
| Return row tag "🚶 เช้าไม่ได้ขึ้นรถ … ขากลับส่งตามปกติ" | `loss.self_pier` more than 0 (the reason in brackets: section 3, no. 2) |
| Cancelled row (struck, "ยกเลิกแล้ว · ไม่ต้องไปรับ", "ล้างออก" button, no number, in no total) | `struck: "cancelled"`, `no: null`; the button calls the existing `ckStrandClear` (wired in `ops/36-ops-day-actions.js`) |
| Moved-away row (struck, "เลื่อนวันแล้ว · เลื่อนไป <day>") | `struck: "moved"`, `moved_to` |
| Van-stop row (แวะ, label, seats, leg, time, place, phone, zone, note) | `kind: "stop"`: `stop_kind`, `label`, `seats`, `leg`, `time`, `place`, `phone`, `zone`, `zone_th`, `note` |
| Total row: AD / CHD / INF / FOC | `out.totals`, `ret.totals` (`ad, chd, inf, foc`) |
| Total row: "N pax · M booking · แยกส่ง K จุด" | `totals.pax`, `.bookings`, `.separate_drops` |
| Total row: "ค้างจัดการ N (ยกเลิก/เลื่อนวัน · ไม่นับ)" | `totals.struck` |
| Total row: "จุดแวะ N · ลูกค้า X + ติดรถ Y = Z ที่นั่ง" | `totals.stops`, `.stop_seats`, `.pax` |
| Round 2+ note "ขากลับไม่ได้อยู่ในใบนี้ — อยู่ในใบรอบ 1 (N คน)" | `ret_on_round_1`; N is `ret_pax` of the round 1 job in the day read |
| Notes line, call-us line, column headings | legacy text, unchanged |
| Row highlight colour (`vjHl*`), template (`vjTpl*`), van colour | client settings (`vanjob_rowhl`, `vanjob_tpl`), unchanged; the highlight key uses the screen's booking id for the server's `booking_id` |

Checked against legacy on the same seeded day (`docs/walk/pdf/vanjobs-order-legacy.txt` against `vanjobs-order.txt`): the text of round 1
is identical except the cancelled booking, which the server keeps struck in its group (the legacy function, run on the copy in the browser, did not list it).

## 3. Fields the server lacks

The backend can add these. Nothing was invented; each block is listed with what the screen does now.

1. `alt_pickups` on an outbound row: the purple lines under the pick-up place ("🚌 N คน · who [zone] @ place", legacy `b.altPickups`). Now read from the booking the screen holds (a booking field, nothing counted). Without that booking in the browser the lines are left out.
2. Reason label of the "เช้าไม่ได้ขึ้นรถ (<reason>)" tag, e.g. `loss.self_pier_reason`. Now `pckSelfPierNote` on the local check-in; without it the tag has no brackets.
3. "Heads still travelling" on a return row (legacy `ckPaxLeft`). The server has `loss {no_show, cxl, self_pier}`; the screen tests `no_show + cxl >= pax` for the "ไม่ได้เดินทาง" tag. It can differ from legacy when the lost heads were typed by category.
4. The outbound van of a return row, or a `same_van` flag. `from_van_id` is null both for "came out on this van" and "no outbound van"; the screen prints "กลับคันเดิม" for both (legacy printed nothing for the second).
5. Passenger count for legacy's "+N more" when the passenger list holds only the lead (legacy printed "+1 more" then). Not drawn.
6. `code`: `voucher` falls back to the booking's id, legacy's to `voucherRef || code || id`. Only a booking with no voucher shows the difference.
7. Per-leg booking counts on a job (`out_bookings`, `ret_bookings`) for the list's "↩ ขากลับ N" badge and the rail's "N bk". `bookings` counts both legs once.
8. The hero numbers of the list band by programme (unassigned, return not arranged, self-arrive) exist on the day read (`unassigned.by_route`, `return_unarranged`, `self_arrive`); only the list rewrite (decision 1) would use them.

## 4. Fields and rows created

No server field or row. In the browser, nothing is stored: `laOps.vanJobs.sheet.cache` (the sheets in hand, in memory), `laOps.vanJobs.jobKey`, `.dayRead`, `.loadJobs`, `.redraw`, and `dayRead` (the last day read per date) in `35-ops-van-jobs.js`. A drawn sheet is asked for again when it is older than 1.5 s at the next draw or after a write by this tab, and redraws only when the answer changed.

## 5. Decisions needed

1. Rewrite the list band of the screen too (`renderVanJobs`, `vjRoundAll`, `vehDayRoundN`, `vanJobsBookingsFor`)? It needs the backend to add the two per-leg counts (no. 7) and a copy of the legacy list markup in the ops file. Until then the list and the sheet can disagree when local data and server data do (the sheet then says "The server has no job order for this van and programme").
2. First draw: the sheet shows "Loading the job order from the server…" until the answer lands (legacy drew at once from local data), and cannot draw offline. OK?
3. The purple "รถปนกันในกรุ๊ป" banner is gone: the server cannot put one group on two vans. OK?
4. The "unassigned" banner counts bookings, not parts (legacy counted each part), so a split booking with two unassigned parts shows 1 where legacy showed 2. The pax figure is the same.
5. Print window: when the sheet is older than 30 s it is fetched first and the window opens after the answer. Safari may block a window opened after a wait; Chrome does not. Raise the 30 s, or accept?
6. Section 3, no. 3 and no. 4 print slightly different tags from legacy until the backend adds the fields. Ask for them, or accept?

Tests: `node test/ui/t_walk_vanjobs.mjs` (50 checks: rows, numbers, totals, banner, round, struck, merged, overnight, return-only day, no booking in the browser, change on the server, print window), `node test/ui/make_vanjobs_pdf.mjs`, `node test/ui/t_ops.mjs`, `node test/ui/t_walk_dayops.mjs` (one known red: item 4, moved-away row on a second machine), `node --test test/unit/ops-van-jobs.test.mjs`.
`t_walk_dayops.mjs` needed `guide_english: true` in its booking seed: the server now refuses to confirm a booking without a guide language.
