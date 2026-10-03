// §ovnRet §mealOvnRt · วันกลับของ OVN ต้องนับเป็นวันที่เรือออก
//
// เคสจริง · Oceanus (b13) ถูกเหมาค้างเกาะ 16 → 18 ก.ย. 69 · r10 Phi Phi Bamboo by Speedboat
//   16 = วันออก · 17 = อยู่ที่เกาะ · 18 = วิ่งกลับเข้าท่าพร้อมคน 12 คน กินข้าวกลางวันระหว่างทาง
// เดิมทั้ง 17 และ 18 ถูกจัดเป็น "ระหว่างทาง" เหมือนกัน · ใบงานเรือจึงซ่อนบล็อกครัวในวันกลับ
// และการ์ดครัวอ่านเส้นทางจาก torder ซึ่งว่างเปล่าเมื่อลำนั้นมีแต่งานรับกลับ
//
// ข้อมูล: subset_ovnmeal.json ต้องคง ops ของบุ๊กกิ้ง และคง trips (กระดาน Boat Op) ไว้
//   ถ้าตัด ops ออก เทสนี้จะผ่านแบบว่างเปล่า เพราะไม่มีลำไหนถูกผูกกับใบรับกลับเลย
import { open } from './_harness.mjs';

const BLOB = process.env.LAD;
const BOAT = 'b13', RID = 'r10';
const OUT = '2026-09-16', MID = '2026-09-17', RET = '2026-09-18';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: BLOB });

const R = await page.evaluate(([bid, rid, out, mid, ret]) => {
  const o = {};
  const B = (typeof BOATS !== 'undefined' ? BOATS : []).filter(x => x.id === bid)[0] || null;
  o.boat = B ? B.name : null;

  // ช่วงเหมาค้างเกาะที่ระบบมองเห็น
  const h = (typeof bkOvnHoldOn === 'function') ? bkOvnHoldOn(bid, ret) : null;
  o.hold = h ? { from: h.from, to: h.to } : null;

  // สถานะรายวันตามที่ใบงานเรือใช้ตัดสิน · going = (k === 'run')
  o.st = {};
  [out, mid, ret].forEach(d => {
    const hasOp = !!((typeof TRIPS !== 'undefined' && TRIPS[d]) ? TRIPS[d][bid] : null);
    const s = pjBoatSt(d, B, hasOp);
    o.st[d] = { op: hasOp, k: s.k, stale: s.stale };
  });

  // ร้านประจำเส้นทาง — ต้องมีอยู่จริง ไม่งั้นเทสข้างล่างจะผ่านแบบไม่ได้พิสูจน์อะไร
  const rv = (typeof mvForRoute === 'function') ? mvForRoute(rid) : null;
  o.routeVenue = rv ? { id: rv.id, name: rv.name, ad: +rv.priceAd || 0, ch: +rv.priceCh || 0 } : null;

  // การ์ดครัวของวันกลับ · จำลองโครงที่ renderPierCheckin ส่งให้ pckKitchenHtml
  //   ลำที่มีแต่งานรับกลับ: rows/trips/torder ว่าง · แถวอยู่ใน ovn
  const OVR = (typeof pckMealOvnRows === 'function') ? pckMealOvnRows(ret, bid) : [];
  o.ovn = OVR.map(x => ({ lead: x.b.leadPax, pax: x.pax, inc: x.inc, rid: x.t && x.t.routeId }));
  const boats = {}; boats[bid] = { bid: bid, rows: [], trips: {}, torder: [], ovn: OVR.slice() };
  o.card = (typeof pckKitchenHtml === 'function') ? pckKitchenHtml([bid], boats, ret, true) : '';

  // และหลังจากกด "รวมอาหาร" ต้องคิดเงินออกมาได้
  o.after = null;
  if (OVR.length && typeof pckMealOvnSet === 'function') {
    const before = (typeof pckMealOvnOf === 'function') ? pckMealOvnOf(ret, bid, OVR[0].b.id) : '';
    pckMealOvnSet(ret, bid, OVR[0].b.id, 'in');
    const OV2 = pckMealOvnRows(ret, bid);
    const b2 = {}; b2[bid] = { bid: bid, rows: [], trips: {}, torder: [], ovn: OV2.slice() };
    o.after = pckKitchenHtml([bid], b2, ret, true);
    pckMealOvnSet(ret, bid, OVR[0].b.id, before || '');   // คืนสภาพ ไม่ทิ้งรอยไว้ในข้อมูลเทส
  }
  return o;
}, [BOAT, RID, OUT, MID, RET]);

console.log('OVN meal · ' + (R.boat || BOAT) + ' · ' + OUT + ' → ' + RET);

/* ── ข้อมูลตั้งต้นต้องครบก่อน ไม่งั้นข้อที่เหลือผ่านแบบว่างเปล่า ───────────── */
if (!R.hold || R.hold.from !== OUT || R.hold.to !== RET)
  fail('ชุดข้อมูล · ไม่เจอช่วงเหมาค้างเกาะ ' + OUT + ' → ' + RET + ' · ได้ ' + JSON.stringify(R.hold));
else ok('ชุดข้อมูล · เหมาค้างเกาะ ' + R.hold.from + ' → ' + R.hold.to);

