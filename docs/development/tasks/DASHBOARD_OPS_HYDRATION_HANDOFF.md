# Handoff: hydrate the staff Dashboard from operation-backend

> **Implementation status — 2026-10-10:** the backend endpoint is now available and the frontend day view is integrated. `js/ops/60-ops-dashboard.js` fetches and caches `GET /v1/dashboard?date=…&mode=day`; `renderDash()` uses its operational summary and selected-day route facts once present. The Dashboard visibly says whether it is loading server data, showing a server snapshot, or has fallen back to potentially stale local values. The rolling 30-day chart remains local deliberately: the endpoint's `month` response is calendar-month aggregate data, not a compatible daily series.

## Objective

Replace the Dashboard's locally calculated operational data with an authoritative
`operation_backend` response, while preserving the existing UI and keeping a safe
fallback during rollout.

This handoff concerns the staff app's `dashboard` view (`renderDash()`), not the
separate Booking Dashboard (`b2b-dash` or Booking v2 tabs).

## Current state verified on `integration/operation-backend`

### Frontend entry points

- Dashboard renderer: `allotment_v2/js/04-data-core.js`, `renderDash()`
- Operation-backend client: `allotment_v2/js/ops/00-ops-core.js`
- Operation boot: `allotment_v2/js/ops/90-ops-boot.js`
- Availability bridge: `allotment_v2/js/ops/50-ops-availability.js`

`90-ops-boot.js` already loads, in order:

1. catalogue (routes/boats/markets/sales/agents)
2. deployments
3. seat locks
4. bookings
5. pending approvals
6. availability preload

The Dashboard is redrawn when availability data arrives, but `renderDash()` has
no Dashboard API call. It calculates its cards/charts locally from `TRIPS`,
`SB_BOOKINGS`, `BOATS`, and related client-side helpers. In particular, the
current `renderDash()` body contains no `getAllotment()`, `OPS`, or
`fromServer` references.

## Required backend work

In the separate `operation_backend` repository, add a read endpoint:

```text
GET /v1/dashboard?date=YYYY-MM-DD&mode=day
GET /v1/dashboard?date=YYYY-MM-DD&mode=month
GET /v1/dashboard?date=YYYY-MM-DD&mode=year
```

The endpoint should use existing operation-backend tables and should not require
a schema migration unless an existing-table gap is discovered. Do not create a
second dashboard-specific source of truth.

### Required response shape

The exact names may be adjusted to match the backend conventions, but the
response must contain enough data to reproduce the current Dashboard without
client-side guesses:

```json
{
  "date": "2026-10-09",
  "mode": "day",
  "generated_at": "2026-10-09T02:00:00Z",
  "summary": {
    "total_capacity": 0,
    "booked_pax": 0,
    "free_seats": 0,
    "fill_percent": 0,
    "active_boats": 0,
    "available_boats": 0,
    "fixing_boats": 0,
    "unavailable_boats": 0,
    "operating_percent": 0
  },
  "routes": [],
  "boats": [],
  "bookings": [],
  "alerts": []
}
```

Each route item should include at least:

```json
{
  "route_id": "r1",
  "name": "Similan",
  "capacity": 0,
  "booked_pax": 0,
  "locked_pax": 0,
  "free_seats": 0,
  "fill_percent": 0,
  "state": "open|tight|full|no-allotment|closed",
  "charter_pax": 0
}
```

Each boat item should include enough information for the existing boat/status
cards and operational list:

```json
{
  "boat_id": "boat-1",
  "name": "...",
  "status": "available|fixing|unavailable",
  "route_id": "r1",
  "capacity": 0,
  "booked_pax": 0
}
```

If the current Dashboard has additional cards not covered above, capture their
current values in a fixture before implementation and add explicit response
fields rather than silently recalculating them in the browser.

## Business rules the endpoint must enforce

- Exclude `cancelled`, `cancelled_weather`, and `rejected` from all live
  booking, pax, revenue, capacity, and occupancy aggregates.
- For legacy Dashboard parity, `pending_approval` is included in `booked_pax`,
  occupancy, and capacity-used figures. It is still exposed separately as a
  pending/approval count so users can distinguish it from confirmed business.
