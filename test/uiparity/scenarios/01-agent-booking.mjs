// Scenario 1 · booking: an agent booking, created and confirmed from the booking form
// Legacy flow (08-app.js): Booking › "+ New booking" (bkV2NewBooking) › agent: type, Enter (bkV2AgentDDKey →
// bkV2PickAgentByText) › trip 1 route: type, Enter (bkV2RouteDDKey → bkV2PickRouteByText) › the calendar
// (bkV2CalOpen › bkV2CalPick) › 2 adults (bkV2BumpPax 'ad_fr') › lead name (bkV2SetBookingField 'leadPax') ›
// nationality (bkV2NatDDKey) › guide English (bkV2ToggleGuide) › hotel (bkV2HotelDDFilter) — legacy requires all three to confirm › Confirm (bkV2SubmitBooking → bkV2CommitBooking 'confirmed').
import { pickAgentRoute, bookingsByLead } from './_booking.mjs';
export const LEAD = 'UIP SC1 Lead';
export function formSteps(v, lead) {
  return [
    { nav: 'booking' },
    { label: '+ New booking', clickFn: 'bkV2NewBooking' },
    { label: 'agent: type', fill: '#bkv2-agent-input', value: v.agentName },
    { label: 'agent: Enter', press: '#bkv2-agent-input', key: 'Enter' },
    { label: 'route: type', fill: '#bkv2-route-input-0', value: v.routeName },
    { label: 'route: Enter', press: '#bkv2-route-input-0', key: 'Enter' },
    { label: 'date: open calendar', clickSel: '#bkv2-cal-trig-0' },
    // the day cell's own handler: clicking the cell timed out on both sides (the popup's cells are not 'visible' to the
    // test while the month renders), so the step calls what the cell's onclick calls
    { label: 'date: pick ' + v.date + ' (the day cell: bkV2CalPick)', call: 'bkV2CalPick', args: [0, v.date] },
    { label: '+1 adult', clickSel: `[onclick*="BumpPax(0,'ad_fr',1)"]` },
    { label: '+1 adult', clickSel: `[onclick*="BumpPax(0,'ad_fr',1)"]` },
    { label: 'lead name', fill: `input[oninput*="SetBookingField('leadPax'"]`, value: lead },
    { label: 'lead nationality: type', fill: '#bkv2-nat-input-lead', value: 'Germany' },
    { label: 'lead nationality: Enter', press: '#bkv2-nat-input-lead', key: 'Enter' },
    { label: 'guide: English', clickSel: "input[onchange*=\"ToggleGuide('english'\"]" },
    { label: 'hotel / pickup', fill: '#bkv2-hotel-input', value: 'UIP Test Hotel' },
  ];
}
export default {
  name: 'agent-booking',
  title: 'agent booking: create and confirm from the form',
  async prepare({ legacy, addDays, today }) {
    const date = addDays(today, 14);
    return { date, today, ...(await pickAgentRoute(legacy, date)) };
  },
  steps: (v) => [...formSteps(v, LEAD), { label: 'Confirm booking', clickFn: 'bkV2SubmitBooking' }],
  async data({ legacy, ops }) {
    const r = await bookingsByLead(legacy, ops, LEAD);
    return { legacy: r.legacy, new: r.new };
  },
};
