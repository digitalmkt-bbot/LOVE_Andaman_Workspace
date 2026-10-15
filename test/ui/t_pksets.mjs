// §pkSets · ตั๋วอุทยาน · แท็บ Ticket Management · เลือกลำ → กำหนดจำนวน → สุ่มรายชื่อ → เซฟเป็นชุด
//
// ที่มา (2026-10-14) · owner: "เพิ่มแถบอีกอันอยู่แถบเดียวกับทริป เป็น Ticket management ... เลือกเรือ กำหนดจำนวน ระบบดึงรายชื่อ
//   ทำหลายชุด ตั้งชื่อได้" + "อิงตารางแบบเดิม · ตารางล่างดึงรายชื่อ Random · เซฟเป็น 1 ชุด" + "บนเรือแยก ผญไทย เด็กไทย FOC ไทย/ตช · เรือให้ User เลือก"
// กัน
//   1 ชิป Ticket Management อยู่ท้ายแถวชิปโปรแกรม · กดแล้วตารางเดิมหาย ขึ้นแถว "เรือที่เลือก" ว่าง + หัวตาราง บนเรือ·ไทย (ผญ เด็ก <3 FOC รวมไทย) / บนเรือ·ต่างชาติ (เหมือนกัน) / รวมทั้งลำ / ชุดนี้ · ยังไม่มีแถวเรือ (§pkSets2)
//   2 + เพิ่มเรือ → เมนูมีทุกลำของวัน · เลือกลำ → แถวขึ้นลำเดียว · กดแถว → ช่องกรอกตามประเภทขึ้น · ใส่ 3 → รายชื่อ 3 คน ประเภทตรง ไม่ซ้ำ มาจากลำนั้น
//   3 ติ๊กออก 1 คน → คนใหม่ (ป้าย "ใหม่") ประเภทเดียวกันมาแทน · ยังครบ 3 · คนที่ติ๊กออกอยู่ท้ายขีดฆ่า · ติ๊กกลับได้ (ถ้าเต็มขึ้น alert ASCII)
//   4 บันทึก → PIER_CFG.parkSets[date] มี 1 ชุด 3 คน ชื่อเริ่มต้น "<เรือ> ชุด 1" · poPersist ถูกเรียก · การ์ดขวาขึ้นชุด · "เหลือ" ลด 3 · ชุดใหม่สุ่มไม่ซ้ำคนที่เซฟแล้ว
//   5 (§pkSets7) ใส่เกินที่เหลือบนลำ → ช่องเหลือง เลขจาง ๆ ติดลบ · รายชื่อดึงจากลำอื่นในเส้นทางเดียวกัน ตรงประเภท (ป้าย "จาก <ลำ>") · บันทึกได้ from=ลำจริง · ช่อง 0 ว่าง placeholder 0
//   6 เปิดชุด → ร่างโหลดกลับ · ซื้อแล้ว → ล็อก ช่องกรอกหาย · ปลดล็อก → แก้ได้ · ลบ → หาย
//   7 Excel ชุด/ทุกลำ · ชีทต่อชุด 3 คอลัมน์ + ชีทสรุปรหัส (ราคา/ใบ · รวม) · (§pkSets9) ทุกลำ = ไฟล์ละลำ · การ์ดขวามียอดเงินต่อชุด/ต่อลำ/รวม · ไม่เรียก writeFile จริง
//   9 (§pkSets3/4) เลือกเส้นทางก่อน (ชิป) → ยอดจริงของเส้นทางขึ้น แถวในตารางเหลือเส้นทางนั้น → เมนูเพิ่มเรือกรอง · ไทย+ตช=รวม · เต็มจอ (pk3-wide) · การ์ดขวา 1 ใบ + ใต้ตาราง 2 ใบ
//  10 (§pkCalc) การ์ด "ตารางคำนวณ" ใบแรกฝั่งขวา · จำนวน × ราคา = รวม คิดสดโดยไม่วาดหน้าใหม่ · ราคา/ใบ จำใน PIER_CFG.parkPrice · แถวพิมพ์เอง 3 แถว · ดึงจำนวนจากเส้นทาง/ชุด
//  13 (§pkLine3) การ์ด "สรุปส่งไลน์" · ต่อเกาะ: รายการซื้อ / รายการทั้งหมด (บรรทัดรวมแยกประเภท · เว้นบรรทัด · ลำละบรรทัด เวลา เรือ จำนวน) · 0 ไม่ขึ้น · คัดลอก
//  12 (§pkSets8) ใต้คอลัมน์ "ชุดนี้" ของแถวเส้นทาง/แถวรวม/แถววัน = รวมคนในชุดที่บันทึกแล้ว แยกประเภท
//  11 (§pkSets6) คอลัมน์ "ชุดนี้" เรียง ผญ ไทย · เด็กไทย · ต่ำกว่า 3 · ผญ ตปท · เด็ก ตปท · (ประเภทที่เพิ่มเอง) เหมือนบนเรือ
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
await page.evaluate(({ D, P }) => { _poPier = P; _poDate = D; _pkFam = 'all'; _pkSetBoats = []; _pkSetD = null; delete PIER_CFG.parkSets; window.__persist = 0; const r = window.laBlobSave; window.laBlobSave = function () { window.__persist++; return r ? r.apply(this, arguments) : undefined; }; window.__cfg0 = JSON.stringify(Object.assign({}, PIER_CFG, { parkSets: undefined, parkPrice: undefined })); renderPierPark(P); }, { D: DATE, P: PIER });
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
// 5 (§pkSets7) ใส่เกินที่เหลือบนลำ → ช่องเหลือง (pull) · เลขจาง ๆ ข้าง ๆ = เหลือ − ใส่ (ติดลบ = ดึงจากลำอื่น) · รายชื่อดึงจากลำอื่นในเส้นทางเดียวกัน ตรงประเภท มีป้าย "จาก <ลำ>" · บันทึกได้ (from=ลำจริง)
dlg.length = 0;
const pool5 = await page.evaluate(({ c }) => { const PL = pkSetPool(pk3Flat(), _pkSetD), used = pkSetUsed(_poDate, _pkSetD.id); const f = l => l.filter(p => p.cat === c && !p.over && !used[pkSetKey(p)]).length; return { own: f(PL.own), oth: f(PL.oth), fam: PL.fam && PL.fam.n, othBoats: [...new Set(PL.oth.map(p => pkSetPool(pk3Flat(), _pkSetD).P[pkSetKey(p)].x.B.boat.name))] }; }, { c: cat });
await page.evaluate(({ H, c, v }) => { const i = document.querySelector(H + ' .pk3-in[data-cat="' + c + '"]'); i.value = String(v); i.dispatchEvent(new Event('change')); }, { H, c: cat, v: pool5.own + 5 }); await page.waitForTimeout(300); a = await st();
const r5 = await page.evaluate(({ H, c }) => { const h = document.querySelector(H), sel = h.querySelector('.pk3-mx tr.bt.sel'), i = sel.querySelector('.pk3-in[data-cat="' + c + '"]');
  const sm = i.parentElement.querySelector('small.rm'); const zero = [...sel.querySelectorAll('.pk3-in')].filter(x => x !== i);
  const rows = [...h.querySelectorAll('.pk3-sheet tbody tr')].filter(t => !t.classList.contains('pk3-skip') && !t.querySelector('.pk-e'));
  const oth = rows.filter(t => t.querySelector('.othb')).map(t => ({ nm: t.querySelector('.nmc').textContent.trim(), b: t.querySelector('.othb').textContent.trim(), code: t.querySelector('.cd').textContent.trim() }));
  const sumTd = sel.querySelector('td.sum.big'); return { pull: i.classList.contains('pull'), over: i.classList.contains('over'), rm: sm.textContent, neg: sm.classList.contains('neg'), zeroEmpty: zero.every(x => x.value === '' && x.placeholder === '0'), nRows: rows.length, oth, sum: sumTd.firstChild.textContent, sumRm: sumTd.querySelector('small.rm').textContent, st: (h.querySelector('.pk3-info .st') || {}).textContent, info: (h.querySelector('.pk3-info > span') || {}).textContent }; }, { H, c: cat });
