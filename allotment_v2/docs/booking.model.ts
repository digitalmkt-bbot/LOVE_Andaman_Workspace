// Reference model for LOVE Andaman Booking v2.
// This file is documentation only; allotment_v2.html is still the runtime source.
// Storage: localStorage['loveandaman_v2'].sb_bookings and backend relational tables.

export type ISODate = `${number}-${number}-${number}`; // YYYY-MM-DD
export type ISODateTime = string;
export type MoneyTHB = number;

export type BookingStatus =
  | 'quote'
  | 'pending_foc'
  | 'pending_approval'
  | 'confirmed'
  | 'cancelled'
  | 'cancelled_weather'
  | 'rejected'
  | 'completed';

export type PaxKind = 'AD' | 'CHD' | 'INF' | 'FOC';
export type BookingMode = 'seat' | 'charter';
export type PickupZone = 'PK' | 'KL' | 'NoTransfer' | 'NT';
export type PriceMode = 'rate' | 'manual';

// Current pax counter used by Booking v2 trips.
// Some older helpers may also tolerate older keys, but new bookings use these split fields.
export interface BookingPaxCounts {
  ad_fr?: number;
  ad_th?: number;
  chd_fr?: number;
  chd_th?: number;
  inf_fr?: number;
  inf_th?: number;
  foc?: number;
}

export interface BookingPassenger {
  name: string;
  nationality: string;
  type: PaxKind;
  foc: boolean;
}

export interface BookingTrip {
  routeId: string;
  date: ISODate;
  zone?: PickupZone;
  pax: BookingPaxCounts;
  pickupTime: string;

  bookingMode: BookingMode;
  charterBoatId: string | null;
  charterPriceMode: 'rate' | 'manual';
  charterPriceManual: MoneyTHB;
  charterPriceNote: string;
  charterDisplacementAck: boolean;

  // Overnight/island-stay metadata.
  ovn?: string | null;
  ovnReturnDate?: ISODate | '';
  ovnCharge?: MoneyTHB;
  ovnLeg?: boolean;
  ovnOf?: number | string | null;

  // Seat lock accounting.
  seatSource: { locked: number; general: number };
  lockDrawSel: Record<string, number>; // lockId -> qty selected in form
  lockDraws: Array<{ lockId: string; qty: number }>;

  subtotal: MoneyTHB;
}

export interface BookingAddOn {
  type: string;
  label: string;
  amount: MoneyTHB;
  qty: number;
  note?: string;
}

export interface BookingAdjustment {
  kind: string;
  mode: 'amount' | 'percent';
  value: number;
  label?: string;
  note?: string;
}

export interface BookingOps {
  boatId?: string | null;
  vanId?: string | null;
  vanReturnId?: string | null;
  returnSameVan?: boolean;
  vanGroup?: number;
  vanSeq?: number;
  vanSplits?: Array<{
    vanId?: string | null;
    vanGroup?: number;
    vanSeq?: number;
    [key: string]: unknown;
  }>;
  pickupTimeFinal?: string;
  reconfirm?: { status?: string; by?: string; at?: ISODateTime; note?: string } | null;
  pfm?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BookingApproval {
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  targetStatus?: BookingStatus;
  over?: Array<{
    routeId: string;
    date: ISODate;
    name: string;
    need: number;
    capFree: number;
    overBy: number;
    licFree: number;
  }>;
  totOver?: number;
  discount?: MoneyTHB;
  saleName?: string;
  requestedBy?: string;
  requestedAt?: ISODateTime;
  approvedBy?: string;
  approvedAt?: ISODateTime | '';
  note?: string;
}

export interface BookingFocApproval {
  count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: ISODateTime;
  requestedBy: string;
  approvedAt?: ISODateTime;
  approvedBy?: string;
  rejectReason?: string;
}

export interface BookingHistoryItem {
  at?: ISODateTime;
  type?: string;
  title?: string;
  text?: string;
  by?: string;
  [key: string]: unknown;
}

export interface BookingV2 {
  id: string;
  schemaVer: 2;

  createdAt: ISODate;
  createdBy: string;
  updatedAt?: ISODateTime;
  updatedBy?: string;
  bookedAt: ISODateTime;
  bookingDate: ISODate;
  voucherRef: string;

  // Customer/source.
  agentId?: string | null;
  b2cChannel?: string | null;
  rateTypeRef: string;
  soldBy?: string | null;

  leadPax: string;
  leadNationality: string;
  leadType: PaxKind;
  leadFoc: boolean;
  leadPhone?: string;
  leadEmail?: string;
  passengers: BookingPassenger[];

