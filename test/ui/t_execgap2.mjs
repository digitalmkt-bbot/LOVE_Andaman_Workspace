// §execGap2 / §execAlloc2 / §execSalesTgt · Executive Board › Gap to Target (วาดใหม่) · หน้าต่างกำหนดสัดส่วน · แท็บ "เป้าเซลส์"
//
// ที่มา (2026-10-18/19) · owner "ปรับต่อในส่วนของ Gap to target · เส้นทาง × วัน ขอให้ขึ้นแบบไม่ต้องมี Scroll
//   · ช่องว่างแบ่งให้เซลส์ แล้วเซลส์จะรู้ได้ยังไงว่าต้องหาเส้นทางไหนบ้าง · ทำแยกเป็นอีกอันต่อจาก Gap to target
//   ซึ่งผู้บริหารก็จะได้เห็นการเคลื่อนไหวรายวันด้วย · ทำทั้งหมดเลย"
// ข้อมูลทดสอบ: วางเรือ 2 โปรแกรม 21 วัน · ใบจองที่เข้าระบบวันนี้/ย้อน 7 วัน ผูกเซลส์ 3 คน (soldBy)
//
// กัน
//   1 Gap: ประโยคเดียว "ต้องหาอีก N" = Σ max(0, เป้าเที่ยว − จองแล้ว) 14 วัน · ตาราง 14 คอลัมน์ไม่มี scroll · ช่องตรง getAllotment · ช่องเป็นปุ่ม (กดไปเที่ยว)
//   2 แถวเซลส์บรรทัดเดียว · กดกาง เห็นเส้นทางที่ต้องหา + วันที่ว่าง · กดอีกทีหุบ · ป้าย "วันนี้ +N" ตรงใบที่เข้าวันนี้ของเซลส์คนนั้น
//   3 หน้าต่างกำหนดสัดส่วน: เปิดเป็น modal · "เกลี่ยให้ครบ 100" ทำให้ทุกเส้นทางรวม 100 · บันทึก → ปิด · หัวข้อเปลี่ยนเป็น "ผู้บริหารกำหนด" · กลับไปค่าคำนวณ
//   4 แท็บ "เป้าเซลส์": ทั้งทีมได้วันนี้ = Σ pax ของใบที่เข้าวันนี้ (เดินทางในเดือน) · กราฟ 14 แท่ง · การ์ดเฉพาะเซลส์ที่มีเป้า · เรียงคนตามหลังมากสุดก่อน
//   5 การ์ด: ตาราง เส้นทาง/ขาด/ต้องได้ต่อวัน/วันนี้ · ปุ่มวันว่างพาไปเที่ยว · "คัดลอกสรุปส่งไลน์" ได้ข้อความมีชื่อเซลส์ + เส้นทาง · ขึ้น "คัดลอกแล้ว"
//   6 "เฉพาะฉัน": บัญชีที่ผูกเซลส์เห็นการ์ดตัวเองใบเดียว · บัญชีที่ไม่ผูกเห็นข้อความบอกให้ตั้ง · "เดือนหน้า" เปลี่ยนป้ายเดือน
//   7 กรองท่า (pier) ตัดเส้นทางอีกท่าออกจากตาราง · ใช้ดูอย่างเดียว: SB_BOOKINGS ไม่เปลี่ยน · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
await page.waitForTimeout(500);
const S = await page.evaluate(() => {
  const ymd = d => bkV2LocalYMD(d), T = new Date(), t0 = ymd(T);
  const add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return ymd(d); };
  const bT = (BOATS || []).find(x => x && x.id && x.pier === 'tublamu'), bP = (BOATS || []).find(x => x && x.id && x.pier === 'panwa');
  const rT = (ROUTES || []).find(r => r && r.pier === 'tublamu' && r.id !== 'r10' && r.id !== 'r12').id;
  const plan = [['r10', bP.id], [rT, bT.id]];   /* คนละท่า (ท่าของเส้นทาง) · ไว้ทดสอบกรองท่า */
  for (let d = 0; d <= 20; d++) { const ds = add(d); TRIPS[ds] = TRIPS[ds] || {}; plan.forEach(([rid, bid]) => { TRIPS[ds][bid] = { route: rid, type: 'normal', booked: 0 }; }); }
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && !laIsInternalFree(b));
  let n = 0; const sids = ['s01', 's02', 's03'];
  const mk = (travel, rid, madeOff, hour, paxN, sid) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZGP' + n;
    b.trips[0].date = travel; b.trips[0].routeId = rid; b.trips[0].pax = { ad: paxN, chd: 0, inf: 0, foc: 0 }; b.trips[0].lockUse = 0; delete b.trips[0].seatSource; delete b.trips[0].upg;
    const md = new Date(T); md.setDate(md.getDate() + madeOff); if (madeOff === 0) hour = Math.min(hour, T.getHours()); md.setHours(hour, madeOff === 0 && hour === T.getHours() ? Math.max(0, T.getMinutes() - 2) : 15, 0, 0);
    b.history = [{ at: md.toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.bookingDate = ymd(md); b.createdAt = ymd(md); b.ops = {}; b.status = 'confirmed'; b.soldBy = sid; delete b.cancelledAt; delete b.cancellation; SB_BOOKINGS.push(b); return b; };
  for (let k = 7; k >= 1; k--) sids.forEach((sid, i) => mk(add(3 + (k % 5)), k % 2 ? 'r10' : rT, -k, 10 + i, 2 + i, sid));
  const ly = (() => { const d = new Date(T); d.setFullYear(d.getFullYear() - 1); d.setDate(15); return ymd(d); })();   /* ปีก่อนเดือนเดียวกัน → สัดส่วนคำนวณมีทั้ง 3 คนทั้ง 2 เส้นทาง */
  sids.forEach((sid, i) => { mk(ly, 'r10', -370, 10, 20 + i * 10, sid); mk(ly, rT, -370, 11, 30 - i * 5, sid); });
  mk(add(2), 'r10', 0, 9, 4, 's01'); mk(add(5), rT, 0, 10, 3, 's01'); mk(add(4), 'r10', 0, 11, 2, 's02');   /* วันนี้ · s01 = 7 · s02 = 2 · s03 = 0 */
  try { if (typeof ckBksOnReset === 'function') ckBksOnReset(); } catch (_) {}
  localStorage.removeItem('exec_alloc'); try { const B = laBlob(); delete B.exec_alloc; } catch (_) {}
  Object.assign(window._eb, { per: 'today', pier: '', tab: 'gap', sp: 'week', off: 0, gp: 'h', mvd: '', gx: '', stm: 'this', me: '', allocEdit: false });
  const seen = {}; const monthOf = ds => ds.slice(0, 7);
  return { t0, tm: add(1), todayPax: { s01: 7, s02: 2, s03: 0 }, ymThis: monthOf(t0), monthEnd: ymd(new Date(T.getFullYear(), T.getMonth() + 1, 0)) };
});
await goView(page, 'execboard', 1200);
await page.evaluate(() => { ebSetNow('tab', 'gap'); ebSetNow('gp', 'h'); });
await page.waitForTimeout(300);