const n5a = await page.evaluate((D) => pkSets(D).length, DATE);
await page.click(H + ' .pk3-bh .pri'); await page.waitForTimeout(300);
const s5 = await page.evaluate((D) => { const S = pkSets(D); const last = S[S.length - 1]; return { n: S.length, from: last ? last.people.filter(q => q.from).map(q => q.from) : [], bid: last && last.bid, ids: S.map(x => x.id) }; }, DATE);
const enough = pool5.oth >= 5;
const okPull = r5.pull && !r5.over && r5.rm === '−5' && r5.neg && r5.zeroEmpty && /ลำอื่นใน/.test(r5.info) && r5.sum === String(pool5.own + 5);
const okList = enough ? (r5.nRows === pool5.own + 5 && r5.oth.length === 5 && r5.oth.every(o => o.code === code && pool5.othBoats.some(b => o.b === 'จาก ' + b)) && /ครบ .* จากลำอื่น 5/.test(r5.st) && s5.n === n5a + 1 && s5.from.length === 5 && s5.from.every(b => b !== big.bid) && dlg.length === 0)
  : (r5.nRows === pool5.own + pool5.oth && r5.oth.length === pool5.oth && /คนไม่พอ/.test(r5.st) && dlg.length === 1 && /Not enough people/.test(dlg[0]) && !/[^\x00-\x7F]/.test(dlg[0]) && s5.n === n5a);
