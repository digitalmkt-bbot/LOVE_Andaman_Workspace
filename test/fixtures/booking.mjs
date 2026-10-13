// Fixture helper: builds a valid SB_BOOKINGS record without the DOM / without allotment_v2.html.
//
// Shape verified against:
//   - CLAUDE.md §3.4 (Booking / SB_BOOKINGS field reference)
//   - os-backend/src/mapping/field_mapping.json  (sb_bookings, sb_bookings__trips,
//     sb_bookings__passengers, sb_bookings__history — the actual decomposeBlob/assembleBlob
//     source-field names the relational write path reads)
//
// Pure data construction: no network, no fs, no browser globals. Safe to import from any test.
//
// bkV2LocalYMD (CLAUDE.md gotcha) builds a local YYYY-MM-DD without the UTC-shift bug in
// `toISOString().slice(0,10)`. It only matters in a browser evaluating in a non-UTC zone; here we
// just need a stable, deterministic date string, so a plain literal format is used instead of
// reimplementing the app's timezone-aware helper.
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let seq = 0;
/** Deterministic-ish unique id for scratch fixtures — always prefixed zz_test_ so it is
 *  trivially greppable and safe to delete in bulk (CLAUDE.md §4 scratch-record convention). */
export function zzTestId(prefix = 'bk') {
  seq += 1;
  return `zz_test_${prefix}_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build one passenger row (sb_bookings__passengers shape).
 */
export function buildPassenger(overrides = {}) {
  return {
    name: 'Zz Test Passenger',
    nationality: 'TH',
    type: 'ad_th',
    foc: false,
    ...overrides,
  };
}

/**
 * Build one trip (sb_bookings__trips shape, nested inside a booking's trips[]).
 * pax field names follow field_mapping.json exactly (ad_fr/ad_th split by nationality tier,
 * chd_*, inf_*, foc_fr/foc_th, plus the legacy flat `ad`/`foc` aggregates some views still read).
 */
export function buildTrip(overrides = {}) {
  const today = new Date();
  const tripDate = new Date(today.getTime() + 7 * 86400000); // 7 days out — clear of same-day cutover logic
  return {
    routeId: 'r1',
    date: ymd(tripDate),
    zone: 'PK',
    bookingMode: 'seat',
    pax: {
      ad_fr: 0,
      ad_th: 2,
      chd_fr: 0,
      chd_th: 0,
      inf_fr: 0,
      inf_th: 0,
      foc_fr: 0,
      foc_th: 0,
      ad: 2,
      foc: 0,
    },
    pickupTime: '07:30',
    seatSource: { locked: 0, general: 2 },
    subtotal: 2400,
    lockDrawSel: {},
    ops: {},
    ...overrides,
  };
}

/**
 * Build a full booking record in the app's nested (camelCase) shape — the shape the real write
 * path expects as the `body` of a `{op:'put', r:'sb_bookings', body}` /api/v1/_batch op, and the
 * shape `bkV2CommitBooking` produces client-side. NOT the flattened SQL row shape.
 *
 * No DOM, no localStorage, no fetch — just an object literal builder, so it can be reused to seed
 * unit tests, integration tests, or (once schema exists) a real Postgres write-path e2e test.
 *
 * @param {object} overrides - deep-shallow overrides merged onto the top level only (nested
 *   objects like `trips` are replaced wholesale if passed, not deep-merged — pass a full replacement).
 */
export function buildBooking(overrides = {}) {
  const id = overrides.id || zzTestId('bk');
  const nowIso = new Date().toISOString();
  const base = {
    id,
    schemaVer: 2,
    createdAt: nowIso,
    createdBy: 'zz_test_harness',
    voucherRef: `ZZ-${id.slice(-8)}`,
    agentId: null,
    rateTypeRef: null,
    leadPax: 'Zz Test Lead',
    leadNationality: 'TH',
    leadType: 'th',
    leadFoc: false,
    leadPhone: '0800000000',
    leadEmail: 'zz-test@example.invalid',
    pickupAreaId: null,
    pickupSelf: false,
    hotelName: 'Zz Test Hotel',
    roomNumber: '101',
    dropoffSame: true,
    notes: 'zz_test fixture — safe to delete',
    status: 'confirmed',
    channel: 'direct',
    bookingDate: ymd(new Date()),
    priceBreakdown: {
      seat: 2400,
      addOn: 0,
      focDiscount: 0,
      discount: 0,
      extra: 0,
      total: 2400,
    },
    paymentSnapshot: {
      method: 'cash',
      netDays: 0,
      source: 'zz_test',
      paid: 0,
      paidStatus: 'unpaid',
      deposit: 0,
      balance: 2400,
    },
    marketSnapshot: {
      market: 'zz_test',
      sub: null,
      agentId: null,
      at: nowIso,
    },
    ops: {},
    trips: [buildTrip()],
    passengers: [buildPassenger(), buildPassenger({ name: 'Zz Test Passenger 2' })],
    addOns: [],
    adjustments: [],
    history: [{ at: nowIso, kind: 'created', text: 'created by LAM-22 test harness', by: 'zz_test_harness' }],
  };
  return { ...base, ...overrides };
}

/** Statuses excluded from every pax/revenue aggregate (CLAUDE.md §3.4 / §6). Kept here so tests
 *  that assert aggregation behavior don't hardcode the list in two places. */
export const CANCELLED_STATUSES = ['cancelled', 'cancelled_weather', 'rejected'];