/* ══ 1 · Gap · ประโยคเดียว + ตารางไม่เลื่อน ═══════════════════════════ */
const R1 = await page.evaluate((S) => {
  const w = document.getElementById('eb-wrap');
  const next = ds => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + 1); return bkV2LocalYMD(d); };
  let hG = 0; for (let ds = S.t0, k = 0; k < 14; ds = next(ds), k++) { const seen = {}; Object.keys(TRIPS[ds] || {}).forEach(b => { const r = TRIPS[ds][b].route; if (seen[r]) return; seen[r] = 1; const al = getAllotment(r, ds); if (al && al.hasAllotment) hG += Math.max(0, Math.round(al.availableCapacity * 0.9) - al.seatsConsumed); }); }
  const big = +((w.querySelector('.eg-hl .big .n') || {}).textContent || '').replace(/[^\d]/g, '');
  const grid = w.querySelector('.eg-grid');
  const noScroll = !!grid && grid.scrollWidth <= grid.clientWidth + 2 && w.scrollWidth <= w.clientWidth + 2;
  const dayHeads = w.querySelectorAll('.eg-dh:not(.r)').length;
  const rows = [...w.querySelectorAll('.eg-rn b')].map(b => b.textContent);
  const cells = [...w.querySelectorAll('button.eg-c:not(.off)')];
  const c0 = cells[0]; const m = c0 && /ebGoTrip\('([^']+)','([^']+)'\)/.exec(c0.getAttribute('onclick') || '');
  let cellOk = false; if (m) { const al = getAllotment(m[2], m[1]); const f = c0.querySelector('b').textContent; cellOk = (f === 'เต็ม' ? 0 : +f.replace(/,/g, '')) === Math.max(0, al.seatsAvailable); }
  const tiles = w.querySelectorAll('.eg-tiles > div').length;
  return { big, hG, noScroll, dayHeads, rows, nCells: cells.length, cellOk, isBtn: !!c0 && c0.tagName === 'BUTTON', tiles, err: /Render error/.test(w.textContent) };
}, S);
if (R1.big === R1.hG && R1.noScroll && R1.dayHeads === 14 && R1.rows.length === 2 && R1.cellOk && R1.isBtn && R1.tiles >= 3 && !R1.err)
  ok('1 Gap · "ต้องหาอีก ' + R1.big + '" = Σ max(0, เป้าเที่ยว − จองแล้ว) 14 วัน · ตาราง 14 คอลัมน์ไม่มี scroll · ' + R1.rows.length + ' เส้นทาง · ช่องเป็นปุ่ม ' + R1.nCells + ' ช่อง · ที่ว่างตรง getAllotment · ' + R1.tiles + ' การ์ดตัวเลข');
