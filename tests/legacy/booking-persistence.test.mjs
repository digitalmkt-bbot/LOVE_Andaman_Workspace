// LAM-77 characterization: booking persistence.
//
// CLAUDE.md §2: "The single-file client keeps a working copy in localStorage
// loveandaman_v2 (LS_KEY) ... and syncs every change to Postgres through a
// REST API ... always read-modify-write (parse -> update only your keys ->
// write back); never clobber." and "A key that's persisted but never loaded
// = data vanishes on refresh (this bit sb_bookings historically)."
//
// This suite executes three REAL extracted pieces of allotment_v2.html:
//   A. save(area) — the generic routes/boats/trips read-modify-write + edit-guard.
//   B. the load-condition line for sb_bookings (`Array.isArray(d.sb_bookings)`).
//   C. the SB_BOOKINGS placement (replace-in-place vs unshift) + final
//      localStorage write inside bkV2CommitBooking.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, extractBetween, occurrences } from './lib/source.mjs';
import { runInSandbox, makeLocalStorage } from './lib/sandbox.mjs';

// ── A. save(area) ────────────────────────────────────────────────────────
const saveSrc = extractFunction('save');

describe('booking persistence — save(area): read-modify-write + per-area edit guard', () => {
  test('read-modify-write: writing routes/boats/trips preserves unrelated keys already in the blob (e.g. fleet_inventory, sb_bookings)', () => {
    const localStorage = makeLocalStorage({
      loveandaman_v2: JSON.stringify({ fleet_inventory: [{ id: 'inv1' }], sb_bookings: [{ id: 'bk1' }] }),
    });
    const { save } = runInSandbox(saveSrc, {
      localStorage, LS_KEY: 'loveandaman_v2', DATA_VERSION: 'test-v', ROUTES: ['r1'], BOATS: ['b1'], TRIPS: { '2026-09-01': {} },
      window: {}, console,
    }, ['save']);
    save(); // area omitted → internal call path, no edit-guard
    const written = JSON.parse(localStorage.getItem('loveandaman_v2'));
    assert.deepEqual(written.fleet_inventory, [{ id: 'inv1' }], 'fleet_inventory must survive untouched');
    assert.deepEqual(written.sb_bookings, [{ id: 'bk1' }], 'sb_bookings must survive untouched');
    assert.deepEqual(written.routes, ['r1']);
    assert.deepEqual(written.boats, ['b1']);
    assert.equal(written.version, 'test-v');
  });

  test('called with an area the user cannot edit (laCanEditArea returns false) → does NOT persist at all', () => {
    const localStorage = makeLocalStorage({ loveandaman_v2: JSON.stringify({ marker: 'untouched' }) });
    const { save } = runInSandbox(saveSrc, {
      localStorage, LS_KEY: 'loveandaman_v2', DATA_VERSION: 'v', ROUTES: [], BOATS: [], TRIPS: {},
      window: { laCanEditArea: () => false }, console,
    }, ['save']);
    save('operations');
    const written = JSON.parse(localStorage.getItem('loveandaman_v2'));
    assert.deepEqual(written, { marker: 'untouched' }, 'no write should happen when the guard denies the area');
  });

  test('called with no `area` argument (internal/seed/migration calls) is NEVER guarded — it always persists', () => {
    const localStorage = makeLocalStorage({ loveandaman_v2: '{}' });
    const { save } = runInSandbox(saveSrc, {
      localStorage, LS_KEY: 'loveandaman_v2', DATA_VERSION: 'v', ROUTES: ['seeded'], BOATS: [], TRIPS: {},
      window: { laCanEditArea: () => false }, console, // guard would deny any real area, but area is falsy here
    }, ['save']);
    save();
    const written = JSON.parse(localStorage.getItem('loveandaman_v2'));
    assert.deepEqual(written.routes, ['seeded'], 'save() with no area bypasses the edit-guard entirely (documented as intentional for seed/migration/load call sites)');
  });
});

