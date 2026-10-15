// §pkDockIn · เงินสดย่อย · ชีทค่าอุทยาน · "เงินที่จ่าย" ของลำหนึ่งรวมค่าจอดของลำนั้นแล้ว
// ที่มา (2026-10-15) · owner ส่งภาพชีท 15 ต.ค. ถาม "ยอดที่คีย์ นี่รวม ค่าจอดไหม"
//   ทุกลำที่มีค่าจอด: ต่าง = ค่าจอดพอดี (Zeus 15,000 → จ่าย 15,100 · จอด 100) · ปุ่มดึง ฿55,750 = 54,950 + 800 (ค่าจอดเข้าสมุดสองครั้ง)
//   owner: "รวมไปเลย ตอนที่เอารายการเข้า สำหรับเรือลำนั้นๆ"
// กัน (ข้อมูลทดสอบ · ใส่ในหน่วยความจำของหน้าเท่านั้น)
//   1 ลำที่คีย์ จำนวน + ค่าจอด 100 + เงินที่จ่าย = อุทยานที่คำนวณ + 100 → คำนวณขึ้นรวมจอด · ต่าง "ตรง"
//   + owner (รอบ 2) รูปสมุด "ค่าจอดเรือ (ดึงจากชีท) 800 / ค่าอุทยาน (ดึงจากชีท) 54,150": "รายการดึงต้องเป็น ค่าอุทยานเกาะสิมิลัน วันที่ ชื่อเรือ
//     ราคาที่ดึงมาต้องเป็นราคาที่จ่าย ซึ่งต้องรวมค่าจอดแล้ว แยกเป็นรายลำไป" (§pkPullBoat)
//   2 pcTotals: ค่าอุทยาน = Σ เงินที่จ่าย (รวมค่าจอดแล้ว) · ค่าจอดไม่บวกซ้ำ
//   3 กดดึง → บรรทัดละลำ "ค่าอุทยานเกาะ… <วันที่> <เรือ>" ยอด = เงินที่จ่าย · ไม่มีบรรทัดค่าจอดแยก · ✓ ดึงแล้ว 2 ลำ
//   3b ลำที่ยังไม่ดึง → ปุ่ม "ดึง 1 ลำ" · ดึงเฉพาะลำนั้น · กดซ้ำไม่ซ้ำ · แก้เงินหลังดึง → เตือนไม่ตรงชีท
//   4 วันที่ดึงแบบเดิม (ก้อนเดียว + ค่าจอดแยก) → เตือนไม่ตรงชีท · ไม่ดึงรายลำซ้อน
//   5 แถบเตือนบนหัว "ค่าอุทยาน · ต่าง" ไม่ขึ้นเมื่อจ่ายตรง (เดิมขึ้น +ค่าจอด) · 6 ไม่มี error · 7 ใบพิมพ์คิดแบบเดียวกัน
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1000 });
await goView(page, 'pop-panwa', 1000);
/* ข้อมูลทดสอบไม่มีแผนต้นทุน · ราคาอุทยานสมมุติ (ตปท 500/250 · ไทย 100/50) · ตัวที่ทดสอบคือการรวมค่าจอด ไม่ใช่ราคา */
await page.evaluate(() => { window.pcParkRate = () => ({ ok: true, ad_th: 100, chd_th: 50, inf_th: 0, foc_th: 100, ad_fr: 500, chd_fr: 250, inf_fr: 0, foc_fr: 500, plan: 'test', how: '', miss: [] }); });
const S = await page.evaluate(() => {
  for (const pier of ['tublamu', 'panwa']) for (const d of Object.keys(TRIPS).sort()) {
    const B = pcBoats(d, pier).filter(b => pcParkRate(b.rid).ok && pcPax(d, b.bid, pier).n.tot > 0);
    if (B.length >= 2) return { pier, d, bids: B.slice(0, 2).map(b => b.bid), names: B.slice(0, 2).map(b => b.name) };
  }
  return { err: 'no day with 2 priced boats' }; });