else fail('1 ' + JSON.stringify(R1));

/* ══ 2 · แถวเซลส์ กาง/หุบ · วันนี้ +N ══════════════════════════════════ */
const R2 = await page.evaluate(async (S) => {
  const w = document.getElementById('eb-wrap');
  const rows = [...w.querySelectorAll('.eg-sr')].map(r => ({ sid: r.dataset.sid, td: (r.querySelector('.td') || {}).textContent || '' }));
  const r1 = rows.find(r => r.sid === 's01'), r3 = rows.find(r => r.sid === 's03');
  const before = w.querySelectorAll('.eg-sx').length;
  w.querySelector('.eg-sr[data-sid="s01"] button.nm').click(); await new Promise(r => setTimeout(r, 120));
  const w2 = document.getElementById('eb-wrap'); const row = w2.querySelector('.eg-sr[data-sid="s01"]'); const sx = row && row.nextElementSibling && row.nextElementSibling.classList.contains('eg-sx') ? row.nextElementSibling : null;
  const famRows = sx ? [...sx.querySelectorAll(':scope > .r')].map(r => ({ f: r.querySelector('.f').textContent, od: r.querySelectorAll('.od button').length })) : [];
  const open = w2.querySelectorAll('.eg-sx').length;
  w2.querySelector('.eg-sr[data-sid="s01"] button.nm').click(); await new Promise(r => setTimeout(r, 120));
  const after = document.getElementById('eb-wrap').querySelectorAll('.eg-sx').length;
  return { n: rows.length, r1, r3, before, open, famRows, after, gx: window._eb.gx };
}, S);
if (R2.n >= 3 && R2.r1 && /\+7/.test(R2.r1.td) && R2.r3 && /\+0/.test(R2.r3.td) && R2.before === 0 && R2.open === 1 && R2.famRows.length === 2 && R2.famRows.every(f => f.od > 0) && R2.after === 0 && R2.gx === '')
  ok('2 แถวเซลส์ ' + R2.n + ' แถว · s01 "' + R2.r1.td.trim() + '" · s03 "' + R2.r3.td.trim() + '" · กดกางเห็น ' + R2.famRows.length + ' เส้นทาง + ปุ่มวันว่าง · กดอีกทีหุบ');
else fail('2 ' + JSON.stringify(R2));