if (okPull && okList) ok(`5 ใส่ ${pool5.own + 5} (เหลือบนลำ ${pool5.own}) → ช่องเหลือง เลขจาง −5 · ช่องอื่นว่าง (placeholder 0) · ` + (enough ? `ดึงจากลำอื่นใน ${pool5.fam} 5 คน (ป้าย ${[...new Set(r5.oth.map(o => o.b))].join('/')}) · บันทึกได้ from=ลำจริง` : `ลำอื่นมีแค่ ${pool5.oth} → คนไม่พอ · บันทึกไม่ได้ (alert ASCII)`)); else fail('5 ' + JSON.stringify({ pool5, r5, s5, n5a, dlg, okPull, okList }));
if (s5.n === n5a + 1) await page.evaluate(({ D, id }) => { pkSetsWrite(D, pkSets(D).filter(S => S.id !== id)); }, { D: DATE, id: s5.ids[s5.ids.length - 1] });
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
// 7 excel (§pkSets9: 'all' = ไฟล์ละลำ · ชีทสรุปมี ราคา/ใบ + รวม) · การ์ดขวาโชว์ยอดเงินต่อชุด/ต่อลำ/รวม
await page.evaluate(({ D, bid, c }) => { _pkSetD = null; pkSetTab(bid, pkTkData(D, _poPier).find(g => g.boats.some(B => B.bid === bid)).rid); pkSetCnt(c, 2); pkSetSave(); pkSetTab(bid, _pkSetD ? _pkSetD.rid : pkTkData(D, _poPier).find(g => g.boats.some(B => B.bid === bid)).rid); pkSetCnt(c, 1); pkSetName('ชุดทดสอบ'); pkSetSave(); }, { D: DATE, bid: big.bid, c: cat });
await page.waitForTimeout(300);
// ชุดที่ 3 บนลำอื่น (ลำแรกที่มีคนเหลือ) · เอาไว้ทดสอบไฟล์ละลำ · ลบทิ้งหลังเช็ก
const o7 = await page.evaluate(({ D, bid }) => { const F = pk3Flat(); const used = pkSetUsed(D); const y = F.find(x => x.B.bid !== bid && pkSetAvail(x.B, used).length); if (!y) return null; const p = pkSetAvail(y.B, used)[0]; _pkSetD = null; pkSetTab(y.B.bid, y.g.rid); pkSetCnt(p.cat, 1); pkSetName('ลำอื่น'); pkSetSave(); const S = pkSets(D); return { bid: y.B.bid, name: y.B.boat.name, cat: p.cat, id: S[S.length - 1].id, n: S.length }; }, { D: DATE, bid: big.bid });
await page.evaluate(({ c, c2 }) => { delete PIER_CFG.parkPrice; pkPriceSet(c, '100'); if (c2 && c2 !== c) pkPriceSet(c2, '40'); renderPierPark(); }, { c: cat, c2: o7 && o7.cat }); await page.waitForTimeout(300);
const x7 = await page.evaluate((D) => { const out = [];
  if (typeof XLSX === 'undefined') { /* harness โหลด CDN ไม่ได้ · ตัวแทนขั้นต่ำที่ pkSetXls ใช้ */
    window.XLSX = { utils: { book_new: () => ({ SheetNames: [], Sheets: {} }), aoa_to_sheet: rows => ({ __rows: rows }), book_append_sheet: (wb, ws, n) => { wb.SheetNames.push(n); wb.Sheets[n] = ws; }, sheet_to_json: ws => ws.__rows }, writeFile: () => {} }; } const W = XLSX.writeFile; XLSX.writeFile = (wb, fn) => { out.push({ fn, sheets: wb.SheetNames, rows: wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })) }); }; try { pkSetXls(pkSets(D)[0].id); pkSetXls('all'); } finally { XLSX.writeFile = W; }
  const h = document.querySelector('#pk-host-' + _poPier); const card = [...h.querySelectorAll('.pk3-set')].map(b => ({ name: b.querySelector('.t b').textContent, amt: b.querySelector('.v .amt').textContent, pt: b.querySelector('.v .amt').classList.contains('pt') }));
  return { out, sets: pkSets(D).map(S => ({ name: S.name, n: S.people.length, bid: S.bid })), card, bsum: [...h.querySelectorAll('.pk3-bsum')].map(x => x.textContent), gsum: (h.querySelector('.pk3-gsum') || {}).textContent }; }, DATE);
