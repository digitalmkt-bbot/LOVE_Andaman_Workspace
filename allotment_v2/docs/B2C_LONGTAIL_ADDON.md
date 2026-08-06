# B2C → Ops · add-on import contract

> Audience: the B2C / webshop team — but **most of the remaining work is ours.**
> Ops side: `server.js` `mapB2CItemBooking` (line 278), `b2cLineSeat` (line 262) · app side:
> `allotment_v2.html` `bkV2AddOnFlags` (line 64132)
> Status: **B2C sends add-ons and sends enough to price them. Ops discards them.**
> One open question for B2C (§4 Q1). Everything else is an ops-side build.

*Revised 2026-08-06 (second pass), after a full census of the B2C database and a review of the
complete booking object. Two earlier drafts of this document were wrong in ways that would have
sent the B2C team chasing work they do not need to do — see §6 if you are holding an older copy.*

---

## 1. What's broken today

B2C stores the selection. Real Phi Phi order from prod (`LOV-4190737`, created 2026-08-06):

```json
"addonsSelected": [
  { "qty": 2, "code": "longtail-join", "addonId": "AD-003", "qtyAdult": 2, "qtyChild": 0 }
]
"subtotal": 8000,  "_unitPrices": { "adult": 3500, "child": 2800, "foc": 0, "infant": 0 }
```

The ops importer reads `details` for pickup fields, then throws the add-on away:

- `server.js:440` — `addOns: []` is hardcoded on every imported booking.
- `server.js:451` — `priceBreakdown.addOn: 0`, always.
- `erp/src/mapExternalBooking.js:64` (the older webhook path) does map `addonsSelected`, but with
  `amount: 0` — so the money is lost even there.

What ops stored for that order:

```json
{ "id": "b2c_LOV-4190737_1",
  "priceBreakdown": { "seat": 7000, "addOn": 0, "total": 7000 },
  "paymentSnapshot": { "paid": 8000, "paidStatus": "paid" } }
```

The `addOns` key is not `[]` — it is **absent entirely**. The guest paid ฿8,000 against a booking
ops thinks is worth ฿7,000.

Consequence: **a B2C guest who bought an add-on is invisible to ops.** For longtail specifically
they do not appear in the trip-prep count that tells staff how many boats to arrange
(`bkV2AddOnFlags` returns `join:false`, so `ltJoinPax += _rp` at `allotment_v2.html:64572` never
runs), they are absent from the manifest add-on column, and the money is not attributed as add-on
revenue.

### 1.1 Census of the B2C database (2026-08-06)

All 83 B2C orders, read through `/api/b2c/raw`. 16 orders carry add-ons; 25 add-on entries total.

| `addonId` | `code` | entries |
|---|---|---|
| AD-001 | *(absent)* | 12 |
| AD-002 | *(absent)* | 6 |
| AD-003 | *(absent)* | 5 |
| AD-003 | `longtail-join` | 2 |

Field presence across those 25 entries:

| field | present | note |
|---|---|---|
| `qty`, `addonId` | 25 / 25 | always |
| `code`, `qtyAdult`, `qtyChild` | 2 / 25 | **both are orders created 2026-08-06** — see §3.1 |
| `unitPrice`, `amount`, `price` | 0 / 25 | never — but not needed, see §3.2 |

**This is not a longtail-only problem.** AD-001 and AD-002 account for 18 of 25 entries — more than
longtail — and are dropped identically, including on routes where longtail is not sold. Whatever we
build must cover all add-on codes.

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
on it (`bkV2AddOnFlags`, `allotment_v2.html:64132`).

A working B2B record, for reference — this is the shape the importer must produce:

```json
"addOns": [ { "type": "longtail-join", "label": "Longtail Join (2A + 0C)",
              "amount": 600, "qty": 1, "note": "" } ]
```

Note `type` is `longtail-join` — which is exactly B2C's `code` value, **not** its `addonId`.

Ops' rate type rt003 offers longtail on Phi Phi routes only (`r10`, `r11`). Live data contradicts
this: `LOV-0080714` carries `AD-003` on `r5`. See §4 Q2.

---

## 3. The payload — what we have, and what we do with it

### 3.1 Identity: `code` is the field we need, and B2C already ships it

`addonId` is an opaque catalogue code (`AD-003`). Ops has nothing to resolve it against —
`sb_addon_types` is empty in prod and the built-ins (`RT_ADDON_BUILTIN`) are keyed `longtail`,
`privateTransfer`.

`code` (`"longtail-join"`) matches ops' own `type` naming exactly. **B2C shipped `code`,
`qtyAdult` and `qtyChild` on 2026-08-06** — every add-on entry created since carries them; the 23
older entries predate the change. This is exactly what ops needs, and no further work is required
on it.

The one ask: **confirm `code` is emitted for every add-on product, not just AD-003.** Right now the
only two samples in existence are longtail, so we cannot see whether AD-001 and AD-002 will carry
one. If they will, §4 Q1 is answered for free and ops needs nothing else.

### 3.2 Money: derivable from `subtotal`, no B2C change needed

`addonsSelected` carries no price, but it does not need to. The **line-level `subtotal` includes the
add-on**, while `unitPrices` is seat-only:

```
subtotal                 8000
seat = 2 × 3500          7000     ← Σ pax_<cat> × details.unitPrices.<cat>
──────────────────────────────
add-on                   1000     ← subtotal − seat
```

Verified across all 16 add-on-carrying lines in the B2C database: **15 give a positive amount, 1
zero (a degenerate record with subtotal 0), 0 negative.** The derived figure matches the
paid-vs-total gap on every order checked.

