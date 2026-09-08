# Unpersisted writes in `allotment_v2.html` — catalogue (LAM-21)

> **Spike output — a document, not a fix.** No source file was modified to produce this
> catalogue. Line numbers are as of `fa60a96` (2026-08-19) and will drift; grep the
> function name instead. Every row below was verified by reading the actual function body
> in `allotment_v2/allotment_v2.html`, not inferred from comments alone.

## 1. How persistence actually works here (needed to read the table)

Per `CLAUDE.md` §2, the client keeps a working copy in `localStorage['loveandaman_v2']`
(`LS_KEY`) and syncs it to Postgres. Concretely (`allotment_v2.html:64-82`):

- `Storage.prototype.setItem` is overridden. A call to `localStorage.setItem(LS_KEY, json)`
  is intercepted: the string is stashed in an in-RAM `_mem` variable and, if the session can
  edit, a debounced `save(v)` fires ~1s later, POSTing the whole blob to `/api/save`.
- **Any code that calls `localStorage.setItem(LS_KEY, …)` — whether through a
  `xxxPersist()`helper, the generic `save()`/`flSave()`, or a hand-rolled
  read-modify-write — does reach the server.** The dozens of direct
  `localStorage.setItem(LS_KEY, JSON.stringify(d))` call sites found by a raw grep are
  therefore **not** bugs by themselves; this codebase's persistence pattern is
  "read-modify-write the blob," not "always call one central function."
- The actual bug class this spike hunts is narrower: **a global store (`SB_*`, `FL_*`, an
  agent/booking sub-field) is mutated in memory, but no code path for that mutation ever
  calls `localStorage.setItem(LS_KEY, …)` (directly or via a `*Persist()`/`save()`/`flSave()`
  wrapper) at all, or only calls it conditionally.** Those mutations exist only in the live
  JS object; the next page load re-hydrates from the server blob (or from `_mem`, which was
  never updated either) and the change is gone.
- On prod, `DATA_BACKEND=relational` (`CLAUDE.md` §2, `server.js:26`): the whole-blob POST is
  decomposed into ~103 `operation_schemas` tables by `os-backend/src/mapping/os_repo.js`,
  driven **only** by `os-backend/src/mapping/field_mapping.json`. A top-level blob key with
  no entry in that file is silently dropped on `decomposeBlob` and never re-emitted by
  `assembleBlob` on the next `/api/load` — confirmed directly from the `§mapDrift` comment
  and `MAP_DRIFT` boot-check at `server.js:46-71` ("สิ่งที่ผู้ใช้เห็นคือ กรอกได้ ไม่มี error
  ไม่มีเตือน แล้วรีเฟรชทีข้อมูลหายทุกครั้ง" — the user can type it in, no error, no warning,
  then it disappears on every refresh). This means a mutation can pass every client-side
  persistence call it has and *still* not survive a reload if its blob key was never
  registered server-side. Row 4 below is a confirmed instance of exactly this.

## 2. Ranked catalogue

Ranked by blast radius = (how core the data is) × (how easily the loss goes unnoticed) ×
(whether the UI falsely signals success).

