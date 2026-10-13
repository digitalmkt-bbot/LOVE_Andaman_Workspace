// §splitOwn · By trip date · a split-off person who comes to the pier on their own sits in "Own transportation"
//
// Source (2026-10-13) · owner, screenshot of a Khao Lak group (agent ไกด์นาง กัญญารัตน์, lead RAKOWSKI SONJA):
//   "ดูที่เป็นไกด์นาง เป็นบุคกิ้งที่แยกกัน มันเป็นกรุ๊ปนึงที่ให้รถรับส่ง อีกคนเดินทางเอง
//    ตอนแสดงผล เดินทางเองควรอยู่ที่ Own Transportation และมีป้ายว่าเป็นบุคกิ้งเดียวกันไหม"
// Setup: two bookings in a van zone on one trip, each split (vanSplits) into a main row + one person coming on their own
//   A · auto split from altPickups with zone NoTransfer (the รับหลายจุด path)
//   B · manual split whose pickAreaId is a NoTransfer area (no pickZone)
// Display only · nothing in SB_BOOKINGS changes
// Checks
//   1 the self-arrive split rows are in the Own transportation zone, not in the booking's van zone
//   2 the main rows stay in the van zone
//   3 chips both sides: main row "🔗 +N มาเอง", self row "🔗 กลุ่มเดียวกัน · <zone> N" · same color
//   4 zone band counts: Own transportation +2 booking and +self pax · van zone pax minus the self pax
//   5 click a chip → scrolls to the other row and flashes it
//   6 an Own transportation zone appears even when that trip had none before
//   7 Boat Assign mode (no split rows) keeps the booking whole in its van zone
//   8 the day header "ยังไม่จัดรถ" no longer waits on a van for the self-arrive person
//   9 bookings unchanged · no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const SP = process.env.SHOT || '';
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);

