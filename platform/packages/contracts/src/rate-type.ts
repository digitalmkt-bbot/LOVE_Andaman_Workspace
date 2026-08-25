import { z } from 'zod';
import { LocalDate, PageQuery, pageOf } from './common.js';

/**
 * RT-01 · rate types.
 *
 * A rate type is a reusable B2B price package. Agents bind to one through
 * `agent.rateTypeId`; change a price here and every agent on that rate type
 * gets it. This is the single source of truth for B2B pricing, and `BK-09`
 * cannot quote a trip without it.
 */

/**
 * Pickup zone. These three strings are stored verbatim by the monolith as the
 * keys of `seatRates[route][zone]`, so they are the wire values too — renaming
 * them would silently unmatch every imported price.
 *
 *   PK          Phuket pickup
 *   KL          Khao Lak pickup
 *   NoTransfer  guest makes their own way to the pier
 */
export const RateZone = z.enum(['PK', 'KL', 'NoTransfer']);
export type RateZone = z.infer<typeof RateZone>;

/**
 * Passenger type a seat price is quoted for.
 *
 * The monolith writes `adult-fr` / `child-fr`, where `fr` means FOREIGNER
 * (farang) — not "free", not France. Spelled out here because that abbreviation
 * has been misread before; the migration renames it on the way in.
 */
export const PaxType = z.enum([
  'adult_thai',
  'adult_foreign',
  'child_thai',
  'child_foreign',
  'infant_thai',
  'infant_foreign',
]);
export type PaxType = z.infer<typeof PaxType>;

/** A route's business code, as used across every store: `r5`, `r10`, `r12`. */
const RouteId = z.string().min(1).max(64);

/** THB. Non-negative — 0 is a real price (infants ride free), negative is not. */
const Money = z.number().nonnegative();

/** One published seat price: route × zone × pax type. */
export const RateTypeSeatRate = z.object({
  routeId: RouteId,
  zone: RateZone,
  paxType: PaxType,
  price: Money,
});
export type RateTypeSeatRate = z.infer<typeof RateTypeSeatRate>;

/**
 * The period this rate type is sellable on a route.
 *
 * THE source of truth for the active period — charter rates and add-ons inherit
 * these dates. `RateType.validFrom` / `validTo` are a legacy rate-type-level
 * fallback and are only consulted when a route has no entry here.
 *
 * A null bound is open-ended; the monolith stores `''` for that, which must
 * never be read as a date.
 */
export const RateTypeRouteValidity = z.object({
  routeId: RouteId,
  validFrom: LocalDate.nullable(),
  validTo: LocalDate.nullable(),
});
export type RateTypeRouteValidity = z.infer<typeof RateTypeRouteValidity>;

/** `free` = bundled at no surcharge. `paid` = surcharge added to the seat total. */
export const BundleMode = z.enum(['free', 'paid']);
export type BundleMode = z.infer<typeof BundleMode>;

/** Which booking modes a forced bundle applies to. The monolith defaults to `seat`. */
export const BundleApplyTo = z.enum(['seat', 'charter', 'both']);
export type BundleApplyTo = z.infer<typeof BundleApplyTo>;

/**
 * A forced add-on baked into the seat price — the agent cannot opt out.
 *
 * Distinct from `RateTypeAddon`, which is optional and chosen per booking.
 * Whale Shark shipping with a longtail transfer included is the canonical case.
 */
export const RateTypeRouteBundle = z.object({
  routeId: RouteId,
  /** Which add-on is forced. Only `longtail` exists today. */
  addonKey: z.string().min(1).max(64),
  mode: BundleMode,
  adultPrice: Money,
  childPrice: Money,
  applyTo: BundleApplyTo,
});
export type RateTypeRouteBundle = z.infer<typeof RateTypeRouteBundle>;

/** Whole-boat pricing: a starter price covering N pax, plus a marginal rate above it. */
export const RateTypeCharterRate = z.object({
  routeId: RouteId,
  /** Lower-cased boat type, e.g. `speedboat`, `catamaran`. Open vocabulary. */
  boatType: z.string().min(1).max(64),
  starterPrice: Money,
  /** Pax included in `starterPrice`. */
  starterIncludes: z.number().int().nonnegative(),
  /** Marginal price per pax ABOVE `starterIncludes` — not a per-head rate for the boat. */
  extraPerPax: Money,
});
export type RateTypeCharterRate = z.infer<typeof RateTypeCharterRate>;

