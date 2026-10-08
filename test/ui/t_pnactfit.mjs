// §pnActFit · ใบรออนุมัติบนหน้า By trip date · ปุ่มดูรายละเอียดกับปุ่มอนุมัติต้องไม่โดนตัด
//
// ที่มา (8 ต.ค. 2026) · เจ้าของส่งภาพแถว Pending approval ของ B2C · เห็นแค่ "✓ App" · "ดูช่องเมเนจหน่อย ของ B2C โดนตัด"
//   สาเหตุ · ปุ่ม View + อนุมัติ อยู่ในช่อง VC กว้าง 48px (คอลัมน์ตรึงความกว้าง · td ตัดส่วนเกิน)
//
// กันสี่อย่าง (โหมดปกติ · โหมดจัดเรือ · โหมดจัดรถ)
//   1 ทุกปุ่มในแถวรออนุมัติอยู่ในกรอบช่องของตัวเองครบ ไม่ล้นขอบช่อง
//   2 มีปุ่มเปิดรายละเอียด และปุ่มอนุมัติ ครบทั้งสามโหมด
//   3 กดปุ่มอนุมัติแล้วเรียก bkV2ApproveBooking กับใบนั้น · กด VC แล้วเปิดรายละเอียดใบนั้น
//   4 จำนวนช่องในแถวเท่ากับหัวตาราง (ไม่ทำคอลัมน์เลื่อน)
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const prep = await page.evaluate(() => {
  const c = {}; (SB_BOOKINGS || []).forEach(b => { if (b.status !== 'confirmed') return; (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const bk = SB_BOOKINGS.find(b => b.status === 'confirmed' && (b.trips || []).some(t => t.date === day));
  bk.status = 'pending_approval'; bk.approval = { reason: 'b2c_hold' };
  window._calls = []; window.bkV2ApproveBooking = id => window._calls.push(['approve', id]); const od = window.bkV2OpenDetail; window.bkV2OpenDetail = id => window._calls.push(['detail', id]);
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { day, id: bk.id };
});
await page.waitForTimeout(1200);
const check = () => page.evaluate(() => {
  const tr = document.querySelector('tr.t2-pnrow'); if (!tr) return { err: 'no pending row' };
  const tbl = tr.closest('table'), nh = [...tbl.querySelectorAll('thead th')].reduce((s, th) => s + (+th.colSpan || 1), 0);
  const nr = [...tr.children].reduce((s, td) => s + (+td.colSpan || 1), 0);
  const clip = [];
  tr.querySelectorAll('button').forEach(b => { const td = b.closest('td'), r = b.getBoundingClientRect(), q = td.getBoundingClientRect();
    if (r.left < q.left - 0.5 || r.right > q.right + 0.5) clip.push(b.textContent.trim() + ' ' + Math.round(r.left - q.left) + '/' + Math.round(q.right - r.right)); });
  const btns = [...tr.querySelectorAll('button')];
  return { clip, nh, nr, labels: btns.map(b => b.textContent.trim()),
    detail: btns.find(b => /bkV2OpenDetail/.test(b.getAttribute('onclick'))), app: btns.find(b => /bkV2ApproveBooking/.test(b.getAttribute('onclick'))) ? 1 : 0 };
});
for (const mode of ['normal', 'boat', 'van']) {
  await page.evaluate(m => { _bkV2.boatAssignMode = (m === 'boat'); _bkV2.vanAssignMode = (m === 'van'); bkV2Render(); }, mode);
  await page.waitForTimeout(700);
  const R = await check();
  const R3 = await page.evaluate(() => { window._calls = []; const tr = document.querySelector('tr.t2-pnrow');
    [...tr.querySelectorAll('button')].forEach(b => b.click()); return window._calls; });
  if (!R.err && !R.clip.length && R.app && R.nh === R.nr && R3.some(c => c[0] === 'approve' && c[1] === prep.id) && R3.some(c => c[0] === 'detail' && c[1] === prep.id))
    ok(`${mode} · ปุ่ม ${R.labels.join(' / ')} อยู่ในช่องครบ · ช่อง ${R.nr} = หัว ${R.nh} · กดแล้วไปที่ใบ ${prep.id}`);
  else fail(mode + ' ' + JSON.stringify({ R, R3 }));
}
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
