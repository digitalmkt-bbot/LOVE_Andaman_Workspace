// §sbkFit · ช่อง Send back บนหน้า By trip date · ป้ายต้องไม่โดนตัด
//
// ที่มา (8 ต.ค. 2026) · เจ้าของส่งภาพแถวที่ส่งกลับคนละที่ · "ibis Styles Phuk" กับป้าย "⚠ ยังไม่จัดรถกลับ" โดนตัดครึ่ง
//   ป้าย "↩ กลับคันเดิม (เปิด Van)" หายไปทั้งป้าย · "ช่อง Send back อันนี้ด้วย"
//   สาเหตุ · คอลัมน์ 90px ตรึงความกว้าง · ป้ายตั้ง white-space:nowrap จึงล้นแล้วถูกตัด
//
// กันสี่อย่าง (โหมดปกติ · จัดเรือ · จัดรถ)
//   1 ป้ายทุกอันในช่อง Send back อยู่ในกรอบช่องครบ ทั้งความกว้างและความสูง
//   2 ป้ายครบตามสถานะ · ยังไม่จัด = "ยังไม่จัดรถกลับ" + "กลับคันเดิม"
//   3 ชื่อโรงแรมยาว ตัดด้วย … ได้ แต่ต้องมี title ชื่อเต็ม
//   4 ความกว้างรวมของตารางเท่าเดิม (ยืมจาก Pickup + Room) · ช่องในแถวเท่าหัวตาราง
//   5 §zoneSlim · "Zone บีบให้แคบลงได้ · Own transport โชว์ถึงคำว่า Pier ก็ได้"
//     ช่อง Zone ของใบมาเองขึ้นชื่อท่าเต็มคำ (ยาวก็ขึ้นสองบรรทัด) ไม่โดนตัด · ชื่อเต็ม "(self-arrive)" อยู่ใน title · Send back กว้างขึ้นเป็น 148
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const prep = await page.evaluate(() => {
  const c = {}; (SB_BOOKINGS || []).forEach(b => { if (b.status !== 'confirmed') return; (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const bk = SB_BOOKINGS.find(b => b.status === 'confirmed' && (b.trips || []).some(t => t.date === day) && !b.pickupSelf);
  bk.dropoffSame = false; bk.dropoffHotelName = 'ibis Styles Phuket City Airport Hotel'; bk.ops = Object.assign({}, bk.ops, { vanReturnId: null, returnSameVan: false });
  /* ใบที่สองเป็นใบมาเองที่ท่า · พื้นที่ชื่อ "Tub Lamu Pier (self-arrive)" */
  const pa = (typeof SB_PICKUP_AREAS !== 'undefined' ? SB_PICKUP_AREAS : []).find(a => /\(self-arrive\)/i.test(a.name || ''));
  const bk2 = SB_BOOKINGS.find(b => b !== bk && b.status === 'confirmed' && (b.trips || []).some(t => t.date === day));
  if (pa) { bk2.pickupAreaId = pa.id; } else { bk2.pickupAreaId = null; bk2.pickupArea = 'Tub Lamu Pier (self-arrive)'; }
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { day, id: bk.id, sep: bkV2RetInfo(bk, day) };
});
await page.waitForTimeout(1200);
for (const mode of ['normal', 'boat', 'van']) {
  await page.evaluate(m => { _bkV2.boatAssignMode = (m === 'boat'); _bkV2.vanAssignMode = (m === 'van'); bkV2Render(); }, mode);
  await page.waitForTimeout(700);
  const R = await page.evaluate(() => {
    const td = [...document.querySelectorAll('td.t2-sbk')].find(t => /ibis Styles/.test(t.innerHTML)); if (!td) return { err: 'no send-back cell' };
    const q = td.getBoundingClientRect(), clip = [];
    td.querySelectorAll('.t2-rb').forEach(b => { const r = b.getBoundingClientRect();
      if (r.left < q.left - .5 || r.right > q.right + .5 || r.bottom > q.bottom + .5 || b.scrollWidth > b.clientWidth + 1) clip.push(b.textContent.trim()); });
    const sb = td.querySelector('.t2-sb'), tr = td.closest('tr'), tbl = td.closest('table');
    const nh = [...tbl.querySelectorAll('thead th')].reduce((s, th) => s + (+th.colSpan || 1), 0), nr = [...tr.children].reduce((s, c) => s + (+c.colSpan || 1), 0);
    const w = [...tbl.querySelectorAll('col')].reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0);
    const zt = [...document.querySelectorAll('.t2-zonetag')].find(z => /self-arrive/i.test(z.title || '') || /Pier/.test(z.textContent));
    const zone = zt ? { txt: zt.textContent.trim(), title: zt.title, cut: zt.scrollWidth > zt.clientWidth + 1 || zt.scrollHeight > zt.clientHeight + 1 || zt.getBoundingClientRect().right > zt.closest('td').getBoundingClientRect().right + .5 } : null;
    return { chips: [...td.querySelectorAll('.t2-rb')].map(b => b.textContent.trim()), clip, title: sb && sb.title, nh, nr, w, tdw: Math.round(q.width), zone };
  });
  if (!R.err && !R.clip.length && R.chips.some(t => /ยังไม่จัดรถกลับ/.test(t)) && R.chips.some(t => /กลับคันเดิม/.test(t)) && /ibis Styles Phuket City Airport Hotel/.test(R.title || '') && R.nh === R.nr
      && R.tdw === 148 && R.zone && /Pier$/.test(R.zone.txt) && !/self/i.test(R.zone.txt) && !R.zone.cut)
    ok(`${mode} · Send back ${R.tdw}px · ${R.chips.join(' | ')} · ไม่โดนตัด · Zone "${R.zone.txt}" (title "${R.zone.title}") · ตารางรวม ${R.w}px`);
  else fail(mode + ' ' + JSON.stringify(R));
}
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
