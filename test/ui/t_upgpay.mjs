// §upgStay / §upgPay · Upgrade window and where the upgrade note shows on By trip date
//
// Source (2026-10-11) · owner: "ไปที่ปุ่ม Upgrade ลค ไปอีกโปรแกรมก่อน เวลาจัด upgrade มันเด้ง
//   และก็ รายละเอียด Note ย้ายไปอยู่กับ Pay ได้ไหม เพื่อให้เห็นว่าไม่ต้องเก็บเงิน"
// Checks
//   1 picking a programme lower down in a scrolled Upgrade window keeps the scroll (no jump to the top)
//   2 free upgrade · the Pay cell says "ไม่ต้องเก็บเงิน" + from-programme + reason, nothing in Special request
//   3 upgrade with a charge · Pay cell says "ต้องเก็บ ฿500"
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 360 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const S = await page.evaluate(async () => {
  for (const b of SB_BOOKINGS) { if (b.status !== 'confirmed' || /^b2c_/.test(b.id) || (b.trips || []).length !== 1) continue;
    const t = b.trips[0]; if (t.bookingMode === 'charter' || t.ovn || t.ovnLeg || (+t.lockUse > 0) || (t.seatSource && +t.seatSource.locked > 0)) continue;
    const pax = bookingV2PaxAllTot(t.pax || {});
    const T = bookingV2UpgTargets(t.date, t.routeId, b.id).filter(x => x.free == null || x.free >= pax);
    if (!T.length) continue;
    _bkV2.filterDate = t.date; _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700));
    return { id: b.id, date: t.date, from: t.routeId, fromNm: bkUpgRouteName(t.routeId), to: T[T.length - 1].rid }; }
  return { err: 'no upgradable booking' }; });
if (S.err) { fail('setup ' + S.err); await close(); process.exit(1); }

const c1 = await page.evaluate(async s => {
  bookingV2BoatUpgrade(s.id, s.from, s.date); await new Promise(z => setTimeout(z, 200));
  const box = document.querySelector('#bkv2-upg-ov > div'); if (!box) return { err: 'no window' };
  const room = box.scrollHeight - box.clientHeight;
  box.scrollTop = room; const before = box.scrollTop;
  const radio = document.querySelector('#bkv2-upg-ov [data-upg-to="' + s.to + '"] input'); radio.click();
  await new Promise(z => setTimeout(z, 150));
  const box2 = document.querySelector('#bkv2-upg-ov > div');
  return { room, before, after: box2.scrollTop, picked: _bkUpg.to === s.to }; }, S);
if (c1.room > 20 && c1.picked && Math.abs(c1.after - c1.before) <= 2) ok(`1 scrolled ${c1.before}px down, picked a programme · still at ${c1.after}px`);
else fail('1 ' + JSON.stringify(c1));

const cell = () => page.evaluate(s => {
  const tr = [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')].find(r => r.dataset.al.indexOf(s.id) === 0); if (!tr) return null;
  const pay = tr.querySelector('.t2-paywrap .t2-upgpay');
  const outside = [...tr.querySelectorAll('[data-upgnote]')].filter(x => !x.closest('.t2-paywrap')).length;
  const cut = pay ? (pay.scrollWidth > pay.clientWidth + 1 || pay.getBoundingClientRect().right > pay.closest('td').getBoundingClientRect().right + .5) : null;
  return { pay: pay ? pay.textContent.replace(/\s+/g, ' ').trim() : '', outside, cut }; }, S);

await page.evaluate(async s => { _bkUpg.reason = 'Free upgrade'; _bkUpg.charge = ''; bookingV2UpgApply(); await new Promise(z => setTimeout(z, 100)); bookingV2UpgApply(true); await new Promise(z => setTimeout(z, 600)); }, S);
const c2 = await cell();
if (c2 && /ไม่ต้องเก็บเงิน|Nothing to collect/.test(c2.pay) && c2.pay.includes(S.fromNm) && /Free upgrade/.test(c2.pay) && c2.outside === 0 && !c2.cut)
  ok(`2 Pay cell "${c2.pay}" · nothing in Special request`); else fail('2 ' + JSON.stringify(c2));

await page.evaluate(async s => {
  const b = SB_BOOKINGS.find(x => x.id === s.id); bookingV2UpgUndo(s.id, b.trips[0].routeId, s.date); await new Promise(z => setTimeout(z, 400));
  bookingV2BoatUpgrade(s.id, s.from, s.date); await new Promise(z => setTimeout(z, 200));
  _bkUpg.to = s.to; _bkUpg.reason = 'guest asked'; _bkUpg.charge = '500'; bookingV2UpgApply(); await new Promise(z => setTimeout(z, 100)); bookingV2UpgApply(true); await new Promise(z => setTimeout(z, 600)); }, S);
const c3 = await cell();
if (c3 && /(ต้องเก็บ|Collect) ฿500/.test(c3.pay) && /guest asked/.test(c3.pay) && c3.outside === 0) ok(`3 Pay cell "${c3.pay}"`); else fail('3 ' + JSON.stringify(c3));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
