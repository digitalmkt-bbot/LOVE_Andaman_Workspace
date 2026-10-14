// §ltStale · Add-on หางยาวต้องหายไปเมื่อเส้นทางในใบไม่มีเส้นไหนรองรับหางยาว · ใบเก่าที่ค้าง 0A+0C ไม่นับเป็นหางยาว
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);

const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  bkV2NewBooking(); await z(150);
  const d = _bkV2.newBooking;
  bkV2PickAgentByText('Zen Tour'); await z(150);
  bkV2PickRouteByText(0, 'Phi Phi Bamboo by Speedboat'); await z(150);
  d.trips[0].pax.ad_fr = 3;
  bkV2ToggleAddOn('longtail-join'); await z(150);
  const a1 = JSON.parse(JSON.stringify(d.addOns));
  bkV2PickRouteByText(0, 'Similan Islands by Speedboat'); await z(150);
  const a2 = JSON.parse(JSON.stringify(d.addOns));
  // กลับไปเส้นทางที่รองรับ · ติ๊กใหม่ · ลดหัว · จำนวนคนที่ลงจอยต้องไม่เกินหัว
  bkV2PickRouteByText(0, 'Phi Phi Bamboo by Speedboat'); await z(100);
  bkV2ToggleAddOn('longtail-join'); await z(100);
  d.trips[0].pax.ad_fr = 1; bkV2PickRouteByText(0, 'Phi Phi Bamboo by Speedboat'); await z(100);
  const a3 = JSON.parse(JSON.stringify(d.addOns));
  // เปลี่ยนเอเจนต์ · เส้นทางถูกล้าง · หางยาวต้องหายด้วย
  bkV2PickAgentByText(''); await z(100);
  const a4 = JSON.parse(JSON.stringify(d.addOns));
  return { a1, a2, a3, a4, route: d.trips[0].routeId };
});
const lt = L => L.filter(a => /^longtail-/.test(a.type));
if (lt(r.a1).length === 1 && r.a1[0].jAd === 3) ok('1 ติ๊ก Longtail Join บน Phi Phi Bamboo · jAd 3'); else fail('1 ' + JSON.stringify(r.a1));
if (lt(r.a2).length === 0) ok('2 เปลี่ยนเป็นเส้นทางที่ไม่มีหางยาว · Add-on หางยาวถูกตัดทิ้ง'); else fail('2 ' + JSON.stringify(r.a2));
if (lt(r.a3).length === 1 && r.a3[0].jAd === 1) ok('3 เส้นทางรองรับ · ลดหัวเหลือ 1 · jAd ตามลงเป็น 1'); else fail('3 ' + JSON.stringify(r.a3));
if (lt(r.a4).length === 0 && !r.route) ok('4 ล้างเอเจนต์ · เส้นทางว่าง · หางยาวหาย'); else fail('4 ' + JSON.stringify(r.a4) + ' route=' + r.route);

const s = await page.evaluate(() => {
  const mk = (jAd, jChd) => ({ id: 'T', agentId: 'a77', rateTypeRef: 'rt001', addOns: [{ type: 'longtail-join', label: 'Longtail Join (' + jAd + 'A + ' + jChd + 'C)', amount: 0, qty: 1, jAd, jChd }],
    trips: [{ routeId: 'r1791037542879', date: '2026-10-16', pax: { ad_fr: 3 } }] });
  const f0 = bkV2AddOnFlags(mk(0, 0), 'r1791037542879'), f2 = bkV2AddOnFlags(mk(2, 0), 'r1791037542879');
  const fo = bkV2AddOnFlags({ addOns: [{ type: 'longtail-join', label: 'Longtail Join' }], trips: [{ routeId: 'r10' }] }, 'r10');
  const c0 = ckAddonList(mk(0, 0), 'r1791037542879'), c2 = ckAddonList(mk(2, 0), 'r1791037542879');
  return { j0: f0.join, j2: f2.join, p2: f2.joinPax, jo: fo.join, c0: c0.filter(x => x.kind === 'longtail').length, c2: c2.filter(x => x.kind === 'longtail').length };
});
if (s.j0 === false && s.c0 === 0) ok('5 ใบเก่า 0A+0C · By-trip / หน้าท่า ไม่ขึ้นหางยาว'); else fail('5 ' + JSON.stringify(s));
if (s.j2 === true && s.p2 === 2 && s.c2 === 1 && s.jo === true) ok('6 join 2 คน และใบเก่าที่ไม่ระบุจำนวน ยังขึ้นหางยาวตามเดิม'); else fail('6 ' + JSON.stringify(s));

if (errors.length) fail('errors: ' + errors.join(' | ')); else ok('7 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
