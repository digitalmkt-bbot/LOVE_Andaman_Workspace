# M1 — Finance transactions adapter (`30-ops-money.js`)

## Input contract

- **Requested outcome:** Migrate `allotment_v2` invoice, payment, deposit, and refund/credit transactions to `operation-backend` in operations mode.
- **Acceptance criteria:**
  - Hydrate `SB_INVOICES`, `SB_PAYMENTS`, and `SB_DEPOSITS` from `/v1/invoices`, `/v1/deposits`, and `/v1/refunds`.
  - Use dedicated server endpoints for invoice creation, header/WHT edits, discounts, payments, payment corrections, voiding, deposits, deposit spend (`method: 'credit'`), and refund payouts.
  - Never generic-patch computed invoice status/amount fields or patch local `booking.invoiceId` / `booking.paymentStatus`.
  - Keep operations-mode mutations server-first; preserve legacy mode unchanged.
- **Allowed scope:** `allotment_v2/js/ops/30-ops-money.js`, its classic script tag in `allotment_v2/allotment_v2.html`, `test/unit/ops-money.test.mjs`, `docs/development/tasks/M1-ops-money.md`, and `.agent-reports/M1.json`.

## Output contract

### Backend files inspected

- `D:/projects/operation-backend/src/routes/operations.ts`
- `D:/projects/operation-backend/src/routes/money.ts`
- `D:/projects/operation-backend/src/routes/credit.ts`
- `D:/projects/operation-backend/src/domain/invoices.ts`
- `D:/projects/operation-backend/src/domain/refunds.ts`
- `D:/projects/operation-backend/src/domain/credit.ts`

### Endpoints exercised

| Method | Path | Body / Query |
|---|---|---|
| `GET` | `/v1/invoices` | optional `{ agent_id, booking_id, status, from, to }` |
| `POST` | `/v1/invoices` | `{ agent_id, booking_ids, kind?: 'booking'|'prepay', note?, ref?, dear?, accept_at?, remark? }` |
| `PATCH` | `/v1/invoices/:id` | `{ note?, ref?, dear?, accept_at?, remark?, wht_amount? }` |
| `PUT` | `/v1/invoices/:id/discounts` | `{ lines: [{ seq, discount }] }` |
| `POST` | `/v1/invoices/:id/void` | `{ reason? }` |
| `POST` | `/v1/invoices/:id/payments` | `{ amount, method: 'transfer'|'cash'|'card'|'credit', paid_on?, ref?, slip_ids?, overpay_anyway? }` |
| `POST` | `/v1/invoices/:id/payment-corrections` | `{ payments: [{ id, amount?, method?, paid_on?, deleted? }], reason?, overpay_anyway? }` |
| `GET` | `/v1/deposits` | optional `{ agent_id, include_voided }` |
| `POST` | `/v1/deposits` | `{ agent_id, amount, method?, received_on?, ref?, note?, slip_ids? }` |
| `POST` | `/v1/deposits/:id/void` | `{ reason }` |
| `GET` | `/v1/refunds` | optional `{ agent_id, booking_id, kind, paid_out }` |
| `POST` | `/v1/refunds/:id/payout` | `{ method: 'transfer'|'cash'|'cheque', paid_on?, ref?, slip_ids? }` |
| `DELETE` | `/v1/refunds/:id/payout` | none |

### Projection mapping

- `SB_INVOICES`: populated from server `InvoiceView` objects (`subtotal`, `net_amount`, `vat_amount`, `total`, `wht_amount`, `payment_amount`, `paid`, `balance`, `refunded`, `credited`, `overpaid`, `status`, `lines`, `payments`, `refunds`).
- `SB_PAYMENTS`: derived from live invoice payments and refund/credit entries on `SB_INVOICES`.
- `SB_DEPOSITS`: populated from live `/v1/deposits` records; deposit spend is recorded as an invoice payment with `method: 'credit'` without locally decrementing deposit records.

### Verification

- `node --check allotment_v2/js/ops/30-ops-money.js` — passed
- `node --check test/unit/ops-money.test.mjs` — passed
- `node --test test/unit/ops-money.test.mjs` — 4/4 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/invoices.test.ts test/credit.test.ts` — 14/14 passed
- `git diff --check` — passed