/* ══ 3 · หน้าต่างกำหนดสัดส่วน ═════════════════════════════════════════ */
const R3 = await page.evaluate((S) => {
  const w = document.getElementById('eb-wrap');
  const h0 = [...w.querySelectorAll('h2')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  ebAllocEdit(true);
  const ov = document.getElementById('eb-alloc-ov'), box = document.getElementById('eb-alloc');
  if (!ov || !box || !ov.contains(box)) return { noBox: true };
  const modal = getComputedStyle(ov).position === 'fixed';
  const inputs = [...box.querySelectorAll('input[data-f][data-s]')]; const fams = [...new Set(inputs.map(i => i.dataset.f))];
  inputs.forEach(i => { i.value = i.dataset.s === 's01' ? 30 : (i.dataset.s === 's02' ? 10 : 0); });
  ebAllocFill();
  const sums = fams.map(f => inputs.filter(i => i.dataset.f === f).reduce((s, i) => s + (+i.value || 0), 0));
  const totTxt = fams.map(f => (box.querySelector('[data-totst="' + f + '"]') || {}).textContent || '');
  const s01 = inputs.filter(i => i.dataset.s === 's01').map(i => +i.value), s02 = inputs.filter(i => i.dataset.s === 's02').map(i => +i.value);
  ebAllocSave(S.ymThis);
  const closed = !document.getElementById('eb-alloc-ov');
  const stored = JSON.parse(laBlob().exec_alloc || '{}')[S.ymThis];
  const h1 = [...document.getElementById('eb-wrap').querySelectorAll('h2')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  const rows1 = [...document.getElementById('eb-wrap').querySelectorAll('.eg-sr')].map(r => r.dataset.sid + ':' + (/\/ ([\d,]+)/.exec(r.querySelector('.pb b').textContent) || [])[1]);
  window.confirm = () => true; ebAllocReset(S.ymThis);
  const h2 = [...document.getElementById('eb-wrap').querySelectorAll('h2')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  return { modal, fams: fams.length, sums, totTxt, s01, s02, closed, stored: !!stored && stored.by[fams[0]].s01 === 75 && stored.by[fams[0]].s02 === 25, h0: /ตามสัดส่วนที่ขายได้/.test(h0), h1: /ผู้บริหารกำหนด/.test(h1), rows1, h2: /ตามสัดส่วนที่ขายได้/.test(h2), reset: !JSON.parse(laBlob().exec_alloc || '{}')[S.ymThis] };
}, S);
if (!R3.noBox && R3.modal && R3.fams === 2 && R3.sums.every(x => x === 100) && R3.totTxt.every(t => /ครบ/.test(t)) && R3.s01.every(v => v === 75) && R3.s02.every(v => v === 25) && R3.closed && R3.stored && R3.h0 && R3.h1 && R3.rows1.some(x => /^s01:[1-9]/.test(x)) && R3.rows1.some(x => /^s02:[1-9]/.test(x)) && R3.rows1.some(x => x === 's03:0') && R3.h2 && R3.reset)
  ok('3 หน้าต่างกำหนดสัดส่วนเป็น modal · 30/10 → "เกลี่ยให้ครบ 100" = 75/25 ทั้ง ' + R3.fams + ' เส้นทาง · รวม "ครบ" · บันทึกแล้วปิด · หัวข้อ "ผู้บริหารกำหนด" · s03 ที่ไม่ได้สัดส่วนเป้าเป็น 0 · กลับไปค่าคำนวณได้');
else fail('3 ' + JSON.stringify(R3));

/* ══ 4 · แท็บ เป้าเซลส์ · ทีม + กราฟ + การ์ด ══════════════════════════ */
await page.evaluate(() => { ebSetNow('tab', 'tgt'); });
await page.waitForTimeout(300);
const R4 = await page.evaluate((S) => {
  const w = document.getElementById('eb-wrap');
  const on = (w.querySelector('.eb-seg button.on') || {}).textContent;
  const big = +((w.querySelector('.eg-head.st .big .n') || {}).textContent || '').replace(/[^\d]/g, '');
  let exp = 0; SB_BOOKINGS.forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather', 'quote', 'draft'].includes(b.status) || laIsInternalFree(b)) return; if (_dashBkDay(b) !== S.t0) return; (b.trips || []).forEach(t => { if (t.date >= S.t0 && t.date <= S.monthEnd) exp += bkV2PaxAllTot(t.pax || {}); }); });
  const bars = w.querySelectorAll('.st-chart .bars > div').length, todayBar = +((w.querySelector('.st-chart .bars > div.td b') || {}).textContent || '').replace(/,/g, '');
  const cards = [...w.querySelectorAll('.st-card')].map(c => ({ sid: c.dataset.sid, h: c.querySelector('.st-h .eb-mut').textContent, chip: (c.querySelector('.st-h .eb-st') || {}).textContent || '', rows: c.querySelectorAll('.eg-sx-r').length, od: c.querySelectorAll('.eg-sx-r .od button').length, d7: c.querySelectorAll('.st-d7 i').length }));
  const ratio = cards.map(c => { const m = /([\d,]+) \/ ([\d,]+)/.exec(c.h); return m ? 1 - (+m[1].replace(/,/g, '')) / Math.max(1, +m[2].replace(/,/g, '')) : -1; });
  const sorted = ratio.every((r, i) => i === 0 || r <= ratio[i - 1] + 0.01);   /* หัวการ์ดปัดเป็นจำนวนเต็ม · เรียงด้วยค่าจริง */
  const sub = (w.querySelector('.eb-sub') || {}).textContent || '';
  return { on, big, exp, bars, todayBar, cards, sorted, hasMonth: /ต.ค.|พ.ย.|ธ.ค.|ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ตุลาคม|พฤศจิกายน|ธันวาคม|มกราคม/.test(cards.map(c => c.h).join(' ')), err: /Render error/.test(w.textContent) };
}, S);
if (R4.on === 'เป้าเซลส์' && R4.big === R4.exp && R4.exp >= 9 && R4.bars === 14 && R4.todayBar === R4.exp && R4.cards.length >= 3 && R4.sorted && R4.cards.every(c => c.rows >= 1 && c.d7 === 7 && /วันนี้ \+\d+ \/ \d+/.test(c.chip)) && R4.cards.some(c => c.od > 0) && !R4.err)
  ok('4 แท็บเป้าเซลส์ · ทั้งทีมได้ ' + R4.big + ' = Σ ใบที่เข้าวันนี้ · กราฟ 14 แท่ง (วันนี้ ' + R4.todayBar + ') · ' + R4.cards.length + ' การ์ด เรียงคนตามหลังมากสุดก่อน · ทุกใบมีตารางเส้นทาง + จุด 7 วัน + ชิป "วันนี้ +N / เป้า"');
else fail('4 ' + JSON.stringify(R4));

/* ══ 5 · การ์ด s01 · วันว่างพาไปเที่ยว · คัดลอกสรุป ════════════════════ */
const R5 = await page.evaluate(async (S) => {
  const w = document.getElementById('eb-wrap');
  const c = w.querySelector('.st-card[data-sid="s01"]'); if (!c) return { noCard: true };
  const chip = c.querySelector('.st-h .eb-st').textContent;
  const btn = c.querySelector('button[data-copy]'); const txt = btn.getAttribute('data-copy');
  const fams = [...c.querySelectorAll('.eg-sx-r .f')].map(x => x.textContent.replace(/\s*ตามหลัง$/, '').trim());
  const copyHasFams = fams.every(f => txt.includes(f));
  let clip = ''; const oc = navigator.clipboard; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { clip = t; return Promise.resolve(); } }, configurable: true }); } catch (_) {}
  btn.click(); await new Promise(r => setTimeout(r, 80));
  const toast = document.getElementById('eb-toast'); const toastOn = !!toast && toast.style.display !== 'none' && /คัดลอกแล้ว/.test(toast.textContent);
  const od = c.querySelector('.eg-sx-r .od button'); const m = od && /ebGoTrip\('([^']+)','([^']+)'\)/.exec(od.getAttribute('onclick') || '');
  const before = JSON.stringify(SB_BOOKINGS); if (od) od.click(); await new Promise(r => setTimeout(r, 300));
  const went = !!m && (location.hash || '').indexOf('execboard') < 0 || !document.getElementById('eb-wrap') || !!document.querySelector('.bt-day, #bt-wrap, .bk-trip, #view-bytrip');
  const same = JSON.stringify(SB_BOOKINGS) === before;
  return { chip, hasName: /IRIS/.test(txt), lines: txt.split('\n').length, copyHasFams, clip: clip === txt, toastOn, odDs: m && m[1], went, same };
}, S);
if (!R5.noCard && /วันนี้ \+7/.test(R5.chip) && R5.hasName && R5.lines >= 3 && R5.copyHasFams && R5.clip && R5.toastOn && R5.odDs && R5.same)
  ok('5 การ์ด IRIS · ชิป "' + R5.chip + '" · คัดลอกสรุป ' + R5.lines + ' บรรทัด มีชื่อ + ทุกเส้นทาง · ขึ้น "คัดลอกแล้ว" · ปุ่มวันว่าง ' + R5.odDs + ' กดได้ · ไม่แก้ข้อมูล');
