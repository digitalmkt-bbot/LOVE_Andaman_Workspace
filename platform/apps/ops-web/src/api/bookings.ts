export type BookingSummary = {
  id: string;
  code?: string;
  status?: string;
  booking_date?: string;
  bookingDate?: string;
  service_date?: string;
  serviceDate?: string;
  lead_pax?: string;
  leadPax?: string;
  agent_id?: string;
  agentId?: string;
  voucher_ref?: string;
  voucherRef?: string;
  pax_total?: number;
  paxTotal?: number;
  total?: number;
};

export type BookingDetail = BookingSummary & {
  pax_breakdown?: unknown;
  paxBreakdown?: unknown;
  booking_data?: Record<string, unknown>;
  bookingData?: Record<string, unknown>;
  [key: string]: unknown;
};

export type Manifest = Record<string, unknown>;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function collection(value: unknown): BookingSummary[] {
  if (Array.isArray(value)) return value as BookingSummary[];
  if (value && typeof value === 'object') {
    const envelope = value as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'bookings']) {
      if (Array.isArray(envelope[key])) return envelope[key] as BookingSummary[];
    }
  }
  throw new Error('Bookings API returned an unexpected list response');
}

function detail(value: unknown): BookingDetail {
  if (value && typeof value === 'object') {
    const envelope = value as Record<string, unknown>;
    if (envelope.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)) {
      return envelope.data as BookingDetail;
    }
    return envelope as BookingDetail;
  }
  throw new Error('Bookings API returned an unexpected detail response');
}

export function fetchBookingList(routeId: string, serviceDate: string): Promise<BookingSummary[]> {
  const params = new URLSearchParams({ route_id: routeId, service_date: serviceDate });
  return getJson<unknown>(`/v1/bookings?${params}`).then(collection);
}

export function fetchBooking(id: string): Promise<BookingDetail> {
  return getJson<unknown>(`/v1/bookings/${encodeURIComponent(id)}`).then(detail);
}

export function fetchManifest(routeId: string, date: string): Promise<Manifest> {
  const params = new URLSearchParams({ route_id: routeId, date });
  return getJson<Manifest>(`/v1/manifest?${params}`);
}
