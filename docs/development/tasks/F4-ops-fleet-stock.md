# F4 — Stock, consumables, and purchase memos (`25-ops-fleet-stock.js`)

## Input contract

- **Requested outcome:** Migrate stock items (`FL_INVENTORY`), consumables (`FL_CONSUMABLE_LOGS`), and purchase memos (`FL_MEMOS`) to `operation-backend` in operations mode, inspecting `src/routes/fleet-stock.ts`, `src/domain/fleet-stock.ts`, `src/domain/fleet-memos.ts`, and `src/domain/fleet-seams.ts` first.
- **Acceptance criteria:**
  - Hydrate `FL_INVENTORY`, `FL_MEMOS`, and `FL_CONSUMABLE_LOGS` from `/v1/fleet/stock-items`, `/v1/fleet/memos`, and `/v1/fleet/consumables`.
  - Never submit local `stocks[].qty`, movement history, or replacement arrays: quantities are server movement-derived.
  - Replace/refetch responses after stock movements, job part additions/removals, consumable draws/voids, and memo commands.

## Output contract

### Backend files inspected (inspect-first evidence)

- `D:/projects/operation-backend/src/routes/fleet-stock.ts`
- `D:/projects/operation-backend/src/domain/fleet-stock.ts`
- `D:/projects/operation-backend/src/domain/fleet-memos.ts`
- `D:/projects/operation-backend/src/domain/fleet-seams.ts`
- `D:/projects/operation-backend/test/fleet-stock.test.ts`

### Inspected payload contracts

- `POST /v1/fleet/stock-items`: `{ name, part_no?, category?, supplier?, unit?, min_qty?, cost?, note?, qty?, warehouse? }`
- `PATCH /v1/fleet/stock-items/:id`: `{ name?, part_no?, category?, supplier?, unit?, min_qty?, cost?, note?, part_no_anyway? }`
- `POST /v1/fleet/stock-items/:id/receive`: `{ warehouse, qty, date?, note? }`
- `POST /v1/fleet/stock-items/:id/transfer`: `{ from, to, qty, date?, note? }`
- `POST /v1/fleet/stock-items/:id/adjust`: `{ warehouse, qty, date?, note? }`
- `POST /v1/fleet/stock-items/:id/merge`: `{ from_ids: string[] }`
- `POST /v1/fleet/jobs/:id/parts`: `{ item_id, warehouse, qty?, late_anyway?, date? }`, `DELETE /v1/fleet/jobs/:id/parts/:idx[?late_anyway=true]`
- `POST /v1/fleet/consumables`: `{ item_id, warehouse, qty, boat_id, engine_id?, engine_label?, date?, by?, note?, allow_negative? }`, `DELETE /v1/fleet/consumables/:id`
- `POST /v1/fleet/memos`: `{ no, title, boat_id?, memo_type, scope, general_category?, proposer?, from?, to?, cc?, ref_note?, supplier?, note?, memo_date, job_id?, project_id?, vat_enabled, vat_rate, discount_pct, discount_amt, lines }`
- `POST /v1/fleet/memos/:id/approve`: `{ approved_by, approved_date?, note? }`
- `POST /v1/fleet/memos/:id/order`: `{ ordered_date?, ordered_by? }`
- `POST /v1/fleet/memos/:id/receive`: `{ warehouse?, date?, note?, lines: [{ line_id, qty }] }`
- `POST /v1/fleet/memos/:id/short-close`: `{}`
- `POST /v1/fleet/memos/:id/pay`: `{ paid_date?, paid_by?, paid_via? }`
- `POST /v1/fleet/memos/:id/cancel`: `{ reason, allow_negative? }`

### Verification

- `node --check allotment_v2/js/ops/25-ops-fleet-stock.js` — passed
- `node --check test/unit/ops-fleet-stock.test.mjs` — passed
- `node --test test/unit/ops-fleet-stock.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/fleet-stock.test.ts` — passed
- `git diff --check` — passed
