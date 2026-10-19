// §pxKeepScroll · Trip P&L › กดกางรายละเอียดหมวดต้นทุนแล้วหน้าไม่เด้งกลับขึ้นบน / แถบ Boat detail ไม่เลื่อนกลับซ้ายสุด
//
// ที่มา (2026-10-19) · owner ส่งภาพ Boat detail แล้วบอก "กดรายละเอียดแล้วเด้ง"
//   pxCostTog → renderTripPL วาด host ทั้งก้อนใหม่ · scrollTop ของหน้าและ scrollLeft ของ #px-dscroll หายทุกครั้ง
//
// กัน
//   1 วันที่มีเรือหลายลำ: เลื่อนหน้าลงไปถึง Boat detail + เลื่อนแถบไปขวา · กดกางหมวด → หมวดกางจริง · ตำแหน่งเลื่อนทั้งสองยังอยู่ (±4px)
//   2 กดหุบ → หุบจริง · ตำแหน่งยังอยู่ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1200, height: 700 });
await page.waitForTimeout(400);
/* วันที่มีเรือมากสุดใน TRIPS · ให้มีหลายลำพอจะเลื่อนแนวนอน */
const DATE = await page.evaluate(() => Object.keys(TRIPS).map(d => [d, Object.keys(TRIPS[d] || {}).length]).sort((a, b) => b[1] - a[1])[0][0]);
await page.evaluate((D) => { _px.tab = 'd'; _px.date = D; _px.pier = ''; _px.oc = {}; }, DATE);
await goView(page, 'trippl', 900);

const S = await page.evaluate(() => {
  const host = document.getElementById('trippl-host'); let sc = host;
  while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  const ds = document.getElementById('px-dscroll');
  const first = host.querySelector('.csw .csr[onclick]');
  if (!ds || !first) return { noDs: !ds, noRow: !first };
  if (sc && sc !== document.body) { sc.scrollTop = 600; } else window.scrollTo(0, 600);
  ds.scrollLeft = 350;
  const g = /pxCostTog\('([^']*)'\)/.exec(first.getAttribute('onclick'))[1];
  const y = () => (sc && sc !== document.body) ? sc.scrollTop : (window.pageYOffset || 0);
  return { y0: y(), x0: ds.scrollLeft, g, useWin: !(sc && sc !== document.body) };
});
if (S.noDs || S.noRow) { fail('0 ไม่มีแถบ Boat detail/แถวหมวดต้นทุน ' + JSON.stringify(S) + ' · วันที่ ' + DATE); }
else {
  const step = async (open) => {
    await page.evaluate((g) => pxCostTog(g), S.g);
    await page.waitForTimeout(250);
    return page.evaluate(({ useWin, g }) => {
      const host = document.getElementById('trippl-host'); let sc = host;
      while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const ds = document.getElementById('px-dscroll');
      const row = [...host.querySelectorAll('.csw .csr[onclick]')].find(r => (r.getAttribute('onclick') || '').includes("pxCostTog('" + g + "')"));
      return { y: useWin ? (window.pageYOffset || 0) : sc.scrollTop, x: ds ? ds.scrollLeft : -1, open: !!(row && row.parentElement.classList.contains('ope')), pane: !!(row && row.parentElement.querySelector('.cpane, table')), err: /Could not build/.test(host.textContent) };
    }, { useWin: S.useWin, g: S.g });
  };
  const A = await step(true);
  if (A.open && Math.abs(A.y - S.y0) <= 4 && Math.abs(A.x - S.x0) <= 4 && !A.err) ok('1 กดกาง "' + S.g + '" · หมวดกาง · หน้ายังอยู่ที่ y=' + A.y + ' (เดิม ' + S.y0 + ') · แถบ Boat detail ยังอยู่ x=' + A.x + ' (เดิม ' + S.x0 + ')');
  else fail('1 ' + JSON.stringify({ S, A }));
  const B = await step(false);
  if (!B.open && Math.abs(B.y - S.y0) <= 4 && Math.abs(B.x - S.x0) <= 4 && !B.err && errors.length === 0) ok('2 กดหุบ · หุบจริง · ตำแหน่งยังอยู่ · ไม่มี error');
  else fail('2 ' + JSON.stringify({ S, B }) + ' errors=' + JSON.stringify(errors.slice(0, 2)));
}
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
