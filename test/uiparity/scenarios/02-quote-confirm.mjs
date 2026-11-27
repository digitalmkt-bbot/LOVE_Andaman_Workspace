// Scenario 2 · booking: a quote (Save Draft) that is later confirmed
// Legacy flow (08-app.js): the booking form as in scenario 1 › "Save Draft" (bkV2SaveDraft → bkV2CommitBooking
// 'quote') › All bookings (bkV2SwitchTab('all')) › the quote's row (bkV2OpenDetail) › Edit (bkV2EditBooking) ›
// "Update Booking" (bkV2SubmitBooking → bkV2CommitBooking 'confirmed'; bkV2EditDiffAsk shows what changed first).
import { RUN } from './_booking.mjs';
import { pickAgentRoute, bookingsByLead } from './_booking.mjs';
import { formSteps } from './01-agent-booking.mjs';
// a new name per run, so a rerun on the same databases (--reuse-dbs) reads only its own booking
const LEAD = 'UIP SC2 Quote ' + RUN;
export default {
  name: 'quote-confirm',
  title: 'quote (Save Draft), then confirm it',
  async prepare({ legacy, addDays, today }) {
    const date = addDays(today, 15);
    return { date, today, ...(await pickAgentRoute(legacy, date)) };
  },
  steps: (v) => [
    ...formSteps(v, LEAD),
    { label: 'Save Draft (quote)', clickFn: 'bkV2SaveDraft' },
    { label: 'All bookings tab', clickSel: `[onclick*="SwitchTab('all'"]` },
    // its row click (bkV2OpenDetail) with the id each side gave the quote: the new frontend has no All bookings tab and
    // loads a window of bookings, so the row is not found the same way on both
    { label: 'open the quote (its row click: bkV2OpenDetail)', call: 'bkV2OpenDetail', argsFrom: {
      legacy: `SELECT id FROM operation_schemas.sb_bookings WHERE leadpax = '${LEAD}'`, ops: `SELECT coalesce(external_id, id) FROM bookings WHERE lead_pax = '${LEAD}'` } },
    { label: 'Edit', clickFn: 'bkV2EditBooking' },
    { label: 'Update Booking (confirm)', clickFn: 'bkV2SubmitBooking' },
  ],
  async data({ legacy, ops }) {
    const r = await bookingsByLead(legacy, ops, LEAD);
    return { legacy: r.legacy, new: r.new };
  },
};
