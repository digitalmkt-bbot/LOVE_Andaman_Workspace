# B2C → Ops · Longtail Join add-on contract

> Audience: the B2C / webshop team.
> Ops side: `server.js` `mapB2CItemBooking` (line 278) · app side: `allotment_v2.html` `bkV2AddOnFlags` (line 64127)
> Status: **B2C sends add-ons today. Ops discards them.** The ops fix is blocked on two
> gaps in the payload (§3.1 identity, §3.4 money) — everything else below is already working.

*Revised 2026-08-06 after inspecting live prod data. An earlier draft of this document described a
payload shape that B2C does not actually send; §1 and §3 have been rewritten against real orders.
If you are implementing from an older copy, re-read §3.1 — the field names were wrong.*

---

## 1. What's broken today

B2C stores the selection and has done for a while. This is a **real Phi Phi order from prod**
(`LOV-3861198`, 8 Aug 2026), read back through `/api/b2c/raw`:

```json
"addonsSelected": [
  { "qty": 2, "code": "longtail-join", "addonId": "AD-003", "qtyAdult": 2, "qtyChild": 0 }
]
```

The ops importer reads `details` for pickup fields, then throws the add-on away:

- `server.js:440` — `addOns: []` is hardcoded on every imported booking.
- `server.js:451` — `priceBreakdown.addOn: 0`, always.
- `erp/src/mapExternalBooking.js:64` (the older webhook path) does map `addonsSelected`, but with
  `amount: 0` — so the money is lost even there.

What ops stored for that order:

```json
{ "id": "b2c_LOV-3861198_1",
  "priceBreakdown": { "seat": 7000, "addOn": 0, "total": 7000 },
  "paymentSnapshot": { "paid": 8000, "paidStatus": "paid" } }
```

The `addOns` key is not `[]` — it is **absent entirely**. The guest paid ฿8,000 against a booking
ops thinks is worth ฿7,000, so the ฿1,000 sits on the record as an unexplained overpayment.

Consequence: **a B2C guest who bought a longtail join is invisible to ops.** They do not appear in
the trip-prep count that tells staff how many longtails to arrange, they do not appear on the
manifest add-on column, and the money is not attributed as add-on revenue.

### 1.1 This is not a longtail-only problem

Sampling other B2C orders with a paid-vs-total gap, every one carries add-ons — including on routes
where longtail is not sold at all:

| order | route | `addonsSelected` | paid − total |
|---|---|---|---|
| LOV-3921869 | r12 | `AD-001` ×2, `AD-002` ×2 | ฿5,400 |
| LOV-0080714 | r5  | `AD-001` ×3, `AD-003` ×1 | ฿10,097 |
| LOV-4756525 | r12 | `AD-001` ×5, `AD-002` ×5 | ฿3,000 |
| LOV-6852886 | r10 | `AD-001` ×4, `AD-002` ×4 | ฿2,400 |

17 of 31 single-line B2C orders currently show `paid > total`, ~฿41,000 in aggregate once one
outlier test record (`BK-002`, ฿185,200) is excluded. The gap is indicative rather than audited,
but the mechanism is confirmed: **`AD-001` and `AD-002` are being dropped exactly like `AD-003`.**
Whatever contract we agree should cover all add-on codes, not just longtail.

---

## 2. How ops models longtail (so the shape makes sense)

Ops has two longtail products, and they behave differently:

| | `longtail-join` | `longtail-charter` |
|---|---|---|
| Sold by | the **head** — each person riding | the **boat** — whole longtail, capacity ~6 |
| `qty` means | number of people | number of boats |
| Ops uses it to | count heads for the trip-prep chip `Longtail Join · N คน` | count boats `Longtail เหมา · N ลำ` |
| Price | adult / child differ (rt003: ฿400 / ฿300) | flat per boat (rt003 r10: ฿1,500 / 6 pax) |

They are **mutually exclusive per booking** — if a booking carries a charter, ops ignores any join
on it (`bkV2AddOnFlags`, `allotment_v2.html:64127`).

Longtail applies to **Phi Phi routes only** — `r10` (Phi Phi + Bamboo) and `r11`. It is not offered
on Similan, Surin, or Maiton in the B2C rate type (`rt003`). Note this is already contradicted by
live data: `LOV-0080714` carries `AD-003` on `r5`. See §4 Q4.

---

## 3. The contract

### 3.0 What you send today

```json
{ "qty": 2, "code": "longtail-join", "addonId": "AD-003", "qtyAdult": 2, "qtyChild": 0 }
```

`qty`, `qtyAdult`, `qtyChild` are good — keep them exactly as they are. The problems are `addonId`
and the absence of any price.

### 3.1 We cannot resolve `AD-00x` to a product ⛔ blocking

`addonId` is an opaque product code. Ops has no table mapping `AD-001` / `AD-002` / `AD-003` to
anything — `sb_addon_types` is empty in prod, and the built-in types (`RT_ADDON_BUILTIN`) are keyed
`longtail`, `privateTransfer`, not `AD-00x`.

`code: "longtail-join"` is the field we can actually use — it matches our own naming. **But it is
not reliably sent.** `LOV-3861198` has it; the four orders in §1.1 send only `{qty, addonId}`.

Either of these unblocks us — B2C's choice:

