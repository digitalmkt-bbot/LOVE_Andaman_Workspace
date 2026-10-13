// §btInScroll · หัว By trip date · กล่อง Programmes เลื่อนลงไปกดแถวล่าง ๆ แล้วต้องไม่เด้งกลับขึ้นบน
//
// ที่มา (8 ต.ค. 2026) · เจ้าของ: "ช่องนี้ เวลาเราเลื่อนไปคลิกอันที่อยู่ล่าง ๆ คลิกเสร็จแล้วเด้ง"
//   สาเหตุ · กดแล้ววาดหัวใหม่ทั้งก้อน · bookingV2KeepScroll จำแค่ตารางกับหน้าจอ ไม่จำกล่องเลื่อนในหัว
//
// กันสามอย่าง
//   1 เลื่อนกล่อง Programmes ลงล่างสุด แล้วกดแถวโปรแกรมแถวสุดท้าย · ตัวกรองเปลี่ยนจริง และกล่องยังอยู่ตำแหน่งเดิม
//   2 แถวที่กดยังมองเห็นอยู่ในกล่อง
//   3 กดซ้ำเพื่อยกเลิกตัวกรอง ก็ไม่เด้งเหมือนกัน · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
await page.evaluate(() => {
  const c = {}; (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => { if (t && t.date && t.routeId) (c[t.date] = c[t.date] || new Set()).add(t.routeId); }));
  const day = Object.keys(c).sort((a, b) => c[b].size - c[a].size)[0];
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip');
  /* ทำให้กล่องเลื่อนได้แน่ ๆ ไม่ว่าชุดข้อมูลมีกี่โปรแกรม */
  const st = document.createElement('style'); st.textContent = '.bt-pgbody{max-height:70px !important}'; document.head.appendChild(st);
});
await page.waitForTimeout(1200);
const state = () => page.evaluate(() => {
  const b = document.querySelector('.bt-pgbody'); if (!b) return { err: 'no programme box' };
  const rows = [...b.querySelectorAll('[onclick*="bookingV2Tab2SetRoute"]')];
  return { top: Math.round(b.scrollTop), max: b.scrollHeight - b.clientHeight, n: rows.length, route: _bkV2.filterRoute };
});
const S0 = await page.evaluate(() => { const b = document.querySelector('.bt-pgbody'); b.scrollTop = b.scrollHeight; return Math.round(b.scrollTop); });
const before = await state();
if (before.err || before.max <= 0 || before.n < 1) { fail('prep ' + JSON.stringify(before)); await close(); process.exit(1); }
const clickLast = () => page.evaluate(() => { const b = document.querySelector('.bt-pgbody'); const rows = [...b.querySelectorAll('[onclick*="bookingV2Tab2SetRoute"]')]; const r = rows[rows.length - 1]; r.click(); return r.getAttribute('onclick'); });
const oc = await clickLast();
await page.waitForTimeout(400);
const after = await state();
const vis = await page.evaluate(() => { const b = document.querySelector('.bt-pgbody'); const rows = [...b.querySelectorAll('[onclick*="bookingV2Tab2SetRoute"]')]; const r = rows[rows.length - 1].getBoundingClientRect(), q = b.getBoundingClientRect(); return r.bottom > q.top && r.top < q.bottom; });
if (after.route && Math.abs(after.top - S0) <= 2 && S0 > 0) ok(`1 กดแถวล่างสุด → กรอง ${after.route} · กล่องอยู่ที่ ${after.top}px เท่าเดิม (ก่อนกด ${S0})`);
else fail('1 ' + JSON.stringify({ S0, after, oc }));
if (vis) ok('2 แถวที่กดยังอยู่ในกล่อง'); else fail('2 row not visible');
await clickLast();
await page.waitForTimeout(400);
const again = await state();
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (!again.route && Math.abs(again.top - S0) <= 2 && !e1.length) ok('3 กดซ้ำยกเลิกตัวกรอง · ไม่เด้ง · ไม่มี error');
else fail('3 ' + JSON.stringify({ again, S0 }) + ' ' + e1.slice(0, 2).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
