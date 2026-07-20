# Pickup-Zone Data — Full Picture + What Crosses the B2C API

Pickup "zones" in this app are **three overlapping levels**, not one list. My earlier note only
covered Level 1 (the 3 pricing zones), which is all the external B2C API actually sends — but the
real granularity lives in Level 2 (**37 pickup areas**). Both are documented here, plus exactly what
leaves the app.

> Data below is the baked **default seed** in `allotment_v2.html`. Pickup areas are editable in the
> **Pickup Setup** UI and persist to `sb_pickup_areas`, so a live install may have more/renamed
> areas — verify against live (`SB_PICKUP_AREAS`) if you need the exact current list.

---

## The three levels

| Level | Name | Count | Source | Sent to B2C? |
|------|------|-------|--------|--------------|
| 1 | **Transfer zones** | 3 | `SB_TRANSFER_ZONES` (`:35323`) | ✅ yes (as price buckets) |
| 2 | **Pickup areas** | 37 | `SB_PICKUP_AREAS` (`:36138`) | ❌ no |
| 3 | **Time groups** | 16 | `timeGroup` on each area + `SB_PICKUP_TIMES` (`:36190`) | ❌ no |

Each area rolls **up** to exactly one transfer zone (for pricing) and **into** a time-group (for
pickup-time scheduling per route).

---

## Level 1 — Transfer zones (the price buckets, SENT to B2C)

```
SB_TRANSFER_ZONES = ['PK', 'KL', 'NoTransfer']
```

| Zone | Meaning |
|------|---------|
| `PK` | Phuket pickup |
| `KL` | Khao Lak pickup |
| `NoTransfer` | Self-arrive at pier (no transfer) |

These three are the only pickup dimension in the outbound `GET /api/b2c/availability` response
(`server.js:1021`), where each active rate type carries prices for `PK` / `KL` / `NoTransfer`, split
by pax type (adult/child/infant) × nationality (`_fr` foreign / `_th` Thai). `NoTransfer` omits
infant. (See "What crosses the API" below.)

---

## Level 2 — Pickup areas (the "more zones", NOT sent to B2C)

37 named areas, each `{ id, name, zone, region, timeGroup }`.

### PK · Phuket (33 areas)

| Region | Areas |
|--------|-------|
| `phuket-north` | Maikhao, Naithon, Naiyang, Airport, Talang |
| `phuket-east` | Aopor, Pa Khlok, Yamu, Monument, Ko Kaeo, Sapam, Aoyon, Panwa |
| `phuket-w-n` (west-north) | Layan, Laguna, Bangtao, Cherngtalay, Surin (beach) |
| `phuket-west` | Kamala, Kalim, Tritrang, Patong, Karon, Kata |
| `phuket-south` | Rawai, Naiharn, Saiyuan, Chalong, Chaofa |
| `phuket-central` | Siray, Phuket Town |
| `phang-nga` | Khok Kloi, Natai *(still PK pricing for some routes)* |

### KL · Khao Lak (2 areas)

| Region | Areas |
|--------|-------|
| `khao-lak` | Bang Niang, Nang Thong / La Flora |

### NoTransfer · piers (2 areas)

| Region | Areas |
|--------|-------|
| `pier` | Visit Panwa Pier (self-arrive), Tub Lamu Pier (self-arrive) |

---

## Level 3 — Time groups (pickup scheduling, NOT sent to B2C)

Areas share a `timeGroup` so many areas get one pickup window per route. The Pickup Time Matrix
(`SB_PICKUP_TIMES`, `:36190`) maps `route × timeGroup → 'HH:MM-HH:MM'`.

Time groups: `pk-n1, pk-n2, pk-e1, pk-e2, pk-wn1, pk-w1, pk-w2, pk-s1, pk-s2, pk-c1, pk-c2, pk-pa1, pk-pn1, kl-c1, nt-vp, nt-tl`.

Example (Phi Phi Bamboo `r10`, departs 09:00): `pk-w2` (Patong/Karon/Kata) → `07:30-07:45`;
`nt-vp` (self-arrive) → `Before 08:30 at pier`.

---

## What actually crosses the B2C API boundary

`GET /api/b2c/availability?route=<id>&dateFrom=…&dateTo=…[&rateTypeId=…]` — header `X-Api-Key: <B2C_API_KEY>`:

```jsonc
{
  "route": "r6", "dateFrom": "2026-07-01", "dateTo": "2026-07-03",
  "dates": [ { "date": "2026-07-01", "bookedSeats": 42, "lockedSeats": 10, "totalConsumed": 52 } ],
  "pricing": [
    {
      "rateTypeId": "rt003", "code": "STD", "name": "Standard",
      "PK":         { "adult_fr": 2500, "adult_th": 2100, "child_fr": 2000, "child_th": 1700, "infant_fr": 0, "infant_th": 0 },
      "KL":         { "adult_fr": 2700, "adult_th": 2300, "child_fr": 2200, "child_th": 1900, "infant_fr": 0, "infant_th": 0 },
      "NoTransfer": { "adult_fr": 2099, "adult_th": 1799, "child_fr": 1699, "child_th": 1499 }
    }
  ]
}
```

- **Sent:** the 3 transfer zones as price buckets (`server.js:1083-1085`), from
  `sb_rate_types__seatrates` (`pk_*/kl_*/notransfer_*`) on active rate types for the route.
- **NOT sent:** the 37 pickup **areas**, their regions, time-groups, or pickup times — none of that
  leaves the app. The external B2C site only knows the 3 coarse zones.

### Gap to note
If the intent is for the B2C site to let a customer pick their **actual hotel/area** (all 37) and map
it to the right zone + pickup time, that mapping does **not** exist over the API today — only the 3
price buckets are exposed. Making areas available externally would mean adding `SB_PICKUP_AREAS`
(and optionally `SB_PICKUP_TIMES`) to the availability response (or a new `/api/b2c/pickup-areas`
endpoint). Say the word and I'll spec/build it.