So ops computes `priceBreakdown.addOn = subtotal − seat` and stores it. **We do not re-price B2C
bookings from our own rate card** — and must not: B2C charged ฿500/rider on `LOV-4190737` while
rt003 says ฿400 adult / ฿300 child. Whatever B2C charged is what ops and accounting show.

Two constraints that must keep holding — both are correct in the data today:

- The add-on must **not** be baked into `unitPrices.adult` / `unitPrices.child`. If it were, the
  subtraction above would yield zero and seat revenue would be overstated. *(Confirmed:
  `unitPrices.adult` 3500 × 2 = the ฿7,000 seat total.)*
- The add-on **must** stay inside the line `subtotal` and the order `total`. *(Confirmed: both
  8000.)*

**Limitation.** On lines carrying two add-ons (AD-001 + AD-002 together — 6 orders), the derivation
yields the *combined* amount. That is sufficient for `priceBreakdown.addOn` and for accounting, but
it cannot put a separate amount against each add-on. If B2C ever wants per-add-on money in ops,
adding `unitPrice` + `amount` to each entry would give it. **Nice to have, not blocking.**

### 3.3 The array must be complete on every sync

Ops overwrites the booking's add-on list from each sync. If a guest removes the longtail, send
`"addonsSelected": []` — **do not omit the key**, and do not send only the delta. An omitted key is
indistinguishable from "the field doesn't exist on this row" and we will leave the stale add-on in
place.

### 3.4 `qty` is the number of riders, and it may be less than the item's pax

This is the one that most affects operations. On the B2B side, a longtail join is priced across the
whole party — every adult and child on the trip. On B2C, the guest ticks a quantity, so an item with
6 pax can carry `qty: 4`.

**Ops will trust `qty`, not the item's pax count.** That number goes straight into the count staff
use to arrange boats at Phi Phi. An over-count means a longtail idling at Maya with no one on it; an
under-count means guests standing on the beach. `qtyAdult` / `qtyChild` (shipped 2026-08-06) are
exactly what we want, since our own pricing splits adult/child — please keep them.

### 3.5 Attach it to the item, not the order

An order with a Similan line and a Phi Phi line must carry the add-on on the **Phi Phi line only**.
Ops splits every B2C order into one booking per `booking_item` (`id = b2c_<booking_id>_<line_no>`), so
an order-level add-on would either be duplicated onto every line or dropped. Item-level is already
how `addonsSelected` is stored — just confirming it stays that way.

---

## 4. Open questions for B2C

Only Q1 affects what ops builds.

1. **What are `AD-001` and `AD-002`, and will they carry `code`?** They appear on 18 of 25 add-on
   entries — more than longtail — and we would be importing them blind. Either confirm `code` ships
   for them too (preferred, nothing further needed), or send us the `AD-00x` catalogue with stable
   ids and we will hardcode the mapping.
2. **Which products can carry which add-on?** We assumed longtail was Phi Phi only, but
   `LOV-0080714` carries `AD-003` on `r5`. Either our assumption is wrong or that order is.
3. **Is `qty` the number of riders?** (§3.4) Or a boolean-ish 1, or an order-level count?
4. **Does B2C sell a private / whole-boat longtail** as well as the join? If yes we need a distinct
   `code` for it, with `qty` = boats.
5. **Can a guest add or drop an add-on after booking?** If yes the resync must reflect it, which
   makes §3.3 mandatory rather than nice-to-have.
6. **Is there a per-add-on note field** — meeting point, time, contact? Ops staff use one on B2B
   bookings and it prints on the manifest.

---

## 5. What ops will build

No action needed from B2C. This is now unblocked except for the AD-001/AD-002 labels.

1. `mapB2CItemBooking` reads `det.addonsSelected` → `addOns[{type,label,amount,qty,note}]`, resolving
   `type` from `code` (§3.1), and sets `priceBreakdown.addOn = subtotal − seat` (§3.2).
2. **Fix `b2cLineSeat` (`server.js:270`).** It ends `return Math.round(seat || Number(item.subtotal) || 0)`
   — the `subtotal` fallback fires when `unitPrices` is missing, and since `subtotal` is
   add-on-inclusive it books **add-on money as seat revenue**. Derive `seat` and `addOn` from
   `subtotal` together instead of treating `subtotal` as a seat proxy.
3. Add the add-on columns to the sync's conflict-update list so edits on B2C propagate.
4. Make the trip-prep count qty-aware — today `ltJoinPax += _rp` adds the **whole booking's pax**
   for any booking flagged as join (`allotment_v2.html:64572`), which is right for B2B but would
   over-count a B2C partial selection.
5. Manifest / pier check-in pick it up automatically once `addOns[]` is populated, since both read
   through the shared `bkV2AddOnFlags` resolver.
6. Backfill the 16 existing orders whose add-ons were dropped — the money is derivable for all of
   them (§3.2), so this is a re-import rather than a data-entry exercise.

---

## 6. Revision history

**2026-08-06, second pass** — corrected two claims that would have sent B2C chasing non-work:

- *"`addonId` carries the enum."* It does not; it carries `AD-00x`. The enum is in `code`.
- *"`code` is unreliable — sent on only 2 of 25 entries."* Misread. Both are orders created on
  2026-08-06; B2C shipped `code` that morning and every entry since carries it. It is new, not
  flaky.
- *"There is no money in the payload, and ops cannot derive it — blocking."* Wrong on the second
  half. The line `subtotal` is add-on-inclusive, so `subtotal − seat` recovers the amount on
  15 of 16 live lines. Not blocking; `unitPrice`/`amount` are a convenience for splitting
  multi-add-on lines only.

**2026-08-06, first pass** — rewrote §1/§3 against live prod data. The original draft was written
from `erp/booking.json` and described a payload shape B2C does not send.
