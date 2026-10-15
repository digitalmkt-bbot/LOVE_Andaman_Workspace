// §rcSearch · หน้า Re-confirm · ช่องค้นหาบนแถบบน กรองแถว/การ์ดโดยไม่วาดหน้าใหม่
//
// ที่มา (2026-10-14) · owner: "เพิ่มช่องค้นหาให้ดวย"
// กัน
//   1 มีช่อง #rc-q · พิมพ์ Booking # ของใบหนึ่ง → เหลือแถวนั้นแถวเดียว การ์ดเอเย่นต์อื่นหายทั้งใบ · ชิป "พบ 1"
//   2 โฟกัสยังอยู่ที่ช่องค้นหาหลังพิมพ์ (ไม่วาดหน้าใหม่)
//   3 คำค้นไม่ตรงเลย → แถวซ่อนหมด + ข้อความ "ไม่พบรายการ" · ล้างคำค้น (ปุ่ม ×) → ทุกแถวกลับมา
//   4 ค้นชื่อโรงแรมพิมพ์เล็ก/ใหญ่ปนกัน และสองคำ (ชื่อ + เอเย่นต์) ได้ · คำค้นคงอยู่หลัง renderReconfirm() ซ้ำ
//   5 มุมมอง By trip ก็ค้นได้ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'reconfirm', 700);
const DATE = '2026-09-15';
const info = await page.evaluate((DATE) => {
  _rcDate = DATE; _rcQ = ''; _rcView = 'agent'; renderReconfirm();
  const rows = _rcActiveRows(DATE).map(r => _rcRowData(r));
  const host = document.getElementById('reconfirm-host');
  return { n: host.querySelectorAll('tr[data-s]').length, cards: host.querySelectorAll('.rc-card').length,
    has: !!document.getElementById('rc-q'),
    v: rows.find(d => d.voucher && d.voucher !== '—' && d.hotel), all: rows.map(d => ({ voucher: d.voucher, hotel: d.hotel, agentName: d.agentName })) };
}, DATE);
if (!info.has || info.n < 3 || !info.v) { fail('prep ' + JSON.stringify({ has: info.has, n: info.n })); await close(); process.exit(1); }
const state = () => page.evaluate(() => {
  const host = document.getElementById('reconfirm-host');
  const trs = [...host.querySelectorAll('tr[data-s]')];
  return { vis: trs.filter(t => t.style.display !== 'none').length, tot: trs.length,
    cards: [...host.querySelectorAll('.rc-card')].filter(c => c.style.display !== 'none').length,
    chip: (document.getElementById('rc-qn') || {}).textContent, chipShown: (document.getElementById('rc-qn') || { style: {} }).style.display !== 'none',
    noq: (document.getElementById('rc-noq') || { style: {} }).style.display !== 'none',
    focused: document.activeElement && document.activeElement.id === 'rc-q', q: (document.getElementById('rc-q') || {}).value };
});
// 1
await page.click('#rc-q'); await page.keyboard.type(String(info.v.voucher)); await page.waitForTimeout(100);
let s = await state();
const sameV = info.all.filter(d => String(d.voucher) === String(info.v.voucher)).length;
if (s.vis === sameV && s.cards === 1 && s.chipShown && /พบ\s*1/.test(s.chip.replace(String(sameV), '1')) ) ok(`1 ค้น ${info.v.voucher} → เหลือ ${s.vis}/${s.tot} แถว · ${s.cards} การ์ด · ${s.chip}`); else fail('1 ' + JSON.stringify(s));
// 2
if (s.focused) ok('2 โฟกัสยังอยู่ที่ช่องค้นหา'); else fail('2 focus lost');
// 3
await page.fill('#rc-q', 'zzz-no-such-thing-9'); await page.waitForTimeout(100); s = await state();
const s3a = s;
await page.click('#rc-qx'); await page.waitForTimeout(100); s = await state();
if (s3a.vis === 0 && s3a.noq && s3a.cards === 0 && s.vis === s.tot && !s.noq && s.q === '' && s.cards === info.cards) ok('3 ไม่พบ → ซ่อนหมด + ข้อความ · ล้างแล้วกลับมาครบ ' + s.vis); else fail('3 ' + JSON.stringify({ s3a, s }));
// 4
const hw = String(info.v.hotel).split(/\s+/)[0], mixed = hw.slice(0, 1).toLowerCase() + hw.slice(1).toUpperCase();
const agw = String(info.v.agentName).split(/\s+/)[0];
await page.fill('#rc-q', mixed + ' ' + agw); await page.waitForTimeout(100); s = await state();
const expect4 = info.all.filter(d => (d.hotel + ' ' + d.agentName + ' ' + d.voucher).toLowerCase().includes(hw.toLowerCase()) && (d.agentName + ' ' + d.hotel).toLowerCase().includes(agw.toLowerCase())).length;
await page.evaluate(() => renderReconfirm()); await page.waitForTimeout(100); const s4 = await state();
if (s.vis >= 1 && s.vis <= expect4 + 2 && s.vis < s.tot && s4.vis === s.vis && s4.q === mixed + ' ' + agw) ok(`4 "${mixed} ${agw}" → ${s.vis} แถว · วาดใหม่แล้วยังกรอง`); else fail('4 ' + JSON.stringify({ s, s4, expect4 }));
// 5
await page.evaluate(() => { rcSetView('trip'); }); await page.waitForTimeout(150);
await page.fill('#rc-q', String(info.v.voucher)); await page.waitForTimeout(100); s = await state();
if (s.vis === sameV && s.vis < s.tot) ok(`5 By trip ค้นได้ · ${s.vis} แถว`); else fail('5 ' + JSON.stringify(s));
await page.evaluate(() => { _rcQ = ''; rcSetView('agent'); });
if (errors.length) fail('errors: ' + errors.join(' | ')); else ok('ไม่มี error');
await close();
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