  // Pickup/drop-off.
  pickupAreaId?: string;
  pickupArea?: string;
  pickupZone: PickupZone;
  pickupSelf: boolean;
  hotelName: string;
  roomNumber?: string;
  dropoffSame?: boolean;
  dropoffAreaId?: string;
  dropoffArea?: string;
  dropoffHotelName?: string;
  altPickups: Array<{
    who: string;
    qty: number;
    areaId?: string;
    area?: string;
    zone?: PickupZone | string;
    place?: string;
    ad_fr?: number; ad_th?: number; chd_fr?: number; chd_th?: number; inf_fr?: number; inf_th?: number; foc?: number;
  }>;

  guides: { english: boolean; russian: boolean; chinese: boolean; otherLang: string };
  specialMeals: {
    veg: number;
    vegan: number;
    halal: number;
    allergies: string;
    allergyList: Array<{ name: string; qty: number }>;
  };
  largeLuggage: number;
  cashOnTour: { amount: MoneyTHB; currency: string; handling: string; note: string } | null;

  trips: BookingTrip[];
  addOns: BookingAddOn[];
  adjustments: BookingAdjustment[];

  focApproval: BookingFocApproval | null;
  approval?: BookingApproval;
  paymentSnapshot: {
    method: 'credit' | 'prepaid';
    netDays: number;
    source: 'contract' | 'b2c' | 'override';
    contractVersion: string;
  };
  priceBreakdown: {
    seat: MoneyTHB;
    addOn: MoneyTHB;
    focDiscount: MoneyTHB; // negative number
    discount: MoneyTHB;    // negative number
    extra: MoneyTHB;
    total: MoneyTHB;
  };
  total: MoneyTHB;
  priceMode: PriceMode;
  manualTotal: MoneyTHB | null;

  status: BookingStatus;
  incomplete?: string[]; // soft missing fields, e.g. ['pickup']
  marketSnapshot?: { market: string | null; sub?: string | null; agentId?: string | null; at: ISODate };

  ops?: BookingOps;
  history?: BookingHistoryItem[];

  // Preserved fields when editing; do not wipe these.
  upgrades?: unknown[];
  feeItems?: unknown[];
  reschedule?: unknown;
  partialCancels?: unknown[];
  cancellation?: unknown;
  cancelCategory?: string;
  weatherResolve?: unknown;
  rebook?: unknown;
  invoiceId?: string | null;
  paymentStatus?: 'unpaid' | 'invoiced' | 'partial' | 'paid' | string;

  attachments?: unknown[];
  docCheck?: unknown | null;
  notes?: string;
  note?: string;

  purpose?: 'sale' | 'staff_welfare' | 'staff_inspection';
  staffId?: string | null;
  staffPurpose?: string | null;
  confirmedBy?: string;
  confirmedAt?: ISODateTime | null;
}

// Tiny visual example.
export const exampleBookingV2: BookingV2 = {
  id: 'BK-26080001',
  schemaVer: 2,
  createdAt: '2026-08-01',
  createdBy: 'RM',
  bookedAt: '2026-08-01T09:30:00+07:00',
  bookingDate: '2026-08-01',
  voucherRef: 'AGT-12345',
  agentId: 'a01',
  b2cChannel: null,
  rateTypeRef: 'rt001',
  soldBy: null,
  leadPax: 'Jane Smith',
  leadNationality: 'British',
  leadType: 'AD',
  leadFoc: false,
  leadPhone: '+66 81 000 0000',
  leadEmail: 'jane@example.com',
  passengers: [{ name: 'John Smith', nationality: 'British', type: 'AD', foc: false }],
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
  guides: { english: true, russian: false, chinese: false, otherLang: '' },
  specialMeals: { veg: 0, vegan: 0, halal: 0, allergies: '', allergyList: [] },
  largeLuggage: 0,
  cashOnTour: null,
  trips: [{
    routeId: 'r_similan',
    date: '2026-08-05',
    zone: 'PK',
    pax: { ad_fr: 2 },
    pickupTime: '06:00-06:15',
    bookingMode: 'seat',
    charterBoatId: null,
    charterPriceMode: 'rate',
    charterPriceManual: 0,
    charterPriceNote: '',
    charterDisplacementAck: false,
    seatSource: { locked: 0, general: 2 },
    lockDrawSel: {},
    lockDraws: [],
    subtotal: 7800
  }],
  addOns: [],
  adjustments: [],
  focApproval: null,
  paymentSnapshot: { method: 'credit', netDays: 30, source: 'contract', contractVersion: 'v2026-1' },
  priceBreakdown: { seat: 7800, addOn: 0, focDiscount: 0, discount: 0, extra: 0, total: 7800 },
  total: 7800,
  priceMode: 'rate',
  manualTotal: null,
  status: 'confirmed',
  incomplete: [],
  marketSnapshot: { market: 'Europe', sub: null, agentId: 'a01', at: '2026-08-01' },
  ops: { boatId: null, vanId: null, vanReturnId: null, vanGroup: 0, vanSeq: 0, vanSplits: [], pfm: {} },
  history: []
};
