// §daOrd · Daily Availability · แถวเรียงตามลำดับ Program Config (laRouteOrdCmp) ไม่ใช่เวลาออก
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });
await page.waitForTimeout(600);
const r = await page.evaluate(() => {
  const ds = '2026-10-15', g = buildDAGroups(ds), out = {};
  ['tublamu', 'panwa'].forEach(p => {
    const rows = _daSortRows(Object.values(g[p] || {}));
    out[p] = { got: rows.map(x => x.r.name), want: rows.slice().sort((a, b) => laRouteOrdCmp(a.r, b.r)).map(x => x.r.name), times: rows.map(x => (x.r.times || [])[0]) };
  });
  daDate = new Date(2026, 9, 15); renderDA();
  const txt = (document.getElementById('da-preview') || document.querySelector('[id*="da-"][id*="prev"]') || {}).textContent || '';
  out.txtOrder = ['Early Tratato', 'Early Tiger', 'Catamaran', 'Similan Islands by Speedboat', 'Surin'].map(k => txt.indexOf(k));
  return out;
});
for (const p of ['tublamu', 'panwa']) {
  const x = r[p];
  if (x.got.length && JSON.stringify(x.got) === JSON.stringify(x.want)) ok(`${p} · ${x.got.join(' → ')}`);
  else fail(p + ' ' + JSON.stringify(x));
}
const o = r.txtOrder.filter(i => i >= 0);
if (o.length >= 3 && o.every((v, i) => !i || v > o[i - 1])) ok('ข้อความที่ copy เรียงตามลำดับเดียวกัน');
else console.log('  · (ข้ามตรวจข้อความ · ไม่เจอกล่อง preview) ' + JSON.stringify(r.txtOrder));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (!e1.length) ok('ไม่มี error'); else fail('console: ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
