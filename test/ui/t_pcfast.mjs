// §pcFast · petty cash (เงินสดย่อย) · a click must not re-read the whole blob / all bookings hundreds of times
//
// Source (2026-10-11) · owner: "ดูเรื่องการคลิก มันจะดีเลย์ไปนิดนึง ตรงแต่ล่ะหัวข้อ"
//   Measured on the 9 Oct backup (5,399 bookings): 0.3–1 s per tab/day click. Two causes:
//   laBlob() = localStorage.getItem of the whole blob on every pcArr call (hundreds per render),
//   and pxLongtail / pcPax / poBoats each scanning every booking for every day × boat.
// Checks
//   1 ckBksOn(date) = the bookings with a trip that day, in SB_BOOKINGS order
//   2 a booking added later shows up (index rebuilds on length change)
//   3 one tab render reads localStorage at most twice (was once per pcArr call)
//   4 laBlob is not left pinned after a render (later reads see new data)
//   5 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1000 });
await goView(page, 'pop-panwa', 1200);
const R = await page.evaluate(async () => {
  const out = {};
  const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }));
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const want = SB_BOOKINGS.filter(b => (b.trips || []).some(t => t.date === day)).map(b => b.id);
  const got = (typeof ckBksOn === 'function' ? ckBksOn(day) : []).map(b => b.id);
  out.c1 = { day, n: want.length, same: JSON.stringify(want) === JSON.stringify(got) };
  SB_BOOKINGS.push({ id: 'zz_pcfast', status: 'confirmed', trips: [{ date: day, routeId: 'r1', pax: {} }] });
  out.c2 = (typeof ckBksOn === 'function' ? ckBksOn(day) : []).some(b => b.id === 'zz_pcfast');
  SB_BOOKINGS.pop();
  _pcDate = day; _pcYM = day.slice(0, 7);
  const proto = Object.getPrototypeOf(localStorage), orig = proto.getItem; let n = 0;
  proto.getItem = function (k) { if (k === LS_KEY) n++; return orig.apply(this, arguments); };
  try { out.reads = {}; for (const t of [0, 1, 2]) { n = 0; pcTab(t); out.reads[t] = n; } } finally { proto.getItem = orig; }
  out.pinned = (typeof _laBlobPin !== 'undefined') ? _laBlobPin : null;
  return out; });
if (R.c1.same && R.c1.n > 0) ok(`1 ckBksOn(${R.c1.day}) = ${R.c1.n} bookings, same order as SB_BOOKINGS`); else fail('1 ' + JSON.stringify(R.c1));
if (R.c2) ok('2 a booking added afterwards is found'); else fail('2');
if (Object.values(R.reads).every(v => v <= 2)) ok('3 blob reads per tab render: ' + JSON.stringify(R.reads)); else fail('3 ' + JSON.stringify(R.reads));
if (R.pinned === null) ok('4 blob not left pinned after render'); else fail('4 pinned');
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 no page errors'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
