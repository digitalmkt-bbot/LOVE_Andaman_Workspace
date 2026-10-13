// §fcMob · §freeFirst · §fcLoad · Fleet Calendar · desktop matrix + phone (By day / By boat)
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const shot = process.env.SHOT;
// desktop
{
  const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
  const r = await page.evaluate(() => {
    const boatNames = new RegExp(BOATS.map(b => String(b.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'); nav(document.querySelector('.nav-item[data-view="fleetcal"]')); _fc.mode = 'm7'; _fc.from = '2026-10-13'; renderFleetCal();
    const firstRows = [...document.querySelectorAll('#fc-host tr.fc-mg')].map(tr => { let n = tr.nextElementSibling; return n && n.classList.contains('fr') ? 'free' : (n ? n.className : ''); });
    return { mobile: !!document.querySelector('#fc-host .fm'), firstRows, over: document.querySelectorAll('#fc-host .fc-bc.ov').length,
      chips: [...document.querySelectorAll('#fc-host .fc-chip')].map(x => x.textContent), thai: /[฀-๿]/.test(document.getElementById('fc-host').innerText.replace(boatNames,'')) };
  });
  if (!r.mobile && r.firstRows.filter(x => x === 'free').length >= 2 && r.firstRows.every(x => x === 'free' || x === 'fc-dorm')) ok('desktop · ทุกท่าแถวแรกเป็น Free at pier · ' + r.firstRows.length + ' ท่า');
  else fail('desktop rows ' + JSON.stringify(r));
  if (/^Free at pier/.test(r.chips[0] || '')) ok('desktop · ชิปหัว: ' + r.chips.join(' | ')); else fail('chips ' + JSON.stringify(r.chips));
  if (!r.thai) ok('desktop · ไม่มีตัวอักษรไทยบนหน้า'); else fail('desktop มีภาษาไทย');
  ok('desktop · ชิปเกินที่นั่ง ' + r.over + ' ช่อง');
  if (shot) await page.screenshot({ path: shot + '_desk.png', fullPage: false });
  const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e)); if (e1.length) fail('desktop console: ' + e1.slice(0, 2).join(' | '));
  await close();
}
// phone
{
  const { page, errors, close } = await open({ blob: process.env.LAD, width: 390, height: 844 });
  const r = await page.evaluate(() => {
    const boatNames = new RegExp(BOATS.map(b => String(b.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'); nav(document.querySelector('.nav-item[data-view="fleetcal"]')); _fc.mfrom = '2026-10-13'; _fc.sel = '2026-10-15'; _fc.mob = 'day'; renderFleetCal();
    const host = document.getElementById('fc-host');
    const day = { mobile: !!host.querySelector('.fm'), days: host.querySelectorAll('.fm-day').length, cards: [...host.querySelectorAll('section.fm-card')].map(s => (s.children[1] || {}).className), sw: document.documentElement.scrollWidth, thai: /[฀-๿]/.test(host.innerText.replace(boatNames,'')) };
    fcMobMode('boat');
    const grid = host.querySelector('.fm-g'); const firstAfterPier = [...host.querySelectorAll('.fm-gp')].map(gp => (gp.nextElementSibling || {}).className);
    const boat = { grid: !!grid, rows: host.querySelectorAll('.fm-gb').length, firstAfterPier, sw: document.documentElement.scrollWidth, thai: /[฀-๿]/.test(host.innerText.replace(boatNames,'')) };
    fcMobMode('day');
    return { day, boat };
  });
  const d = r.day, b = r.boat;
  if (d.mobile && d.days === 7 && d.cards.length && d.cards.filter(c => /fm-free/.test(c || '')).length >= 2 && d.cards.every(c => /fm-free|fm-note/.test(c || '')) && d.sw <= 392) ok(`phone By day · 7 วัน · ${d.cards.length} การ์ด ทุกการ์ดเปิดด้วย Free at pier · ไม่ล้นจอ (${d.sw}px)`);
  else fail('phone day ' + JSON.stringify(d));
  if (b.grid && b.rows > 0 && b.firstAfterPier.filter(c => c !== 'fm-gb').every(c => c === 'fm-gf') && b.sw <= 392) ok(`phone By boat · ${b.rows} ลำ · แถว Free ขึ้นก่อนทุกท่า · ไม่ล้นจอ (${b.sw}px)`);
  else fail('phone boat ' + JSON.stringify(b));
  if (!d.thai && !b.thai) ok('phone · ไม่มีตัวอักษรไทย'); else fail('phone มีภาษาไทย');
  if (shot) { await page.screenshot({ path: shot + '_day.png', fullPage: true }); await page.evaluate(() => fcMobMode('boat')); await page.screenshot({ path: shot + '_boat.png', fullPage: true }); }
  const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e)); if (!e1.length) ok('phone · ไม่มี error'); else fail('phone console: ' + e1.slice(0, 2).join(' | '));
  await close();
}
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