if (S.err) { fail('setup ' + S.err); await close(); process.exit(1); }
const R = await page.evaluate(s => {
  window.pcGuard = () => true; window.pcSave = () => {};          /* ทดสอบในหน่วยความจำ · ไม่เขียนที่ไหน */
  const D = pcDay(s.pier, s.d, true); D.out = (D.out || []).filter(x => !x.src);
  const exp = s.bids.map(bid => { const B = pcBoats(s.d, s.pier).find(b => b.bid === bid); return pcParkAmt(pcParkRate(B.rid), pcPax(s.d, bid, s.pier).n); });
  s.bids.forEach((bid, i) => { D.pk[bid] = { dock: 100 * (i + 1), amt: exp[i] + 100 * (i + 1) }; });   /* จ่ายตรง: อุทยาน + จอด */
  _pcPier = s.pier; _pcDate = s.d; _pcYM = s.d.slice(0, 7); _pcTab = 2; renderPierCash(s.pier);
  const host = document.getElementById('pc-host-' + s.pier);
  const rows = s.names.map(n => { const r = [...host.querySelectorAll('.pc2-tr.pk')].find(x => (x.querySelector('.bn') || {}).textContent?.startsWith(n)); return r ? { ex: r.querySelector('.mn.ex').textContent, df: r.querySelector('.mn.ctr').textContent } : null; });
  const T = pcTotals(s.pier, s.d), st = pc2StatPK(s.pier, s.d);
  const head = (host.querySelector('.pc2-todo, .pc2-h, header') ? host.innerText : host.innerText);
  return { exp, rows, T: { pk: T.pk, dock: T.dock, ref: T.ref }, sumAmt: exp[0] + 100 + exp[1] + 200, diff: st.diff, warnDiff: /ค่าอุทยาน · ต่าง/.test(host.innerText) }; }, S);
const r1 = R.rows.every((r, i) => r && r.ex.replace(/[^0-9]/g, '').startsWith(String(R.exp[i] + 100 * (i + 1))) && /ตรง/.test(r.df));
if (r1) ok(`1 ${S.d} ${S.names.join(', ')} · คำนวณ = อุทยาน + จอด (${R.exp.map((e, i) => e + '+' + 100 * (i + 1)).join(' · ')}) · ต่าง "ตรง"`); else fail('1 ' + JSON.stringify(R));
if (R.T.dock === 300 && R.T.pk === R.sumAmt && R.T.ref >= R.T.pk) ok(`2 pcTotals · ค่าอุทยาน ${R.T.pk} = เงินที่จ่ายทั้งวัน (รวมค่าจอด ${R.T.dock} แล้ว · ไม่บวกซ้ำ)`); else fail('2 ' + JSON.stringify(R));
const P3 = await page.evaluate(s => { pcPull(s.d); const D = pcDay(s.pier, s.d, false); const host = document.getElementById('pc-host-' + s.pier);
  const L = (D.out || []).filter(x => x.src === 'pk' || x.src === 'dock').map(x => ({ src: x.src, bid: x.bid, txt: x.txt, amt: x.amt }));
  return { L, warn: /ไม่ตรงกับชีท/.test(host.innerText), done: /ดึงเข้าสมุดแล้ว · 2 ลำ/.test(host.innerText), btn: /⤓ ดึง \d+ ลำ/.test(host.innerText) }; }, S);
