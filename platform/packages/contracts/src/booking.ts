/**
 * The booking aggregate, as the API exchanges it.
 *
 * Mirrors the relational model in `@la/db` migrations 0001–0006 (task BK-01),
 * not the monolith's blob. Where the two disagree, the differences are
 * deliberate and are catalogued field by field in `packages/db/MAPPING.md`:
 *
 *   - every calendar date is a `LocalDate` string, never a JS `Date`;
 *   - child collections are arrays that are empty when there is nothing, never
 *     a null or a zero-valued sentinel object;
 *   - per-trip pax counts are a list of (kind, class, qty) rows instead of a
 *     12-key object with two spellings for adults;
 *   - operational assignment is one entry per service day, with no separate
 *     shape for day 1.
 */

import { z } from 'zod';
import { LocalDate, SourceSystem } from './common.js';

/**
 * Thai baht. A plain number, not a string: every amount in this system fits
 * exactly in a double (the largest booking on record is six figures of baht),
 * and forcing callers to parse decimal strings has bought nothing but bugs.
 */
export const MoneyTHB = z.number().finite();
export type MoneyTHB = z.infer<typeof MoneyTHB>;

/**
 * An absolute instant, ISO-8601 with an explicit offset.
 *
 * The offset is required. A bare `2026-08-05T06:00:00` is ambiguous, and the
 * monolith's habit of writing local time without one is why some `bookedAt`
 * values read as 07:00 earlier than they happened.
 */
export const Instant = z.string().datetime({ offset: true });
export type Instant = z.infer<typeof Instant>;

/** The 8 states a booking can be in. Closed set; a 9th needs a migration. */
export const BookingStatus = z.enum([
  'quote',
  'pending_foc',
  'pending_approval',
  'confirmed',
  'cancelled',
  'cancelled_weather',
  'rejected',
  'completed',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

/**
 * Excluded from every pax, seat and revenue aggregate.
 *
 * Exported as data rather than left for each caller to spell out, because the
 * monolith's copies of this list drifted: `rejected` was missing from several
 * of them, so rejected bookings were still counted against capacity.
 */
export const CANCELLED_BOOKING_STATUSES = [
  'cancelled',
  'cancelled_weather',
  'rejected',
] as const satisfies readonly BookingStatus[];

export const isActiveBookingStatus = (status: BookingStatus): boolean =>
  !(CANCELLED_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);

export const PaxKind = z.enum(['AD', 'CHD', 'INF', 'FOC']);
export type PaxKind = z.infer<typeof PaxKind>;

/**
 * Which rate class a head is counted at — foreign or Thai.
 *
 * A pricing class, not a passport: a foreign resident of Thailand is sold at
 * `TH`. The blob encoded it as an `_fr` / `_th` suffix on the pax key, plus an
 * unsuffixed legacy spelling that meant `FR`; that third spelling does not
 * exist here.
 */
export const NationalityClass = z.enum(['FR', 'TH']);
export type NationalityClass = z.infer<typeof NationalityClass>;

export const BookingMode = z.enum(['seat', 'charter']);
export type BookingMode = z.infer<typeof BookingMode>;

/**
 * Transfer zone. `NT` — a second spelling of `NoTransfer` in the blob — is
 * normalised away at migration and is not accepted here.
 */
export const PickupZone = z.enum(['PK', 'KL', 'NoTransfer']);
export type PickupZone = z.infer<typeof PickupZone>;

export const PriceMode = z.enum(['rate', 'manual']);
export type PriceMode = z.infer<typeof PriceMode>;

export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const PaymentStatus = z.enum(['unpaid', 'invoiced', 'partial', 'paid']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

/** `sale` is a paying customer; the other two are internal Staff & Welfare trips. */
export const BookingPurpose = z.enum(['sale', 'staff_welfare', 'staff_inspection']);
export type BookingPurpose = z.infer<typeof BookingPurpose>;

/** One (kind, class) count on one trip. Absent means zero — there is no zero row. */
export const BookingTripPax = z.object({
  kind: PaxKind,
  nationalityClass: NationalityClass,
  qty: z.number().int().min(0),
});
export type BookingTripPax = z.infer<typeof BookingTripPax>;

const BookingTripFields = z.object({
  id: z.string().uuid(),
  tripIndex: z.number().int().min(0),
  routeId: z.string(),
  date: LocalDate,
  zone: PickupZone.nullable(),
  /** A window such as `06:00-06:15`, not a clock time. */
  pickupTime: z.string().nullable(),
  pax: z.array(BookingTripPax),

  bookingMode: BookingMode,
  charterBoatId: z.string().nullable(),
  charterPriceMode: PriceMode,
  charterPriceManual: MoneyTHB,
  charterPriceNote: z.string().nullable(),
  charterDisplacementAck: z.boolean(),

  ovn: z.string().nullable(),
  ovnReturnDate: LocalDate.nullable(),
  ovnCharge: MoneyTHB,
  ovnLeg: z.boolean(),
  /** Which trip this overnight leg belongs to, by `tripIndex`. */
  ovnOfTripIndex: z.number().int().min(0).nullable(),

  /**
   * Summary of where the seats came from. The authoritative per-lock breakdown
   * is `booking_trip_lock_draw` (BK-02); this is what the manifest prints.
   */
  seatSource: z.object({
    locked: z.number().int().min(0),
    general: z.number().int().min(0),
  }),

  subtotal: MoneyTHB,
});

/**
 * Mirrors the `booking_trip_charter_boat_ck` constraint, so a bad payload is
 * rejected at the edge with a field path instead of as a 23514 from Postgres.
 * A charter with no boat is not a charter — it is a silent hole in the day's
 * capacity plan, since charter trips are excluded from the seat pool.
 */
export const BookingTrip = BookingTripFields.refine(
  (t) => t.bookingMode !== 'charter' || t.charterBoatId !== null,
  { message: 'a charter trip must name a charterBoatId', path: ['charterBoatId'] },
);
export type BookingTrip = z.infer<typeof BookingTrip>;

export const BookingPassenger = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  name: z.string(),
  nationality: z.string().nullable(),
  kind: PaxKind,
  isFoc: z.boolean(),
  isLead: z.boolean(),
});
export type BookingPassenger = z.infer<typeof BookingPassenger>;

export const BookingAddOn = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  /** An `RT_ADDON_DEFS` key. Open-ended: staff create add-on types in the UI. */
  type: z.string(),
  label: z.string().nullable(),
  amount: MoneyTHB,
  qty: z.number().int().min(0),
  note: z.string().nullable(),
});
export type BookingAddOn = z.infer<typeof BookingAddOn>;