const one = x7.out[0] || {}, allF = x7.out.slice(1);
const sumRows = one.rows ? one.rows[one.rows.length - 1] : [];
const perBoat = o7 && allF.length === 2 && allF[0].sheets.length === 3 && allF[0].sheets.includes('ชุดทดสอบ') && allF[1].sheets.length === 2 && allF[1].sheets[0] === 'ลำอื่น' && allF[1].fn.startsWith(o7.name.replace(/[^\w฀-๿-]+/g, '_') + '_2026-09-16_') && allF.every(f => /_2026-09-16_\d{4}\.xlsx$/.test(f.fn)) && allF[0].fn.startsWith(big.name.replace(/[^\w฀-๿-]+/g, '_') + '_') && one.fn && one.fn.startsWith(big.name.replace(/[^\w฀-๿-]+/g, '_') + '_2026-09-16_');   /* §pkSets10 ชื่อไฟล์ = เรือ_วันที่_HHMM */
const sumOk = sumRows.length === 3 && sumRows[0].length === 7 && sumRows[0][5] === 'ราคา/ใบ' && sumRows[1][4] === 2 && sumRows[1][5] === 100 && sumRows[1][6] === 200 && sumRows[2][0] === 'รวม' && sumRows[2][6] === 200;
const p3 = o7 && o7.cat === cat ? 100 : 40;
const cardOk = x7.card.length === 3 && x7.card[0].amt === '฿ 200' && x7.card[1].amt === '฿ 100' && x7.card[2].amt === '฿ ' + p3 && x7.card.every(c => !c.pt) && x7.bsum.length === 1 && /2 ชุด · 3 คน/.test(x7.bsum[0]) && /฿ 300/.test(x7.bsum[0]) && /3 ชุด · 4 คน/.test(x7.gsum) && new RegExp('฿ ' + (300 + p3)).test(x7.gsum);
if (x7.sets.length === 3 && x7.sets[1].name === 'ชุดทดสอบ' && one.sheets && one.sheets.length === 2 && one.rows[0].length === 2 && one.rows[0][0].length === 3 && one.rows[0][0][2] === code && one.sheets[1] === 'สรุปรหัส' && sumOk && perBoat && cardOk)
  ok(`7 Excel · ไฟล์ ${one.fn} · ชุดเดียว ${one.sheets.length} ชีท (3 คอลัมน์ · code ${code} · สรุป 2×100=200) · ทุกลำ → ${allF.length} ไฟล์ (${big.name} 3 ชีท / ${o7.name} 2 ชีท) · การ์ด ฿200 ฿100 ฿${p3} · รวมลำ ฿300 · รวมทุกชุด ฿${300 + p3}`); else fail('7 ' + JSON.stringify({ sets: x7.sets, one: { s: one.sheets, r0: one.rows && one.rows[0], sum: sumRows }, allF: allF.map(f => ({ s: f.sheets, fn: f.fn })), o7, card: x7.card, bsum: x7.bsum, gsum: x7.gsum, sumOk, perBoat, cardOk }));
