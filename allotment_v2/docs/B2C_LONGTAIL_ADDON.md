# B2C → Ops · Longtail Join add-on contract

> Audience: the B2C / webshop team.
> Ops side: `server.js` `mapB2CItemBooking` · app side: `allotment_v2.html` `bkV2AddOnFlags`
> Status: **not implemented on either side yet.** This is the spec to agree before we build it.

---

## 1. What's broken today

B2C already stores the selection. `booking_items.details.addonsSelected` carries it — the sample
order in `erp/booking.json` has exactly this on a Phi Phi line:

```json
"addonsSelected": [ { "addonId": "longtail-join", "qty": 4 } ]
```

The ops importer reads `details` for pickup fields, then throws the add-on away:

- `server.js:422` — `addOns: []` is hardcoded on every imported booking.
- `server.js:433` — `priceBreakdown.addOn: 0`, always.
- `erp/src/mapExternalBooking.js:64-69` (the older webhook path) does map `addonsSelected`, but with
  `amount: 0` — so the money is lost even there.

Consequence: **a B2C guest who bought a longtail join is invisible to ops.** They do not appear in
the trip-prep count that tells staff how many longtails to arrange, they do not appear on the
manifest add-on column, and the money is not attributed as add-on revenue.

Fixing the ops side is a small change. What we need from B2C first is a stable contract, because
several things about the product are genuinely ambiguous from our side.

---

## 2. How ops models longtail (so the shape makes sense)

Ops has two longtail products, and they behave differently:

| | `longtail-join` | `longtail-charter` |
|---|---|---|
| Sold by | the **head** — each person riding | the **boat** — whole longtail, capacity ~6 |
| `qty` means | number of people | number of boats |
| Ops uses it to | count heads for the trip-prep chip `Longtail Join · N คน` | count boats `Longtail เหมา · N ลำ` |
| Price | adult / child differ (rt003: ฿400 / ฿300) | flat per boat |

They are **mutually exclusive per booking** — if a booking carries a charter, ops ignores any join
on it (`bkV2AddOnFlags`, `allotment_v2.html:58921`).

Longtail applies to **Phi Phi routes only** — `r10` (Phi Phi + Bamboo) and `r11`. It is not offered
on Similan, Surin, or Maiton in the B2C rate type (`rt003`, `allotment_v2.html:36644`).

---

## 3. The contract we're asking for

Keep using `booking_items.details.addonsSelected[]`. Per entry:

```json
{
  "addonId":   "longtail-join",   // enum · see below · must match exactly
  "qty":       4,                 // units — meaning depends on addonId
  "qtyAdult":  3,                 // optional but wanted · see §3.3
  "qtyChild":  1,
  "unitPrice": 400,               // THB per unit, as charged
  "amount":    1400,              // THB total for this add-on line
  "note":      "meet at pier 09:00"   // optional free text → shown to ops staff
}
```

### 3.1 `addonId` is an enum, not free text

Only these two values, lowercase, hyphenated:

- `longtail-join`
- `longtail-charter`

Ops matches the string literally against its own add-on types. Anything else (`longtail`,
`Longtail Join`, `LT-JOIN`) falls into a loose regex fallback that guesses "join" and will
mis-classify a charter as a per-head join. If B2C wants a third longtail product, tell us before
launch and we add the enum value on both sides.

### 3.2 The array must be complete on every sync

Ops overwrites the booking's add-on list from each sync. If a guest removes the longtail, send
`"addonsSelected": []` — **do not omit the key**, and do not send only the delta. An omitted key is
indistinguishable from "the field doesn't exist on this row" and we will leave the stale add-on in
place.

### 3.3 `qty` is the number of riders, and it may be less than the item's pax

This is the one that most affects operations. On the B2B side, a longtail join is priced across the
whole party — every adult and child on the trip. On B2C, the guest ticks a quantity, so an item with
6 pax can carry `qty: 4`.

**Ops will trust `qty`, not the item's pax count.** That number goes straight into the count staff
use to arrange boats at Phi Phi. If `qty` is ever a per-order figure, a "1 = yes" flag, or anything
other than actual riders, say so now — an over-count here means a longtail idling at Maya with no
one on it, an under-count means guests standing on the beach.

We would also like `qtyAdult` / `qtyChild` where you have them, since our own pricing splits
adult/child. If B2C only ever charges one price, omit them and we'll use `amount` as authoritative.

### 3.4 Money must be separable from the seat price

Ops computes the seat price of a line as `Σ pax_<cat> × details.unitPrices.<cat>`
(`server.js:243-252` `b2cLineSeat`). So:

- The longtail must **not** be baked into `unitPrices.adult` / `unitPrices.child`. If it is, we
  cannot tell seat revenue from add-on revenue, and the Phi Phi seat rate looks ฿400 higher than it
  is in every rate comparison.
- The longtail **must** be included in the order-level `bookings.total` (`bk_total`). Ops derives
  paid / deposit / unpaid by comparing `Σ payments` against that total — a longtail charged to the
  customer but missing from `bk_total` makes a fully-paid order read as overpaid.
- `bi.subtotal` for the line: tell us whether it includes the add-on or not. Today we treat it as a
  seat-only fallback. Either answer is workable, we just need it fixed and consistent.

Once this holds, ops stores `amount` verbatim and displays it — we never re-price a B2C booking from
our rate card, so whatever B2C charged is what ops and accounting show.

### 3.5 Attach it to the item, not the order

An order with a Similan line and a Phi Phi line must carry the longtail on the **Phi Phi line only**.
Ops splits every B2C order into one booking per `booking_item` (`id = b2c_<booking_id>_<line_no>`), so
an order-level add-on would either be duplicated onto every line or dropped. Item-level is already
how `addonsSelected` is stored — just confirming it stays that way.

---

## 4. Open questions for B2C

Answers to these change what we build, so we'd like them before we start:

1. **Is `qty` the number of riders?** (§3.3) Or a boolean-ish 1, or an order-level count?
2. **Does B2C sell a private / whole-boat longtail** as well as the join? If yes we need the
   `longtail-charter` enum wired now, with `qty` = boats.
3. **Is the longtail price inside `unitPrices`, inside `bi.subtotal`, inside `bk_total`** — which of
   the three? (§3.4)
4. **Which products can carry it?** We assume Phi Phi only (`POW-003`, and `PR-003` if privates can
   add one). Confirm, so an unexpected route doesn't import an add-on our rate type says can't exist.
5. **Can a guest add or drop the longtail after booking?** If yes, the resync must reflect it, which
   makes §3.2 (always send the full array) mandatory rather than nice-to-have.
6. **Is there a per-booking note field** for the longtail — meeting point, time, contact? Ops staff
   use one on B2B bookings and it prints on the manifest.

---

## 5. What ops will build once this is agreed

For reference — no action needed from B2C:

1. `mapB2CItemBooking` reads `det.addonsSelected` → `addOns[{type,label,amount,qty,note}]`, sets
   `priceBreakdown.addOn`, and includes the add-on in `lineTotal`.
2. Add the add-on columns to the sync's conflict-update list so edits on B2C propagate.
3. Make the trip-prep count qty-aware — today it adds the **whole booking's pax** for any booking
   flagged as join (`allotment_v2.html:59343`), which is right for B2B but would over-count a B2C
   partial selection.
4. Manifest / pier check-in pick it up automatically once `addOns[]` is populated, since both read
   through the shared `bkV2AddOnFlags` resolver.
