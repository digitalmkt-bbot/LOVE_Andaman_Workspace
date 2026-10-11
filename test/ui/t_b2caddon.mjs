// §b2cAddon · B2C add-on bought for a trip that was booked through an agent
//
// Source (2026-10-11) · owner, about LOV-4575619 / LOV-6128092 flagged "จำนวนคนเป็น 0":
//   "ลค จองทริปกับเอเจ้น แล้วมาจองบริการเสริมผ่านบริษัท ทีนี้มันเลยเข้ามาแค่บริการเสริม"
//   Sales write the agent voucher in the B2C special request ("ลูกค้าจองมาใน VC 22433 จาก IN&OUT").
//
// Checks
//   1 the add-on-only B2C booking links to the agent booking whose voucherRef is in its notes (same date)
//   2 a ref with no booking on that date → no link (never guessed)
//   3 the longtail charter counts on the agent booking (ExtraBoats +1, bkLtState charter) and NOT on the B2C one
//   4 By trip date · agent row shows "Longtail Charter · B2C LOV-…", the B2C row shows "↳ ของ VC 22433"
//   5 B2C check panel · linked line listed in the green section, the real problem stays above it
//   6 no page errors
import { open, goView } from './_harness.mjs';
import fs from 'node:fs';
/* the panel code lives in 01-auth-sync.js inside the logged-in block the harness never reaches
   (no server) · lift exactly that slice into the page, with stand-ins for its two closure helpers */
const AUTH = fs.readFileSync(new URL('../../allotment_v2/js/01-auth-sync.js', import.meta.url), 'utf8');
const PANEL = AUTH.slice(AUTH.indexOf("var _LA_B2CI_KEY="), AUTH.indexOf('// Real-time push via SSE'));
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);