- **(a) Always send `code`**, on every entry, as a stable lowercase-hyphenated slug
  (`longtail-join`, `longtail-charter`, and whatever `AD-001` / `AD-002` are). Preferred — it is
  self-describing and survives a product-catalogue renumber.
- **(b) Send us the `AD-00x` catalogue** — the full list of codes with their product names — and
  commit to the ids being stable. We will hardcode the mapping.

What we cannot do is guess. An unrecognised code falls into a loose regex fallback that guesses
"join", which would mis-classify a charter as a per-head join and under-arrange boats.

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

`qtyAdult` / `qtyChild` are already being sent and are exactly what we want — our own pricing splits
adult/child. Please keep them.

### 3.4 There is no money in the payload ⛔ blocking

`addonsSelected` carries **no `unitPrice` and no `amount`** on any order we inspected. The add-on
money exists only inside the order-level total. Please add both:

```json
{ "qty": 2, "code": "longtail-join", "addonId": "AD-003",
  "qtyAdult": 2, "qtyChild": 0,
  "unitPrice": 500,     // ← ADD · THB per unit, as actually charged
  "amount": 1000,       // ← ADD · THB total for this add-on line
  "note": "meet at pier 09:00" }   // ← optional free text → shown to ops staff
```

**Ops cannot derive this itself.** On `LOV-3861198` B2C charged ฿500/rider (฿8,000 − ฿7,000 ÷ 2
riders). Our rate type `rt003` — the one agent `a_b2c` actually points at — prices longtail-join on
`r10` at **฿400 adult / ฿300 child**. Re-pricing from our own card would book ฿800 and leave ฿200
dangling. Whatever B2C charged is what ops and accounting must show, so B2C has to tell us the
number.

Placement rules, which already hold today and should keep holding:

- The longtail must **not** be baked into `unitPrices.adult` / `unitPrices.child`. Ops computes the
  seat price of a line as `Σ pax_<cat> × details.unitPrices.<cat>` (`server.js:262` `b2cLineSeat`).
  If the add-on were inside `unitPrices` we could not separate seat revenue from add-on revenue, and
  the Phi Phi seat rate would look ฿500 higher than it is in every rate comparison. *(Confirmed
  correct today: `LOV-3861198` has `unitPrices.adult: 3500`, and 2 × 3,500 = the ฿7,000 seat total.)*
- The longtail **must** be included in the order-level `bookings.total` (`bk_total`). *(Confirmed
  correct today: `bookingTotal: 8000` includes it.)*
- `bi.subtotal` for the line: tell us whether it includes the add-on or not. Today we treat it as a
  seat-only fallback. Either answer is workable, we just need it fixed and consistent.

### 3.5 Attach it to the item, not the order

An order with a Similan line and a Phi Phi line must carry the longtail on the **Phi Phi line only**.
Ops splits every B2C order into one booking per `booking_item` (`id = b2c_<booking_id>_<line_no>`), so
an order-level add-on would either be duplicated onto every line or dropped. Item-level is already
how `addonsSelected` is stored — just confirming it stays that way.

---

## 4. Open questions for B2C

Q1 and Q2 block the build. The rest change details.

1. ⛔ **Identity — `code` always, or the `AD-00x` catalogue?** (§3.1) Which option, (a) or (b)?
2. ⛔ **Will you add `unitPrice` + `amount`?** (§3.4) Without them the money cannot be attributed
   and the paid-vs-total gap stays.
3. **What are `AD-001` and `AD-002`?** They appear on more orders than the longtail does (§1.1) and
   we are currently dropping them silently.
4. **Which products can carry which add-on?** We assumed longtail was Phi Phi only, but `LOV-0080714`
   carries `AD-003` on `r5`. Either our assumption is wrong or that order is. Which?
5. **Is `qty` the number of riders?** (§3.3) Or a boolean-ish 1, or an order-level count?
6. **Does B2C sell a private / whole-boat longtail** as well as the join? If yes we need a distinct
   code for it now, with `qty` = boats.
7. **Can a guest add or drop an add-on after booking?** If yes, the resync must reflect it, which
   makes §3.2 (always send the full array) mandatory rather than nice-to-have.
8. **Is there a per-booking note field** for the longtail — meeting point, time, contact? Ops staff
   use one on B2B bookings and it prints on the manifest.

---

## 5. What ops will build once this is agreed

For reference — no action needed from B2C:

1. `mapB2CItemBooking` reads `det.addonsSelected` → `addOns[{type,label,amount,qty,note}]`, sets
   `priceBreakdown.addOn`, and includes the add-on in `lineTotal`. Resolve the type via `code`
   (or the `AD-00x` map, per §3.1), not the loose regex.
2. Add the add-on columns to the sync's conflict-update list so edits on B2C propagate.
3. Make the trip-prep count qty-aware — today `ltJoinPax += _rp` adds the **whole booking's pax**
   for any booking flagged as join (`allotment_v2.html:64567`), which is right for B2B but would
   over-count a B2C partial selection.
4. Manifest / pier check-in pick it up automatically once `addOns[]` is populated, since both read
   through the shared `bkV2AddOnFlags` resolver.
5. Backfill the ~16 existing orders whose add-ons were dropped (§1.1), once the money is available
   to attribute.
