# Reading seat availability from lk-inbox (`GET /v1/availability`)

> For whoever builds a service that needs live seat numbers. Implemented in `b2c-v1-availability.js`,
> tested in `test/unit/b2c-v1-availability.test.mjs`. The endpoint only reads. It holds no seats and
> books nothing.

## Quick start

```bash
curl -H "X-Api-Key: $B2C_API_KEY" "https://rsvn.loveandaman.com/v1/availability?route_id=r10&date=2026-11-04"
```

## Before you start

| You need | Value |
|---|---|
| Base URL | `https://rsvn.loveandaman.com` |
| Header | `X-Api-Key: <key>` on every call |
| Key | The value of `B2C_API_KEY` |

**Getting the key:** in Railway open project **ERP-Loveandaman**, environment **`dev`**, service
**`Allotment_service(FrontEnd)`**, then **Variables**. Yes, `dev` is the live one. Don't use
`production/Operation`, which is a separate copy on another database.

**Rules for the key:**

- Keep it in your service's server-side environment, for example `B2C_API_KEY`. Never commit it, and
  never put it in a log.
- Call from your server only, never from a browser. This route sends no CORS headers, so a browser
  call fails anyway, and on lk-inbox the same key can also create routes.
- The key is shared with Love Kingdom. Changing it needs every service updated at the same moment, so
  tell ops first if you think it has leaked.

## Finding route ids

Call this once and cache it. It returns each route's id and name, and uses the same key:

```bash
curl -H "X-Api-Key: $B2C_API_KEY" "https://rsvn.loveandaman.com/api/b2c/routes"
```

```jsonc
{ "routes": [
  { "routeId": "r10", "name": "...", "pier": "tublamu", "kind": "marine", "times": ["08:00"] }
] }
```

Use `routeId` as `route_id` below. The response has more fields than shown. Only ever `GET` this
path: `POST` creates a route.

## The two calls

### One route, one day

```
GET /v1/availability?route_id=r10&date=2026-11-04
```

```json
{
  "route_id": "r10", "service_date": "2026-11-04", "open": true,
  "deployed_capacity": 40, "licensed_capacity": 45,
  "booked_pax": 12, "charter_pax": 4, "locked_pax": 3,
  "available_seats": 15, "unlimited": false, "unplaced_pax": 0, "licensed_free": 23
}
```

### A date range

```
GET /v1/availability?from=2026-11-01&to=2026-11-30&route_id=r10
GET /v1/availability?from=2026-11-01&to=2026-11-30
```

Leave out `route_id` for every route. Each day has the same fields as above, plus `deployments`:

```json
{ "days": [
  { "route_id": "r10", "service_date": "2026-11-01", "open": true,
    "deployed_capacity": 40, "licensed_capacity": 45,
    "booked_pax": 12, "charter_pax": 4, "locked_pax": 3,
    "available_seats": 15, "unlimited": false, "unplaced_pax": 0, "licensed_free": 23,
    "deployments": [
      { "boat_id": "b1", "capacity": 30, "license_pax": 35, "chartered": false, "trip_type": "normal" },
      { "boat_id": "b2", "capacity": 10, "license_pax": null, "chartered": true, "trip_type": "normal" }
    ] }
] }
```

Days come in date order, then by route in catalogue order. Every route-day is listed, even an empty
one. Prefer one range call to many single-day calls.

### Parameters

| Parameter | Used with | Meaning |
|---|---|---|
| `route_id` | Required for one day, optional for a range | Route id, for example `r10` |
| `date` | One day | `YYYY-MM-DD`. `service_date` also works |
| `from`, `to` | Range | `YYYY-MM-DD`, both inclusive, and must be sent together |
| `exclude_booking_id` | Either | Hand back one booking's seats, to see what an edit of it could use. A Love Kingdom order id such as `LOV-123` covers all its lines |
| `exclude_lock_id` | Either | Hand back one seat lock's seats |

A range is at most **400 days** with `route_id`, and **62 days** without it. Dates are Thailand
operating dates, so don't derive today's date from UTC.

## Reading the answer

