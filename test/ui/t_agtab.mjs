// §agTab · ป้ายเอเยนต์ของใบที่ขายเอง (B2C) · แบบหัวลายเซ็นอีเมลของบริษัท
//
// Source (2026-10-13) · owner: "อยากปรับ Logo ตรงนี้ใหม่" (กล่องขาวขอบเทา ในช่อง Agency ของ By trip date)
//   แล้วส่งตัวอย่าง · หัวลายเซ็นอีเมล LOVE ANDAMAN · แผ่นกรมท่า โลโก้ขาว มุมขวาเฉียงสีฟ้า (เหมือน assets/la-tab.png)
//   §agTab2 · "ใช้แบบ ตามที่เราแนบไปเลย ตัด อีเมล เบอร์โทรออก" → แผ่น la-tab + LOVE ANDAMAN + Your experience, Our Passion
// Checks
//   1 By trip date (Classic) · ใบ B2C ขึ้นแผ่น la-tab + LOVE ANDAMAN + คำขวัญ · ไม่มีอีเมล/เบอร์ · ไม่มี <img> ในช่อง
//   2 Compact · ป้ายไม่ถูกเปลี่ยนเป็นแถบสีด้านซ้าย · สูงไม่เกิน 30px · แผ่นและตัวหนังสือไม่โดนตัด
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
  const b2c = cells.find(td => /LOVE ANDAMAN/.test(td.textContent));
  const other = cells.find(td => td !== b2c && td.querySelector('div') && !/LOVE ANDAMAN/.test(td.textContent));
  if (!b2c) return { none: true };
  const box = b2c.querySelector(':scope > div'), tile = box.querySelector(':scope > span'), txt = box.querySelector(':scope > span:last-child');
  const br = box.getBoundingClientRect(), tr = tile.getBoundingClientRect(), xr = txt.getBoundingClientRect();
  return { tileBg: getComputedStyle(tile).backgroundImage.indexOf(LA_LOGO_TAB.slice(0, 60)) >= 0, tileH: Math.round(tr.height),
    text: txt.textContent.replace(/\s+/g, ' ').trim(), imgs: b2c.querySelectorAll('img').length, boxBg: getComputedStyle(box).backgroundColor,
    h: Math.round(br.height), clipped: tr.bottom > br.bottom + .5 || xr.bottom > br.bottom + .5 || xr.right > br.right + .5
      || [...txt.children].some(c => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > br.right - 1 || c.getBoundingClientRect().bottom > br.bottom + .5), btc: box.classList.contains('btc-ag'),
    other: other ? getComputedStyle(other.querySelector('div')).backgroundColor : null };
});
const c1 = await read();
if (!c1.none && c1.tileBg && /^LOVE ANDAMAN ?Your experience, Our Passion$/.test(c1.text) && !/@|\d{3}-/.test(c1.text) && !c1.imgs && c1.boxBg === 'rgba(0, 0, 0, 0)' && !c1.clipped)
  ok(`1 Classic · แผ่น la-tab ${c1.tileH}px + "${c1.text}" · ไม่มีอีเมล/เบอร์ · สูง ${c1.h}px (${S.day} · B2C ${S.n} ใบ)`); else fail('1 ' + JSON.stringify(c1));
if (c1.other && c1.other !== 'rgba(0, 0, 0, 0)') ok('3 เอเยนต์อื่นยังเป็นชิปสี ' + c1.other); else fail('3 ' + JSON.stringify(c1.other));
if (SP) await page.screenshot({ path: SP + 'agtab_classic.png' });
await page.evaluate(() => { if (typeof btcSet === 'function') btcSet('compact'); }); await page.waitForTimeout(1000);
const c2 = await read();
if (!c2.none && !c2.btc && c2.h <= 30 && !c2.clipped && c2.tileBg && c2.tileH >= 26) ok(`2 Compact · ป้ายคงเดิม สูง ${c2.h}px · แผ่น ${c2.tileH}px ไม่โดนตัด`); else fail('2 ' + JSON.stringify(c2));
if (SP) await page.screenshot({ path: SP + 'agtab_compact.png' });
await page.evaluate(() => { if (typeof btcSet === 'function') btcSet('classic'); });
const c4 = await page.evaluate(() => { const b = SB_BOOKINGS.find(x => /^b2c_/.test(x.id));
  const mk = (h, o) => { const w = document.createElement('div'); w.innerHTML = laAgencyMark(b, h, o); document.body.appendChild(w); const box = w.firstChild;
    const r = { title: box.title, txt: box.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(box.getBoundingClientRect().height) }; w.remove(); return r; };
  return { small: mk(13, { inline: true, margin: false, pad: '3px 6px' }), big: mk(20), none: laAgencyMark({ id: 'BK-1' }, 14) }; });
if (/Love Andaman/.test(c4.small.title) && c4.small.txt === 'LOVE ANDAMAN' && /Our Passion/.test(c4.big.txt) && c4.none === '')
  ok(`4 laAgencyMark (ใช้ทุกหน้า) · ป้ายเล็ก ${c4.small.h}px "${c4.small.txt}" · ป้ายปกติ ${c4.big.h}px มีคำขวัญ · ใบที่ไม่ใช่ B2C ไม่ได้ป้าย`); else fail('4 ' + JSON.stringify(c4));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 no page errors'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