else fail('5 ' + JSON.stringify(R5));

/* ══ 6 · เฉพาะฉัน · เดือนหน้า ═════════════════════════════════════════ */
await goView(page, 'execboard', 800);
const R6 = await page.evaluate((S) => {
  ebSetNow('tab', 'tgt'); ebSetNow('stm', 'this');
  const me0 = window.LA_ME; window.LA_ME = { email: 'sales.global@loveandaman.com' };
  ebSetNow('me', '1');
  let w = document.getElementById('eb-wrap');
  const mine = [...w.querySelectorAll('.st-card')].map(c => c.dataset.sid);
  window.LA_ME = { email: 'nobody@example.com' }; ebSetNow('me', '1'); w = document.getElementById('eb-wrap');
  const noLink = /ยังไม่ได้ผูกกับเซลส์/.test(w.textContent) && w.querySelectorAll('.st-card').length === 0;
  window.LA_ME = me0; ebSetNow('me', '');
  w = document.getElementById('eb-wrap'); const all = w.querySelectorAll('.st-card').length;
  const lbl0 = w.querySelector('.st-card .st-h .eb-mut').textContent;
  ebSetNow('stm', 'next'); w = document.getElementById('eb-wrap');
  const lblNext = (w.querySelector('.st-card .st-h .eb-mut') || w.querySelector('.eb-none') || {}).textContent || '';
  const T = new Date(S.t0 + 'T12:00:00'); const nx = new Date(T.getFullYear(), T.getMonth() + 1, 1); const nm = MONTHS_TH[nx.getMonth()] + ' ' + (nx.getFullYear() + 543);
  ebSetNow('stm', 'this');
  return { mine, noLink, all, lbl0: lbl0.slice(0, 30), lblNext: lblNext.slice(0, 40), nm, nextOk: lblNext.includes(nm), err: /Render error/.test(w.textContent) };
}, S);
if (R6.mine.length === 1 && R6.mine[0] === 's01' && R6.noLink && R6.all >= 3 && R6.nextOk && !R6.err)
  ok('6 "เฉพาะฉัน" บัญชี IRIS เห็นการ์ดตัวเองใบเดียว · บัญชีที่ไม่ผูกเซลส์ขึ้นข้อความบอกให้ตั้ง · ทุกคน ' + R6.all + ' ใบ · "เดือนหน้า" ป้าย ' + R6.nm);
