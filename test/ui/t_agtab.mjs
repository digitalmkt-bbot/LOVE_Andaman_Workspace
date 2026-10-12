// §agTab · ป้ายเอเยนต์ของใบที่ขายเอง (B2C) · แผ่นกรมท่า โลโก้ขาว ขอบขวาเฉียงมีแถบฟ้า
//
// Source (2026-10-13) · owner: "อยากปรับ Logo ตรงนี้ใหม่" (กล่องขาวขอบเทา ในช่อง Agency ของ By trip date)
//   แล้วส่งตัวอย่าง · หัวลายเซ็นอีเมล LOVE ANDAMAN · แผ่นกรมท่า โลโก้ขาว มุมขวาเฉียงสีฟ้า (เหมือน assets/la-tab.png)
// Checks
//   1 By trip date (Classic) · ใบ B2C ขึ้นแผ่นกรมท่า + โลโก้ขาว + แถบฟ้า · ไม่ใช่กล่องขาวขอบเทาแบบเดิม
//   2 Compact · ป้ายไม่ถูกเปลี่ยนเป็นแถบสีด้านซ้าย · สูงไม่เกิน 30px และโลโก้ไม่โดนตัด
//   3 เอเยนต์อื่นยังเป็นชิปสีประจำเอเยนต์เหมือนเดิม
//   4 ทุกหน้าที่ใช้ laAgencyMark ได้ป้ายแบบเดียวกัน (ลองที่หน้าเช็คอินหน้าท่า)
//   5 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const SP = process.env.SHOT || '';
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);
const S = await page.evaluate(() => {
  const c = {}; SB_BOOKINGS.forEach(b => { if (b.status !== 'confirmed' || !/^b2c_/.test(b.id)) return; (b.trips || []).forEach(t => { if (t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  try { localStorage.setItem('la_bt_view', 'classic'); } catch (_) {}
  if (typeof btcSet === 'function') btcSet('classic');
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { day, n: c[day] };
});
await page.waitForTimeout(1000);
const read = () => page.evaluate(() => {
  const cells = [...document.querySelectorAll('#view-booking tr.t2-row td.t2-ag')].filter(td => td.offsetParent);
  const b2c = cells.find(td => td.querySelector('img[alt="LOVE andaman"]'));
  const other = cells.find(td => !td.querySelector('img') && td.querySelector('div'));
  if (!b2c) return { none: true };
  const box = b2c.querySelector(':scope > div'), sp = box.querySelectorAll(':scope > span'), img = box.querySelector('img');
  const br = box.getBoundingClientRect(), ir = img.getBoundingClientRect();
  return { cyan: getComputedStyle(sp[0]).backgroundColor, navy: getComputedStyle(sp[1]).backgroundColor, clip: getComputedStyle(sp[1]).clipPath,
    boxBg: getComputedStyle(box).backgroundColor, border: getComputedStyle(box).borderTopWidth, white: img.src === LA_LOGO_WHITE,
    h: Math.round(br.height), clipped: ir.bottom > br.bottom + .5 || ir.top < br.top - .5, btc: box.classList.contains('btc-ag'),
    other: other ? getComputedStyle(other.querySelector('div')).backgroundColor : null };
});
const c1 = await read();
if (!c1.none && c1.cyan === 'rgb(0, 180, 224)' && c1.navy === 'rgb(11, 30, 91)' && /polygon/.test(c1.clip) && c1.white && c1.boxBg === 'rgba(0, 0, 0, 0)' && c1.border === '0px' && !c1.clipped)
  ok(`1 Classic · แผ่นกรมท่า + แถบฟ้า + โลโก้ขาว · สูง ${c1.h}px (${S.day} · B2C ${S.n} ใบ)`); else fail('1 ' + JSON.stringify(c1));
if (c1.other && c1.other !== 'rgba(0, 0, 0, 0)') ok('3 เอเยนต์อื่นยังเป็นชิปสี ' + c1.other); else fail('3 ' + JSON.stringify(c1.other));
if (SP) await page.screenshot({ path: SP + 'agtab_classic.png' });
await page.evaluate(() => { if (typeof btcSet === 'function') btcSet('compact'); }); await page.waitForTimeout(1000);
const c2 = await read();
if (!c2.none && !c2.btc && c2.h <= 30 && !c2.clipped && c2.navy === 'rgb(11, 30, 91)') ok(`2 Compact · ป้ายคงเดิม สูง ${c2.h}px · โลโก้ไม่โดนตัด`); else fail('2 ' + JSON.stringify(c2));
if (SP) await page.screenshot({ path: SP + 'agtab_compact.png' });
await page.evaluate(() => { if (typeof btcSet === 'function') btcSet('classic'); });
const c4 = await page.evaluate(() => { const b = SB_BOOKINGS.find(x => /^b2c_/.test(x.id));
  const w = document.createElement('div'); w.innerHTML = laAgencyMark(b, 14, { inline: true, margin: false, pad: '2px 7px' }); document.body.appendChild(w);
  const box = w.firstChild, sp = box.querySelectorAll(':scope > span'); const r = { title: box.title, navy: getComputedStyle(sp[1]).backgroundColor, img: box.querySelector('img').src === LA_LOGO_WHITE, h: Math.round(box.getBoundingClientRect().height),
    none: laAgencyMark({ id: 'BK-1' }, 14) }; w.remove(); return r; });
if (/Love Andaman/.test(c4.title) && c4.navy === 'rgb(11, 30, 91)' && c4.img && c4.none === '') ok(`4 laAgencyMark (ใช้ทุกหน้า) ได้ป้ายแบบเดียวกัน · inline สูง ${c4.h}px · ใบที่ไม่ใช่ B2C ไม่ได้ป้าย`); else fail('4 ' + JSON.stringify(c4));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 no page errors'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
