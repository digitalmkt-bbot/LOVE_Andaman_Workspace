import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchBooking,
  fetchBookingList,
  fetchManifest,
  type BookingDetail,
  type BookingSummary,
} from './api/bookings.js';

const EXAMPLE_BOOKING_ID = 'booking_9719ee2e-98bc-4f5e-9f70-368210d2ede9';

function value(row: BookingSummary, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = row[key as keyof BookingSummary];
    if (candidate !== null && candidate !== undefined && candidate !== '') return String(candidate);
  }
  return '—';
}

function formatMoney(amount: unknown): string {
  return typeof amount === 'number'
    ? new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount)
    : '—';
}

function JsonPanel({ title, value: data }: { title: string; value: unknown }) {
  return (
    <section className="json-panel">
      <h3>{title}</h3>
      <pre>{JSON.stringify(data ?? {}, null, 2)}</pre>
    </section>
  );
}

function BookingDetailPanel({ booking }: { booking: BookingDetail }) {
  const bookingData = booking.booking_data ?? booking.bookingData ?? {};
  const paxBreakdown = booking.pax_breakdown ?? booking.paxBreakdown ?? {};

  return (
    <>
      <section className="detail-summary" aria-label="Booking summary">
        <div><span>Code</span><strong>{value(booking, 'code', 'id')}</strong></div>
        <div><span>Status</span><strong className="status">{value(booking, 'status')}</strong></div>
        <div><span>Lead guest</span><strong>{value(booking, 'lead_pax', 'leadPax')}</strong></div>
        <div><span>Total</span><strong>{formatMoney(booking.total)}</strong></div>
      </section>
      <JsonPanel title="Pax breakdown" value={paxBreakdown} />
      <JsonPanel title="Original booking data" value={bookingData} />
    </>
  );
}

export function App() {
  const [routeId, setRouteId] = useState('r10');
  const [serviceDate, setServiceDate] = useState('2026-08-07');
  const [bookingId, setBookingId] = useState(EXAMPLE_BOOKING_ID);
  const [selectedBookingId, setSelectedBookingId] = useState(EXAMPLE_BOOKING_ID);

  const list = useQuery({
    queryKey: ['bookings', routeId, serviceDate],
    queryFn: () => fetchBookingList(routeId, serviceDate),
  });
  const manifest = useQuery({
    queryKey: ['manifest', routeId, serviceDate],
    queryFn: () => fetchManifest(routeId, serviceDate),
  });
  const booking = useQuery({
    queryKey: ['booking', selectedBookingId],
    queryFn: () => fetchBooking(selectedBookingId),
    enabled: Boolean(selectedBookingId),
  });

  function applyBookingId() {
    const trimmed = bookingId.trim();
    if (trimmed) setSelectedBookingId(trimmed);
  }

  return (
    <main className="ops-page">
      <header className="masthead">
        <p className="eyebrow">LOVE ANDAMAN · OPERATIONS</p>
        <h1>Bookings, from the API</h1>
        <p>Canonical booking data is fetched from <code>/v1</code>; this screen does not load or import the legacy state blob.</p>
      </header>

      <form className="filters" onSubmit={(event) => { event.preventDefault(); void list.refetch(); void manifest.refetch(); }}>
        <label>Route<input value={routeId} onChange={(event) => setRouteId(event.target.value)} /></label>
        <label>Service date<input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></label>
        <button type="submit">Refresh day</button>
      </form>

      <div className="workspace">
        <section className="card booking-list">
          <div className="section-heading"><div><p className="eyebrow">BOOKINGS</p><h2>{routeId} · {serviceDate}</h2></div><span>{list.data?.length ?? 0} records</span></div>
          {list.isPending && <p className="muted">Loading bookings…</p>}
          {list.isError && <p className="error">{String(list.error)}</p>}
          {list.data && (
            <div className="table-wrap"><table><thead><tr><th>Booking</th><th>Guest</th><th>Pax</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>{list.data.map((row) => <tr key={row.id} className={row.id === selectedBookingId ? 'selected' : ''} onClick={() => { setBookingId(row.id); setSelectedBookingId(row.id); }}>
                <td><strong>{value(row, 'code', 'id')}</strong><small>{value(row, 'voucher_ref', 'voucherRef')}</small></td><td>{value(row, 'lead_pax', 'leadPax')}</td><td>{value(row, 'pax_total', 'paxTotal')}</td><td><span className="status">{value(row, 'status')}</span></td><td>{formatMoney(row.total)}</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

        <aside className="card manifest"><div className="section-heading"><div><p className="eyebrow">MANIFEST</p><h2>Operational day</h2></div></div>
          {manifest.isPending && <p className="muted">Loading manifest…</p>}
          {manifest.isError && <p className="error">{String(manifest.error)}</p>}
          {manifest.data && <JsonPanel title={`${routeId} · ${serviceDate}`} value={manifest.data} />}
        </aside>
      </div>

      <section className="card detail"><div className="section-heading"><div><p className="eyebrow">BOOKING DETAIL</p><h2>Canonical record</h2></div></div>
        <form className="booking-id" onSubmit={(event) => { event.preventDefault(); applyBookingId(); }}><input aria-label="Backend booking ID" value={bookingId} onChange={(event) => setBookingId(event.target.value)} /><button type="submit">Fetch booking</button></form>
        {booking.isPending && <p className="muted">Loading booking…</p>}
        {booking.isError && <p className="error">{String(booking.error)}</p>}
        {booking.data && <BookingDetailPanel booking={booking.data} />}
      </section>
    </main>
  );
}