await page.evaluate(({ D, id }) => { pkSetsWrite(D, pkSets(D).filter(S => S.id !== id)); delete PIER_CFG.parkPrice; renderPierPark(); }, { D: DATE, id: o7 && o7.id }); await page.waitForTimeout(300);
// 12 (§pkSets8) ใต้คอลัมน์ "ชุดนี้" ของแถวเส้นทาง/แถวรวม/แถววัน = รวมคนในชุดที่บันทึกแล้ว แยกประเภท (ตอนนี้ 2 ชุด · cat 2+1 = 3 บนลำ big)
await page.waitForTimeout(200);
const r12 = await page.evaluate(({ H, D, c, bid }) => { const h = document.querySelector(H); const TY = pk3TyOrder(pkTypes()); const ci = TY.findIndex(T => T.k === c);
  const row = tr => { const sv = [...tr.querySelectorAll('td.sv')].map(t => +t.textContent || 0); return { n: sv.length, cat: sv[ci], tot: sv[sv.length - 1], other: sv.filter((v, i) => i !== ci && i !== sv.length - 1).reduce((a, b) => a + b, 0) }; };
  const fm = [...h.querySelectorAll('.pk3-mx tr.fm')].map(tr => ({ nm: tr.querySelector('.fn').childNodes[1].textContent.trim(), ...row(tr) }));
  const fam = pk2FamOf(pkSets(D)[0].rid).n; const want = pkSets(D).reduce((a, S) => a + S.people.filter(q => q.cat === c).length, 0);
  return { ty: TY.length, fm, dy: row(h.querySelector('.pk3-mx tr.dy')), fam, want, nSets: pkSets(D).length, chosen: _pkSetBoats.includes(bid), fh: h.querySelector('.pk3-mx tr.fh').textContent }; }, { H, D: DATE, c: cat, bid: big.bid });
const famR = r12.fm.find(x => x.nm === r12.fam), allR = r12.fm.find(x => x.nm === 'ทั้งหมด'), othR = r12.fm.filter(x => x.nm !== r12.fam && x.nm !== 'ทั้งหมด');
if (r12.want === 3 && r12.nSets === 2 && famR && famR.n === r12.ty + 1 && famR.cat === 3 && famR.tot === 3 && famR.other === 0 && allR && allR.cat === 3 && allR.tot === 3 && othR.every(x => x.tot === 0) && r12.chosen && r12.dy.cat === 3 && r12.dy.tot === 3 && /รวมในชุดที่บันทึกแล้ว/.test(r12.fh))
  ok(`12 ใต้ "ชุดนี้" · แถว ${r12.fam} = ${famR.cat} (${cat}) รวม ${famR.tot} · แถวรวม ${allR.tot} · แถววัน ${r12.dy.tot} · เส้นทางอื่น 0`); else fail('12 ' + JSON.stringify(r12));
// 13 (§pkLine) การ์ด "สรุปส่งไลน์" · วันที่ · จำนวนทั้งหมด (ผญ ไทย · เด็ก ไทย · ผญ ตช · เด็ก ตช) · รายการซื้อ (เวลา เรือ จำนวน) · เรือที่ไม่ได้ซื้อ (เวลา เรือ) · ปุ่มคัดลอก
await page.evaluate(() => { _pkSetFamF = 'all'; renderPierPark(); }); await page.waitForTimeout(300);
const r13 = await page.evaluate(({ H, D }) => { const h = document.querySelector(H); const t = pkLineText(); const pre = (h.querySelector('.pk3-line .pk3-lt') || {}).textContent;
  const setB = [...new Set(pkSets(D).map(S => S.bid))]; const by = {}; let n = 0; pkSets(D).forEach(S => S.people.forEach(q => { by[q.cat] = (by[q.cat] || 0) + 1; n++; }));
  const boats = pk3Flat().map(x => ({ bid: x.B.bid, nm: x.B.boat.name, dep: x.B.dep }));
  return { t, pre, n, by, setB, boats, inRight: !!h.querySelector('.pk3-full > .pc2-col + .pc2-col .pk3-line') }; }, { H, D: DATE });
