# M2 — Daily PFM adapter (`31-ops-pfm.js`)

## Input contract

- **Requested outcome:** Migrate `allotment_v2` Daily PFM screen and commands to `operation-backend` in operations mode, delegating invoice and payment writes to M1 (`30-ops-money.js`).
- **Acceptance criteria:**
  - Load PFM grid from `GET /v1/pfm?from=YYYY-MM-DD&to=YYYY-MM-DD` and render server rows/totals.
  - Send versioned `POST /v1/bookings/:id/pfm/approve-travel` and `POST /v1/bookings/:id/pfm/hold`, plus `POST /v1/pfm/remind`.
  - Refresh PFM response after every command.
  - Stop writing `bk.ops.pfm` and `bk.paymentSlips[]` locally in operations mode.

## Output contract

### Backend files inspected

- `D:/projects/operation-backend/src/routes/money.ts`
- `D:/projects/operation-backend/src/domain/pfm.ts`
- `D:/projects/operation-backend/test/money-pfm.test.ts`

### Endpoints exercised

| Method | Path | Body / Query |
|---|---|---|
| `GET` | `/v1/pfm` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `POST` | `/v1/bookings/:id/pfm/approve-travel` | `{ approver }` + `If-Match` |
| `POST` | `/v1/bookings/:id/pfm/hold` | `{}` + `If-Match` |
| `POST` | `/v1/pfm/remind` | `{ from, to }` |

### Verification

- `node --check allotment_v2/js/ops/31-ops-pfm.js` — passed
- `node --check test/unit/ops-pfm.test.mjs` — passed
- `node --test test/unit/ops-pfm.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/money-pfm.test.ts` — 4/4 passed
- `git diff --check` — passed