const S = await page.evaluate(() => {
  const VZ = z => z && z !== 'NoTransfer' && z !== 'NT' && z !== '__CHARTER__';
  const cxl = ['cancelled', 'rejected', 'cancelled_weather'];
  // a trip (date+route) with ≥2 van-zone bookings of ≥2 pax and NO own-transport booking (for check 6)
  const by = {};
  SB_BOOKINGS.forEach(b => { if (cxl.includes(b.status) || b.pickupSelf) return; (b.trips || []).forEach(t => { if (!t.date || t.bookingMode === 'charter') return;
    const k = t.date + '|' + t.routeId; const z = bkV2EffZone(b, t) || 'NoTransfer'; (by[k] = by[k] || []).push({ b, t, z }); }); });
  let pick = null;
  Object.keys(by).forEach(k => { const L = by[k]; if (L.some(x => !VZ(x.z))) return;
    const ok = L.filter(x => VZ(x.z) && bkPaxSum(bkPaxOfTrip(x.t)) >= 2 && !(x.b.ops && (x.b.ops.vanSplits || x.b.ops.boatSplits)) && !(x.b.altPickups || []).length);
    if (ok.length >= 2 && (!pick || ok.length > pick.ok.length)) pick = { k, ok }; });
  if (!pick) return { err: 'no trip with 2 van-zone bookings and no own-transport booking' };
  const [date, rid] = pick.k.split('|');
  const A = pick.ok[0].b, B = pick.ok[1].b;
  let selfArea = (SB_PICKUP_AREAS || []).find(a => a.zone === 'NoTransfer' || a.zone === 'NT');
  if (!selfArea) { selfArea = { id: 'pa_zz_selfpier', name: 'Tub Lamu Pier (self-arrive)', zone: 'NoTransfer' }; SB_PICKUP_AREAS.push(selfArea); }
  // A · altPickups → auto split (rendered once above, now plant)
  // B · manual split · second row picks up at a NoTransfer area
  _bkV2.filterDate = date; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  const tb0 = [...document.querySelectorAll('#view-booking table.t2-mtbl')].find(t => t.querySelector('tr.t2-row[data-al="' + A.id + '"]'));
  const before = {}; if (tb0) tb0.querySelectorAll('tr.t2-zband').forEach(tr => { before[(tr.querySelector('.znm') || {}).textContent] = (tr.querySelector('.zsub') || {}).textContent.replace(/\s+/g, ' '); });
  const pB = bkPaxOfTrip(pick.ok[1].t); const nB = bkPaxSum(pB);
  A.altPickups = [{ who: 'Guide Zz Test', ad: 1, chd: 0, inf: 0, foc: 0, zone: 'NoTransfer', areaId: selfArea.id }];
  bkV2SyncAltPickupSplits(A);
  B.ops = B.ops || {};
  B.ops.vanSplits = [{ pax: nB - 1, ad: (pB.ad || 0) - 1, chd: pB.chd || 0, inf: pB.inf || 0, foc: pB.foc || 0, vanGroup: 0, vanId: null },
                     { pax: 1, ad: 1, chd: 0, inf: 0, foc: 0, vanGroup: 0, vanId: null, pickAreaId: selfArea.id }];
  window.__snap = JSON.stringify(SB_BOOKINGS);
  _bkV2.filterDate = date; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { before, date, rid, A: A.id, B: B.id, zA: pick.ok[0].z, zB: pick.ok[1].z, nA: bkPaxSum(bkPaxOfTrip(pick.ok[0].t)), nB, area: selfArea.name };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
ok(`setup ${S.date} ${S.rid} · A ${S.A} (${S.zA}, ${S.nA} pax) · B ${S.B} (${S.zB}, ${S.nB} pax) · self area "${S.area}"`);
await page.waitForTimeout(900);

const read = () => page.evaluate(S => {
  // walk the trip's table: remember the zone band above each row
  const out = { rows: [], bands: {} };
  document.querySelectorAll('#view-booking table.t2-mtbl').forEach(tb => {
    let zone = null; const mine = !!tb.querySelector('tr.t2-row[data-al^="' + S.A + '"]');
    tb.querySelectorAll('tr').forEach(tr => {
      if (tr.classList.contains('t2-zband')) { zone = (tr.querySelector('.znm') || {}).textContent; if (mine) out.bands[zone] = (tr.querySelector('.zsub') || {}).textContent.replace(/\s+/g, ' '); return; }
      if (!tr.classList.contains('t2-row')) return;
      const al = tr.getAttribute('data-al') || ''; const id = al.split('@')[0].split('#')[0];
      if (id !== S.A && id !== S.B) return;
      const ch = tr.querySelector('.t2-spl');
      out.rows.push({ al, zone, chip: ch ? ch.textContent.trim() : '', go: ch ? ch.getAttribute('data-spl') : '', col: ch ? getComputedStyle(ch).color : '' });
    });
  });
  return out;
}, S);
const zl = z => ({ PK: 'Phuket', KL: 'Khao Lak', RN: 'Ranong' })[z] || z;
const R1 = await read();
const own = R1.rows.filter(r => r.zone === 'Own transportation'), main = R1.rows.filter(r => r.zone !== 'Own transportation');
if (own.length === 2 && own.every(r => /@1$/.test(r.al))) ok('1 self-arrive rows in Own transportation · ' + own.map(r => r.al).join(', '));
else fail('1 ' + JSON.stringify(R1.rows));
if (main.length === 2 && main.every(r => /@0$/.test(r.al)) && main.some(r => r.zone === zl(S.zA)) && main.some(r => r.zone === zl(S.zB))) ok('2 main rows stay in ' + [...new Set(main.map(r => r.zone))].join(' / '));
else fail('2 ' + JSON.stringify(main));
const c3 = [S.A, S.B].map(id => { const m = main.find(r => r.al.startsWith(id)), o = own.find(r => r.al.startsWith(id)); return { m, o }; });
if (c3.every(({ m, o }) => m && o && /^🔗 \+1 มาเอง$/.test(m.chip) && /^🔗 กลุ่มเดียวกัน · (Khao Lak|Phuket|Ranong) \d+$/.test(o.chip) && m.go === o.al && o.go === m.al && m.col === o.col))
  ok('3 chips · ' + c3.map(({ m, o }) => `"${m.chip}" ↔ "${o.chip}"`).join(' · '));
else fail('3 ' + JSON.stringify(c3));
const bo = R1.bands['Own transportation'] || '';
if (!S.before['Own transportation'] && bo === '2 booking · 2 pax') ok('4/6 Own transportation band appears: "' + bo + '" (none before)'); else fail('4 ' + JSON.stringify({ before: S.before, after: R1.bands }));
const px = t => +(((t || '').match(/(\d+) pax/) || [])[1]), bn = t => +(((t || '').match(/(\d+) booking/) || [])[1]);
const vb = S.before[zl(S.zA)], va = R1.bands[zl(S.zA)];
if (px(va) === px(vb) - 2 && bn(va) === bn(vb)) ok(`4 ${zl(S.zA)} band ${vb} → ${va} (self-arrive people counted in Own transportation)`); else fail('4b ' + JSON.stringify({ vb, va }));
if (SP) for (const [k, f] of [['@0', 'splitown_main.png'], ['@1', 'splitown_own.png']]) {
  const tr = page.locator(`#view-booking tr.t2-row[data-al="${S.A}${k}"]`); await tr.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const b = await tr.boundingBox(); await page.screenshot({ path: SP + f, clip: { x: b.x, y: Math.max(0, b.y - (k === '@1' ? 120 : 30)), width: 1500, height: b.height + (k === '@1' ? 160 : 60) } }); }

const c5 = await page.evaluate(async S => {
  const ch = [...document.querySelectorAll('#view-booking .t2-spl')].find(c => c.closest('tr').getAttribute('data-al') === S.A + '@0');
  window.scrollTo(0, 0); ch.click(); await new Promise(z => setTimeout(z, 900));
  const tr = document.querySelector('#view-booking tr.t2-row[data-al="' + S.A + '@1"]'); const r = tr.getBoundingClientRect();
  return { flash: tr.classList.contains('t2-splfl'), inView: r.top >= 0 && r.bottom <= innerHeight };
}, S);
if (c5.flash && c5.inView) ok('5 chip click scrolls to the other row and flashes it'); else fail('5 ' + JSON.stringify(c5));

await page.evaluate(() => { bkV2ToggleBoatMode(); }); await page.waitForTimeout(700);
const R7 = await read();
if (R7.rows.length === 2 && R7.rows.every(r => r.zone !== 'Own transportation' && !r.chip)) ok('7 Boat Assign mode · one row per booking in its van zone, no chips');
else fail('7 ' + JSON.stringify(R7.rows));
await page.evaluate(() => { bkV2ToggleBoatMode(); });

const c9 = await page.evaluate(async S => {
  const n = () => { const b = [...document.querySelectorAll('#view-booking .t2-hd-warnchip')].find(x => /ยังไม่จัดรถ \(ขาไป\)/.test(x.title)); return b ? +((b.title.match(/(\d+) booking/) || [])[1]) : 0; };
  const A = SB_BOOKINGS.find(b => b.id === S.A), keep = A.ops.vanSplits[0].vanId;
  const set = async v => { A.ops.vanSplits[0].vanId = v; bkV2Render(); await new Promise(z => setTimeout(z, 300)); return n(); };
  const withVan = await set('v_zz_test'), noVan = await set(null);
  A.ops.vanSplits[0].vanId = keep; bkV2Render(); await new Promise(z => setTimeout(z, 300));
  return { withVan, noVan }; }, S);
if (c9.noVan === c9.withVan + 1) ok(`8 header "ยังไม่จัดรถ" · group without van ${c9.noVan} booking · group with van ${c9.withVan} (the self-arrive person never waits for a van)`); else fail('8 ' + JSON.stringify(c9));
const c8 = await page.evaluate(() => window.__snap === JSON.stringify(SB_BOOKINGS));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c8 && !e1.length) ok('9 bookings unchanged · no page errors'); else fail('9 ' + JSON.stringify({ c8, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