await page.evaluate(() => { window.__cp = null; document.execCommand = () => { window.__cp = document.activeElement && document.activeElement.value; return true; }; try { Object.defineProperty(window, 'isSecureContext', { value: false }); } catch (_) {} });
await page.click(H + ' .pk3-line .pri'); await page.waitForTimeout(150);
const c13 = await page.evaluate((H) => ({ cp: window.__cp, btn: document.querySelector(H + ' .pk3-line .pri').textContent }), H);
const L = r13.t.split('\n');
const MAIN = [['adTH', 'ผญท'], ['chTH', 'ดท'], ['adFR', 'ผญตช'], ['chFR', 'ดตช'], ['inf', 'ดเล็ก']];   // §pkLine4 ชื่อย่อ
const brk = c => MAIN.filter(m => c[m[0]]).map(m => m[1] + ' ' + c[m[0]]).join(' ');   // §pkLine5 เว้นวรรคเดียว
// expected per family · bought (sets) + all boats (people on board)
const exp13 = await page.evaluate((D) => { const F = pk3Flat(), fams = []; const by = {};
  F.forEach(x => { const f = pk2FamOf(x.g.rid); if (!by[f.id]) { by[f.id] = { n: f.n, all: [], buy: {} }; fams.push(f.id); } const c = {}; let n = 0; x.B.people.forEach(p => { if (p.over) return; c[p.cat] = (c[p.cat] || 0) + 1; n++; }); if (n) by[f.id].all.push({ nm: x.B.boat.name, dep: x.B.dep, c, n }); });
  pkSets(D).forEach(S => { const x = F.find(y => y.B.bid === S.bid); const id = pk2FamOf(x.g.rid).id; const r = by[id].buy[S.bid] || (by[id].buy[S.bid] = { nm: x.B.boat.name, dep: x.B.dep, c: {}, n: 0 }); S.people.forEach(q => { r.c[q.cat] = (r.c[q.cat] || 0) + 1; r.n++; }); });
  return fams.map(id => ({ n: by[id].n, all: by[id].all, buy: Object.values(by[id].buy) })); }, DATE);
const block = (rows, title) => { if (!rows.length) return []; const tc = {}; let tn = 0; rows.forEach(r => { Object.keys(r.c).forEach(k => tc[k] = (tc[k] || 0) + r.c[k]); tn += r.n; });
  return ['', `${title} · ${rows.length} ลำ · ${tn} คน`, brk(tc), ''].concat(rows.slice().sort((a, b) => (a.dep + a.nm).localeCompare(b.dep + b.nm)).map(r => `${r.dep} ${r.nm} ${brk(r.c)}`)   /* §pkLine5 ไม่มียอดรวมต่อลำ */); };
let want13 = ['ตั๋วอุทยาน' + (exp13.length === 1 ? ' ' + exp13[0].n : '') + ' · พ. 16 ก.ย. 69'];
exp13.forEach(f => { if (exp13.length > 1) want13.push('', `— ${f.n} —`); want13 = want13.concat(block(f.buy, 'รายการซื้อ'), block(f.all, 'รายการทั้งหมด')); });
const noZero = !/ 0( |$)/m.test(r13.t) && !/^\d\d:\d\d .* · /m.test(r13.t);
// เลือกเกาะ → เกาะเดียว ชื่อเกาะในหัว ไม่มีหัวช่วง
const one13 = await page.evaluate((fid) => { _pkSetFamF = fid; const t = pkLineText(); _pkSetFamF = 'all'; return t; }, await page.evaluate(() => pk2FamOf(pk3Flat()[0].g.rid).id));
if (r13.inRight && r13.pre === r13.t && r13.t === want13.join('\n') && noZero && /^ตั๋วอุทยาน \S/.test(one13) && !/— .* —/.test(one13) && /รายการทั้งหมด · \d+ ลำ/.test(one13) && c13.cp === r13.t && /คัดลอกแล้ว/.test(c13.btn))
  ok(`13 สรุปส่งไลน์ (§pkLine3) · ${exp13.length} เกาะ · รายการซื้อ + รายการทั้งหมด (บรรทัดแยกประเภท · เว้นบรรทัด · ลำละบรรทัด) · ไม่มี 0 · เลือกเกาะ = เกาะเดียว · คัดลอกได้`); else fail('13 ' + JSON.stringify({ got: L, want: want13, noZero, one13, inRight: r13.inRight, c13 }));
