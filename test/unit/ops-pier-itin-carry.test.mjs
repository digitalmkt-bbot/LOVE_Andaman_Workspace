import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// §pjItinCarry check: a day that has not decided its own itinerary borrows the text AND the colour of the same boat's nearest earlier day on the same
// route (the server's itinerary {text, own, colour, from}); pjItinOf hands both to the card, and never a colour that is not #rrggbb.
const PRE = `
var _poDate = '2026-10-20';
function pjItinOf(){ return { t: 'legacy', own: false, c: '', from: '' }; }
function pjRaw(){ return null; }
`;
function rt(views) {
  const r = runtime({ files: [], pre: PRE });
  r.O.pier = { enabled: () => true, loaded: true, busy: () => false };
  r.O.pierJob = { state: { views } };
  r.load('85-ops-pier-w5.js');
  return r;
}

test('a borrowed itinerary carries its colour with its text and says which day it came from', () => {
  const r = rt({ '2026-10-20::b1': { itinerary_text: '', itinerary_colour: '', itinerary: { text: 'Koh Similan → Koh Bon', own: false, colour: '#C0392B', from: '2026-10-17' } } });
  assert.deepEqual(plain(r.ctx.pjItinOf('2026-10-20', 'b1', { id: 'r1' })), { t: 'Koh Similan → Koh Bon', own: false, c: '#C0392B', from: '2026-10-17' });
});

test('the day\'s own itinerary shows its own colour; a colour that is not #rrggbb is dropped; no answer = legacy\'s', () => {
  const r = rt({ '2026-10-20::b1': { itinerary_text: 'X', itinerary_colour: '#112233', itinerary: { text: 'X', own: true, colour: '#112233', from: null } },
    '2026-10-20::b2': { itinerary: { text: 'Y', own: true, colour: 'red', from: null } } });
  assert.deepEqual(plain(r.ctx.pjItinOf('2026-10-20', 'b1', {})), { t: 'X', own: true, c: '#112233', from: '' });
  assert.equal(r.ctx.pjItinOf('2026-10-20', 'b2', {}).c, '');
  assert.equal(r.ctx.pjItinOf('2026-10-20', 'b3', {}).t, 'legacy');
});
