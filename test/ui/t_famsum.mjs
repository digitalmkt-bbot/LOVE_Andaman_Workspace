// §famSum · By trip date · Programmes card · the programme (family) row sums its variants: locks, booked+locked / seats, free
//
// Source (2026-10-13) · owner screenshot (Similan Islands 234 pax over Early Tratato 🔒38 0/40 · Early Tiger 🔒52 101/155 …):
//   "ตัวผลรวมที่เป็น Variant เพิ่มจำนวนล็อคทั้งหมดด้วย และผลรวมจะเป็นเท่าไหร่"
// Checks (Classic and Compact)
//   1 every family row with locks or seats shows 🔒 Σlocks · รวม Σ(booked+locked)/Σseats · free Σfree
//     and the numbers equal the sums of its variant rows on screen
//   2 total + free = seats (nothing double counted)
//   3 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
await goView(page, 'booking', 700);
await page.evaluate(async () => { const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }));
  const days = Object.keys(c).sort((a, b) => c[b] - c[a]);
  const withLk = days.find(d => (ROUTES || []).some(r => bkV2LockedTotal(r.id, d) > 0));
  _bkV2.filterDate = withLk || days[0];
  // the seed subset has no seat locks · stand in 2 locked seats per programme on this day (by name, so getAllotment
  // subtracts them from the pool exactly as a real lock does)
  if (!withLk) { const D0 = _bkV2.filterDate, o = window.bkV2LockedTotal; window.bkV2LockedTotal = (r, d) => d === D0 ? 2 : o(r, d); } bkV2SwitchTab('bytrip'); btcSet('classic'); await new Promise(z => setTimeout(z, 600)); });
const read = mode => page.evaluate(mode => {
  const out = [];
  document.querySelectorAll('#view-booking .bt-prog .bt-pgf').forEach(f => {
    const fs = f.querySelector('.bt-fsum'); const q = (sel) => { const e = fs && fs.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }; let bk = 0, cap = 0, lk = 0, fr = 0, anyFull = false;
    let v = f.nextElementSibling;
    while (v && !v.classList.contains('bt-pgf')) {
      if (v.classList.contains('bt-pgv') && !v.classList.contains('off')) {
        if (v.querySelector('.bt-free.full')) anyFull = true;
        const t = v.textContent.replace(/\s+/g, ' ');
        if (mode === 'classic') { const s = v.querySelector('.bt-seat'); const m = s && s.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (m) { bk += +m[1]; cap += +m[2]; } else if (s) bk += parseInt(s.textContent) || 0;
          const l = v.querySelector('.bt-lk:not(.bt-bhold)'); if (l) lk += parseInt((l.textContent.match(/\d+/) || [0])[0]); const f2 = v.querySelector('.bt-free:not(.none)'); if (f2 && m) fr += parseInt((f2.textContent.match(/\d+/) || [0])[0]) || 0; }
        else { const st = v.querySelector('.st'); const m = st && st.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (m) { bk += +m[1]; cap += +m[2]; } const l = v.querySelector('.lk'); if (l) lk += parseInt((l.textContent.match(/\d+/) || [0])[0]) || 0; const f2 = v.querySelector('.fr .bt-free:not(.none)'); if (f2 && m) fr += parseInt((f2.textContent.match(/\d+/) || [0])[0]) || 0; }
      }
      v = v.nextElementSibling;
    }
    out.push({ fam: f.querySelector('.nm').textContent, fs: fs ? [q('.lk'), q('.tt'), q('.bt-free')].filter(Boolean).join(' · ') : '', lkT: q('.lk'), ttT: q('.tt'), frT: q('.bt-free'), anyFull, sum: { bk, cap, lk, fr } });
  });
  return out;
}, mode);
const check = (rows, mode) => {
  const badRows = rows.filter(r => {
    if (!r.sum.lk && !r.sum.cap) return !!r.fs && !/รวม/.test(r.fs);
    const lk = +((r.lkT.match(/(\d+)/) || [0, 0])[1]), m = r.ttT.match(/(\d+)(?:\/(\d+))?/), fr = /full|เต็ม/.test(r.frT) ? 0 : +((r.frT.match(/(\d+)/) || [0, 0])[1]);
    if (!m) return true;
    const tot = +m[1], cap = m[2] ? +m[2] : 0;
    return lk !== r.sum.lk || tot !== r.sum.bk + r.sum.lk || cap !== r.sum.cap || (cap && fr !== r.sum.fr) || (cap && !r.anyFull && tot + fr !== cap);
  });
  return badRows;
};
const c1 = await read('classic'), b1 = check(c1, 'classic');
if (c1.length && !b1.length && c1.some(r => r.sum.lk)) ok('1/2 Classic · ' + c1.filter(r => r.fs).map(r => `${r.fam}: "${r.fs}"`).join(' · ')); else fail('1 classic ' + JSON.stringify(b1.length ? b1 : c1));
await page.evaluate(async () => { btcSet('compact'); await new Promise(z => setTimeout(z, 600)); });
const c2 = await read('compact'), b2 = check(c2, 'compact');
if (c2.length && !b2.length) ok('1/2 Compact · ' + c2.filter(r => r.fs).map(r => `${r.fam}: "${r.fs}"`).join(' · ')); else fail('1 compact ' + JSON.stringify(b2.length ? b2 : c2));
if (process.env.SHOT) { const b = await page.locator('#view-booking .bt-prog').first().boundingBox(); await page.screenshot({ path: process.env.SHOT, clip: b }); }
await page.evaluate(() => btcSet('classic'));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('3 no page errors'); else fail('3 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
