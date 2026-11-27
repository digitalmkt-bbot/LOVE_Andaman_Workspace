// Scenario 2 · booking: a quote (Save Draft) that is later confirmed
// Legacy flow (08-app.js): the booking form as in scenario 1 › "Save Draft" (bkV2SaveDraft → bkV2CommitBooking
// 'quote') › All bookings (bkV2SwitchTab('all')) › the quote's row (bkV2OpenDetail) › Edit (bkV2EditBooking) ›
// "Update Booking" (bkV2SubmitBooking → bkV2CommitBooking 'confirmed'; bkV2EditDiffAsk shows what changed first).
import { pickAgentRoute, bookingsByLead } from './_booking.mjs';
import { formSteps } from './01-agent-booking.mjs';
const LEAD = 'UIP SC2 Quote';
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
    { label: 'open the quote', clickFn: 'bkV2OpenDetail', near: LEAD },
    { label: 'Edit', clickFn: 'bkV2EditBooking' },
    { label: 'Update Booking (confirm)', clickFn: 'bkV2SubmitBooking' },
  ],
  async data({ legacy, ops }) {
    const r = await bookingsByLead(legacy, ops, LEAD);
    return { legacy: r.legacy, new: r.new };
  },
};
