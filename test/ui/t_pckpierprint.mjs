// §pckPierPrint · เช็คอินหน้าท่า · ปุ่มพิมพ์ "ทุกลำ" ต้องพิมพ์เฉพาะท่าที่เลือก
//
// ที่มา (2026-10-14) · owner (screenshot กล่องถาม "ยังไม่ได้จ่ายไกด์ให้ 10 ลำ (Tadeo, … Zeus)" ทั้งที่เลือกท่าพังงาอยู่): "อันนี้ต้องแยกบายท่าเรือด้วย"
// กัน
//   1 เลือกท่า A · goPrint('all') ถามเฉพาะเรือของท่า A และบอกชื่อท่าในกล่อง
//   2 เลือกท่า A · pckTravelReg('all') / pckGuideJobOrder('all') ได้เฉพาะลำของท่า A
//   3 ทุกท่า (ไม่เลือก) · ได้ทุกลำเหมือนเดิม
//   4 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'piercheckin', 700);
const S = await page.evaluate(() => {
  const D = '2026-09-23'; _pckDate = D;
  const piers = ['tublamu', 'panwa'];
  const boats = {}, rts = {};
  piers.forEach(k => { boats[k] = (BOATS || []).filter(b => (b.pier || '') === k).slice(0, 2).map(b => b.id); rts[k] = (ROUTES || []).find(r => (r.pier || '') === k).id; });
  let n = 0;
  piers.forEach(k => boats[k].forEach(bid => { n++; SB_BOOKINGS.push({ id: 'zz_pp' + n, schemaVer: 2, status: 'confirmed', leadPax: 'Test ' + n, createdAt: D + 'T08:00:00', trips: [{ routeId: rts[k], date: D, pax: { ad_fr: 2 } }], ops: { boatId: bid }, passengers: [{ name: 'Test Pax ' + n, type: 'AD' }] }); }));
  return { D, boats };
});
const run = (pier) => page.evaluate(async (pier) => {
  _pckPier = pier;
  const out = { confirm: '', win: [], alert: '' };
  const oc = window.confirm, oo = window.open, oa = window.alert;
  window.confirm = (m) => { out.confirm = m; return false; };
  window.alert = (m) => { out.alert = m; };
  window.open = () => { const w = { document: { open() {}, write(h) { out.win.push(h); }, close() {} }, focus() {}, print() {} }; return w; };
  try { goPrint('all'); } catch (e) { out.err = String(e); }
  try { pckTravelReg('all'); } catch (e) { out.err2 = String(e); }
  try { pckGuideJobOrder('all'); } catch (e) { out.err3 = String(e); }
  window.confirm = oc; window.open = oo; window.alert = oa;
  return out;
}, pier);
const names = (ids) => page.evaluate((ids) => ids.map(id => (getBoat(id) || {}).name || id), ids);
const tl = await names(S.boats.tublamu), pw = await names(S.boats.panwa);
const a = await run('panwa');
const inA = (txt) => pw.every(n => txt.indexOf(n) >= 0) && tl.every(n => txt.indexOf(n) < 0);
if (a.confirm && /ท่าพันวา/.test(a.confirm) && inA(a.confirm)) ok(`1 ท่าพันวา · กล่องถามเฉพาะเรือพันวา: "${a.confirm.split('\n')[0]}"`); else fail('1 ' + JSON.stringify({ c: a.confirm, tl, pw, err: a.err }));
const reg = a.win[0] || '', gjo = a.win[1] || '';
if (a.win.length === 2 && inA(reg) && /ท่าพันวา/.test(reg) && inA(gjo)) ok('2 ทะเบียนรายชื่อ / ใบงานไกด์ เฉพาะลำพันวา'); else fail('2 ' + JSON.stringify({ n: a.win.length, regOk: inA(reg), gjoOk: inA(gjo), err2: a.err2, err3: a.err3 }));
const b = await run(null);
const allIn = (txt) => pw.concat(tl).every(n => txt.indexOf(n) >= 0);
if (b.confirm && allIn(b.confirm) && b.win.length === 2 && allIn(b.win[0]) && allIn(b.win[1])) ok('3 ทุกท่า · ได้ทุกลำเหมือนเดิม'); else fail('3 ' + JSON.stringify({ c: b.confirm, n: b.win.length }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