| # | Mutation site | Store touched | Persisted? | Lost on reload? | Blast radius |
|---|---|---|---|---|---|
| 1 | `ctRenewActivate()` — `allotment_v2.html:65317` | `SB_AGENTS[a]` (contractVersion/Start/End/Status, contractHistory, programPeriods, addonServices, agentSignatory, companyInfo, bookingChannel) + `SB_AGENT_PRICES[a.id]` | **No** — zero `sbAgentsPersist()` / `localStorage.setItem` call anywhere in the function | **Yes, entirely** | **Critical** |
| 2 | `aosSaveModal()` `:79018`, `aosDeleteService()` `:78928`, `aosAddVariant()`/sibling fns | `SB_ADDON_SVCS` (never loaded from or written to the blob at all); `aosDeleteService` also mutates `SB_AGENTS[].addonServices` in place | **No** for `SB_ADDON_SVCS`; **No** for the `SB_AGENTS` side-effect in `aosDeleteService` (no `sbAgentsPersist()`) | **Yes** | **High** |
| 3 | `flSaveAssignment()` `:35420`, `flCancelAssignment()` `:35481`, `flAutoUpdateAssignments()` `:35505` | `BOATS[b].assignments[]` (+ `b.pier` on a permanent/active assignment) | **Conditionally** — each writes `localStorage.setItem(LS_KEY,…)` directly, but only inside `if(ls.boats){…}`; also **none of the three call `laCanEditArea('fleet')`**, unlike every other fleet mutation, which is gated only inside `flSave()` | **Yes if `ls.boats` is falsy** (edge case after a fresh reset/first boot); **also a permission bypass** — a view-only fleet user's assignment edit *does* persist, unlike every other fleet edit | **Medium** |
| 4 | `fuelSetBudget()` `:29873` | `fleet_fuelbudget` (a raw top-level blob key, not a JS global `flLoad()` hydrates) | **Writes localStorage directly**, no `laCanEditArea('fleet')` guard — **but `fleet_fuelbudget` has zero entry in `os-backend/src/mapping/field_mapping.json` or `operation_schemas_model.json`** (confirmed by grep; contrast with the sibling key `fleet_fuelprice`, which *is* registered as `fleet_fuelprice` map table) | **Yes, on the relational backend** — `osRepo.decomposeBlob` drops the key on every save, `assembleBlob` never re-emits it (see §1); the client-side write looks successful but the DB never sees it. *(Static verification only — no reachable Postgres in this sandbox to reproduce end-to-end.)* | **Medium** (planning figure, not transactional, but a genuine, previously-undocumented DB round-trip loss) |
| 5 | Booking-side stamp inside `acctPersistBookings()` `:42877`, called by `sbInvoicesPersist`/`sbPaymentsPersist`/`sbDepositsPersist` | `bk.invoiceId` / `bk.paymentStatus` / `bk.history` on `SB_BOOKINGS` | **Guard mismatch, not a missing call**: `acctPersistBookings` is gated on `laCanEditArea('operations')`; the three invoice/payment/deposit persist functions that call it are gated on `laCanEditArea('accounting')`. A user with `accounting` but not `operations` rights creates the invoice/payment successfully (`SB_INVOICES`/`SB_PAYMENTS`/`SB_DEPOSITS` persist fine) but the linked booking's stamp silently no-ops | **Yes, for that role combination** — the booking reverts to looking un-invoiced next session even though the invoice/payment record exists | **Medium** (real accounting/booking desync, plausible role setup) |
| 6 | OCR failure branch inside the doc-check pre-check promise chain, `.catch(...)` around `allotment_v2.html:75242-75244` | `bk.docCheck.pre = {at, error}` on `SB_BOOKINGS` | **No** — the `.catch` branch sets `b.docCheck.pre` unconditionally but never calls `_docCheckPersist()`, regardless of edit rights (the success branch does gate+call it) | **Yes** | **Low** (diagnostic-only OCR error marker, not a core booking field) |
| 7 | `SB_AGENT_PRICES` regeneration — `_seedAgentPrices()` `:39914` (`let SB_AGENT_PRICES = _seedAgentPrices();`) | `SB_AGENT_PRICES` | **N/A by design** — never loaded from the blob, never written to it; regenerated synthetically on every boot | **Always** — any mutation into this store (e.g. row 1's `SB_AGENT_PRICES[a.id]={}` carry-over clear) is moot; contract-renewal price snapshots (`archiveEntry.snapshot.prices`, `:65332`) capture synthetic seed prices, never real negotiated ones | **Low–Medium** (already flagged in `02-sales-agents-pricing.md` §9.23; listed here because it compounds row 1's severity — even a *correctly persisted* renewal would archive fake prices) |

### Notes on rows already named in the Jira ticket

- Row 2 covers the `SB_ADDON_SVCS`/`aosSaveModal` instance from the ticket, plus one
  sibling (`aosDeleteService`) the ticket didn't name — it was found by reading the rest of
  the same `#view-addonsvc` module (`:78802`–`:79046`) once the first instance was located.