if (!R.ovn.length) fail('ชุดข้อมูล · ไม่มีใบรับกลับผูกกับลำนี้เลย (ops ถูกตัดออกจาก subset?)');
else ok('ชุดข้อมูล · ใบรับกลับ ' + R.ovn.length + ' ใบ · ' + R.ovn[0].pax + ' ท่าน · เส้นทาง ' + R.ovn[0].rid);

if (!R.routeVenue) fail('ชุดข้อมูล · ' + RID + ' ไม่ได้ตั้งร้านไว้ ข้อสอบร้านข้างล่างจะไม่มีความหมาย');
else ok('ชุดข้อมูล · ' + RID + ' ตั้งร้าน ' + R.routeVenue.name + ' ' + R.routeVenue.ad + '/' + R.routeVenue.ch);

/* ── §ovnRet · วันออก run · วันกลาง ovn · วันกลับ run ─────────────────────── */
if (R.st[OUT].k !== 'run') fail('วันออก ' + OUT + ' ควรเป็น run · ได้ ' + R.st[OUT].k);
else ok('วันออก ' + OUT + ' = run');

if (R.st[MID].k !== 'ovn') fail('วันกลาง ' + MID + ' เรืออยู่ที่เกาะ ควรเป็น ovn · ได้ ' + R.st[MID].k);
else ok('วันกลาง ' + MID + ' = ovn (ยังอยู่ที่เกาะ ไม่ได้เปลี่ยน)');

if (R.st[RET].k !== 'run')
  fail('วันกลับ ' + RET + ' ควรเป็น run · ได้ ' + R.st[RET].k + ' → ใบงานเรือซ่อนบล็อกครัว');
else ok('วันกลับ ' + RET + ' = run · ใบงานเรือเปิดบล็อกครัว');

if (R.st[RET].stale)
  fail('วันกลับ ' + RET + ' ยังขึ้น "โปรแกรมค้าง" ทั้งที่โปรแกรมนั้นถูก · มีปุ่ม "เอาออก" ให้กดด้วย');
else ok('วันกลับ ' + RET + ' ไม่มีป้าย "โปรแกรมค้าง" หลอกแล้ว');

/* ── §mealOvnRt · การ์ดครัวต้องหาเส้นทางและร้านเจอ ────────────────────────── */
const V = R.routeVenue || { name: '—', ad: 0, ch: 0 };
if (/ยังไม่ได้ตั้งร้านให้เส้นทางนี้/.test(R.card))
  fail('การ์ดครัวยังขึ้น "ยังไม่ได้ตั้งร้านให้เส้นทางนี้" ทั้งที่ ' + RID + ' ตั้ง ' + V.name + ' ไว้แล้ว');
else ok('การ์ดครัวไม่ขึ้นข้อความ "ยังไม่ได้ตั้งร้าน" อีกแล้ว');

if (R.routeVenue && R.card.indexOf(R.routeVenue.name) < 0)
  fail('การ์ดครัวไม่ขึ้นชื่อร้าน ' + R.routeVenue.name);
else ok('การ์ดครัวขึ้นร้าน ' + V.name);

// ปุ่มส่ง: ยังไม่ระบุครบ = ปุ่ม disabled (ไม่มี onclick) · ระบุครบ = มี pckMealSend
//   จึงเช็คที่ข้อความบนปุ่ม ซึ่งมีทั้งสองกรณี ไม่ใช่ที่ชื่อฟังก์ชัน
const HASBTN = /\u0e2a\u0e48\u0e07\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e23\u0e49\u0e32\u0e19|\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e22\u0e2d\u0e14\u0e2d\u0e32\u0e2b\u0e32\u0e23|\u0e2a\u0e48\u0e07\u0e41\u0e25\u0e49\u0e27/;
if (!HASBTN.test(R.card))
  fail('การ์ดครัวไม่มีปุ่มส่งรายการให้ร้านเลย');
else ok('การ์ดครัวมีปุ่มส่งร้านแล้ว');

// ยังไม่ระบุ = ปุ่มต้องกดไม่ได้ · กติกาเดิมของ §mealOvn ต้องไม่หายไปกับการแก้นี้
if (R.ovn.length && !R.ovn[0].inc && R.card.indexOf('disabled') < 0)
  fail('ยังไม่ระบุรวมอาหาร แต่ปุ่มส่งกดได้');
else ok('ยังไม่ระบุรวมอาหาร · ปุ่มส่งยังกดไม่ได้');

// กด "รวมอาหาร" แล้วต้องคิดเงินออกมาตรงกับราคาร้าน × จำนวนคน
if (R.after && R.routeVenue && R.ovn.length) {
  const want = R.routeVenue.ad * R.ovn[0].pax;
  const seen = [...R.after.matchAll(/&#3647;([\d,]+)/g)].map(m => +m[1].replace(/,/g, ''));
  if (seen.indexOf(want) < 0)
    fail('กดรวมอาหารแล้ว ควรคิดได้ ฿' + want.toLocaleString()
       + ' (' + R.routeVenue.ad + ' × ' + R.ovn[0].pax + ') · การ์ดขึ้น ' + JSON.stringify(seen));
  else ok('กดรวมอาหาร → ฿' + want.toLocaleString() + ' (' + R.routeVenue.ad + ' × ' + R.ovn[0].pax + ')');
} else fail('กดรวมอาหารแล้วไม่ได้การ์ดกลับมา');

if (errors.length) { bad += errors.length; errors.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
