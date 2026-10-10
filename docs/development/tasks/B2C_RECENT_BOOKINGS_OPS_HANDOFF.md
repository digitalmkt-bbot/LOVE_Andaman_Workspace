# B2C + Recent Booking Feed — operation-backend handoff

**Status:** Proposed
**Owners:** operation_backend (ingestion + API), frontend integration (consume API)
**Goal:** Restore direct-sales (B2C), Dashboard **Live bookings**, and **Bookings / day** in the operation-backend deployment without restoring legacy `/api/load` or a broad browser booking preload.

## Problem

`lk-inbox`/legacy makes these screens work by loading the whole app blob, including all `sb_bookings`, into `SB_BOOKINGS` at login. The Dashboard then derives recent activity from each booking's `createdAt` / `bookingDate`.

The operation-backend frontend intentionally no longer boot-loads bookings. Calendar and By-trip are travel-date scoped, so Dashboard live feeds and the B2C page have no creation-date-scoped source.

The temporary frontend implementation can page `GET /v1/bookings` newest-first, but that is not a durable contract: it depends on ordering and cannot efficiently or precisely express “bookings created in the last N days”.

## Legacy reference behavior

### B2C ingestion

Legacy `server.js` imports the B2C source into operations `sb_bookings`:

- normal import filter: **travel date >= today − 90 days**;
- all future travel dates are included;
- default cap: **20,000 booking-item rows**;
- runs on `/api/load`, through a background poller, and through targeted order sync/webhook handling;
- a targeted order sync can fetch a booking outside the normal window.

The browser then receives the entire assembled state blob. This is why legacy Live B2C/B2B and Bookings/day can calculate by booking creation date even though B2C ingestion itself is travel-date scoped.

### Do not copy this part

Do **not** recreate `/api/load`, its all-entity blob, or a 90/120-day browser preload. It is costly and makes unrelated screens load data they do not use.

## Required operation-backend work

### 1. B2C ingestion (server-to-server)

Move the B2C source integration into `operation_backend`; the browser must not call the B2C database/API directly.

Required behavior:

- receive a B2C order webhook where available; otherwise poll safely;
- map/upsert direct orders into operation-backend bookings with stable external identity;
- preserve B2C identity/channel fields needed by staff UI:
  - source/channel classification (`b2c` vs B2B),
  - external order/reference,
  - created timestamp from the source,
  - payment status/paid amount where available,
  - cancellation changes;
- ensure retries are idempotent;
- expose ingestion health/last-success/error for staff/admin diagnostics.

A schema migration is **not expected** if the existing booking model already has an extensible source/channel field. If the model lacks durable B2C source, external ID, or creation-time fields, stop and follow the database-change freeze/PR process before changing it.

### 2. Creation-date booking list endpoint

Add an authenticated, cursor-paginated endpoint to query bookings by when they entered the system/source, rather than when travel occurs.

```
GET /v1/bookings/recent?created_from=YYYY-MM-DD&created_to=YYYY-MM-DD&source=b2c|b2b|all&limit=100&cursor=...
```

Suggested response:

```json
{
  "bookings": [
    {
      "id": "...",
      "external_id": "...",
      "source": "b2c",
      "channel": "website",
      "status": "confirmed",
      "created_at": "2026-10-11T05:42:00.000Z",
      "booking_date": "2026-10-11",
      "trips": [],
      "total": 0
    }
  ],
  "next_cursor": null
}
```

Rules:

- sort descending by `created_at`, with a stable ID tie-breaker;
- `created_from`/`created_to` use Bangkok calendar-day boundaries; document whether `created_to` is inclusive;
- default `source=all` but allow B2C-only and B2B-only;
- cancelled/rejected records may be returned for audit, with their status explicit; Dashboard cards decide whether to exclude them;
- agent accounts retain existing scope restrictions; view-only staff may read;
- enforce a bounded `limit` and opaque cursor.

`GET /v1/bookings` may remain travel-date based for Calendar, By-trip, manifest, boat, and van workflows. Do not overload its `from`/`to` semantics.

### 3. Optional aggregate endpoint

For high-volume sites, add creation-day aggregates so Dashboard does not have to download raw bookings just to draw a chart:

```
GET /v1/dashboard/booking-activity?from=YYYY-MM-DD&to=YYYY-MM-DD
```

```json
{
  "timezone": "Asia/Bangkok",
  "days": [
    {
      "date": "2026-10-11",
      "all": { "bookings": 12, "pax": 34, "revenue": 42000 },
      "b2c": { "bookings": 5, "pax": 11, "revenue": 15000 },
      "b2b": { "bookings": 7, "pax": 23, "revenue": 27000 }
    }
  ]
}
```

This endpoint is the preferred source for Dashboard **Bookings / day** (7/30-day chart). The recent-list endpoint remains necessary for the Live B2C/B2B rows.

## Frontend integration

### Dashboard

- On opening Dashboard, request activity aggregates for the visible 7/30-day chart range.
- Request the recent list only for the number of Live B2C/B2B rows displayed.
- Cache responses in memory by complete query parameters.
- Deduplicate in-flight requests.
- Invalidate affected caches after a booking write or B2C push notification.
- Show a small loading/failed provenance state; do not render an authoritative-looking zero when the feed has not loaded.

### B2C page

- On opening B2C, request `source=b2c` for its selected date range.
- Do not infer B2C solely from a browser-local ID prefix. Prefer the server `source` field; retain legacy fallbacks only for migrated records.
- Define KPIs honestly: the legacy label says “7d”, so use a seven-day creation-time query/aggregate, not all loaded records.

### Booking operations

Keep the current split:

- Calendar: selected **travel month**;
- By-trip / manifest: selected **travel day**;
- All-bookings: selected month or explicit server pagination;
- Dashboard: dashboard/activity endpoints;
- B2C: recent creation-time endpoint.

## Acceptance criteria

1. A new direct B2C order reaches operation-backend without a staff browser being open.
2. It appears in Dashboard Live B2C after the API refresh/push cycle.
3. It contributes to the correct Bangkok day in Bookings/day.
4. It appears in the B2C page with channel, payment, and cancellation status correctly represented.
5. Calendar/By-trip show it for its travel date without boot-loading unrelated months.
6. A cancelled B2C order updates status and is excluded/included exactly as documented by each KPI.
7. Dashboard opening does not request an all-history booking list or legacy `/api/load`.
8. Tests cover date-boundary, pagination/cursor, source classification, cancellation, idempotent webhook replay, and staff/view-only/agent authorization.

## Current frontend state

The frontend has an uncommitted temporary recent-feed path that pages the current `/v1/bookings` newest-first list for Dashboard/B2C. It is a stopgap only. Replace it with the explicit creation-date contract above before treating Dashboard/B2C metrics as complete or authoritative.