| Field | Meaning |
|---|---|
| `available_seats` | **The only number to sell against.** `null` on a land route |
| `open` | Whether the route runs that day. `false` means closed by season or by ops |
| `unlimited` | A land route, which has no seat limit |
| `deployed_capacity` | Seats on every boat assigned that day, chartered boats included. `0` means no boat assigned yet |
| `licensed_capacity` | Registered passenger seats on those boats |
| `booked_pax` | Seats sold, including bookings waiting for approval |
| `charter_pax` | Passengers on charter bookings. Not part of `booked_pax` |
| `locked_pax` | Seats held by locks and not yet used |
| `unplaced_pax` | On a day with no boat: passengers and locks waiting for one |
| `licensed_free` | Registered seats left on unchartered boats. An ops figure for over-allotment approval. Never sell against it |
| `deployments` | Range form only: the day's boats and their seats after any override |

Don't calculate seats yourself. `available_seats` already accounts for chartered boats, day-capacity
overrides, the registered-seat limit, locks and closed days.

**`0` has more than one meaning.** Check in this order, so you can show the right message:

| Check | State | Show |
|---|---|---|
| `open === false` | Closed | The route doesn't run that day |
| `unlimited === true` | Land route | No seat limit |
| `deployed_capacity === 0` | No boat assigned yet | Not scheduled yet. It does **not** mean full |
| `available_seats === 0` | Sold out | Full, or every boat is chartered |
| otherwise | Open | `available_seats` seats left |

## Errors

Errors look like `{ "statusCode": 400, "error": "Bad Request", "message": "..." }`.

| Status | Meaning | What to do |
|---|---|---|
| `400` | Bad or missing parameter. `message` names it | Fix the call, don't retry |
| `401` | Missing or wrong key | Check the key, don't retry in a loop |
| `403` | Not a `GET` | Fix the call |
| `404` | Unknown `route_id` | Refresh your route list |
| `500`, `503` | Our side | Retry with a growing delay |

If a call fails, show "unknown". **Never treat a failed call as 0 seats or as seats available.**

## Calling it well

This is the same server staff work on, and it has no rate limit, so please look after it:

- **Cache for 60 seconds** per route and date range. Answers are `no-store` and always live.
- Use a **10 second timeout**.
- Retry only `500`, `503` and timeouts, at most 3 times, waiting longer each time. Never retry at a
  fixed fast interval, because that piles load onto a server that is already struggling.
- An all-routes range is the heaviest call. Ask for it once a minute at most.

The number is a snapshot, so a seat you read can be sold a second later. This API can't reserve one.

## Example (Node 18+)

```js
const BASE = 'https://rsvn.loveandaman.com';
const cache = new Map();
const CACHE_MS = 60_000;

async function availability(params) {
  const query = new URLSearchParams(params).toString();
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;

  for (let attempt = 0; ; attempt++) {
    let res = null;
    try {
      res = await fetch(`${BASE}/v1/availability?${query}`, {
        headers: { 'X-Api-Key': process.env.B2C_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      if (attempt >= 3) throw e;             // timeout or network failure, out of retries
    }
    if (res?.ok) {
      const body = await res.json();
      cache.set(query, { at: Date.now(), body });
      return body;
    }
    if (res && (res.status < 500 || attempt >= 3)) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`availability ${res.status}: ${error.message || 'failed'}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

function stateOf(day) {
  if (!day.open) return 'closed';
  if (day.unlimited) return 'unlimited';
  if (day.deployed_capacity === 0) return 'no_boat_yet';
  return day.available_seats > 0 ? 'open' : 'sold_out';
}

// One route for November:
// const { days } = await availability({ route_id: 'r10', from: '2026-11-01', to: '2026-11-30' });
// for (const day of days) console.log(day.service_date, stateOf(day), day.available_seats);
```

## Test checklist

1. No key returns `401` with `X-Api-Key is required`.
2. Your key returns `200` for one route and one day.
3. Compare a few days with the Booking calendar. Boats, booked seats and closed days should match.
4. A closed day shows `open: false` and `0`.
5. A month range without `route_id` returns one entry per route per day.

## When bookings move to operation-backend

`operationbackend-production.up.railway.app` serves this same path and these same fields, so the
plan is to change the base URL and keep the key. Check these first, because the hosts differ slightly:

- operation-backend has `open` on the range form only, so read `open` from a range call
  (`from` = `to` works for one day).
- It may answer zeros for an unknown route rather than `404`, and can show seats on a closed day, so
  always check `open` first.
- Its `available_seats` can go below 0 on an oversold day. Here it stops at 0.
- `/api/b2c/routes` does not exist there. Route ids come from `GET /v1/routes`, which this key can't
  read, so that step needs a login.
- It also sends `boat_broken`, which isn't served here.
