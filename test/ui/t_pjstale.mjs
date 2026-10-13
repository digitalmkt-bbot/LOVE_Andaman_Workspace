// §pjStaleFit · ใบงานเรือ · ชิป "โปรแกรมค้าง" กับปุ่มเอาโปรแกรมออก
//
// ที่มา (2026-09-21) · หน้าจริงขึ้น "⚠ โปรแกรมค้าง 1 ลำ · เรือไม่พร้อมแล้ว แต่ยังไม่ได้เอาโปรแกรมออก"
//   แต่เอาโปรแกรมออกไม่ได้ · ชิปทั้งก้อนเป็น nowrap และมีชื่อเส้นทางอยู่ข้างใน
//   ชื่อยาว ๆ อย่าง "Whale Shark Phi Phi Maiton Sunset" ดันปุ่ม "เอาออก" ออกไปนอกการ์ด
//   แล้วโดน overflow:hidden ของ .stw กลืนหายทั้งปุ่ม · วัดที่จอ 1920 ปุ่มเลยขอบไป 195px
//   คนใช้เห็นคำเตือน แต่ไม่มีอะไรให้กด — โปรแกรมค้างอยู่อย่างนั้น
//
// เทสนี้กันสามอย่าง
//   1 ปุ่ม "เอาออก" ต้องอยู่ในกรอบการ์ดจริงทุกความกว้างที่ใช้งาน
//   2 กดแล้วต้องลบแถวออกจาก TRIPS จริง ไม่ใช่ซ่อนบนการ์ด
//   3 ลำที่ยังมีใบจองผูกอยู่ ห้ามลบ · ต้องกันไว้ก่อน
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1920, height: 1200 });
await page.waitForTimeout(900);

/* ปลูกเคส · เรือลำหนึ่งของท่ามีโปรแกรมบนกระดาน แต่สถานะวันนั้นเป็น "ซ่อม"
   ใช้ชื่อเส้นทางที่ยาวที่สุดเท่าที่มีจริง เพราะปัญหาเกิดจากความยาวของชื่อ */
const S = await page.evaluate(() => {
  const D = '2026-09-22';
  const b = (BOATS || []).find(x => (x.pier || '') === 'panwa') || BOATS[0];
  b.log = (b.log || []).concat([{ id: 'zz_stale_probe', s: 'fixing', from: '2026-09-20', to: '2026-09-30', loc: '', note: 'probe' }]);
  const mine = (ROUTES || []).filter(r => (r.pier || '') === (b.pier || ''));
  const rt = mine.slice().sort((x, y) => String(y.name || '').length - String(x.name || '').length)[0] || ROUTES[0];
  TRIPS[D] = TRIPS[D] || {};
  TRIPS[D][b.id] = { route: rt.id, type: 'normal', booked: 0 };
  _poDate = D; _poPier = b.pier || 'panwa';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-poj-' + _poPier).classList.add('active');
  renderPierJob(_poPier);
  return { boat: b.name, bid: b.id, route: rt.name, len: String(rt.name || '').length,
           canEdit: (typeof poCanEdit === 'function') ? poCanEdit() : null };
});
console.log('ปลูกเคส · ' + S.boat + ' · ' + S.route + ' (' + S.len + ' ตัวอักษร)');
if (!S.canEdit) { console.log('  ! ผู้ใช้ชุดนี้แก้ไม่ได้ · ข้ามเทสทั้งไฟล์'); console.log('พัง 0'); await close(); process.exit(0); }

/* ══ 1 · ปุ่มต้องอยู่ในกรอบการ์ด ทุกความกว้าง ══════════════════════════════ */
const WIDTHS = [1920, 1680, 1440, 1280];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 1200 });
  await page.waitForTimeout(350);
  const M = await page.evaluate(() => {
    const host = document.getElementById('pj-host-' + _poPier);
    const chip = host && host.querySelector('.pj-stale');
    if (!chip) return { err: 'ไม่มีชิปโปรแกรมค้าง' };
    const btn = chip.querySelector('button');
    if (!btn) return { err: 'ชิปไม่มีปุ่มเอาออก' };
    const card = chip.closest('.bc');
    const R = e => e.getBoundingClientRect();
    const B = R(btn), C = R(card);
    return { cut: Math.round(Math.max(0, B.right - C.right)),
             left: Math.round(Math.max(0, C.left - B.left)),
             w: Math.round(B.width), cardW: Math.round(C.width),
             /* วัดว่ามองเห็นจริง ไม่ใช่แค่มีใน DOM · ตัวที่กลืนปุ่มคือ overflow ของแม่ */
             clipped: (function(){
               let n = btn.parentElement, hid = 0;
               while (n && n !== document.body){
                 const cs = getComputedStyle(n);
                 if (/hidden|clip/.test(cs.overflowX)){
                   const q = n.getBoundingClientRect();
                   if (B.right > q.right + 1 || B.left < q.left - 1) hid++;
                 }
                 n = n.parentElement;
               }
               return hid;
             })() };
  });
  if (M.err) { fail(w + 'px · ' + M.err); continue; }
  if (M.cut || M.left) fail(w + 'px · ปุ่มเอาออกล้นกรอบการ์ดไป ' + (M.cut || M.left) + 'px (การ์ดกว้าง ' + M.cardW + ')');
  else if (M.clipped) fail(w + 'px · ปุ่มเอาออกถูก overflow ของกล่องแม่กลืนไป ' + M.clipped + ' ชั้น');
  else ok(w + 'px · ปุ่มเอาออกอยู่ในกรอบการ์ด · กว้าง ' + M.w + 'px');
}

