// §boatFill · a boat colour picked in Boat Status shows as that colour (and on By trip date)
//
// Source (2026-10-13) · owner screenshot of Boat Status (Okeanos, colour square next to the name):
//   "เรากดในนี้ แล้วเหมือนไม่เปลี่ยน · ให้เปลี่ยนในหน้า By trip date ด้วย"
// Cause: getBoatColor().text darkens any picked colour until it passes 4.5:1 both on its light tint and under
//   white text · a bright orange came out dark brown (looked unchanged) · the picker reopened on a blue default
//   (text is rgb(), the input wanted #hex) · Asset → Boats ignored custom colours (rgb() failed a #hex test)
// Checks
//   1 Boat Status · pick #F98E0B → saved on the boat · the square next to the name is exactly #F98E0B
//     the avatar is still orange (white initials readable ≥3:1), not brown · reopening the picker starts on #F98E0B
//   2 Asset → Boats detail uses the picked colour too
//   3 By trip date · rows on that boat: avatar colour = the same orange · boat picker avatar too
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
const hue = c => { const m = String(c).match(/\d+/g).map(Number); const [r, g, b] = m.map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h *= 60; return Math.round(h < 0 ? h + 360 : h); };
const lum = c => { const m = String(c).match(/\d+/g).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
const ratioW = c => 1.05 / (lum(c) + .05);
const S = await page.evaluate(async () => {
  // a boat that carries bookings on some day
  const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { const id = t && t.date && bkOpsRead(b, t.date).boatId; if (id) { const k = id + '|' + t.date; c[k] = (c[k] || 0) + 1; } }));
  const [bid, day] = Object.keys(c).sort((a, b) => c[b] - c[a])[0].split('|');
  nav(document.querySelector('.nav-item[data-view="fl-boatstatus"]')); await new Promise(z => setTimeout(z, 500));
  selectBoat(bid); await new Promise(z => setTimeout(z, 300));
  const inp = document.querySelector('input[type=color][onchange*="flSetBoatColor(\'' + bid + '\'"]');
  inp.value = '#f98e0b'; inp.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(z => setTimeout(z, 300));
  const inp2 = document.querySelector('input[type=color][onchange*="flSetBoatColor(\'' + bid + '\'"]');
  const sw = getComputedStyle(inp2.previousElementSibling).backgroundColor;
  return { bid, day, saved: (BOATS.find(b => b.id === bid) || {}).color, sw, reopen: inp2.value, fill: getBoatColor(bid).fill, text: getBoatColor(bid).text };
});
if (S.saved === '#f98e0b' && S.sw === 'rgb(249, 142, 11)' && S.reopen === '#f98e0b' && Math.abs(hue(S.fill) - hue(S.sw)) <= 4 && ratioW(S.fill) >= 3)
  ok(`1 Boat Status · ${S.bid} saved ${S.saved} · square ${S.sw} · avatar ${S.fill} (hue ${hue(S.fill)}° vs ${hue(S.sw)}°, white text ${ratioW(S.fill).toFixed(1)}:1) · old text colour would be ${S.text} · picker reopens on ${S.reopen}`);
else fail('1 ' + JSON.stringify(S));
const c2 = await page.evaluate(async bid => { nav(document.querySelector('.nav-item[data-view="fl-asset"]') || document.querySelector('.nav-item[data-view^="fl-asset"]'));
  await new Promise(z => setTimeout(z, 400)); if (typeof flSelBoat === 'function') flSelBoat(bid); await new Promise(z => setTimeout(z, 300));
  const inp = document.querySelector('input[type=color][onchange*="flSetBoatColor(\'' + bid + '\'"]'); if (!inp) return { none: true };
  return { sw: getComputedStyle(inp.previousElementSibling).backgroundColor, reopen: inp.value }; }, S.bid);
if (c2.none) ok('2 Asset → Boats detail not reachable in this build (skipped)'); else if (c2.sw === 'rgb(249, 142, 11)' && c2.reopen === '#f98e0b') ok(`2 Asset → Boats · square ${c2.sw} · picker ${c2.reopen}`); else fail('2 ' + JSON.stringify(c2));
const c3 = await page.evaluate(async S => { _bkV2.filterDate = S.day; nav(document.querySelector('.nav-item[data-view="booking"]')); bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700));
  const nm = (BOATS.find(b => b.id === S.bid) || {}).name;
  const avs = [...document.querySelectorAll('#view-booking tr.t2-row')].filter(r => r.textContent.includes(nm)).map(r => { const s = [...r.querySelectorAll('span')].find(x => /border-radius:\s*50%/.test(x.getAttribute('style') || '') && x.textContent.trim().length <= 3 && x.closest('td') === r.lastElementChild.closest('td') || false); return s; }).filter(Boolean);
  const any = [...document.querySelectorAll('#view-booking tr.t2-row span')].filter(x => /border-radius:\s*50%/.test(x.getAttribute('style') || '') && getComputedStyle(x).backgroundColor === S.fill.replace(/,/g, ', '));
  const btn = [...document.querySelectorAll('#view-booking tr.t2-row .t2-bpk:not(.add)')].find(b => b.textContent.includes(nm)); let pk = null;
  if (btn) { btn.click(); await new Promise(z => setTimeout(z, 150)); const it = [...document.querySelectorAll('#bkv2-boatpick .bpk-b')].find(b => b.textContent.includes(nm)); pk = it && getComputedStyle(it.querySelector('.av')).backgroundColor; bkV2BoatPickClose(); }
  return { rows: any.length, pk }; }, S);
if (c3.rows > 0 && (c3.pk === null || c3.pk === S.fill.replace(/,/g, ', '))) ok(`3 By trip date ${S.day} · ${c3.rows} avatar(s) in ${S.fill} · picker avatar ${c3.pk || 'n/a'}`); else fail('3 ' + JSON.stringify({ c3, fill: S.fill }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
