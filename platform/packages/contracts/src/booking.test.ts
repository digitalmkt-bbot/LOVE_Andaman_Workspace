import { describe, expect, it } from 'vitest';

import {
  Booking,
  BookingPriceBreakdown,
  BookingStatus,
  BookingTrip,
  CANCELLED_BOOKING_STATUSES,
  isActiveBookingStatus,
} from './booking.js';

/**
 * The `exampleBookingV2` from `allotment_v2/docs/booking.model.ts`, restated in
 * the new shape. It is the smallest booking that exercises every required
 * field, so if the contract drifts away from the model this fails first.
 */
const example: Booking = {
  id: '0f9e6a6a-1f0e-4c9b-9d1a-2f3b4c5d6e70',
  code: 'BK-26080001',
  schemaVer: 2,
  legacyV1: false,
  sourceSystem: 'ops',
  createdAt: '2026-08-01T09:30:00+07:00',
  createdBy: 'RM',
  updatedAt: null,
  updatedBy: null,
  bookedAt: '2026-08-01T09:30:00+07:00',
  bookingDate: '2026-08-01',
  voucherRef: 'AGT-12345',
  agentId: 'a01',
  b2cChannel: null,
  rateTypeId: 'rt001',
  soldBy: null,
  leadPax: 'Jane Smith',
  leadNationality: 'British',
  leadType: 'AD',
  leadFoc: false,
  leadPhone: '+66 81 000 0000',
  leadEmail: 'jane@example.com',
  passengers: [
    {
      id: '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
      seq: 0,
      name: 'John Smith',
      nationality: 'British',
      kind: 'AD',
      isFoc: false,
      isLead: false,
    },
  ],
  pickupAreaId: 'pk-patong',
  pickupArea: 'Patong',
  pickupZone: 'PK',
  pickupSelf: false,
  hotelName: 'Example Resort',
  roomNumber: '1204',
  dropoffSame: true,
  dropoffAreaId: 'pk-patong',
  dropoffArea: 'Patong',
  dropoffHotelName: 'Example Resort',
  altPickups: [],
  guides: { english: true, russian: false, chinese: false, otherLang: null },
  specialMeals: { veg: 0, vegan: 0, halal: 0, allergies: null, allergyList: [] },
  largeLuggage: 0,
  cashOnTour: null,
  trips: [
    {
      id: '2b3c4d5e-6f70-4b8c-9d0e-2f3a4b5c6d7e',
      tripIndex: 0,
      routeId: 'r_similan',
      date: '2026-08-05',
      zone: 'PK',
      pickupTime: '06:00-06:15',
      // Two foreign adults. The blob spelled this `{ad_fr: 2}` and carried ten
      // more keys at zero; here the zeroes simply are not rows.
      pax: [{ kind: 'AD', nationalityClass: 'FR', qty: 2 }],
      bookingMode: 'seat',
      charterBoatId: null,
      charterPriceMode: 'rate',
      charterPriceManual: 0,
      charterPriceNote: null,
      charterDisplacementAck: false,
      ovn: null,
      ovnReturnDate: null,
      ovnCharge: 0,
      ovnLeg: false,
      ovnOfTripIndex: null,
      seatSource: { locked: 0, general: 2 },
      subtotal: 7800,
    },
  ],
  addOns: [],
  adjustments: [],
  feeItems: [],
  upgrades: [],
  paymentSnapshot: {
    method: 'credit',
    netDays: 30,
    source: 'contract',
    contractVersion: 'v2026-1',
  },
  marketSnapshot: { market: 'Europe', sub: null, agentId: 'a01', at: '2026-08-01' },
  priceBreakdown: { seat: 7800, addOn: 0, focDiscount: 0, discount: 0, extra: 0, total: 7800 },
  priceMode: 'rate',
  manualTotal: null,
  status: 'confirmed',
  incomplete: [],
  purpose: 'sale',
  staffId: null,
  staffPurpose: null,
  confirmedBy: null,
  confirmedAt: null,
  invoiceId: null,
  paymentStatus: null,
  ops: [
    {
      id: '3c4d5e6f-7081-4c8d-9e0f-3a4b5c6d7e8f',
      serviceDate: '2026-08-05',
      boatId: null,
      vanId: null,
      vanReturnId: null,
      returnSameVan: false,
      vanGroup: 0,
      vanSeq: 0,
      vanSplits: [],
      boatSplits: [],
      pickupTimeFinal: null,
      reconfirm: null,
      vanCheckin: null,
      pierCheckin: null,
      pierNote: null,
      pfm: null,
    },
  ],
  history: [],
  approval: null,
  focApproval: null,
  cancellation: null,
  cancelCategory: null,
  partialCancels: [],
  reschedule: null,
  weatherResolve: null,
  rebook: null,
  attachments: [],
  b2cLink: null,
  docCheck: null,
  notes: null,
  note: null,
};

describe('Booking', () => {
  it('accepts the reference booking from booking.model.ts', () => {
    expect(Booking.parse(example)).toMatchObject({ code: 'BK-26080001', status: 'confirmed' });
  });

  it('rejects a JS Date where a calendar date belongs', () => {
    // The whole point of LocalDate: `toISOString().slice(0,10)` on a +07:00
    // date before 07:00 local yields the previous day.
    const bad = { ...example, bookingDate: new Date('2026-08-01') };
    expect(Booking.safeParse(bad).success).toBe(false);
  });

  it('rejects an instant with no UTC offset', () => {
    const bad = { ...example, createdAt: '2026-08-01T09:30:00' };
    expect(Booking.safeParse(bad).success).toBe(false);
  });
});

describe('BookingStatus', () => {
  it('has exactly the 8 known states', () => {
    expect(BookingStatus.options).toHaveLength(8);
  });

  it('treats every cancelled-family status as inactive', () => {
    for (const status of CANCELLED_BOOKING_STATUSES) {
      expect(isActiveBookingStatus(status)).toBe(false);
    }
    expect(isActiveBookingStatus('confirmed')).toBe(true);
    // `rejected` was missing from several of the monolith's copies of this list,
    // which is exactly how rejected bookings kept eating capacity.
    expect(isActiveBookingStatus('rejected')).toBe(false);
  });
});

describe('BookingPriceBreakdown', () => {
  it('keeps discounts negative', () => {
    expect(
      BookingPriceBreakdown.safeParse({
        seat: 7800,
        addOn: 0,
        focDiscount: 0,
        discount: 500,
        extra: 0,
        total: 7300,
      }).success,
    ).toBe(false);
  });

  it('sums to the total by plain addition', () => {
    const pb = BookingPriceBreakdown.parse({
      seat: 7800,
      addOn: 1200,
      focDiscount: -600,
      discount: -400,
      extra: 100,
      total: 8100,
    });
    expect(pb.seat + pb.addOn + pb.focDiscount + pb.discount + pb.extra).toBe(pb.total);
  });
});

describe('BookingTrip', () => {
  it('rejects a negative pax count', () => {
    const trip = example.trips[0]!;
    const bad = { ...trip, pax: [{ kind: 'AD', nationalityClass: 'FR', qty: -1 }] };
    expect(BookingTrip.safeParse(bad).success).toBe(false);
  });

  it('has no place to express the legacy unsuffixed pax spelling', () => {
    const trip = example.trips[0]!;
    const bad = { ...trip, pax: [{ kind: 'AD', nationalityClass: 'LEGACY', qty: 2 }] };
    expect(BookingTrip.safeParse(bad).success).toBe(false);
  });
});