/**
 * An optional add-on price. ALWAYS per route.
 *
 * The monolith's longtail add-on carried two historical shapes — a flat price
 * for every route in `applies[]`, and the current per-route `byRoute{}` map —
 * and every reader had to run `_rtNormalizeLongtail` to tell them apart. That
 * ambiguity does not exist here: `routeId` is required, the migration fans a
 * legacy flat price out across its routes, and the flat shape is not
 * representable in the database at all.
 */
export const RateTypeAddon = z.object({
  id: z.string().uuid(),
  /** `longtail`, `privateTransfer`, or any add-on type staff created in the UI. */
  addonKey: z.string().min(1).max(64),
  routeId: RouteId,
  /** Only set for zone-priced add-ons (private transfer). Null for longtail. */
  zone: RateZone.nullable(),
  /** `join` | `charter` for longtail; `sedan` | `van` for private transfer. */
  variant: z.string().min(1).max(64),
  /** Per-pax pricing. Null when the add-on is priced as a flat unit. */
  adultPrice: Money.nullable(),
  childPrice: Money.nullable(),
  /** Flat pricing (a whole longtail boat, one transfer vehicle). */
  unitPrice: Money.nullable(),
  /** Seats the flat price buys, where it charters a whole unit. */
  capacity: z.number().int().nonnegative().nullable(),
  /** Human-facing label: `per pax` | `per trip` | `per boat`. */
  unit: z.string().max(64).nullable(),
});
export type RateTypeAddon = z.infer<typeof RateTypeAddon>;

/** What the list endpoint returns per row — no prices, so a page stays small. */
export const RateTypeSummary = z.object({
  id: z.string().uuid(),
  /** Business code printed on contracts, e.g. `RT-RU-STD`. */
  code: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  /** UI accent colour for the rate-type card. */
  color: z.string().nullable(),
  active: z.boolean(),
  /**
   * LEGACY rate-type-level validity. Prefer `routeValidity` on the detail
   * payload; this is a fallback for routes with no entry there.
   */
  validFrom: LocalDate.nullable(),
  validTo: LocalDate.nullable(),
  /** The monolith's blob id (`rt001`). Disappears when the monolith does. */
  legacyId: z.string().nullable(),
});
export type RateTypeSummary = z.infer<typeof RateTypeSummary>;

/** Everything needed to price a trip on this rate type. */
export const RateTypeDetail = RateTypeSummary.extend({
  /**
   * Every route this rate type touches, sorted.
   *
   * Derived from the price tables rather than stored: the monolith's `routes[]`
   * array could disagree with the prices actually published, and a route with
   * no price is not sellable whatever the array says.
   */
  routes: z.array(RouteId),
  seatRates: z.array(RateTypeSeatRate),
  routeValidity: z.array(RateTypeRouteValidity),
  routeBundles: z.array(RateTypeRouteBundle),
  charterRates: z.array(RateTypeCharterRate),
  addOns: z.array(RateTypeAddon),
});
export type RateTypeDetail = z.infer<typeof RateTypeDetail>;

/**
 * `GET /v1/rate-types` querystring.
 *
 * `active` is an enum of `'true' | 'false'`, not a coerced boolean: coercion
 * maps every non-empty string to `true`, so `?active=flase` would silently
 * return the wrong page instead of being rejected.
 */
export const RateTypeListQuery = PageQuery.extend({
  active: z.enum(['true', 'false']).optional(),
  /** Case-insensitive substring match on code or name. */
  q: z.string().trim().min(1).max(100).optional(),
});
export type RateTypeListQuery = z.infer<typeof RateTypeListQuery>;

export const RateTypeListResponse = pageOf(RateTypeSummary);
export type RateTypeListResponse = z.infer<typeof RateTypeListResponse>;

/**
 * `GET /v1/rate-types/:id` path parameter.
 *
 * The surrogate uuid, not the monolith's `rt001`. Legacy ids are an import
 * detail and are exposed read-only as `legacyId`.
 */
export const RateTypeIdParam = z.object({
  id: z.string().uuid(),
});
export type RateTypeIdParam = z.infer<typeof RateTypeIdParam>;