else fail('6 ' + JSON.stringify(R6));

/* ══ 7 · กรองท่า · ดูอย่างเดียว ═══════════════════════════════════════ */
const R7 = await page.evaluate((S) => {
  const before = JSON.stringify(SB_BOOKINGS), ls = localStorage.getItem('exec_alloc');
  ebSetNow('tab', 'gap'); ebSetNow('pier', 'tublamu');
  let w = document.getElementById('eb-wrap'); const rowsT = [...w.querySelectorAll('.eg-rn b')].map(b => b.textContent);
  ebSetNow('pier', 'panwa'); w = document.getElementById('eb-wrap'); const rowsP = [...w.querySelectorAll('.eg-rn b')].map(b => b.textContent);
  ebSetNow('pier', ''); w = document.getElementById('eb-wrap'); const rowsA = [...w.querySelectorAll('.eg-rn b')].map(b => b.textContent);
  ebSetNow('tab', 'tgt'); ebSetNow('tab', 'move'); ebSetNow('tab', 'rev');
  return { rowsT, rowsP, rowsA, same: before === JSON.stringify(SB_BOOKINGS) && ls === localStorage.getItem('exec_alloc'), err: /Render error/.test(document.getElementById('eb-wrap').textContent) };
}, S);
if (R7.rowsA.length === 2 && R7.rowsT.length + R7.rowsP.length === 2 && R7.rowsT.length === 1 && R7.same && !R7.err && errors.length === 0)
  ok('7 กรองท่า: ทับละมุ ' + R7.rowsT.length + ' เส้นทาง · ปันหยา ' + R7.rowsP.length + ' · ทุกท่า ' + R7.rowsA.length + ' · วาดทุกแท็บแล้ว SB_BOOKINGS/exec_alloc ไม่เปลี่ยน · ไม่มี error');
else fail('7 ' + JSON.stringify(R7) + ' errors=' + JSON.stringify(errors.slice(0, 2)));

await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
