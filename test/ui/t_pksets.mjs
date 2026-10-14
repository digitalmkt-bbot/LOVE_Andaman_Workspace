// §pkSets · ตั๋วอุทยาน · แท็บ Ticket Management · เลือกลำ → กำหนดจำนวน → สุ่มรายชื่อ → เซฟเป็นชุด
//
// ที่มา (2026-10-14) · owner: "เพิ่มแถบอีกอันอยู่แถบเดียวกับทริป เป็น Ticket management ... เลือกเรือ กำหนดจำนวน ระบบดึงรายชื่อ
//   ทำหลายชุด ตั้งชื่อได้" + "อิงตารางแบบเดิม · ตารางล่างดึงรายชื่อ Random · เซฟเป็น 1 ชุด" + "บนเรือแยก ผญไทย เด็กไทย FOC ไทย/ตช · เรือให้ User เลือก"
// กัน
//   1 ชิป Ticket Management อยู่ท้ายแถวชิปโปรแกรม · กดแล้วตารางเดิมหาย ขึ้นแถว "เรือที่เลือก" ว่าง + หัวตาราง บนเรือ·ไทย (ผญ เด็ก <3 FOC รวมไทย) / บนเรือ·ต่างชาติ (เหมือนกัน) / รวมทั้งลำ / ชุดนี้ · ยังไม่มีแถวเรือ (§pkSets2)
//   2 + เพิ่มเรือ → เมนูมีทุกลำของวัน · เลือกลำ → แถวขึ้นลำเดียว · กดแถว → ช่องกรอกตามประเภทขึ้น · ใส่ 3 → รายชื่อ 3 คน ประเภทตรง ไม่ซ้ำ มาจากลำนั้น
//   3 ติ๊กออก 1 คน → คนใหม่ (ป้าย "ใหม่") ประเภทเดียวกันมาแทน · ยังครบ 3 · คนที่ติ๊กออกอยู่ท้ายขีดฆ่า · ติ๊กกลับได้ (ถ้าเต็มขึ้น alert ASCII)
//   4 บันทึก → PIER_CFG.parkSets[date] มี 1 ชุด 3 คน ชื่อเริ่มต้น "<เรือ> ชุด 1" · poPersist ถูกเรียก · การ์ดขวาขึ้นชุด · "เหลือ" ลด 3 · ชุดใหม่สุ่มไม่ซ้ำคนที่เซฟแล้ว
//   5 ใส่เกินที่เหลือ → ช่องแดง · บันทึกไม่ได้ (alert ASCII) · ชุดไม่เพิ่ม
//   6 เปิดชุด → ร่างโหลดกลับ · ซื้อแล้ว → ล็อก ช่องกรอกหาย · ปลดล็อก → แก้ได้ · ลบ → หาย
//   7 Excel ชุด/ทุกชุด · ชีทต่อชุด 3 คอลัมน์ + ชีทสรุปรหัส · ไม่เรียก writeFile จริง
//   9 (§pkSets3) แถวยอดจริงของวันต่อโปรแกรม (ทุกลำ) บนตาราง · ไทย+ตช=รวม · กดแถวโปรแกรม → เมนูเพิ่มเรือกรองตามนั้น · โหมดนี้เต็มจอ การ์ดชุดอยู่ใต้ตาราง
//   8 กลับแท็บ "ทั้งหมด" ตารางเดิมกลับมา · PIER_CFG คีย์อื่นไม่ถูกแตะ · alert ทุกข้อความเป็น ASCII · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
const dlg = []; page.on('dialog', async d => { dlg.push(d.message()); try { await d.accept(); } catch (_) {} });
await goView(page, 'pok-panwa', 800);
const PIER = 'panwa', DATE = '2026-09-16';
const H = `#pk-host-${PIER}`;
const st = () => page.evaluate((H) => { const h = document.querySelector(H);
  const chips = [...h.querySelectorAll('.pk2-fcs .pk2-fc')].map(b => b.textContent.trim());
  const on = (h.querySelector('.pk2-fcs .pk2-fc.on') || {}).textContent || '';
  const mx = h.querySelector('.pk3-mx'); const bt = mx ? [...mx.querySelectorAll('tr.bt')] : [];
  const sel = mx ? mx.querySelector('tr.bt.sel') : null;
  const ins = sel ? [...sel.querySelectorAll('.pk3-in')].map(i => ({ cat: i.dataset.cat, v: i.value, over: i.classList.contains('over'), max: +(i.title.match(/เหลือ (\d+)/) || [])[1] })) : [];
  const rows = [...h.querySelectorAll('.pk3-sheet tbody tr')].filter(t => !t.classList.contains('pk3-skip') && !t.querySelector('.pk-e')).map(t => ({ nm: t.querySelector('.nmc').textContent.trim(), code: t.querySelector('.cd').textContent.trim(), nw: !!t.querySelector('.tpb'), ck: t.querySelector('input[type=checkbox]').checked }));
  const skip = [...h.querySelectorAll('.pk3-sheet tr.pk3-skip')].map(t => t.querySelector('.nmc').textContent.trim());
  const left = sel ? +(sel.lastElementChild.textContent) : null;
  return { chips, on, has3: !!mx, hasOld: !!h.querySelector('.pk2-dmx:not(.pk3-mx)'), bp: !!h.querySelector('.pk3-bp'), bc: [...h.querySelectorAll('.pk3-bc')].map(b => b.firstChild.textContent.trim()),
    menu: [...h.querySelectorAll('.pk3-menu > button .bn')].map(b => b.textContent.trim()), nBt: bt.length, selBoat: sel ? sel.querySelector('.bn').textContent.trim() : '', ins, rows, skip, left,
    goHead: [...h.querySelectorAll('.pk3-mx thead tr.s th')].slice(0, 10).map(t => t.textContent.trim()), goTop: [...h.querySelectorAll('.pk3-mx thead tr.g th')].slice(1, 4).map(t => t.textContent.replace(/\s+/g, ' ').trim()),
    sets: [...h.querySelectorAll('.pk3-set')].map(b => ({ name: b.querySelector('.t b').textContent, n: +b.querySelector('.v b').textContent, tag: b.querySelector('.v small').textContent })),
    stTxt: (h.querySelector('.pk3-info .st') || {}).textContent || '', saveBtn: !!h.querySelector('.pk3-bh .pri'), locked: /ล็อก/.test((h.querySelector('.pk3-info .st') || {}).textContent || ''),
    nameVal: (h.querySelector('.pk3-nm input') || {}).value, namePh: (h.querySelector('.pk3-nm input') || {}).placeholder };
}, H);
await page.evaluate(({ D, P }) => { _poPier = P; _poDate = D; _pkFam = 'all'; _pkSetBoats = []; _pkSetD = null; delete PIER_CFG.parkSets; window.__persist = 0; const r = window.laBlobSave; window.laBlobSave = function () { window.__persist++; return r ? r.apply(this, arguments) : undefined; }; window.__cfg0 = JSON.stringify(Object.assign({}, PIER_CFG, { parkSets: undefined })); renderPierPark(P); }, { D: DATE, P: PIER });
await page.waitForTimeout(400);
// 1
let a = await st();
const tabChip = a.chips.find(c => /Ticket Management/.test(c));
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).click(), H); await page.waitForTimeout(400);
a = await st();
if (tabChip && /0 ชุด/.test(tabChip) && a.chips[a.chips.length - 1] === tabChip && /Ticket Management/.test(a.on) && a.has3 && !a.hasOld && a.bp && a.bc.length === 0 && a.nBt === 0 && a.goHead.map(x => x.replace(/\s+/g, '')).join('|') === 'ผญไทย|เด็กไทย|ต่ำกว่า3ไทย|FOCไทย|รวมไทย|ผญตช|เด็กตช|ต่ำกว่า3ตช|FOCตช|รวมตช' && a.goTop.join('|') === 'บนเรือ · ไทย|บนเรือ · ต่างชาติ|รวมทั้งลำ')
  ok('1 ชิป Ticket Management ท้ายแถว · กดแล้วเป็นโหมดจัดชุด · ยังไม่มีเรือ · หัว บนเรือ ไทย 5 / ต่างชาติ 5 / รวมทั้งลำ'); else fail('1 ' + JSON.stringify({ tabChip, on: a.on, has3: a.has3, hasOld: a.hasOld, bp: a.bp, bc: a.bc, nBt: a.nBt, goHead: a.goHead, goTop: a.goTop }));
