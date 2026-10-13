# F1 — Boat assignments, certificates, documents, and readiness (`22-ops-fleet-boats.js`)

## Input contract

- **Requested outcome:** Hydrate `BOATS` with full server fields (`capacity`, `license_pax`, `registered_persons`, `name_th`, `documents`, `status_log`, `status_effective`, `blocked_by`, `pier_today`, `at_shop`), load per-boat assignments and fleet certificates, and wire assignment create/cancel and document renewal to `operation-backend`.
- **Acceptance criteria:**
  - Map `cap/licensePax/totalcap/nameTh/docs/log` to `capacity/license_pax/registered_persons/name_th/documents/status_log` and `s/from/to` to `status/from_date/to_date`.
  - Ensure `pier_today` never overwrites home `pier`.
  - Refetch the boat after assignment and document renewal commands.
  - Block legacy `flSave()` in operations mode.

## Output contract

### Backend files inspected

- `D:/projects/operation-backend/src/routes/operations.ts`
- `D:/projects/operation-backend/src/routes/fleet.ts`
- `D:/projects/operation-backend/src/routes/fleet-extras.ts`
- `D:/projects/operation-backend/src/domain/catalogue.ts`
- `D:/projects/operation-backend/src/domain/fleet-assignments.ts`
- `D:/projects/operation-backend/src/domain/fleet-certificates.ts`
- `D:/projects/operation-backend/src/domain/fleet-availability.ts`

### Endpoints exercised

| Method | Path | Body / Query |
|---|---|---|
| `GET` | `/v1/boats` | none |
| `GET` | `/v1/boats/:id` | none |
| `GET` | `/v1/fleet/availability` | `?from=&to=&boat_id=` |
| `GET` | `/v1/boats/:id/assignments` | none |
| `POST` | `/v1/boats/:id/assignments` | `{ type, from_pier, to_pier, start_date, end_date, reason, cost }` |
| `POST` | `/v1/boats/:id/assignments/:asn_id/cancel` | `{}` |
| `GET` | `/v1/fleet/certificates` | none |
| `GET` | `/v1/boats/:id/documents` | none |
| `POST` | `/v1/boats/:id/documents/renew` | `{ name, state, expires_on? }` |

### Blocked / deferred items

- Boat CRUD, status-log mutation, retire/restore, and capacity-override bodies belong to C3 discovery and are intentionally left out of F1 per handoff instructions.

### Verification

- `node --check allotment_v2/js/ops/22-ops-fleet-boats.js` — passed
- `node --check test/unit/ops-fleet-boats.test.mjs` — passed
- `node --test test/unit/ops-fleet-boats.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/fleet-extras.test.ts` — passed
- `git diff --check` — passed
