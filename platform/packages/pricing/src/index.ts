/**
 * @la/pricing — pure price calculation. Filled in by BK-09.
 *
 * Design rules, set now so they are not violated later:
 *   1. No database access. Callers fetch rate-type data and pass it in.
 *   2. No `Date.now()` or `new Date()` — the caller supplies the date, so
 *      results are reproducible and testable.
 *   3. Money is integer satang (1 THB = 100 satang), never a float. Every
 *      parity test against the monolith compares to the satang.
 *   4. Discounts and FOC are stored NEGATIVE, matching the existing
 *      `priceBreakdown` shape, so accounting reads the same signs it does today.
 */

/** Money in satang. 1 THB = 100 satang. */
export type Satang = number;

export const thbToSatang = (thb: number): Satang => Math.round(thb * 100);
export const satangToThb = (s: Satang): number => s / 100;

/** Mirrors `priceBreakdown` on the booking. `focDiscount` and `discount` are negative. */
export interface PriceBreakdown {
  seat: Satang;
  addOn: Satang;
  focDiscount: Satang;
  discount: Satang;
  extra: Satang;
  total: Satang;
}

export const emptyBreakdown = (): PriceBreakdown => ({
  seat: 0,
  addOn: 0,
  focDiscount: 0,
  discount: 0,
  extra: 0,
  total: 0,
});

export const sumBreakdown = (b: Omit<PriceBreakdown, 'total'>): PriceBreakdown => ({
  ...b,
  total: b.seat + b.addOn + b.focDiscount + b.discount + b.extra,
});