export const BookingAdjustment = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  kind: z.string(),
  mode: z.enum(['amount', 'percent']),
  /** Signed: a discount is negative in either mode. */
  value: z.number().finite(),
  label: z.string().nullable(),
  note: z.string().nullable(),
});
export type BookingAdjustment = z.infer<typeof BookingAdjustment>;

/** A charge raised after the sale — cancellation fee, reschedule fee, damage. */
export const BookingFeeItem = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  type: z.string(),
  label: z.string().nullable(),
  amount: MoneyTHB,
  raisedAt: Instant.nullable(),
});
export type BookingFeeItem = z.infer<typeof BookingFeeItem>;

/** A day-of upsell sold at the pier. The money splits three ways. */
export const BookingUpgrade = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  upgradeCode: z.string().nullable(),
  label: z.string().nullable(),
  sellPrice: MoneyTHB,
  toCompany: MoneyTHB,
  commission: MoneyTHB,
  collected: z.boolean(),
  seller: z.string().nullable(),
  settle: z.string().nullable(),
  method: z.string().nullable(),
  feePct: z.number().nullable(),
  fee: MoneyTHB,
  customerPaid: MoneyTHB,
  slips: z.array(z.unknown()),
  note: z.string().nullable(),
  soldAt: Instant.nullable(),
});
export type BookingUpgrade = z.infer<typeof BookingUpgrade>;

/**
 * Signed, and `focDiscount` / `discount` stay negative.
 *
 * That keeps `seat + addOn + focDiscount + discount + extra` a plain sum, so no
 * consumer has to know which component is meant to be subtracted.
 */
export const BookingPriceBreakdown = z.object({
  seat: MoneyTHB,
  addOn: MoneyTHB,
  focDiscount: z.number().finite().max(0),
  discount: z.number().finite().max(0),
  extra: MoneyTHB,
  total: MoneyTHB,
});
export type BookingPriceBreakdown = z.infer<typeof BookingPriceBreakdown>;

/**
 * Operational assignment for one service day.
 *
 * One entry per day, always. The monolith's day-1-on-the-booking /
 * day-2+-on-the-trip split does not exist here.
 */
