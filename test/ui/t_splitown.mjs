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
//   3 §together · "👥 Together" on both rows of a booking · same color on both · the two bookings get different colors
//     the self row shows the name picked at booking time (altPickups[].who) instead of the lead · no +N button there
//   4 zone band counts: Own transportation +2 booking and +self pax · van zone pax minus the self pax
//   4b §togFloat · the tag floats across the top edge of the customer cell (like "⚠ รถกลับ") · not clipped, Classic and Compact
//   5 hover a chip → floating popup: one line per row (people, name, how, zone), "แถวนี้" on this row
//     click pins it · its "ไปที่แถว" button scrolls to the other row and flashes it · Esc closes
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
      const ch = tr.querySelector('.t2-tog'), cu = tr.querySelector('td.t2-cu');
      out.rows.push({ al, zone, chip: ch ? ch.textContent.trim() : '', col: ch ? getComputedStyle(ch).backgroundColor : '',
        lead: cu ? (cu.querySelector('.t2-lead') || {}).textContent : '', more: !!(cu && cu.querySelector('.t2-more, .t2-leadonly')) });
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
const leadA = await page.evaluate(id => SB_BOOKINGS.find(b => b.id === id).leadPax, S.A);
const [cA, cB] = c3;
if (c3.every(({ m, o }) => m && o && m.chip === '👥 Together' && o.chip === '👥 Together' && m.col === o.col) && cA.m.col !== cB.m.col
    && cA.o.lead === 'Guide Zz Test' && !cA.o.more && cA.m.lead === leadA && cB.o.lead === cB.m.lead)
  ok(`3 Together on both rows · A ${cA.m.col} · B ${cB.m.col} · A's self row shows "${cA.o.lead}" (lead ${leadA}) · B (no name picked) keeps the lead`);
else fail('3 ' + JSON.stringify(c3));
const bo = R1.bands['Own transportation'] || '';
if (!S.before['Own transportation'] && bo === '2 booking · 2 pax') ok('4/6 Own transportation band appears: "' + bo + '" (none before)'); else fail('4 ' + JSON.stringify({ before: S.before, after: R1.bands }));
const px = t => +(((t || '').match(/(\d+) pax/) || [])[1]), bn = t => +(((t || '').match(/(\d+) booking/) || [])[1]);
const vb = S.before[zl(S.zA)], va = R1.bands[zl(S.zA)];
if (px(va) === px(vb) - 2 && bn(va) === bn(vb)) ok(`4 ${zl(S.zA)} band ${vb} → ${va} (self-arrive people counted in Own transportation)`); else fail('4b ' + JSON.stringify({ vb, va }));
if (SP) for (const [k, f] of [['@0', 'splitown_main.png'], ['@1', 'splitown_own.png']]) {
  const tr = page.locator(`#view-booking tr.t2-row[data-al="${S.A}${k}"]`); await tr.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const b = await tr.boundingBox(); await page.screenshot({ path: SP + f, clip: { x: b.x, y: Math.max(0, b.y - (k === '@1' ? 120 : 30)), width: 1500, height: b.height + (k === '@1' ? 160 : 60) } }); }

const fl = async () => page.evaluate(S => [S.A + '@0', S.A + '@1'].map(k => { const tr = document.querySelector('#view-booking tr.t2-row[data-al="' + k + '"]');
  tr.scrollIntoView({ block: 'center' }); const t = tr.querySelector('.t2-tog'), r = t.getBoundingClientRect(), rr = tr.getBoundingClientRect(), cu = tr.querySelector('td.t2-cu').getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 3);
  return { above: Math.round(rr.top - r.top), inCell: r.left >= cu.left && r.right <= cu.right, onTop: !!(hit && (hit === t || t.contains(hit))), pos: getComputedStyle(t).position }; }), S);
const f1 = await fl(); await page.evaluate(async () => { btcSet('compact'); await new Promise(z => setTimeout(z, 700)); }); const f2 = await fl();
await page.evaluate(async () => { btcSet('classic'); await new Promise(z => setTimeout(z, 700)); });
if ([...f1, ...f2].every(f => f.pos === 'absolute' && f.above >= 5 && f.inCell && f.onTop)) ok(`4b tag floats ${f1[0].above}px above the row edge, inside the customer column, on top · Classic and Compact`);
else fail('4b ' + JSON.stringify({ classic: f1, compact: f2 }));
const c5 = await page.evaluate(async S => {
  const ch = document.querySelector('#view-booking tr.t2-row[data-al="' + S.A + '@0"] .t2-tog');
  ch.scrollIntoView({ block: 'center' }); await new Promise(z => setTimeout(z, 150));
  ch.dispatchEvent(new MouseEvent('mouseenter')); await new Promise(z => setTimeout(z, 100));
  const pop = document.getElementById('t2-tog-pop'), vis = () => pop && getComputedStyle(pop).display === 'block';
  const lines = [...pop.querySelectorAll('.tg-li')].map(l => ({ t: l.querySelector('.tg-tx').textContent.replace(/\s+/g, ' ').trim(), here: l.classList.contains('here'), go: !!l.querySelector('.tg-go') }));
  const hover = vis(), head = pop.querySelector('.tg-hd').textContent;
  ch.dispatchEvent(new MouseEvent('mouseleave')); await new Promise(z => setTimeout(z, 300)); const gone = !vis();
  ch.click(); await new Promise(z => setTimeout(z, 50)); ch.dispatchEvent(new MouseEvent('mouseleave')); await new Promise(z => setTimeout(z, 300)); const pinned = vis();
  pop.querySelector('.tg-go').click(); await new Promise(z => setTimeout(z, 900));
  const tr = document.querySelector('#view-booking tr.t2-row[data-al="' + S.A + '@1"]'); const r = tr.getBoundingClientRect();
  const flash = tr.classList.contains('t2-splfl'), inView = r.top >= 0 && r.bottom <= innerHeight, closedAfterGo = !vis();
  const c2 = tr.querySelector('.t2-tog'); c2.click(); await new Promise(z => setTimeout(z, 50)); const re = vis();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); const esc = !vis();
  return { hover, head, lines, gone, pinned, flash, inView, closedAfterGo, re, esc };
}, S);
if (c5.hover && c5.lines.length === 2 && c5.lines[0].here && !c5.lines[0].go && !c5.lines[1].here && c5.lines[1].go && /Guide Zz Test/.test(c5.lines[1].t) && /มาเองที่ท่า/.test(c5.lines[1].t)
    && c5.gone && c5.pinned && c5.flash && c5.inView && c5.closedAfterGo && c5.re && c5.esc)
  ok(`5 popup "${c5.head.trim()}" · ${c5.lines.map(l => '[' + l.t + ']').join(' ')} · hover/pin/go/Esc all work`);
else fail('5 ' + JSON.stringify(c5));
if (SP) { const t = page.locator(`#view-booking tr.t2-row[data-al="${S.A}@1"] .t2-tog`); await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(200);
  const b = await page.locator(`#view-booking tr.t2-row[data-al="${S.A}@1"]`).boundingBox(), p = await page.locator('#t2-tog-pop').boundingBox();
  const y0 = Math.max(0, Math.min(b.y, p.y) - 70), y1 = Math.max(b.y + b.height, p.y + p.height) + 10;
  await page.screenshot({ path: SP + 'together_pop.png', clip: { x: 0, y: y0, width: 1500, height: y1 - y0 } });
  await page.keyboard.press('Escape'); }

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