// 8
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /ทั้งหมด/.test(b.textContent)).click(), H); await page.waitForTimeout(400); a = await st();
const cfgSame = await page.evaluate(() => JSON.stringify(Object.assign({}, PIER_CFG, { parkSets: undefined, parkPrice: undefined })) === window.__cfg0);
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
await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk3-rt .pk3-fm')][1].click(), H); await page.waitForTimeout(300);
await page.click(H + ' .pk3-add'); await page.waitForTimeout(250);
const g9 = await page.evaluate(({ H, D, P }) => { const h = document.querySelector(H); const sel = h.querySelector('.pk3-mx tr.fm.sel .fn').childNodes[1].textContent.trim();
  const menu = [...h.querySelectorAll('.pk3-menu > button .bn')].map(b => b.textContent.trim());
  const F = pkTkData(D, P); const want = []; F.forEach(g => { if (pk2FamOf(g.rid).n === sel) g.boats.forEach(B => want.push(B.boat.name)); });
  const chipOn = (h.querySelector('.pk3-rt .pk3-fm.on') || {}).textContent || ''; const fmRows = [...h.querySelectorAll('.pk3-mx tr.fm')].map(t => t.querySelector('.fn').childNodes[1].textContent.trim());
  return { sel, menu, want, add: (h.querySelector('.pk3-add') || {}).textContent, chipOn, fmRows, wide: !!h.querySelector('.pk2.pk3-wide'), rightCard: !!h.querySelector('.pk3-full > .pc2-col + .pc2-col .pk3-sets'), under: h.querySelectorAll('.pk3-sidegrid .pc2-card').length, cs: (h.querySelector('.pk3-rt .cs') || {}).textContent || '' }; }, { H, D: DATE, P: PIER });