export const BookingOps = z.object({
  id: z.string().uuid(),
  serviceDate: LocalDate,
  boatId: z.string().nullable(),
  vanId: z.string().nullable(),
  vanReturnId: z.string().nullable(),
  returnSameVan: z.boolean(),
  vanGroup: z.number().int().min(0).nullable(),
  vanSeq: z.number().int().min(0).nullable(),
  vanSplits: z.array(z.unknown()),
  boatSplits: z.array(z.unknown()),
  pickupTimeFinal: z.string().nullable(),
  reconfirm: z
    .object({
      status: z.string().nullable(),
      by: z.string().nullable(),
      at: Instant.nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
  vanCheckin: z.unknown().nullable(),
  pierCheckin: z.unknown().nullable(),
  pierNote: z.string().nullable(),
  /** Daily PFM payload. Owned by the finance module and opaque to booking. */
  pfm: z.unknown().nullable(),
});
export type BookingOps = z.infer<typeof BookingOps>;

export const BookingHistoryItem = z.object({
  id: z.string().uuid(),
  at: Instant,
  /** Monotonic within a booking, so same-millisecond entries still order. */
  seq: z.number().int().min(0),
  kind: z.string().nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  tag: z.string().nullable(),
  actor: z.string().nullable(),
  data: z.unknown().nullable(),
});
export type BookingHistoryItem = z.infer<typeof BookingHistoryItem>;

/** One route/date line in the capacity picture the approver was shown. */
export const BookingApprovalOver = z.object({
  routeId: z.string(),
  date: LocalDate,
  name: z.string(),
  need: z.number().int(),
  capFree: z.number().int(),
  overBy: z.number().int(),
  licFree: z.number().int(),
});
export type BookingApprovalOver = z.infer<typeof BookingApprovalOver>;

export const BookingApproval = z.object({
  status: ApprovalStatus,
  reason: z.string().nullable(),
  targetStatus: BookingStatus.nullable(),
  /** Frozen at request time — a snapshot for a human, never re-queried. */
  over: z.array(BookingApprovalOver),
  totOver: z.number().int().nullable(),
  discount: MoneyTHB.nullable(),
  saleName: z.string().nullable(),
  requestedBy: z.string().nullable(),
  requestedAt: Instant.nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: Instant.nullable(),
  note: z.string().nullable(),
});
export type BookingApproval = z.infer<typeof BookingApproval>;

export const BookingFocApproval = z.object({
  paxCount: z.number().int().min(0),
  reason: z.string().nullable(),
  status: ApprovalStatus,
  requestedAt: Instant.nullable(),
  requestedBy: z.string().nullable(),
  approvedAt: Instant.nullable(),
  approvedBy: z.string().nullable(),
  rejectReason: z.string().nullable(),
});
export type BookingFocApproval = z.infer<typeof BookingFocApproval>;

export const BookingCancellation = z.object({
  cancelledAt: Instant.nullable(),
  category: z.string().nullable(),
  categoryLabel: z.string().nullable(),
  groupName: z.string().nullable(),
  reason: z.string().nullable(),
  note: z.string().nullable(),
  chargeType: z.string().nullable(),
  chargeAmount: MoneyTHB,
  recordedAt: Instant.nullable(),
  recordedBy: z.string().nullable(),
});
export type BookingCancellation = z.infer<typeof BookingCancellation>;

export const BookingPartialCancel = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  tripDate: LocalDate.nullable(),
  tripIndex: z.number().int().min(0).nullable(),
  /** Who was removed, keyed like the old pax object. A historical delta. */
  paxRemoved: z.record(z.string(), z.number()),
  paxCount: z.number().int().min(0),
  category: z.string().nullable(),
  categoryLabel: z.string().nullable(),
  groupName: z.string().nullable(),
  note: z.string().nullable(),
  refundMode: z.string().nullable(),
  refund: MoneyTHB,
  chargedCount: z.number().int().min(0),
  chargedAmount: MoneyTHB,
  waivedCount: z.number().int().min(0),
  waivedAmount: MoneyTHB,
  recordedAt: Instant.nullable(),
  recordedBy: z.string().nullable(),
});
export type BookingPartialCancel = z.infer<typeof BookingPartialCancel>;

export const BookingReschedule = z.object({
  fromDate: LocalDate.nullable(),
  toDate: LocalDate.nullable(),
  reason: z.string().nullable(),
  chargeType: z.string().nullable(),
  chargeAmount: MoneyTHB,
  collect: z.string().nullable(),
  recordedAt: Instant.nullable(),
  recordedBy: z.string().nullable(),
});
export type BookingReschedule = z.infer<typeof BookingReschedule>;