// 2
const info = await page.evaluate(({ D, P }) => { const F = pkTkData(D, P), out = []; F.forEach(g => g.boats.forEach(B => { const by = {}; B.people.forEach(p => { if (!p.over) by[p.cat] = (by[p.cat] || 0) + 1; }); out.push({ bid: B.bid, name: B.boat.name, by, names: B.people.filter(p => !p.over).map(p => p.full) }); })); return out; }, { D: DATE, P: PIER });
const big = info.slice().sort((x, y) => y.names.length - x.names.length)[0]; const cat = Object.keys(big.by).sort((x, y) => big.by[y] - big.by[x])[0]; const avail = big.by[cat];
await page.click(H + ' .pk3-add'); await page.waitForTimeout(250); a = await st();
const menuAll = info.every(b => a.menu.includes(b.name));
await page.evaluate(({ H, n }) => [...document.querySelectorAll(H + ' .pk3-menu > button')].find(b => b.querySelector('.bn').textContent.trim() === n).click(), { H, n: big.name }); await page.waitForTimeout(300); a = await st();
const sums = await page.evaluate((H) => { const tds = [...document.querySelectorAll(H + ' .pk3-mx tr.bt td')].slice(1, 12).map(t => +t.textContent || 0); return { th: tds[0] + tds[1] + tds[2] + tds[3] === tds[4], fr: tds[5] + tds[6] + tds[7] + tds[8] === tds[9], all: tds[4] + tds[9] === tds[10], tds }; }, H);
const oneRow = a.nBt === 1 && a.bc.join() === big.name && !a.selBoat && sums.th && sums.fr && sums.all;
await page.click(H + ' .pk3-mx tr.bt'); await page.waitForTimeout(300); a = await st();
const insOk = a.selBoat === big.name && a.ins.length >= 5 && a.ins.find(i => i.cat === cat && i.max === avail);
await page.evaluate(({ H, c }) => { const i = document.querySelector(H + ' .pk3-in[data-cat="' + c + '"]'); i.value = '3'; i.dispatchEvent(new Event('change')); }, { H, c: cat }); await page.waitForTimeout(300); a = await st();
const code = await page.evaluate(c => pkTkCat(c).code || '—', cat);
const pick1 = a.rows.map(r => r.nm);
if (menuAll && oneRow && insOk && avail >= 5 && a.rows.length === 3 && a.rows.every(r => r.code === code && r.ck) && new Set(pick1).size === 3 && pick1.every(n => big.names.includes(n) || /ยังไม่มีรายชื่อ/.test(n)) && /ครบ 3\/3/.test(a.stTxt))
  ok(`2 เมนูมีทุกลำ · เลือก ${big.name} (รวมไทย+รวม ตช = รวมทั้งลำ ${sums.tds[10]}) · กดแถว ช่องกรอกขึ้น (เหลือ ${avail}) · ใส่ 3 → สุ่มได้ 3 คน code ${code} ไม่ซ้ำ`); else fail('2 ' + JSON.stringify({ menuAll, oneRow, sums, insOk, avail, rows: a.rows, stTxt: a.stTxt }));
