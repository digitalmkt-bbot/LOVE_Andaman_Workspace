# RECONFIRM — ops-board re-confirmation (operation-backend)

Status: implemented (ops-board actions only). Branch `integration/operation-backend`.

## Evidence (read before coding)
- `D:/projects/operation-backend/src/routes/operations.ts` (lines ~1915-1935): `PUT /v1/bookings/:id/reconfirm` (body `{status, via?}`), `DELETE /v1/bookings/:id/reconfirm?all=true|false`; both return the booking.
- `D:/projects/operation-backend/src/routes/operations.ts` (~1999-2014): `POST /v1/reconfirm/sent` body `{booking_ids[], sent: boolean}` (not wired; see below).
- `D:/projects/operation-backend/src/domain/reconfirm.ts`: `RECONFIRM_STATUSES = wa|noans|off|callback|done`; `RECONFIRM_VIAS = reconfirm|phone|list`; `withStatus` (via ≠ reconfirm replaces the record and clears `sent`); `withoutStatus(all)`.
- Legacy: `allotment_v2/js/booking/bookingV2Reconfirm.js`, `bookingV2ReconfirmClear.js`, `bookingV2ReconfirmAll.js`; state lives on `bk.ops.reconfirm` `{status, via, at, by, sent, sentAt, sentBy}`.
- Gap found: `40-ops-bookings.js` mapped only `bk.reconfirm = {sentAt, sentBy}`; legacy reads `bk.ops.reconfirm`, so the state was lost on reload in ops mode. Fixed by a 3-line projection in the same mapper.

## Endpoints wired
| Legacy action | Request |
|---|---|
| `bookingV2Reconfirm(bkId, via)` | `PUT /v1/bookings/{opsId}/reconfirm` body `{status:'done', via:'list'|'phone'}` |
| `bookingV2ReconfirmClear(bkId)` | `DELETE /v1/bookings/{opsId}/reconfirm?all=true` |
| `bookingV2ReconfirmAll(date, rid, via)` | one `PUT` per live, not-done booking of that route/day, sequential via `laOps.queue` |

Day-of write: not versioned, so `laOps.call` (not `bookingWrite`), per `00-ops-core.js`.

## Not wired (route confirmed, but outside this packet's UI)
- `rcSetStatus` (Re-confirm page status picker), `rcSendAgent` / `rcUnsendAgent` (`POST /v1/reconfirm/sent`), `rcToggleBooking`. They remain legacy-only; their bodies are confirmed above, so they can be added in a follow-up.

## Files
- `allotment_v2/js/ops/39-ops-reconfirm.js` (new adapter)
- `allotment_v2/js/ops/40-ops-bookings.js` (+3 lines: projection of `ob.reconfirm` to `bk.ops.reconfirm`)
- `allotment_v2/allotment_v2.html` (one tag before `90-ops-boot.js`)
- `test/unit/ops-reconfirm.test.mjs`

## Tests
- `node --test test/unit/ops-reconfirm.test.mjs`: 8/8 pass (mapping; exact PUT/DELETE paths and bodies; no mutation before response; no mutation after refusal; bulk filter and order; bulk stops at first refusal; legacy mode delegates, no request).
- `node --test test/unit/ops-*.test.mjs`: 44/44 pass at the time of this commit (before S5 was added).

## Confirmation
No backend, DB, schema, migration, mapping JSON, or SQL change.