export const BookingWeatherResolve = z.object({
  eventId: z.string().nullable(),
  status: z.string().nullable(),
  notifiedAt: Instant.nullable(),
  outcome: z.string().nullable(),
  resolvedAt: Instant.nullable(),
  newDate: LocalDate.nullable(),
});
export type BookingWeatherResolve = z.infer<typeof BookingWeatherResolve>;

/** Part of the party is collected somewhere other than the booking's hotel. */
export const BookingAltPickup = z.object({
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  who: z.string().nullable(),
  qty: z.number().int().min(0),
  areaId: z.string().nullable(),
  area: z.string().nullable(),
  zone: PickupZone.nullable(),
  place: z.string().nullable(),
  pax: z.record(z.string(), z.number()),
});
export type BookingAltPickup = z.infer<typeof BookingAltPickup>;

/** Metadata only. The bytes stay in `allotment.attachments` until P0-09. */
export const BookingAttachment = z.object({
  id: z.string().uuid(),
  legacyAttachmentId: z.string().nullable(),
  filename: z.string(),
  mime: z.string().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  uploadedBy: z.string().nullable(),
  uploadedAt: Instant,
  kind: z.string().nullable(),
});
export type BookingAttachment = z.infer<typeof BookingAttachment>;

/** The enforced replacement for the `b2c_<lkId>[_<n>]` id-prefix convention. */
export const BookingB2cLink = z.object({
  lkBookingId: z.string(),
  legIndex: z.number().int().min(0),
  /** Which side wins per field. App-level policy, so the shape is open. */
  ownedFields: z.record(z.string(), z.unknown()),
  linkedAt: Instant,
});
export type BookingB2cLink = z.infer<typeof BookingB2cLink>;

/** `{method, netDays, source, contractVersion}` frozen at create. */
export const PaymentSnapshot = z.object({
  method: z.enum(['credit', 'prepaid']).nullable(),
  netDays: z.number().int().min(0).nullable(),
  source: z.enum(['contract', 'b2c', 'override']).nullable(),
  contractVersion: z.string().nullable(),
});
export type PaymentSnapshot = z.infer<typeof PaymentSnapshot>;

/**
 * `{market, sub, agentId, at}` frozen at create.
 *
 * Demand reporting reads this, never the agent's market as it stands today —
 * re-categorising an agent must not silently rewrite last year's numbers.
 */
export const MarketSnapshot = z.object({
  market: z.string().nullable(),
  sub: z.string().nullable(),
  agentId: z.string().nullable(),
  at: LocalDate,
});
export type MarketSnapshot = z.infer<typeof MarketSnapshot>;

export const CashOnTour = z.object({
  amount: MoneyTHB,
  currency: z.string(),
  handling: z.string().nullable(),
  note: z.string().nullable(),
});
export type CashOnTour = z.infer<typeof CashOnTour>;

export const GuideLanguages = z.object({
  english: z.boolean(),
  russian: z.boolean(),
  chinese: z.boolean(),
  otherLang: z.string().nullable(),
});
export type GuideLanguages = z.infer<typeof GuideLanguages>;

export const SpecialMeals = z.object({
  veg: z.number().int().min(0),
  vegan: z.number().int().min(0),
  halal: z.number().int().min(0),
  allergies: z.string().nullable(),
  allergyList: z.array(z.object({ name: z.string(), qty: z.number().int().min(0) })),
});
export type SpecialMeals = z.infer<typeof SpecialMeals>;

/**
 * The whole aggregate.
 *
 * One-to-one children are `null` when they never happened; one-to-many children
 * are `[]`. Neither is ever a stub object with empty strings in it — that shape
 * is what made "was this cancelled?" ambiguous in the blob.
 */
