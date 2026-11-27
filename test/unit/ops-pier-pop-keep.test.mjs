// Parity poj-tublamu "pjPopToggle › <colour>" (run 2026-11-27T22-38-28, round 13): legacy draws the boat job sheet only when the
// person does something, so the wristband popup they have open stays open after a colour pick. The new side also draws it when a
// server answer lands (the save, the licence checks), which closed it. A redraw outside a person's action keeps the open popups.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/42-ops-pier-core.js', 'utf8');

function page() {
  // a tiny DOM: the job sheet's popups, by id; legacy's renderPierJob draws them all closed again
  let els = new Map();
  const el = (id) => { const cls = new Set(['pj-pop']); return { id, classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, fits: 0 }; };
  const draw = () => { els = new Map(['pjwb-b6', 'pjwb-b11', 'pjrt-b6'].map((id) => [id, el(id)])); };
  draw();
  const document = {
    getElementById: (id) => els.get(id) || null,
    querySelectorAll: (sel) => (sel === '.pj-pop.on[id]' ? [...els.values()].filter((e) => e.classList.contains('on')) : []),
    activeElement: null,
  };
  const win = {
    laOps: { enabled: () => true, get: () => new Promise(() => {}) },   // the pier read never lands here
    renderPierJob: () => { win.drawn++; draw(); }, drawn: 0, pjPopFit: (e) => { e.fits++; }, event: undefined,
  };
  vm.runInNewContext(SOURCE, { window: win, document, console, JSON, Array, Object, Promise, setTimeout, clearTimeout, Date, String });
  const on = (id) => document.getElementById(id).classList.contains('on');
  return { win, document, on };
}

test('a redraw when a server answer lands keeps the popup that was open; the others stay closed', () => {
  const { win, document, on } = page();
  document.getElementById('pjwb-b6').classList.add('on');
  win.renderPierJob();
  assert.equal(win.drawn, 1, 'the sheet was drawn again');
  assert.equal(on('pjwb-b6'), true, 'the wristband popup is still open');
  assert.equal(document.getElementById('pjwb-b6').fits, 1, 'and fitted in its card (legacy pjPopFit)');
  assert.equal(on('pjwb-b11'), false);
  assert.equal(on('pjrt-b6'), false);
});

test('a redraw inside a click draws as legacy does: every popup closed', () => {
  const { win, document, on } = page();
  document.getElementById('pjwb-b6').classList.add('on');
  win.event = { type: 'click' };
  win.renderPierJob();
  assert.equal(on('pjwb-b6'), false);
});

test('nothing open, nothing opened', () => {
  const { win, document } = page();
  win.renderPierJob();
  assert.equal(document.querySelectorAll('.pj-pop.on[id]').length, 0);
});
