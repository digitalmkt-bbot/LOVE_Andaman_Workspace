# W3: check-in commands (Q36) and moved-away rows (Q33)

Branch `wire/w3-checkin-cmds`. Decisions followed: `todo/decisions-answers.md` (Q36, Q33) in operation-backend; the guide is
`todo/w2-checkin-money-model.md` (sections 1, 2, 6) and `todo/checkin-commands-model.md`.
Test: `node test/ui/t_walk_cmds.mjs` (new, 50 checks, all green). Each command family is checked on both sides: the request body, the
server's record, and the screen.

## 1. Functions done

Check-in commands live in `allotment_v2/js/ops/36-ops-checkin-cmds.js`; moved-away rows in `allotment_v2/js/ops/36-ops-van-strands.js`.
Both are registered in `allotment_v2.html` after `36-ops-day-actions.js`. Every wrapper runs the original in legacy mode.
All command URLs are `/operations/trip-ops/{trip}/checkins/{van|pier}/{slot}/...`. The slot comes from the kind (`van#2` is slot 2).

| Legacy name | File | Status | Endpoint |
|---|---|---|---|
| `ckToggle` | `ops/36-ops-checkin-cmds.js` | WIRED | `POST …/check-in` `{}`. Legacy's money dialog (`pckPayGuard`) still comes first on the pier; the answer's `reason_needed` opens the reason dialog, `pay_owed` shows the server's message when the screen did not know about the debt |
| `ckStep` | same | WIRED | `POST …/count` `{delta}`. `409 needs_self_add` opens legacy's self-add dialog (as `ckSelfOpen` did); `reason_needed` opens the reason dialog |
| `ckEvSave` | same | WIRED | `POST …/events` `{type, reason_code, ad, chd, inf, foc, note?, at?}` (the dialog is always in the per-category mode). The dialog stays open on a refusal |
| `ckBackSave` | same | WIRED | `POST …/events/{i}/undo` `{why, note?}` |
| `ckTrySave` | same | WIRED (not on the task list, in the Q36 table) | `POST …/events/{i}/tries` `{note?, at?}` |
| `ckSelfSave` | same | WIRED | `POST …/self-add` `{ad, chd, inf, foc, note?}` |
| `ckPierReinstate` | same | WIRED | `POST …/reinstate` `{on}`; legacy's two confirm texts kept |
| `ckReasonSave` | same | WIRED (not on the task list, in the Q36 table) | `PUT …/reason` `{reason_code, reason_note?, reason_at?}` |
| `pckStageSet` | same | WIRED | `POST …/stage` `{stage: arrived\|cleared, on}`; the boarding step runs `ckToggle` (so the money dialog and reason apply). Same step logic as legacy: pressing the step you are on goes back one |
| `vckSetFlow` | same | WIRED | `POST …/stage` `{flow, note?}` |
| `ckCap` | - | SKIPPED-DESIGN | Display only (the dialogs show "expected / room"). The server works out its own `expected`/ceiling in every command; the board figures stay in the browser (decided 2026-10-17). It could read `trip.aboard` later (Q35), not a command |
| `ckEventUndo` | `ops/36-ops-day-actions.js` | SKIPPED-OTHER | Not on my list; the model note keeps it unbuilt (Q34c). It still writes the whole record with the old PUT (which now takes the server's stamps) |
| `ckStrandMovedRows` | `ops/36-ops-van-strands.js` | WIRED | `GET /operations/van-strands?date=` (all rows of the day; each screen filters by route as before). Rows are turned into legacy's row shape, `why_text` is `strandWhy` |
| `ckStrandStore` | same | WIRED | Read-only map `{ "<booking>\|<day>": … }` built from the cached server rows (`ckStrandClear` uses it to tell a moved row from a cancelled one) |
| `ckStrandStoreSave` | same | WIRED | Does nothing: the `ops_stranded` blob is not written any more |
| `ckStrandSnap` | same | WIRED | Stores nothing (the server snapshots the move); marks the old day stale and reads it again once the write queue is idle |
| `ckStrandMvDrop` | same | WIRED | Drops the row from the cache and reads again (it is called after the DELETE of `ckStrandClear` succeeded) |
| `ckStrandOn` | - | SKIPPED-NOT-NEEDED | Cancelled-and-arranged rows are the booking's own status and ops, not the read (the model note says so) |
| `ckStrandClear` | `ops/36-ops-day-actions.js` | unchanged (kept as asked) | `DELETE /operations/van-strands/{booking}/{date}`; the read is refreshed after it |

Draw rule for Q33: `renderVanCheckin`, `renderVanJobs`, `renderPierCheckin` (so the Land Check-in too) and `renderTravelSum` ask for their day on
every draw (at most once per 4 s, at once after a booking write or a remote booking change) and draw again when the answer differs. A moved
booking this machine does not hold yet (a fresh browser) is fetched by id first, so the row and its clear button work.

### How a tap now works

The tap sends only what happened. The wrapper waits for the answer, merges the returned trip into the booking (`mergeTripOperations`), and
redraws the open check-in screen with the scroll kept and **no blur** (a note being typed is not cut off; checked in the test). Nothing is
drawn at the click itself (the old code drew once at the click and once at the answer). Taps are queued one at a time (`laOps.queue`), so
two quick taps on `+` count twice, as legacy did. `expect_actual_pax` is not sent.

Not sent any more: `actual_pax`, `expected`, `no_show`, `self_add`, `reinstate`, `checked_in_*`, `arrived_*`, `cleared_*`, `flow_at/by`, an event's
`by`/`ts`. The test asserts none of them is in any command body.

## 2. Fields and rows created

None on the server. Browser side:

- `window.laOps.vanStrands` (`load`, `stale`, `rows`): the per-date cache of the moved-away rows (memory only, rebuilt on each draw).
- Each cached row keeps the server's row as sent; the legacy-shaped rows are built from it on every call, so nothing is stored.
- The browser blob key `ops_stranded` is no longer written or read in ops mode (the test checks it stays empty).
- A booking fetched only to draw a moved-away row is added to `SB_BOOKINGS` (as any day load does).

## 3. Decisions needed

1. **`ckEventUndo` ("ถอนรายการล่าสุด") still uses the old whole-record PUT.** The model note keeps it unbuilt (Q34c). Its adapter already marks
   the last live event undone as a "mistake", which is exactly `POST …/events/{i}/undo` with `why: "mistake"`. Wiring it takes one function;
   until then the PUT cannot be removed on the backend.
2. **Two server refusals are new against legacy** (from the model note, shown with the server's message): `ckEvSave` over the people left is
   `409 more_than_left` (legacy clamped silently; the dialog's own maximum already prevents it); `ckSelfSave` above what is outstanding is `400`.
   The dialog's limits keep both from showing in normal use.
3. **`pay_owed` does not block.** Legacy's money dialog still blocks first with its "ขึ้นเรือก่อน" skip; the server only warns. When the screen
   does not know about the debt, the server's message is shown as a toast ("Money still to collect": "3000 still to collect before this booking
   boards"), and the row is ticked. Say if the warning should instead offer the skip dialog.
4. **A check in `t_walk_dayops.mjs` was changed**: the no-show test expected two draws of the pier row ("at the click, then at the answer").
   The screen now waits for the server and draws once, from the answer, so it expects one or more. Nothing else in that file changed.
5. **`t_walk_dayops.mjs` has one red check that is not from this work:** item 4 "cancelled path: the row left the Van Check-in screen" was red
   before any change (baseline run) and stays red in the full run; it is green when item 4 runs alone (`ONLY=4`). It depends on state from earlier
   items. The intended red (item 4, "a second machine … sees the moved-away row") is now green. Also seen once: item 3 "split part keeps 08:10",
   a one-off that passed on the next run.
6. **Past days and the van tab's permission** stay as the backend defaulted them (no past-day lock; one permission, operations or pier area);
   `ckGuard` is still the only screen-side check.
