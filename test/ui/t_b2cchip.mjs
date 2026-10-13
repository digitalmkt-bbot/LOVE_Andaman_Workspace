// §b2cChipFit · By trip date · the "B2C changes" button must not sit on top of LOVE ANDAMAN in the date row
//
// Source (2026-10-13) · owner screenshot (Compact, 15 Oct): the orange "B2C changes 1 to review" button lay across
//   the centred "L O V E  A N D A M A N" · "ตรวจหน่อย"
// Cause: the button and the Classic/Compact switch both had margin-left:auto, so the free space was split
//   and the button landed mid-row · the centred name is absolute and keeps no room of its own
// Checks (1280 / 1440 / 1600 / 1920 · Classic and Compact)
//   1 the button never overlaps the centred name, the view switch or the date arrows
//   2 the button sits right next to the view switch on the right
//   3 the centred name stays visible where it fits (≥1440) · hidden only where it would collide
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const rows = [];
for (const W of [1280, 1440, 1600, 1920]) for (const MODE of ['classic', 'compact']) {
  const { page, errors, close } = await open({ blob: process.env.LAD, width: W, height: 900 });
  await goView(page, 'booking', 700);
  const r = await page.evaluate(async MODE => {
    window.bkV2B2CList = () => [{}];   // one pending B2C change → the button shows
    const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date) c[t.date] = (c[t.date] || 0) + 1; }));
    _bkV2.filterDate = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; bkV2SwitchTab('bytrip'); btcSet(MODE); await new Promise(z => setTimeout(z, 700));
    const hd = document.querySelector('#view-booking .bt-hdtop');
    const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? [r.left, r.right] : null; };
    const br = hd.querySelector('.bt-brand'), shown = getComputedStyle(br).visibility !== 'hidden';
    const chip = R(hd.querySelector('.bt-b2cbtn')), tg = R(hd.querySelector('.btc-tg')), brand = shown ? R(br) : null;
    const arrows = [...hd.querySelectorAll('.bt-arw, .bt-today')].map(R);
    const ov = (a, b) => !!(a && b && a[0] < b[1] && b[0] < a[1]);
    return { chip, tg, shown, txt: (hd.querySelector('.bt-b2cbtn') || {}).textContent,
      hitBrand: ov(chip, brand), hitTg: ov(chip, tg), hitArrows: arrows.some(a => ov(chip, a)), brandOnArrows: arrows.some(a => ov(brand, a)),
      gap: chip && tg ? Math.round(tg[0] - chip[1]) : null };
  }, MODE);
  r.err = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e)).length;
  rows.push({ W, MODE, ...r }); await close();
}
const s = r => `${r.W} ${r.MODE}`;
const b1 = rows.filter(r => !r.chip || r.hitBrand || r.hitTg || r.hitArrows || r.brandOnArrows);
if (!b1.length) ok('1 no overlap in ' + rows.length + ' layouts · button "' + rows[0].txt.trim() + '"'); else fail('1 ' + JSON.stringify(b1));
const b2 = rows.filter(r => !(r.gap >= 6 && r.gap <= 30));
if (!b2.length) ok('2 button next to the view switch (gap ' + [...new Set(rows.map(r => r.gap))].join('/') + 'px)'); else fail('2 ' + JSON.stringify(b2.map(r => [s(r), r.gap])));
const b3 = rows.filter(r => r.W >= 1440 && !r.shown);
if (!b3.length) ok('3 name shown at ' + rows.filter(r => r.shown).map(s).join(', ') + ' · hidden at ' + (rows.filter(r => !r.shown).map(s).join(', ') || 'none')); else fail('3 ' + JSON.stringify(b3.map(s)));
const b4 = rows.filter(r => r.err);
if (!b4.length) ok('4 no page errors'); else fail('4 ' + JSON.stringify(b4.map(s)));
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
