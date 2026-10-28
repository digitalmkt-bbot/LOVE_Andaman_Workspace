// §btcNxt · Compact · ชิปทริปอื่น (+ Private Transfer ...) ล้นช่องลูกค้าไปทับคอลัมน์ AD
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="booking"]')); await z(400);
  btcSet('compact'); await z(200);
  const days = [...new Set(SB_BOOKINGS.flatMap(b => (b.trips || []).map(t => t.date)))].sort();
  for (const d of days) {
    const has = SB_BOOKINGS.some(b => (b.trips || []).some(t => t.date === d) && typeof bkOtherTrips === 'function' && bkOtherTrips(b, d, ((b.trips || []).find(t => t.date === d) || {}).routeId).length);
    if (!has) continue;
    _bkV2.filterDate = d; bookingV2SwitchTab('bytrip'); await z(700);
    const rows = [...document.querySelectorAll('#view-booking tr.t2-row')].filter(tr => tr.querySelector('td.t2-cu .t2-nxt'));
    if (!rows.length) continue;
    // ทำชื่อลูกค้า + ชิปให้ยาวสุด ๆ เหมือนเคสจริง
    let worst = null;
    rows.forEach(tr => {
      const cu = tr.querySelector('td.t2-cu'), ad = cu.nextElementSibling;
      const nx = cu.querySelector('.t2-nxt span'); if (nx) nx.textContent = 'Private Transfer to Pier Private';
      const ld = cu.querySelector('.t2-lead'); if (ld) ld.textContent = 'นางสาว ผ่องศรี มวยทองดี ยาวมาก';
      const kids = [...cu.querySelectorAll('.t2-lead,.t2-cul2,.t2-more,.t2-nxt')];
      const right = Math.max(...kids.map(k => k.getBoundingClientRect().right));
      const over = right - cu.getBoundingClientRect().right;
      if (!worst || over > worst.over) worst = { over: Math.round(over), adLeft: Math.round(ad.getBoundingClientRect().left), right: Math.round(right) };
    });
    return { d, n: rows.length, worst };
  }
  return { none: true };
});
await page.evaluate(() => { const tr=[...document.querySelectorAll('#view-booking tr.t2-row')].find(t=>t.querySelector('td.t2-cu .t2-nxt')); if(tr) tr.scrollIntoView({block:'center'}); }); await page.waitForTimeout(300); await page.screenshot({ path: '/mnt/user-data/outputs/btcnxt.png' });
if (r.none) { console.log('no case'); } else if (r.worst.over <= 0) ok(`ชิปทริปอื่นอยู่ในช่องลูกค้า ไม่ทับคอลัมน์ AD (${r.n} แถว · ${r.d})`); else fail('ล้นเข้า AD ' + r.worst.over + 'px ' + JSON.stringify(r));
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