// ── B. sb_bookings load condition ───────────────────────────────────────
const loadLine = 'if(Array.isArray(d.sb_bookings)) SB_BOOKINGS = d.sb_bookings;';

function loadSbBookings(blobJson) {
  const wrapped = `
    function load(localStorage, LS_KEY) {
      let SB_BOOKINGS = ['SEED_MARKER'];
      const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      ${loadLine}
      return SB_BOOKINGS;
    }
  `;
  const { load } = runInSandbox(wrapped, {}, ['load']);
  const localStorage = makeLocalStorage({ loveandaman_v2: blobJson });
  // Round-trip through JSON: the array is constructed in the vm's separate Realm, and
  // assert.deepStrictEqual checks prototype identity, so a same-content-different-Realm
  // array would otherwise spuriously fail.
  return JSON.parse(JSON.stringify(load(localStorage, 'loveandaman_v2')));
}

describe('booking persistence — sb_bookings load condition (Array.isArray guard)', () => {
  test('exactly one call site in allotment_v2.html uses this literal load-condition text for sb_bookings', () => {
    assert.equal(occurrences(loadLine), 1);
  });

  test('a deliberately-cleared list (empty array persisted) stays cleared — does NOT revert to the seed', () => {
    const result = loadSbBookings(JSON.stringify({ sb_bookings: [] }));
    assert.deepEqual(result, [], 'Array.isArray([]) is true, so an empty persisted array overwrites the seed with an empty list');
  });

  test('a populated array loads as-is', () => {
    const result = loadSbBookings(JSON.stringify({ sb_bookings: [{ id: 'bk1' }] }));
    assert.deepEqual(result, [{ id: 'bk1' }]);
  });

  test('a MISSING sb_bookings key leaves the seed value untouched (does not null it out)', () => {
    const result = loadSbBookings(JSON.stringify({ other: 1 }));
    assert.deepEqual(result, ['SEED_MARKER']);
  });

  test('a non-array sb_bookings value (e.g. null, from a corrupt blob) also leaves the seed untouched', () => {
    const result = loadSbBookings(JSON.stringify({ sb_bookings: null }));
    assert.deepEqual(result, ['SEED_MARKER']);
  });
});

// ── C. SB_BOOKINGS placement + final localStorage write (inside bkV2CommitBooking) ──
const persistBlock = extractBetween(
  'const idx = SB_BOOKINGS.findIndex(b => b.id === editing.id);',
  "  try {\n    const lsKey = (typeof LS_KEY !== 'undefined' ? LS_KEY : 'loveandaman_v2');\n    const raw = localStorage.getItem(lsKey) || '{}';\n    const obj = JSON.parse(raw);\n    obj.sb_bookings = SB_BOOKINGS;\n    if(tripsModified) obj.trips = TRIPS;\n    localStorage.setItem(lsKey, JSON.stringify(obj));\n  } catch(e){ console.warn('Save failed', e); }"
);
// The extracted text starts INSIDE the source's `if(editing){ ... }` (right after the
// opening brace) and is otherwise fully self-closed — see the source comment in this
// file's header for why. Re-supply that one opening brace so the block stands alone.
const persistSrc = `
  function commitPersist(editing, newBk, d, status, SB_BOOKINGS, TRIPS, localStorage, LS_KEY, bkV2PaxAllTot, natLearnRecord) {
    if(editing){${persistBlock}
    return { SB_BOOKINGS, TRIPS, localStorageDump: localStorage._dump() };
  }
`;

