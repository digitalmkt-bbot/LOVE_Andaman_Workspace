// §pjZoom · ใบงานเรือ (pjPrint) · ปุ่ม "พอดีจอ" ย่อทั้งใบให้เห็นครบบนจอ · ไม่มีผลกับรูป PNG และกระดาษ
//
// ที่มา (2026-10-14) · owner (screenshot Tub Lamu 9 ลำ): "ขอใบงาน ให้ FIT กับหน้าจอ ตอนนี้มันใหญ่เกิน"
// กัน
//   1 เปิดมา (1220×880) · ใบถูกย่อ (zoom < 1) และขอบล่างของใบอยู่ในจอ · ไม่มีสกรอลล์แนวตั้ง
//   2 ใบไม่ได้ถูกย่อจนเล็กเกินเหตุ · ขอบล่างห่างก้นจอไม่เกิน 80px (ความสูงกระโดดเป็นขั้นตามการตกบรรทัด) (ลู่เข้าหาค่าพอดี ไม่ใช่รอบแรกแล้วหยุด)
//   3 กดปุ่มปิด · zoom กลับเป็น 1 ใบสูงเกินจอ · กดอีกครั้งกลับมาย่อ
//   4 ปุ่มบันทึกรูป · ตอน html2canvas ถ่าย zoom ต้องเป็น 1 (รูปขนาดจริง) · ถ่ายเสร็จย่อกลับ
//   5 สื่อพิมพ์ · zoom เป็น 1 เสมอแม้ปุ่มเปิดอยู่
//   6 ใบอื่นที่ใช้ pjShotScript ร่วม (ใบเซ็นรับของ poSignPrint) · ไม่มีปุ่ม ไม่ถูกย่อ
//   7 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const capture = (fnName) => page.evaluate((fnName) => {
  const pier = 'tublamu';
  const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
  const rts = (ROUTES || []).filter(r => (r.pier || '') === pier);
  const D = '2026-09-16'; TRIPS[D] = {};
  mine.slice(0, 12).forEach((b, i) => { TRIPS[D][b.id] = { route: (rts[i % rts.length] || ROUTES[0]).id, type: 'normal', booked: 0 }; });
  _poDate = D; _poPier = pier; _pjF = 'all';
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  try { if (fnName === 'pjPrint') pjPrint(); else poSignPrint(mine[0].id, null); } catch (e) { cap = 'ERR:' + (e && e.message); }
  window.open = real;
  return cap.replace(/<link[^>]+fonts[^>]*>/g, '');
}, fnName);
const html = await capture('pjPrint');
if (html.indexOf('ERR:') === 0) { fail('pjPrint ' + html); }
const p = await page.context().newPage(); await p.setViewportSize({ width: 1220, height: 880 });
p.on('dialog', d => d.accept());
await p.setContent(html); await p.waitForTimeout(700);
const M = () => p.evaluate(() => { const el = document.getElementById('sheet'), r = el.getBoundingClientRect();
  return { zoom: el.style.zoom, bottom: Math.round(r.bottom), innerH: innerHeight, scrollH: document.documentElement.scrollHeight, on: document.getElementById('bfit').classList.contains('on') }; });
const a = await M();
if (a.zoom && +a.zoom < 1 && a.bottom <= a.innerH && a.scrollH <= a.innerH + 2 && a.on) ok(`1 เปิดมา · zoom ${a.zoom} · ขอบล่าง ${a.bottom}/${a.innerH} · ไม่มีสกรอลล์`); else fail('1 ' + JSON.stringify(a));
if (a.innerH - a.bottom <= 80) ok(`2 ลู่เข้าค่าพอดี · เหลือที่ว่างใต้ใบ ${a.innerH - a.bottom}px`); else fail('2 ' + JSON.stringify(a));
await p.click('#bfit'); await p.waitForTimeout(200); const b = await M();
await p.click('#bfit'); await p.waitForTimeout(200); const c = await M();
if (!b.zoom && !b.on && b.bottom > b.innerH && c.zoom === a.zoom && c.on) ok(`3 ปิด → ขนาดจริง (ขอบล่าง ${b.bottom}px) · เปิด → ย่อ ${c.zoom}`); else fail('3 ' + JSON.stringify({ b, c }));
const d = await p.evaluate(async () => {
  const el = document.getElementById('sheet'); let seen = null;
  window.html2canvas = (e) => { seen = e.style.zoom; return Promise.resolve({ toBlob: null, toDataURL: () => 'data:image/png;base64,' }); };
  const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};   /* ไม่ให้ดาวน์โหลดจริง */
  shot(); await new Promise(z => setTimeout(z, 300)); HTMLAnchorElement.prototype.click = ac;
  return { during: seen, after: el.style.zoom };
});
if (d.during === '' && d.after && +d.after < 1) ok(`4 ถ่ายรูปที่ zoom 1 · ถ่ายเสร็จย่อกลับ ${d.after}`); else fail('4 ' + JSON.stringify(d));
await p.emulateMedia({ media: 'print' }); const e = await p.evaluate(() => getComputedStyle(document.getElementById('sheet')).zoom);
await p.emulateMedia({ media: 'screen' });
if (e === '1' || e === 'normal' || e === '') ok(`5 สื่อพิมพ์ · zoom = ${e || '1'}`); else fail('5 zoom ' + e);
await p.close();
const html2 = await capture('poSignPrint');
const q = await page.context().newPage(); await q.setViewportSize({ width: 1220, height: 880 }); await q.setContent(html2); await q.waitForTimeout(500);
const f = await q.evaluate(() => { const el = document.getElementById('sheet'); return { btn: !!document.getElementById('bfit'), zoom: el ? el.style.zoom : null, sheet: !!el }; });
await q.close();
if (f.sheet && !f.btn && !f.zoom) ok('6 ใบเซ็นรับของ · ไม่มีปุ่ม ไม่ถูกย่อ'); else fail('6 ' + JSON.stringify(f));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 no page errors'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
