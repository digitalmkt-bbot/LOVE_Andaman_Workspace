// §pkLineOrd · เงินสดย่อย · บรรทัดค่าอุทยานในสมุด (ดึงรายลำ)
// ที่มา (2026-10-15) · owner ส่งภาพสมุด 15 ต.ค.: Zeus · Verona · Tadeo (สุรินทร์) · BMP · Aluminous1 · Artemis
//   "แยกสิมิลันให้เรียงกัน และค่อยตามด้วยสุรินทร์ และก็ใช้สีแยกให้หน่อย"
//   สาเหตุลำดับมั่ว: id สุ่มตอนดึง + ตาราง po_cash_rows ไม่มีคอลัมน์ bid (ใส่ไว้ก็หายหลังโหลดใหม่)
// กัน (วันสมมุติ 2099-01-02 ท่าทับละมุ · 4 ลำ สิมิลัน 3 + สุรินทร์ 1 · ใส่ในหน่วยความจำเท่านั้น)
//   1 ดึง → id = pkl|ท่า|วันที่|bid · บนจอ: สิมิลันเรียงกันตามลำในชีท แล้วตามด้วยสุรินทร์ · จุด/ตัวหนังสือสีของโปรแกรม (สองอุทยานคนละสี)
//   2 จำลองโหลดใหม่ (bid หาย + ลำดับแถวสลับ) → ลำดับบนจอเหมือนเดิม · ยังรู้ว่าลำไหนดึงแล้ว (ไม่ถือเป็นการดึงแบบเดิม)
//   3 บรรทัดที่ดึงก่อนแก้ (id สุ่ม · ไม่มี bid) → หาเรือจากท้ายข้อความได้ · ลำที่เพิ่มทีหลังดึงได้เฉพาะลำนั้น
//   4 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'pop-tublamu', 1000);
const S = await page.evaluate(() => {
  const fam = id => ROUTES.filter(r => (bkV2RouteFamily(r.id) || {}).id === id);
  const sm = fam('similan'), sr = fam('surin'); if (!sm.length || !sr.length) return { err: 'no similan/surin routes' };
  const D0 = '2099-01-02', P = 'tublamu', orig = window.pcBoats;
  const BS = [{ bid: 'zz_zeus', name: 'Zeus', rid: sm[0].id }, { bid: 'zz_artemis', name: 'Artemis', rid: sm[0].id }, { bid: 'zz_verona', name: 'Verona', rid: (sm[1] || sm[0]).id }, { bid: 'zz_tadeo', name: 'Tadeo', rid: sr[0].id }];
  window.__BS = BS.slice();
  window.pcBoats = (d, p) => (d === D0 && p === P) ? window.__BS.map(b => Object.assign({ route: b.rid }, b)) : orig(d, p);
  window.pcGuard = () => true; window.pcSave = () => {};
  const D = pcDay(P, D0, true); D.out = []; D.pk = {};
  [15100, 21700, 2700, 7600].forEach((a, i) => { D.pk[BS[i].bid] = { amt: a, dock: 100 }; });
  _pcPier = P; _pcDate = D0; _pcYM = '2099-01'; _pcTab = 0;
  return { P, D0, sim: (bkV2RouteFamily(sm[0].id) || {}).color, sur: (bkV2RouteFamily(sr[0].id) || {}).color }; });
if (S.err) { fail('setup ' + S.err); await close(); process.exit(1); }
const VIEW = () => page.evaluate(s => { renderPierCash(s.P); const host = document.getElementById('pc-host-' + s.P);
  const rows = [...host.querySelectorAll('.pc2-lr.rw')].map(r => { const i = r.querySelector('.tx i'), d = r.querySelector('.tx b.pkd'); return { t: (r.querySelector('.tx').textContent || '').trim(), dot: d ? getComputedStyle(d).backgroundColor : '', col: i ? getComputedStyle(i).color : '' }; });
  const st = pcPkPullState(s.P, s.D0); return { rows, st: { old: st.old, nPulled: st.nPulled, waiting: st.waiting, off: st.off } }; }, S);
await page.evaluate(s => pcPull(s.D0), S);
const ids = await page.evaluate(s => pcDay(s.P, s.D0).out.map(x => x.id), S);
const v1 = await VIEW();
const names = v => v.rows.map(r => r.t.split(' ').pop());
const rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const wantOrd = ['Zeus', 'Artemis', 'Verona', 'Tadeo'];
const c1 = ids.every(i => /^pkl\|tublamu\|2099-01-02\|zz_/.test(i)) && JSON.stringify(names(v1)) === JSON.stringify(wantOrd)
  && v1.rows.slice(0, 3).every(r => r.dot === rgb(S.sim)) && v1.rows[3].dot === rgb(S.sur) && S.sim !== S.sur && /สุรินทร์/.test(v1.rows[3].t) && /สิมิลัน/.test(v1.rows[0].t);
if (c1) ok(`1 ดึง 4 ลำ · id กุญแจธรรมชาติ · บนจอ ${names(v1).join(' → ')} · สิมิลันจุดสี ${S.sim} · สุรินทร์ ${S.sur}`); else fail('1 ' + JSON.stringify({ ids, v1, S }));
await page.evaluate(s => { const D = pcDay(s.P, s.D0); D.out.forEach(x => delete x.bid); D.out.reverse(); D.out.push(D.out.shift()); }, S);
const v2 = await VIEW();
if (JSON.stringify(names(v2)) === JSON.stringify(wantOrd) && !v2.st.old && v2.st.nPulled === 4 && !v2.st.waiting && !v2.st.off) ok('2 โหลดใหม่ (bid หาย · แถวสลับ) → ลำดับเดิม · รู้ว่าดึงครบ 4 ลำ'); else fail('2 ' + JSON.stringify(v2));
const c3 = await page.evaluate(s => { const D = pcDay(s.P, s.D0); D.out.forEach((x, i) => { x.id = 'pc' + (1700000000000 + i) + 'abc'; });
  window.__BS.push({ bid: 'zz_bmp', name: 'BMP', rid: window.__BS[0].rid }); D.pk.zz_bmp = { amt: 2500, dock: 0 };
  const a = pcPkPullState(s.P, s.D0); pcPull(s.D0); const b = pcPkPullState(s.P, s.D0);
  return { a: { old: a.old, nPulled: a.nPulled, waiting: a.waiting, nWait: a.nWait }, b: { nPulled: b.nPulled, waiting: b.waiting }, n: D.out.length, last: D.out[D.out.length - 1].id }; }, S);
const v3 = await VIEW();
if (!c3.a.old && c3.a.nPulled === 4 && c3.a.waiting === 2500 && c3.a.nWait === 1 && c3.n === 5 && c3.b.nPulled === 5 && !c3.b.waiting && c3.last === 'pkl|tublamu|2099-01-02|zz_bmp'
    && JSON.stringify(names(v3)) === JSON.stringify(['Zeus', 'Artemis', 'Verona', 'BMP', 'Tadeo']))
  ok('3 บรรทัดที่ดึงก่อนแก้ (id สุ่ม) หาเรือจากชื่อท้ายข้อความ · BMP ที่เพิ่มทีหลังดึงได้ลำเดียว · เรียงเข้ากลุ่มสิมิลันก่อนสุรินทร์');
else fail('3 ' + JSON.stringify({ c3, v3: names(v3) }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 ไม่มี error'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