- Do not silently invent a new status policy. Inventory the legacy aggregation
  helpers and add explicit API tests for every status. Unknown statuses must be
  classified before the API is made authoritative; if exact legacy parity is the
  goal, document whether the current legacy helper counts or excludes them.
- Charter bookings do not consume the normal seat pool.
- Seat locks reduce sellable capacity.
- Use the authoritative booking-level operational assignment fields where the
  schema contains both booking-level and trip-level copies.
- Respect route closed/open day overrides.
- Distinguish unlimited/land routes from a route with zero deployed capacity.
- Use the application's local business date, not UTC date truncation.
- Make the timezone explicit in the endpoint/service configuration.
- Scope every response to the authenticated user's permissions and tenant.

## Frontend implementation plan

1. Add `ops.dashboard.load(date, mode)` to the existing operation client.
2. On Dashboard navigation/date/mode changes, request `/v1/dashboard`.
3. Render the existing Dashboard markup from the response without changing the
   visual layout or user workflow.
4. Keep the current local renderer behind a temporary feature flag/fallback:

   ```text
   dashboardApi=true  -> API response is authoritative
   dashboardApi=false -> current local renderer
   API failure        -> show stale-data/error state; do not silently present
                         local numbers as current server numbers
   ```

5. Display the response timestamp and a clear partial/stale indicator when
   appropriate.
6. Remove the fallback only after API-vs-current-renderer comparisons pass for
   representative dates.

## Acceptance criteria

- The Dashboard layout, controls, labels, and navigation remain unchanged.
- Day/month/year controls return the correct server-calculated period.
- The same fixture produces matching values between the existing renderer and
  the new API for all cards, route rows, boat rows, and alerts.
- Reloading does not change the values unexpectedly.
- A booking or seat-lock change updates the Dashboard after refresh/reload.
- API failure is visible and does not masquerade as valid zero/seed data.
- View-only users can read the Dashboard but cannot mutate anything through it.
- No database migration is added unless the backend investigation proves one is
  required; if required, stop and handle it as a separate reviewed database
  change.

## Verification plan

### Backend

- Unit-test aggregation rules for cancelled, pending, unknown, charter, locked,
  closed-route, unlimited-route, and no-deployment cases.
- Test day boundaries in the configured Thailand timezone.
- Test permission and tenant isolation.
- Compare endpoint output with SQL fixtures and the current frontend output.

### Frontend

Run existing checks:

```bash
npm run test:smoke
npm run test:mobile
npm run test:ui
```

Add a Dashboard-specific browser test that verifies:

1. Dashboard loads from `/v1/dashboard`.
2. Visible summary values equal the response.
3. Date/mode changes issue the expected query.
4. API failure produces a visible stale/error state.
5. No legacy `/api/load` dependency is introduced on the operation-only branch.

Use the same fixture and viewport against legacy and the new branch for visual
and workflow parity. Do not use screenshot equality as the only assertion.

## Risks and open questions

- `renderDash()` currently contains more business logic than the summary shown
  above. Inventory every output section and its source fields before finalizing
  the response; do not block endpoint implementation on an unbounded redesign.
  The initial contract can be versioned/extended after the inventory.
- Existing local `TRIPS` and `SB_BOOKINGS` may contain fields not yet exposed by
  operation-backend. Identify these gaps before switching the UI to API-only.
- The API must define whether `booked_pax` includes pending approval bookings;
  document the decision and match the legacy behavior.
- Existing client-side availability hydration may overlap with the new endpoint.
  Decide whether Dashboard uses the dashboard response exclusively or uses the
  availability endpoint only for booking/editor screens.
- Never fall back silently to local seed data: that creates a credible-looking
  but incorrect Dashboard.

## Suggested ownership split

- `operation_backend`: endpoint, SQL/query layer, aggregation tests, API contract.
- This repository: ops client, Dashboard adapter/rendering, fallback/error state,
  browser tests.
- Integration owner: compare legacy and new outputs using fixed fixtures and
  approve intentional differences.