const S = await page.evaluate(() => {
  const c = {}; (SB_BOOKINGS || []).forEach(b => { if (b.status !== 'confirmed' || b.agentId === 'a_b2c') return; (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const A = SB_BOOKINGS.find(b => b.status === 'confirmed' && b.agentId !== 'a_b2c' && (b.trips || []).some(t => t.date === day));
  const tA = A.trips.find(t => t.date === day);
  A.voucherRef = '22433';
  const base = bkV2LongtailCharterExtraBoats(A.id, day), baseLt = bkLtState(A, tA.routeId, day);
  const mk = (id, notes, date) => ({ id, schemaVer: 2, agentId: 'a_b2c', voucherRef: id.replace(/^b2c_|_1$/g, ''), status: 'confirmed', leadPax: 'คุณทดสอบ',
    notes, note: 'B2C · Facebook · ' + id, trips: [{ routeId: tA.routeId, date, bookingMode: 'seat', pax: { ad_fr: 0, ad_th: 0, chd_fr: 0, chd_th: 0, inf_fr: 0, inf_th: 0, foc: 0, foc_fr: 0, foc_th: 0 } }],
    addOns: [{ type: 'longtail-charter', label: 'Longtail Charter', qty: 1, amount: 4999, note: '' }], passengers: [], history: [] });
  const L = mk('b2c_LOV-7770001_1', 'ลูกค้าจองมาใน VC 22433 จาก IN&OUT / ลูกค้า 6 ท่าน', day);
  const N = mk('b2c_LOV-7770002_1', 'จองผ่าน KLOOK Ref: ZZZ999999', day);
  SB_BOOKINGS.push(L, N);
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { day, A: A.id, route: tA.routeId, L: L.id, N: N.id, base, baseBoats: baseLt.boats || 0 };
});
await page.waitForTimeout(1200);

const c1 = await page.evaluate(S => { const L = SB_BOOKINGS.find(b => b.id === S.L), N = SB_BOOKINGS.find(b => b.id === S.N);
  const to = typeof bkB2CAddonTo === 'function' ? bkB2CAddonTo(L) : null;
  return { to: to && to.bk.id, vc: to && to.vc, of: (typeof bkB2CAddonsOf === 'function' ? bkB2CAddonsOf(S.A, S.day) : []).map(b => b.id), n: typeof bkB2CAddonTo === 'function' ? bkB2CAddonTo(N) : 'nofn' }; }, S);
if (c1.to === S.A && c1.vc === '22433' && c1.of.includes(S.L)) ok(`1 ${S.L} → agent booking ${S.A} (VC ${c1.vc}) on ${S.day}`); else fail('1 ' + JSON.stringify(c1));
if (c1.n === null && !c1.of.includes(S.N)) ok('2 a ref with no booking that day → no link'); else fail('2 ' + JSON.stringify(c1));

const c3 = await page.evaluate(S => { const A = SB_BOOKINGS.find(b => b.id === S.A), L = SB_BOOKINGS.find(b => b.id === S.L);
  return { ex: bkV2LongtailCharterExtraBoats(S.A, S.day), lt: bkLtState(A, S.route, S.day), ltL: bkLtState(L, S.route, S.day) }; }, S);
if (c3.ex === S.base + 1 && c3.lt.mode === 'charter' && c3.lt.boats === S.baseBoats + 1 && c3.ltL.mode === 'none')
  ok(`3 charter counted once, on the agent booking (boats ${S.baseBoats} → ${c3.lt.boats}); B2C line itself = none`);
else fail('3 ' + JSON.stringify(c3));

const c4 = await page.evaluate(S => {
  const inA = [...document.querySelectorAll('#view-booking .b2c-addon-in')].map(e => e.textContent.trim());
  const ofL = [...document.querySelectorAll('#view-booking .b2c-addon-of')].map(e => e.textContent.trim());
  return { inA, ofL }; }, S);
if (c4.inA.some(t => /Longtail Charter/.test(t) && /B2C LOV-7770001/.test(t)) && c4.ofL.some(t => /VC 22433/.test(t)))
  ok(`4 By trip date · agent row "${c4.inA[0]}" · B2C row "${c4.ofL[0]}"`);
else fail('4 ' + JSON.stringify(c4));

const c5 = await page.evaluate(async ([S, PANEL]) => {
  if (typeof window._laB2CIssues !== 'function') (new Function('esc', 'bust', PANEL))(
    v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), u => u);
  const fake = { issues: [
    { id: 'b2c_LOV-6882506_3', ref: 'LOV-6882506', code: 'route', sev: 'warn', msg: 'หาเส้นทางไม่เจอ (?)' },
    { id: S.L, ref: 'LOV-7770001', code: 'addon_linked', sev: 'info', msg: 'บริการเสริมของใบเอเจนต์ VC 22433 · ขึ้นที่แถวของใบนั้น · ไม่กินที่นั่ง' }] };
  const X = window.XMLHttpRequest;
  window.XMLHttpRequest = function () { const me = this; this.open = () => {}; this.send = () => setTimeout(() => { me.responseText = JSON.stringify(fake); me.onload && me.onload(); }, 10); };
  try { localStorage.removeItem('la_b2c_issue_hide'); } catch (e) {}
  _laB2CIssues({ issueCount: 1, issueSig: 'zz' + Date.now() });
  _laB2CIssuesOpen(); await new Promise(z => setTimeout(z, 200));
  window.XMLHttpRequest = X;
  const box = document.getElementById('la-b2c-issues-list');
  const warn = [...box.querySelectorAll('.la-b2ci-warn')].map(e => e.textContent.trim()), green = [...box.querySelectorAll('.la-b2ci-ok')].map(e => e.textContent.trim());
  const hd = document.querySelector('#la-b2c-issues b').textContent.trim();
  return { warn, green, hd, order: box.innerHTML.indexOf('la-b2ci-warn') < box.innerHTML.indexOf('la-b2ci-ok') }; }, [S, PANEL]);
if (c5.warn.length === 1 && c5.green.length === 1 && /VC 22433/.test(c5.green[0]) && c5.order && /1 รายการ/.test(c5.hd))
  ok(`5 panel "${c5.hd}" · problem above, linked add-on in the green section`);
else fail('5 ' + JSON.stringify(c5));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 no page errors'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