const want3 = S.bids.map((b, i) => ({ b, amt: R.exp[i] + 100 * (i + 1), name: S.names[i] }));
const ok3 = P3.L.length === 2 && P3.L.every(l => l.src === 'pk') && want3.every(w => P3.L.some(l => l.bid === w.b && l.amt === w.amt && new RegExp('^ค่าอุทยาน\\S+ \\d{1,2} \\S+ \\d{2} ' + w.name + '$').test(l.txt)));
if (ok3 && !P3.warn && P3.done && !P3.btn) ok(`3 ดึงเข้าสมุดรายลำ · ${P3.L.map(l => l.txt + ' = ' + l.amt).join(' | ')} · ไม่มีบรรทัดค่าจอดแยก`); else fail('3 ' + JSON.stringify({ P3, want3 }));
const P3b = await page.evaluate(s => { const D = pcDay(s.pier, s.d, false); const host = () => document.getElementById('pc-host-' + s.pier).innerText;
  D.out = D.out.filter(x => x.bid !== s.bids[1]); renderPierCash(s.pier); const btn = /⤓ ดึง 1 ลำ/.test(host());
  pcPull(s.d); const n = D.out.filter(x => x.src === 'pk').length, n2 = D.out.filter(x => x.src === 'pk' && x.bid === s.bids[1]).length;
  pcPull(s.d); const n3 = D.out.filter(x => x.src === 'pk').length;
  D.pk[s.bids[1]].amt += 50; renderPierCash(s.pier); const warn = /ไม่ตรงกับชีท/.test(host()); D.pk[s.bids[1]].amt -= 50;
  return { btn, n, n2, n3, warn }; }, S);
if (P3b.btn && P3b.n === 2 && P3b.n2 === 1 && P3b.n3 === 2 && P3b.warn) ok('3b ลำที่ยังไม่ได้ดึง → ปุ่ม "ดึง 1 ลำ" · ดึงเพิ่มเฉพาะลำนั้น ไม่ซ้ำ · กดซ้ำไม่เพิ่ม · แก้เงินหลังดึง → เตือนไม่ตรงชีท'); else fail('3b ' + JSON.stringify(P3b));
const P4 = await page.evaluate(s => { const D = pcDay(s.pier, s.d, false); const keep = D.out; const tot = s.bids.reduce((a, b) => a + (+D.pk[b].amt || 0), 0);
  D.out = [{ id: 'o1', src: 'pk', txt: 'ค่าอุทยาน (ดึงจากชีท)', amt: tot }, { id: 'o2', src: 'dock', txt: 'ค่าจอดเรือ (ดึงจากชีท)', amt: 300 }];
  renderPierCash(s.pier); const w = /ดึงไว้[^·]*· ไม่ตรงกับชีท/.test(document.getElementById('pc-host-' + s.pier).innerText);
  pcPull(s.d); const added = D.out.length - 2; D.out = keep; return { w, added }; }, S);
if (P4.w && P4.added === 0) ok('4 วันที่ดึงแบบเดิม (ก้อนเดียว + ค่าจอดแยก = ค่าจอดซ้ำ) → ขึ้นเตือน "ไม่ตรงกับชีท" · ไม่ดึงรายลำซ้อน'); else fail('4 ' + JSON.stringify(P4));
if (Math.round(R.diff) === 0 && !R.warnDiff) ok('5 จ่ายตรง (อุทยาน + จอด) → ส่วนต่างของวัน 0 · ไม่ขึ้นแถบ "ค่าอุทยาน · ต่าง"'); else fail('5 ' + JSON.stringify({ diff: R.diff, warn: R.warnDiff }));
const P7 = await page.evaluate(s => { const h = pcSheetPK(s.pier, { print: true, only: s.d }); const d = document.createElement('div'); d.innerHTML = h;
  const tr = [...d.querySelectorAll('tbody tr')].find(t => t.textContent.includes(s.names[0])); const ex = tr ? (tr.querySelector('.pc-ex b') || {}).textContent : '';
  return { hdr: /ยอดคำนวณ\s*\(รวมจอด\)/.test(d.textContent) && /เงินที่จ่าย\s*\(รวมจอด\)/.test(d.textContent), ex }; }, S);
if (P7.hdr && P7.ex.replace(/[^0-9]/g, '') === String(R.exp[0] + 100)) ok(`7 ใบพิมพ์ · หัวคอลัมน์ (รวมจอด) · ยอดคำนวณ ${P7.ex} รวมค่าจอด`); else fail('7 ' + JSON.stringify(P7));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