/* ══ 2 · กดแล้วต้องลบแถวใน TRIPS จริง ═════════════════════════════════════ */
await page.setViewportSize({ width: 1680, height: 1200 });
await page.waitForTimeout(300);
const R2 = await page.evaluate((bid) => {
  const D = '2026-09-22';
  const had = !!(TRIPS[D] && TRIPS[D][bid]);
  const _c = window.confirm, _a = window.alert;
  let asked = 0, alerted = 0;
  window.confirm = function(){ asked++; return true; };
  window.alert  = function(){ alerted++; };
  try { pjOpDrop(bid); } finally { window.confirm = _c; window.alert = _a; }
  return { had, asked, alerted, still: !!(TRIPS[D] && TRIPS[D][bid]),
           chipGone: !document.querySelector('#pj-host-' + _poPier + ' .pj-stale') };
}, S.bid);
if (!R2.had) fail('ปลูกโปรแกรมไม่ติด · ไม่มีอะไรให้เอาออก');
else if (!R2.asked) fail('กดเอาออกแล้วไม่ถามยืนยันเลย · ของที่ลบแล้วเอาคืนไม่ได้ ต้องถามก่อน');
else if (R2.still) fail('กดยืนยันแล้วแถวยังอยู่ใน TRIPS · หน้าอื่นจะยังนับลำนี้เป็นเรือที่ออก');
else ok('กดเอาออก · ถามยืนยัน 1 ครั้ง · แถวถูกลบออกจาก TRIPS จริง');

/* ══ 3 · ลำที่ยังมีใบจองผูกอยู่ ห้ามลบ ════════════════════════════════════ */
const R3 = await page.evaluate(() => {
  /* หาวันที่+ลำที่มีใบจองผูกอยู่จริงในข้อมูลชุดนี้ · ไม่ปลอมใบจองขึ้นมาเอง
     เพราะกติกาที่ต้องวัดคือ "pjPax เห็นใบจองแล้วกันไว้" ไม่ใช่ตัวนับของเทส */
  const dates = Object.keys(TRIPS || {}).sort();
  for (const d of dates){
    for (const bid of Object.keys(TRIPS[d] || {})){
      const b = (BOATS || []).find(x => x.id === bid); if (!b) continue;
      const pier = (typeof pjPierOf === 'function') ? pjPierOf(b, d) : (b.pier || '');
      if (!pier) continue;
      const px = pjPax(d, bid, pier);
      if (px.n > 0){
        _poDate = d; _poPier = pier;
        const before = JSON.stringify(TRIPS[d][bid]);
        const _c = window.confirm, _a = window.alert;
        let asked = 0, alerted = 0;
        window.confirm = function(){ asked++; return true; };
        window.alert  = function(){ alerted++; };
        try { pjOpDrop(bid); } finally { window.confirm = _c; window.alert = _a; }
        return { found: true, date: d, bid, boat: b.name, n: px.n, asked, alerted,
                 kept: !!(TRIPS[d] && TRIPS[d][bid]) && JSON.stringify(TRIPS[d][bid]) === before };
      }
    }
  }
  return { found: false };
});
if (!R3.found) console.log('  ! ข้อมูลชุดนี้ไม่มีลำไหนที่มีใบจองผูกอยู่ · ข้ามข้อนี้');
else if (!R3.kept) fail(R3.boat + ' ' + R3.date + ' · มีใบจอง ' + R3.n + ' ใบ แต่โปรแกรมถูกลบไป · ใบจองกลายเป็นไม่มีเรือ');
else if (!R3.alerted) fail('กันไว้ได้ แต่ไม่ได้บอกเหตุผล · คนกดจะไม่รู้ว่าต้องไปย้ายลำที่หน้า Booking ก่อน');
else if (R3.asked) fail('ถามยืนยันทั้งที่ลบไม่ได้อยู่แล้ว · ถามเปล่า ๆ');
else ok(R3.boat + ' ' + R3.date + ' · มีใบจอง ' + R3.n + ' ใบ · ไม่ลบ และบอกเหตุผล');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