// 3
await page.evaluate((H) => document.querySelector(H + ' .pk3-sheet tbody tr input[type=checkbox]').click(), H); await page.waitForTimeout(300); a = await st();
const pick2 = a.rows.map(r => r.nm), fresh = a.rows.filter(r => r.nw);
const rep = a.rows.length === 3 && a.skip.length === 1 && a.skip[0] === pick1[0] && !pick2.includes(pick1[0]) && (avail > 3 ? fresh.length === 1 : true) && a.rows.every(r => r.code === code);
dlg.length = 0; await page.evaluate((H) => document.querySelector(H + ' .pk3-sheet tr.pk3-skip input[type=checkbox]').click(), H); await page.waitForTimeout(300); const a3 = await st();
const back = avail > 3 ? (dlg.length === 1 && /full/.test(dlg[0]) && !/[^\x00-\x7F]/.test(dlg[0]) && a3.rows.length === 3) : (a3.rows.length === 3 && a3.skip.length === 0);
if (rep && back) ok(`3 ติ๊กออก → สุ่มคนใหม่แทน (${fresh.map(f => f.nm).join(',') || 'พอดี'}) · ยังครบ 3 · ติ๊กกลับตอนเต็ม → alert ASCII`); else fail('3 ' + JSON.stringify({ rep, back, rows: a.rows, skip: a.skip, dlg, a3rows: a3.rows.length }));
// 4
const persist0 = await page.evaluate(() => window.__persist);
await page.click(H + ' .pk3-bh .pri'); await page.waitForTimeout(400); a = await st();
const saved = await page.evaluate((D) => ({ sets: pkSets(D), persist: window.__persist, chip: [...document.querySelectorAll('.pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).textContent }), DATE);
const S1 = saved.sets[0] || {};
if (saved.sets.length === 1 && S1.name === big.name + ' ชุด 1' && S1.bid === big.bid && (S1.people || []).length === 3 && S1.people.every(q => q.cat === cat && q.k) && saved.persist > persist0 && a.sets.length === 1 && a.sets[0].n === 3 && /พร้อมซื้อ/.test(a.sets[0].tag) && /1 ชุด/.test(saved.chip))
  ok(`4 บันทึก → parkSets[${DATE}] 1 ชุด "${S1.name}" 3 คน · poPersist ${saved.persist - persist0} ครั้ง · การ์ดขวาขึ้น`); else fail('4 ' + JSON.stringify({ n: saved.sets.length, S1: { name: S1.name, bid: S1.bid, np: (S1.people || []).length }, persist: [persist0, saved.persist], sets: a.sets, chip: saved.chip }));
// 4b new set on same boat excludes saved people
await page.click(H + ' .pk3-mx tr.bt'); await page.waitForTimeout(300); a = await st();
const leftNow = a.left, mx2 = (a.ins.find(i => i.cat === cat) || {}).max;
await page.evaluate(({ H, c, v }) => { const i = document.querySelector(H + ' .pk3-in[data-cat="' + c + '"]'); i.value = String(v); i.dispatchEvent(new Event('change')); }, { H, c: cat, v: Math.min(3, avail - 3) }); await page.waitForTimeout(300); a = await st();
const savedNames = S1.people.map(q => q.full);
if (leftNow === big.names.length - 3 && mx2 === avail - 3 && a.rows.length === Math.min(3, avail - 3) && a.rows.every(r => !savedNames.includes(r.nm) || /ยังไม่มีรายชื่อ/.test(r.nm))) ok(`4b ชุดใหม่ลำเดิม · เหลือ ${leftNow} · ช่อง ${cat} เหลือ ${mx2} · สุ่มไม่ซ้ำคนที่เซฟแล้ว`); else fail('4b ' + JSON.stringify({ leftNow, want: big.names.length - 3, mx2, rows: a.rows, savedNames }));
// 5 over
dlg.length = 0;
await page.evaluate(({ H, c, v }) => { const i = document.querySelector(H + ' .pk3-in[data-cat="' + c + '"]'); i.value = String(v); i.dispatchEvent(new Event('change')); }, { H, c: cat, v: avail + 5 }); await page.waitForTimeout(300); a = await st();
const over = (a.ins.find(i => i.cat === cat) || {}).over;
await page.click(H + ' .pk3-bh .pri'); await page.waitForTimeout(300);
const n5 = await page.evaluate((D) => pkSets(D).length, DATE);
if (over && /คนไม่พอ/.test(a.stTxt) && dlg.length === 1 && /Not enough people/.test(dlg[0]) && !/[^\x00-\x7F]/.test(dlg[0]) && n5 === 1) ok('5 ใส่เกิน → ช่องแดง · บันทึกไม่ได้ (alert ASCII) · ชุดไม่เพิ่ม'); else fail('5 ' + JSON.stringify({ over, stTxt: a.stTxt, dlg, n5 }));
await page.evaluate(() => { _pkSetD = null; });
// 6 open / bought / unlock / delete
await page.evaluate((H) => document.querySelector(H + ' .pk3-set').click(), H); await page.waitForTimeout(300); a = await st();
const opened = a.selBoat === big.name && a.rows.length === 3 && a.nameVal === S1.name && a.rows.map(r => r.nm).sort().join() === savedNames.sort().join();
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk3-bh button')].find(b => /ซื้อแล้ว/.test(b.textContent)).click(), H); await page.waitForTimeout(300); const b6 = await st();
const bought = await page.evaluate((D) => pkSets(D)[0].bought, DATE);
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk3-bh button')].find(b => /ปลดล็อก/.test(b.textContent)).click(), H); await page.waitForTimeout(300); const c6 = await st();
dlg.length = 0; await page.evaluate((H) => document.querySelector(H + ' .pk3-sets .f .dl').click(), H); await page.waitForTimeout(300); const d6 = await st();
const n6 = await page.evaluate((D) => pkSets(D).length, DATE);
if (opened && bought && b6.locked && b6.ins.length === 0 && !b6.saveBtn && /ซื้อแล้ว/.test(b6.sets[0].tag) && !c6.locked && c6.ins.length > 0 && dlg.length === 1 && /^Delete this set/.test(dlg[0]) && n6 === 0 && d6.sets.length === 0)
  ok('6 เปิดชุด → ร่างกลับมา · ซื้อแล้ว → ล็อก · ปลดล็อก → แก้ได้ · ลบ → หาย'); else fail('6 ' + JSON.stringify({ opened, bought, b6: { locked: b6.locked, ins: b6.ins.length, save: b6.saveBtn, tag: b6.sets[0] && b6.sets[0].tag }, c6: { locked: c6.locked, ins: c6.ins.length }, dlg, n6 }));
// 7 excel
await page.evaluate(({ D, bid, c }) => { _pkSetD = null; pkSetTab(bid, pkTkData(D, _poPier).find(g => g.boats.some(B => B.bid === bid)).rid); pkSetCnt(c, 2); pkSetSave(); pkSetTab(bid, _pkSetD ? _pkSetD.rid : pkTkData(D, _poPier).find(g => g.boats.some(B => B.bid === bid)).rid); pkSetCnt(c, 1); pkSetName('ชุดทดสอบ'); pkSetSave(); }, { D: DATE, bid: big.bid, c: cat });
await page.waitForTimeout(300);
const x7 = await page.evaluate((D) => { const out = [];
  if (typeof XLSX === 'undefined') { /* harness โหลด CDN ไม่ได้ · ตัวแทนขั้นต่ำที่ pkSetXls ใช้ */
    window.XLSX = { utils: { book_new: () => ({ SheetNames: [], Sheets: {} }), aoa_to_sheet: rows => ({ __rows: rows }), book_append_sheet: (wb, ws, n) => { wb.SheetNames.push(n); wb.Sheets[n] = ws; }, sheet_to_json: ws => ws.__rows }, writeFile: () => {} }; } const W = XLSX.writeFile; XLSX.writeFile = (wb, fn) => { out.push({ fn, sheets: wb.SheetNames, rows: wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })) }); }; try { pkSetXls(pkSets(D)[0].id); pkSetXls('all'); } finally { XLSX.writeFile = W; } return { out, sets: pkSets(D).map(S => ({ name: S.name, n: S.people.length })) }; }, DATE);
const one = x7.out[0] || {}, all = x7.out[1] || {};
if (x7.sets.length === 2 && x7.sets[1].name === 'ชุดทดสอบ' && one.sheets && one.sheets.length === 2 && one.rows[0].length === 2 && one.rows[0][0].length === 3 && one.rows[0][0][2] === code && one.sheets[1] === 'สรุปรหัส' && all.sheets.length === 3 && all.sheets.includes('ชุดทดสอบ') && /park_sets_2026-09-16/.test(all.fn))
  ok(`7 Excel · ชุดเดียว ${one.sheets.length} ชีท (3 คอลัมน์ · code ${code}) · ทุกชุด ${all.sheets.length} ชีท`); else fail('7 ' + JSON.stringify({ sets: x7.sets, one: { s: one.sheets, r0: one.rows && one.rows[0] }, all: { s: all.sheets, fn: all.fn } }));
// 8
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /ทั้งหมด/.test(b.textContent)).click(), H); await page.waitForTimeout(400); a = await st();
const cfgSame = await page.evaluate(() => JSON.stringify(Object.assign({}, PIER_CFG, { parkSets: undefined })) === window.__cfg0);
const asciiDlg = dlg.every(m => !/[^\x00-\x7F]/.test(m));
if (!a.has3 && a.hasOld && cfgSame && asciiDlg && !errors.length) ok('8 กลับ "ทั้งหมด" ตารางเดิมกลับมา · PIER_CFG คีย์อื่นไม่ถูกแตะ · alert ASCII · ไม่มี error'); else fail('8 ' + JSON.stringify({ has3: a.has3, hasOld: a.hasOld, cfgSame, asciiDlg, errors }));
// 9 §pkSets3 · แถวยอดจริงต่อโปรแกรม (ทุกลำของวัน) · กดแถวเลือกโปรแกรม → เมนูเพิ่มเรือกรอง · ไม่มีคอลัมน์ขวา (เต็มจอ)
await page.evaluate((H) => { _pkSetBoats = []; _pkSetD = null; _pkSetFamF = 'all'; [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).click(); }, H); await page.waitForTimeout(400);
const f9 = await page.evaluate(({ H, D, P }) => { const h = document.querySelector(H);
  const fm = [...h.querySelectorAll('.pk3-mx tr.fm')].map(t => ({ n: t.querySelector('.fn').childNodes[1].textContent.trim(), c: [...t.querySelectorAll('td.n')].slice(0, 11).map(x => +x.textContent || 0) }));
  const F = pkTkData(D, P); const exp = {}; let all = 0; F.forEach(g => { const f = pk2FamOf(g.rid); g.boats.forEach(B => { exp[f.n] = (exp[f.n] || 0) + (+B.totPc || 0); all += (+B.totPc || 0); }); });
  const fams = Object.keys(exp);
  return { fm, exp, all, fams, full: !!h.querySelector('.pk3-full'), side: !!h.querySelector('.pk3-sidegrid .pk3-sets'), rightCol: !!h.querySelector('.pc2-main > .pc2-col + .pc2-col') }; }, { H, D: DATE, P: PIER });