const filtOk = g9.sel !== 'ทั้งหมด' && g9.chipOn.includes(g9.sel) && g9.fmRows.join() === g9.sel && g9.menu.length === g9.want.length && g9.want.every(n => g9.menu.includes(n)) && g9.add.includes(g9.sel) && g9.cs.includes(g9.sel) && g9.wide && g9.rightCard && g9.under === 2;
if (famOk && f9.full && filtOk) ok(`9 ชิปเส้นทางก่อน · ${f9.fams.join('/')} (ไทย+ตช=รวม · รวม=ยอดวัน ${f9.all}) · เลือก ${g9.sel} → ยอดขึ้น แถวเหลือเส้นทางนั้นแถวเดียว เมนูเรือ ${g9.menu.length} ลำ · เต็มจอ · การ์ดขวา 1 + ใต้ตาราง 2`);
else fail('9 ' + JSON.stringify({ famOk, fm: f9.fm, exp: f9.exp, all: f9.all, full: f9.full, g9 }));
await page.evaluate(() => { _pkSetFamF = 'all'; _pkSetMenu = false; });
// 10 §pkCalc · การ์ดคำนวณเป็นใบแรกฝั่งขวา · พิมพ์จำนวน × ราคา → รวมสดไม่วาดใหม่ (โฟกัสอยู่) · ราคาจำใน PIER_CFG.parkPrice (persist) · แถวพิมพ์เอง · ดึงจากเส้นทาง
await page.evaluate(() => { delete PIER_CFG.parkPrice; pkCalcClear(); }); await page.waitForTimeout(300);
const o11 = await page.evaluate((H) => [...document.querySelectorAll(H + ' .pk3-mx thead tr.s th')].slice(10, 15).map(t => t.textContent.trim()), H);
const want11 = await page.evaluate(() => ['adTH', 'chTH', 'inf', 'adFR', 'chFR'].map(k => (pkTypes().find(T => T.k === k) || {}).s).filter(Boolean));
if (o11.join('|') === want11.join('|')) ok('11 คอลัมน์ ชุดนี้ เรียงเหมือนบนเรือ · ' + o11.join(' · ')); else fail('11 ' + JSON.stringify({ o11, want11 }));
const c10 = await page.evaluate((H) => { const h = document.querySelector(H); const col = h.querySelector('.pk3-full > .pc2-col + .pc2-col'); return { first: col && col.firstElementChild.classList.contains('pk3-calc'), rows: h.querySelectorAll('.pk3-calc tr[data-k]').length, ty: pkTypes().length }; }, H);
const p0 = await page.evaluate(() => window.__persist);
await page.click(H + ' .pk3-calc tr[data-k="' + cat + '"] [data-f=q]'); await page.keyboard.type('12');
await page.click(H + ' .pk3-calc tr[data-k="' + cat + '"] [data-f=p]'); await page.keyboard.type('150'); await page.waitForTimeout(200);
const d10 = await page.evaluate(({ H, c }) => { const h = document.querySelector(H); const tr = h.querySelector('.pk3-calc tr[data-k="' + c + '"]');
  return { row: tr.querySelector('.pk3-cr').textContent, tot: h.querySelector('.pk3-ct').textContent, focus: document.activeElement === tr.querySelector('[data-f=p]'), price: (PIER_CFG.parkPrice || {})[c], persist: window.__persist }; }, { H, c: cat });
await page.click(H + ' .pk3-calc tr[data-k="free0"] [data-f=n]'); await page.keyboard.type('ค่าเรือเล็ก');
await page.click(H + ' .pk3-calc tr[data-k="free0"] [data-f=q]'); await page.keyboard.type('2');
await page.click(H + ' .pk3-calc tr[data-k="free0"] [data-f=p]'); await page.keyboard.type('250.5'); await page.waitForTimeout(200);
const e10 = await page.evaluate((H) => ({ tot: document.querySelector(H + ' .pk3-ct').textContent, free: _pkCalc.free[0] }), H);
await page.evaluate(() => pkCalcFill('fam')); await page.waitForTimeout(300);
const f10 = await page.evaluate(({ H, c, D, P }) => { const h = document.querySelector(H); const q = h.querySelector('.pk3-calc tr[data-k="' + c + '"] [data-f=q]').value; const p = h.querySelector('.pk3-calc tr[data-k="' + c + '"] [data-f=p]').value;
  let n = 0; pkTkData(D, P).forEach(g => g.boats.forEach(B => B.people.forEach(x => { if (!x.over && x.cat === c) n++; }))); return { q, n, p, free: h.querySelector('.pk3-calc tr[data-k="free0"] [data-f=n]').value }; }, { H, c: cat, D: DATE, P: PIER });
if (c10.first && c10.rows === c10.ty + 3 && d10.row === '1,800' && d10.tot === '1,800' && d10.focus && d10.price === '150' && d10.persist > p0 && e10.tot === '2,301' && e10.free.n === 'ค่าเรือเล็ก' && f10.q === String(f10.n) && f10.p === '150' && f10.free === 'ค่าเรือเล็ก')
  ok(`10 การ์ดคำนวณใบแรก · ${cat} 12×150 = 1,800 (โฟกัสอยู่ · ราคา persist) · แถวเอง 2×250.5 → รวม 2,301 · ดึงจากเส้นทาง = ${f10.n}`);
else fail('10 ' + JSON.stringify({ c10, d10, e10, f10 }));
await page.evaluate(() => { delete PIER_CFG.parkPrice; pkCalcClear(); });
if (process.env.SHOT) { await page.evaluate((H) => { [...document.querySelectorAll(H + ' .pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).click(); }, H); await page.waitForTimeout(300); await page.evaluate((D) => pkSetOpen(pkSets(D)[0].id), DATE); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT, fullPage: true }); }
await close();
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
