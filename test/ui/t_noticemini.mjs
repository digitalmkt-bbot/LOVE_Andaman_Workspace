// §noticeMini · the two bottom-left notices fit the narrow sidebar lane when the sidebar is collapsed
//
// Source (2026-10-13) · owner screenshot (sidebar collapsed, By trip date): "มีข้อมูลใหม่จากคนอื่น" and
//   "ใบ B2C ที่ต้องเช็ค 2 รายการ" lay across the first table column · "ปรับอันนี้หน่อย เวลาเรายุบหน้าจอ"
// Checks
//   1 sidebar open · both notices as before (250px wide, full text)
//   2 sidebar collapsed · both fit the 84px lane: right edge left of the main content, no overlap with each other
//     or with the user badge · "มีข้อมูลใหม่" keeps its load button · B2C shows "⚠ 2" + "B2C เช็ค"
//   3 collapsed · click the B2C notice → the list opens wide as before
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 900 });
page.on('dialog', d => d.accept());
await page.route('**/api/b2c/health**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ issues: [{ id: 'b2c_x', ref: 'LOV-1', msg: 'test issue' }] }) }));
await goView(page, 'booking', 700);
// the live notices need a logged-in server (the B2C one is built inside 01-auth-sync's server block) · here they are
// rebuilt with the same markup that file writes (kept in sync by check 0 below)
const SRC = (await import('node:fs')).readFileSync(new URL('../../allotment_v2/js/01-auth-sync.js', import.meta.url), 'utf8');
if (/class="la-b2ci-sh" onclick="_laB2CIssuesOpen\(\)"/.test(SRC) && /class="la-b2ci-full"/.test(SRC)) ok('0 01-auth-sync writes the short (.la-b2ci-sh) and full (.la-b2ci-full) B2C rows'); else fail('0 markup missing in 01-auth-sync.js');
await page.evaluate(() => { const b = document.createElement('div'); b.id = 'la-b2c-issues';
  b.innerHTML = '<div class="la-b2ci-sh" onclick="_laB2CIssuesOpen()"><b>&#9888; 2</b><i>B2C เช็ค</i></div><div class="la-b2ci-full" style="display:flex;align-items:center;gap:8px;padding:8px 10px 8px 12px"><span>&#9888;</span><b style="cursor:pointer;flex:1" onclick="_laB2CIssuesOpen()">ใบ B2C ที่ต้องเช็ค 2 รายการ</b><span>&times;</span></div><div id="la-b2c-issues-list" style="display:none"></div>';
  document.body.appendChild(b);
  window._laB2CIssuesOpen = window._laB2CIssuesOpen || function () { const l = document.getElementById('la-b2c-issues-list'); b.classList.add('open'); l.style.display = 'block'; l.innerHTML = '<div style="padding:10px 12px">LOV-1 · test issue</div>'; };
  const d = document.createElement('div'); d.id = 'la-refresh';
  d.innerHTML = '<span class="la-rf-dot"></span><span class="la-rf-tx"><b>มีข้อมูลใหม่จากคนอื่น</b><i>โดย someone · จะรีเฟรชอัตโนมัติเมื่อว่าง</i></span><button>โหลดเลย</button>'; document.body.appendChild(d); });
const M = () => page.evaluate(() => { const R = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }; };
  const rf = document.getElementById('la-refresh'), bi = document.getElementById('la-b2c-issues'), ub = document.getElementById('la-userbadge'), mn = document.querySelector('.main');
  const vis = e => e && getComputedStyle(e).display !== 'none';
  return { rf: R(rf), bi: R(bi), ub: ub && vis(ub) ? R(ub) : null, main: Math.round(mn.getBoundingClientRect().left + parseFloat(getComputedStyle(mn).paddingLeft)),
    rfTxt: rf.innerText.replace(/\s+/g, ' ').trim(), biTxt: bi.innerText.replace(/\s+/g, ' ').trim(), btn: R(rf.querySelector('button')) }; });
const ov = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const sbOpen = await page.evaluate(() => !document.body.classList.contains('sb-collapsed'));
if (!sbOpen) await page.click('.sb-toggle');
const m1 = await M();
if (m1.rf.w > 200 && m1.bi.w > 200 && /ใบ B2C ที่ต้องเช็ค 2 รายการ/.test(m1.biTxt) && /จะรีเฟรช/.test(m1.rfTxt)) ok(`1 sidebar open · refresh ${m1.rf.w}px · B2C ${m1.bi.w}px · full text`); else fail('1 ' + JSON.stringify(m1));
await page.click('.sb-toggle'); await page.waitForTimeout(400);
const m2 = await M();
const fit = x => x.r <= m2.main - 4;
if (fit(m2.rf) && fit(m2.bi) && !ov(m2.rf, m2.bi) && !ov(m2.bi, m2.ub) && !ov(m2.rf, m2.ub) && m2.btn.w > 40 && /^⚠ 2 B2C เช็ค$/.test(m2.biTxt))
  ok(`2 collapsed · refresh ${m2.rf.w}px (${m2.rfTxt}) · B2C ${m2.bi.w}px (${m2.biTxt}) · both end at ${Math.max(m2.rf.r, m2.bi.r)}px, content starts ${m2.main}px · no overlap`);
else fail('2 ' + JSON.stringify(m2));
await page.click('#la-b2c-issues .la-b2ci-sh'); await page.waitForTimeout(400);
const m3 = await page.evaluate(() => { const e = document.getElementById('la-b2c-issues'); return { open: e.classList.contains('open'), w: Math.round(e.getBoundingClientRect().width), list: (document.getElementById('la-b2c-issues-list') || {}).innerText }; });
if (m3.open && m3.w > 300 && /LOV-1/.test(m3.list)) ok(`3 collapsed · click → list opens ${m3.w}px wide`); else fail('3 ' + JSON.stringify(m3));
if (process.env.SHOT) { await page.click('#la-b2c-issues .la-b2ci-full b').catch(() => {}); await page.evaluate(() => { const e = document.getElementById('la-b2c-issues'); e.classList.remove('open'); document.getElementById('la-b2c-issues-list').style.display = 'none'; }); await page.waitForTimeout(200);
  await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 900 - 330, width: 520, height: 330 } }); }
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