const fmAll = f9.fm[0] || { c: [] };
const famOk = f9.fm.length === 1 + f9.fams.length && fmAll.n === 'ทั้งหมด' && fmAll.c[10] === f9.all && fmAll.c[4] + fmAll.c[9] === fmAll.c[10] && f9.fams.every(n => { const r = f9.fm.find(x => x.n === n); return r && r.c[10] === f9.exp[n] && r.c[0] + r.c[1] + r.c[2] + r.c[3] === r.c[4]; });
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk3-mx tr.fm')][1].click(), H); await page.waitForTimeout(300);
await page.click(H + ' .pk3-add'); await page.waitForTimeout(250);
const g9 = await page.evaluate(({ H, D, P }) => { const h = document.querySelector(H); const sel = h.querySelector('.pk3-mx tr.fm.sel .fn').childNodes[1].textContent.trim();
  const menu = [...h.querySelectorAll('.pk3-menu > button .bn')].map(b => b.textContent.trim());
  const F = pkTkData(D, P); const want = []; F.forEach(g => { if (pk2FamOf(g.rid).n === sel) g.boats.forEach(B => want.push(B.boat.name)); });
  return { sel, menu, want, add: (h.querySelector('.pk3-add') || {}).textContent }; }, { H, D: DATE, P: PIER });
const filtOk = g9.sel !== 'ทั้งหมด' && g9.menu.length === g9.want.length && g9.want.every(n => g9.menu.includes(n)) && g9.add.includes(g9.sel);
if (famOk && f9.full && f9.side && !f9.rightCol && filtOk) ok(`9 แถวยอดจริงต่อโปรแกรม ${f9.fams.join('/')} (ไทย+ตช=รวม · รวม=ยอดวัน ${f9.all}) · กด ${g9.sel} → เมนูเรือเหลือ ${g9.menu.length} ลำ · เต็มจอ การ์ดอยู่ใต้ตาราง`);
else fail('9 ' + JSON.stringify({ famOk, fm: f9.fm, exp: f9.exp, all: f9.all, full: f9.full, side: f9.side, rightCol: f9.rightCol, g9 }));
await page.evaluate(() => { _pkSetFamF = 'all'; _pkSetMenu = false; });
if (process.env.SHOT) { await page.evaluate((H) => { [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).click(); }, H); await page.waitForTimeout(300); await page.evaluate((D) => pkSetOpen(pkSets(D)[0].id), DATE); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT, fullPage: true }); }
await close();
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