function runPersist({ editing, newBk, SB_BOOKINGS, d = {}, status = 'confirmed', TRIPS = {}, blob = '{}' }) {
  const { commitPersist } = runInSandbox(persistSrc, {}, ['commitPersist']);
  const localStorage = makeLocalStorage({ loveandaman_v2: blob });
  const bkV2PaxAllTot = () => 0;
  const natLearnRecord = () => {};
  const res = commitPersist(editing, newBk, d, status, SB_BOOKINGS, TRIPS, localStorage, 'loveandaman_v2', bkV2PaxAllTot, natLearnRecord);
  return {
    SB_BOOKINGS: JSON.parse(JSON.stringify(res.SB_BOOKINGS)),
    persistedBlob: JSON.parse(res.localStorageDump.loveandaman_v2),
  };
}

describe('booking persistence — SB_BOOKINGS placement on save (P3d: preserve list position on edit)', () => {
  test('editing an existing booking replaces it IN PLACE at its current index (list order/position preserved)', () => {
    const editing = { id: 'bk2' };
    const newBk = { id: 'bk2', total: 999, trips: [] };
    const SB_BOOKINGS = [{ id: 'bk1' }, { id: 'bk2' }, { id: 'bk3' }];
    const { SB_BOOKINGS: out } = runPersist({ editing, newBk, SB_BOOKINGS });
    assert.equal(out.length, 3);
    assert.equal(out[1].id, 'bk2');
    assert.equal(out[1].total, 999);
    assert.equal(out[0].id, 'bk1');
    assert.equal(out[2].id, 'bk3');
  });

  test('a brand-new booking (editing=null) is placed at the FRONT of the list (unshift), not appended', () => {
    const newBk = { id: 'bkNew', trips: [] };
    const SB_BOOKINGS = [{ id: 'bkOld1' }, { id: 'bkOld2' }];
    const { SB_BOOKINGS: out } = runPersist({ editing: null, newBk, SB_BOOKINGS });
    assert.equal(out.length, 3);
    assert.equal(out[0].id, 'bkNew', 'new bookings go to index 0, not the end of the list');
  });

  test('the write to localStorage is read-modify-write: an unrelated blob key survives the booking save', () => {
    const editing = null;
    const newBk = { id: 'bkNew', trips: [] };
    const { persistedBlob } = runPersist({
      editing, newBk, SB_BOOKINGS: [],
      blob: JSON.stringify({ sb_agents: [{ id: 'ag1' }] }),
    });
    assert.deepEqual(persistedBlob.sb_agents, [{ id: 'ag1' }], 'sb_agents (a different sub-key) must not be clobbered');
    assert.deepEqual(persistedBlob.sb_bookings.map(b => b.id), ['bkNew']);
  });

  test('trips (TRIPS) are only written to the blob when a charter trip actually touched them (tripsModified)', () => {
    const newBkNoCharter = { id: 'bkNew', trips: [{ routeId: 'r1', date: '2026-09-01', bookingMode: 'seat' }] };
    const r1 = runPersist({ editing: null, newBk: newBkNoCharter, SB_BOOKINGS: [], TRIPS: { existing: true } });
    assert.equal('trips' in r1.persistedBlob, false, 'a seat-mode-only save must not write trips to the blob at all');

    const newBkCharter = { id: 'bkChx', trips: [{ routeId: 'r1', date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boat1' }] };
    const r2 = runPersist({ editing: null, newBk: newBkCharter, SB_BOOKINGS: [], TRIPS: {}, status: 'confirmed' });
    assert.ok(r2.persistedBlob.trips, 'a charter booking must write TRIPS (it locks the boat there)');
    assert.equal(r2.persistedBlob.trips['2026-09-01'].boat1.charterBookingId, 'bkChx');
  });

  test('a status of "quote" never wires a charter booking into TRIPS, even though the trip is charter-mode', () => {
    const newBk = { id: 'bkQuote', trips: [{ routeId: 'r1', date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boat1' }] };
    const { persistedBlob } = runPersist({ editing: null, newBk, SB_BOOKINGS: [], TRIPS: {}, status: 'quote' });
    assert.equal('trips' in persistedBlob, false, 'a quote never reserves a boat in TRIPS — only a real save (non-quote status) does');
  });
});