export const Booking = z.object({
  /** Surrogate key. Stable across a business-code correction. */
  id: z.string().uuid(),
  /** The business code — `BK-26080001`. What staff and agents quote. */
  code: z.string().min(1),
  schemaVer: z.union([z.literal(1), z.literal(2)]),
  /** v1 bookings share these tables but are read-only. */
  legacyV1: z.boolean(),
  sourceSystem: SourceSystem,

  createdAt: Instant,
  createdBy: z.string().nullable(),
  updatedAt: Instant.nullable(),
  updatedBy: z.string().nullable(),
  /** When the sale happened, which is not always when the row appeared. */
  bookedAt: Instant.nullable(),
  bookingDate: LocalDate,
  voucherRef: z.string().nullable(),

  agentId: z.string().nullable(),
  b2cChannel: z.string().nullable(),
  rateTypeId: z.string().nullable(),
  /** `null` means "inherit the agent's sales owner", not "unassigned". */
  soldBy: z.string().nullable(),

  leadPax: z.string(),
  leadNationality: z.string().nullable(),
  leadType: PaxKind.nullable(),
  leadFoc: z.boolean(),
  leadPhone: z.string().nullable(),
  leadEmail: z.string().nullable(),
  passengers: z.array(BookingPassenger),

  pickupAreaId: z.string().nullable(),
  /** Label frozen at booking time; areas get renamed after vouchers print. */
  pickupArea: z.string().nullable(),
  pickupZone: PickupZone.nullable(),
  pickupSelf: z.boolean(),
  hotelName: z.string().nullable(),
  roomNumber: z.string().nullable(),
  dropoffSame: z.boolean(),
  dropoffAreaId: z.string().nullable(),
  dropoffArea: z.string().nullable(),
  dropoffHotelName: z.string().nullable(),
  altPickups: z.array(BookingAltPickup),

  guides: GuideLanguages,
  specialMeals: SpecialMeals,
  largeLuggage: z.number().int().min(0),
  cashOnTour: CashOnTour.nullable(),

  trips: z.array(BookingTrip),
  addOns: z.array(BookingAddOn),
  adjustments: z.array(BookingAdjustment),
  feeItems: z.array(BookingFeeItem),
  upgrades: z.array(BookingUpgrade),

  paymentSnapshot: PaymentSnapshot,
  marketSnapshot: MarketSnapshot.nullable(),
  priceBreakdown: BookingPriceBreakdown,
  priceMode: PriceMode,
  manualTotal: MoneyTHB.nullable(),

  status: BookingStatus,
  /** Soft "missing but not blocking" flags: `pickup`, `guide-lang`, … */
  incomplete: z.array(z.string()),

  purpose: BookingPurpose,
  staffId: z.string().nullable(),
  staffPurpose: z.string().nullable(),

  confirmedBy: z.string().nullable(),
  confirmedAt: Instant.nullable(),
  invoiceId: z.string().nullable(),
  paymentStatus: PaymentStatus.nullable(),

  ops: z.array(BookingOps),
  history: z.array(BookingHistoryItem),

  approval: BookingApproval.nullable(),
  focApproval: BookingFocApproval.nullable(),
  cancellation: BookingCancellation.nullable(),
  cancelCategory: z.string().nullable(),
  partialCancels: z.array(BookingPartialCancel),
  reschedule: BookingReschedule.nullable(),
  weatherResolve: BookingWeatherResolve.nullable(),

  rebook: z
    .object({
      fromCode: z.string().nullable(),
      toCode: z.string().nullable(),
      reason: z.string().nullable(),
      at: Instant.nullable(),
    })
    .nullable(),

  attachments: z.array(BookingAttachment),
  b2cLink: BookingB2cLink.nullable(),
  docCheck: z.unknown().nullable(),
  notes: z.string().nullable(),
  note: z.string().nullable(),
});
export type Booking = z.infer<typeof Booking>;

/**
 * The list projection.
 *
 * A booking list view is 2,800 rows deep and renders eight fields; sending the
 * full aggregate for each would ship megabytes to draw a table.
 */
export const BookingSummary = Booking.pick({
  id: true,
  code: true,
  status: true,
  bookingDate: true,
  agentId: true,
  leadPax: true,
  voucherRef: true,
  soldBy: true,
  paymentStatus: true,
}).extend({
  /** Earliest trip date, for the "when do they travel" column. */
  firstTripDate: LocalDate.nullable(),
  total: MoneyTHB,
  paxTotal: z.number().int().min(0),
});
export type BookingSummary = z.infer<typeof BookingSummary>;

/** Query filters for `GET /v1/bookings`. Combine with `PageQuery`. */
export const BookingListQuery = z.object({
  status: BookingStatus.optional(),
  agentId: z.string().optional(),
  routeId: z.string().optional(),
  /** Inclusive bounds over the trip date, which is what staff search by. */
  dateFrom: LocalDate.optional(),
  dateTo: LocalDate.optional(),
  voucherRef: z.string().optional(),
  q: z.string().optional(),
});
export type BookingListQuery = z.infer<typeof BookingListQuery>;