- Row 1 covers `ctRenewActivate` as named.
- Row 3 covers `flSaveAssignment` / `flCancelAssignment` / `flAutoUpdateAssignments` as
  named. Contrary to the ticket's framing of "write localStorage directly instead of via
  `flSave()`" reading as pure omission, the code **does** call
  `localStorage.setItem(LS_KEY, …)` in all three — the actual defects are the missing
  `laCanEditArea('fleet')` guard and the `if(ls.boats)` conditional, both confirmed by
  reading the function bodies.
- Row 4 covers `fuelSetBudget` as named — same "does call setItem" correction as row 3, but
  this one has an additional, more serious, previously-undocumented defect: the blob key it
  writes has no server-side mapping at all.

### Findings beyond the six named sites

Rows 5, 6, and 7 were found by systematically grepping all eight
`allotment_v2/docs/workflows/*.md` files for existing "never persist / not persisted / RAM
only / lost on reload / silently stays in RAM" language (a prior documentation effort had
already flagged these), then re-verifying each one directly against the current source:

- Row 5 — `06-accounting-finance.md` §10.1, verified against `acctPersistBookings`
  (`:42877`, gated `operations`) vs. `sbInvoicesPersist`/`sbPaymentsPersist`/`sbDepositsPersist`
  (`:42846`-`:42848`, gated `accounting`).
- Row 6 — `03-boat-operations-pier.md` line 370, verified against the OCR promise chain
  around `:75225`-`:75246`.
- Row 7 — `02-sales-agents-pricing.md` §9.23, verified against `let SB_AGENT_PRICES =
  _seedAgentPrices();` (`:39914`) and its only mutation site inside `ctRenewActivate`
  (`:65367`).

### What was checked and found *not* to be a bug (for completeness)

- The ~170 raw `localStorage.setItem` call sites found by a blind grep are almost all
  legitimate read-modify-write persistence (the codebase's actual pattern, per §1) —
  `sbXPersist()` families, `flSave()`, per-view UI-preference keys (`sb_collapsed`,
  `_cal_view_mode`, etc.), and the boot/sync shim itself. Only the ones in the table above
  mutate a *data* store without ever reaching a write, or reach it only conditionally.
- View-only users' edits staying in RAM (`07-data-persistence-api.md` §17: `laCanEdit()`
  gates the sync shim itself) is **by design** (amber "ดูอย่างเดียว" badge tells the user),
  not catalogued as a defect — distinguished from rows 3/4, where the bug is that the
  fleet-area guard is *missing*, not present-and-working.

## 3. Method

1. Read the four named sites' Jira description and the two cited workflow-doc sections
   (`02-sales-agents-pricing.md` §§9.11/9.21, `05-fleet-management.md` §10.19) to get exact
   line anchors and expected behavior.
2. Read each function body directly in `allotment_v2.html` (grep → 30–80 line window) and
   confirmed, for each mutation: which global/array is touched, whether any
   `localStorage.setItem` / `*Persist()` / `save()` / `flSave()` call exists in the same
   function, and whether that call is unconditional.
3. Grepped every `allotment_v2/docs/workflows/*.md` file for
   `never persist|not persist|RAM only|in-memory only|lost on reload|stays in RAM|silently`
   to surface additional candidates a prior documentation pass had already flagged, then
   re-verified each candidate against current source rather than trusting the doc text.
4. For the `fleet_fuelbudget` finding, additionally cross-checked
   `os-backend/src/mapping/field_mapping.json` and `operation_schemas_model.json` (both
   present in this worktree) against `server.js`'s `MAP_DRIFT` boot-check logic to confirm,
   statically, that the key has no relational destination — since no Postgres instance is
   reachable from this sandbox to reproduce the round-trip loss live.

## 4. Explicitly out of scope (per task constraints)

This is a spike. No fix was applied to any of the seven rows above, and
`allotment_v2/allotment_v2.html` was not modified. Suggested next steps (not performed
here): add `sbAgentsPersist()` to `ctRenewActivate`; load/persist `SB_ADDON_SVCS` like every
other `SB_*` list; add the missing `laCanEditArea('fleet')` guard to the three assignment
functions and to `fuelSetBudget`; register `fleet_fuelbudget` in `field_mapping.json` +
`operation_schemas_model.json`; align the `acctPersistBookings`/`sbInvoicesPersist` edit-area
guards; add a persist call to the OCR failure branch.
