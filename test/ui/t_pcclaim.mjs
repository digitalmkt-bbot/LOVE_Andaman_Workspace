// §pcClm · เงินสดย่อย · รายการตั้งเบิก (ติ๊กแถว → สรุปตั้งเบิก → ตั้งชื่อ → บันทึก)
// ที่มา (2026-10-16) · owner "สรุปตั้งเบิก ควรเป็น ติ๊ก ๆ รายการ แล้วกดสรุปตั้งเบิก มีให้เขียนชื่อ รายการอัพเดทข้างล่าง
//   และเมื่อบันทึกรายการตั้งเบิกแล้ว ควรทำให้รู้ว่ารายการนี้ตั้งเบิกแล้ว อยู่ในรายการล่าง"
// ข้อมูล (ท่าทับละมุ): 15 ต.ค. จ่าย 5,000 (ก่อนเริ่มใช้ตั้งเบิก) · 16 ต.ค. จ่าย a 1,000 · b 2,000 · c 4,000
//   17 ต.ค. "รับเงินคืน 15/10" 5,000 · "รับเงินคืน รถตู้ชุดแรก" 3,000 · "เงินเบิกคืน" 4,000
// กัน
//   1 ติ๊ก a,b แล้วกด สรุปตั้งเบิก → ช่องชื่อขึ้น (ชื่อตั้งต้นมีให้) → พิมพ์ "รถตู้ชุดแรก" Enter → บันทึก 1 รายการ ผูก a,b · ตาราง po_cash_rows มี claim
//   2 แถว a,b มีชิป "ตั้งเบิก · รถตู้ชุดแรก" · c ไม่มี
//   3 ติ๊ก b (ตั้งเบิกแล้ว) + c → ปุ่ม "สรุปตั้งเบิก 1 รายการ" · กดหัวสมุดแบบไม่ติ๊ก → เลือกให้เฉพาะที่ยังไม่ตั้งเบิก (c) → บันทึก → c อยู่รายการที่ 2 · b ยังอยู่รายการแรก
//   4 การ์ดรายการตั้งเบิกใต้สมุด: 2 รายการ · ชื่อ · 2/1 รายการ · ยอด 3,000 / 4,000 · รอรับคืน
//   5 เงินคืน 17 ต.ค.: ชื่อในข้อความ → "↩ รถตู้ชุดแรก · ตรง" · ไม่ระบุ 4,000 → รายการที่ 2 ตรง · "15/10" → วัน 15 ต.ค. ตรง (ก่อนเริ่มใช้ยังจับเป็นวัน)
//      การ์ดรายการตั้งเบิก: ทั้งสองรายการ "คืนครบ"
//   6 โหลดใหม่ (สร้าง view จากตาราง) แล้วชิป/รายการยังอยู่ · เซฟซ้ำไม่มีอะไรเปลี่ยน
//   7 พิมพ์ใบตั้งเบิก (โครงเดียวกับใบรับรองแทนใบเสร็จฯ · ไม่มีคอลัมน์จ่ายให้): ชื่อรายการ · เฉพาะแถวของใบนี้ · ยอดเป็นตัวอักษร · สถานะคืนแล้วครบ · ลายเซ็น 3 ช่อง
//   8 เอาแถว a ออกจากรายการ → รายการแรกเหลือ 2,000 · ลบรายการที่ 2 → c ไม่มีชิป ติ๊กตั้งเบิกใหม่ได้ · 9 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1200 });
await goView(page, 'pop-tublamu', 1000);
await page.evaluate(() => {
  window.pcGuard = () => true; window._saves = 0; window.laBlobSave = () => { window._saves++; };
  window.confirm = () => true;
  const P = 'tublamu', A = pcPier(P); Object.keys(A).forEach(k => delete A[k]);
  const d = ds => pcDay(P, ds, true);
  d('2026-10-15').out.push({ id: 'z1', txt: 'ค่าแรงไกด์ 15/10/26', amt: 5000, at: '16:00' });
  d('2026-10-16').out.push({ id: 'a', txt: 'ค่ารถตู้ นายA', amt: 1000, at: '10:00' }, { id: 'b', txt: 'ค่ารถตู้ นายB', amt: 2000, at: '10:05' },
    { id: 'c', txt: 'ซื้อน้ำแข็ง', amt: 4000, at: '11:00' });
  pcSave();
  _pcPier = P; _pcTab = 0; _pcYM = '2026-10'; _pcDate = '2026-10-16'; renderPierCash(P); });
const tick = async (id, on = true) => page.evaluate(([id, on]) => pcSelSet('out', id, on), [id, on]);

// 1
await tick('a'); await tick('b');
await page.click('#pc-selbar button[onclick="pcClmStart()"]');
await page.waitForTimeout(80);
const f1 = await page.evaluate(() => { const i = document.getElementById('pc-clm-name'); return { has: !!i, v: i && i.value, foc: document.activeElement === i }; });
await page.fill('#pc-clm-name', 'รถตู้ชุดแรก');
await page.press('#pc-clm-name', 'Enter');
await page.waitForTimeout(150);
const r1 = await page.evaluate(() => { const C = pcClmArr(); const t = {}; pcRowsArr().forEach(x => { t[x.id] = x.claim || ''; });
  return { n: C.length, c: C[0] && { pier: C[0].pier, date: C[0].date, name: C[0].name, id: C[0].id }, t }; });
const c1 = r1.c && r1.c.id;
if (f1.has && /16 ต.ค./.test(f1.v || '') && f1.foc && r1.n === 1 && r1.c.pier === 'tublamu' && r1.c.date === '2026-10-16' && r1.c.name === 'รถตู้ชุดแรก'
  && r1.t.a === c1 && r1.t.b === c1 && !r1.t.c && !r1.t.z1)
  ok('1 ติ๊ก 2 แถว → ช่องชื่อ (ตั้งต้น "' + f1.v + '") → บันทึก "รถตู้ชุดแรก" · ผูก a,b ในตาราง');
else fail('1 ' + JSON.stringify({ f1, r1 }));

// 2
const r2 = await page.evaluate(() => ['a', 'b', 'c'].map(id => { const e = document.getElementById('pcr-tublamu-out-' + id); const ch = e && e.querySelector('em.pc-cl');
  return (ch ? ch.textContent : '') + '|' + (e && e.classList.contains('clm') ? 1 : 0); }));
if (r2[0] === 'ตั้งเบิก · รถตู้ชุดแรก|1' && r2[1] === 'ตั้งเบิก · รถตู้ชุดแรก|1' && r2[2] === '|0') ok('2 a,b มีชิป "ตั้งเบิก · รถตู้ชุดแรก" · c ไม่มี');
else fail('2 ' + JSON.stringify(r2));

// 3
await tick('b'); await tick('c');
const r3a = await page.evaluate(() => document.getElementById('pc-selbar').innerText.replace(/\s+/g, ' '));
await page.evaluate(() => pcSelClear());
await page.click('#pc-host-tublamu .pc2-led .ch button[onclick="pcClmStart()"]');
await page.waitForTimeout(80);
const r3b = await page.evaluate(() => ['a', 'b', 'c'].filter(id => pcSelHas('out', id)).join());
await page.fill('#pc-clm-name', 'น้ำแข็ง');
await page.click('#pc-selbar button[onclick="pcClmSave()"]');
await page.waitForTimeout(150);
const r3 = await page.evaluate(() => { const C = pcClmArr(); const t = {}; pcRowsArr().forEach(x => { t[x.id] = x.claim || ''; }); return { n: C.length, c2: C[1] && C[1].id, name2: C[1] && C[1].name, t }; });
const c2 = r3.c2;
if (/สรุปตั้งเบิก 1 รายการ/.test(r3a) && /ตั้งเบิกแล้ว 1 · ไม่นับ/.test(r3a) && r3b === 'c' && r3.n === 2 && r3.name2 === 'น้ำแข็ง' && r3.t.c === c2 && r3.t.b === c1)
  ok('3 แถวที่ตั้งเบิกแล้วไม่ถูกนับซ้ำ · กดหัวสมุดแบบไม่ติ๊ก = เลือกเฉพาะที่ยังไม่ตั้งเบิก → รายการที่ 2 "น้ำแข็ง"');
else fail('3 ' + JSON.stringify({ r3a, r3b, r3 }));

// 4
const r4 = await page.evaluate(() => [...document.querySelectorAll('#pc-host-tublamu .pc2-clms .pc2-cl')].map(e => e.querySelector('.r').innerText.replace(/\s+/g, ' ').trim()));
if (r4.length === 2 && r4.some(t => /รถตู้ชุดแรก .*2 รายการ.*รอรับคืน.*฿3,000/.test(t)) && r4.some(t => /น้ำแข็ง .*1 รายการ.*รอรับคืน.*฿4,000/.test(t)))
  ok('4 การ์ดใต้สมุด: รถตู้ชุดแรก 2 รายการ ฿3,000 · น้ำแข็ง 1 รายการ ฿4,000 · รอรับคืน');
else fail('4 ' + JSON.stringify(r4));

// 5
const r5 = await page.evaluate(() => {
  pcDay('tublamu', '2026-10-17', true)['in'].push({ id: 'r1', txt: 'รับเงินคืน 15/10', amt: 5000, at: '09:00' },
    { id: 'r2', txt: 'รับเงินคืน รถตู้ชุดแรก', amt: 3000, at: '09:10' }, { id: 'r3', txt: 'เงินเบิกคืน', amt: 4000, at: '09:20' });
  pcSave(); _pcDate = '2026-10-17'; renderPierCash('tublamu');
  const chip = id => ((document.getElementById('pcr-tublamu-in-' + id) || document.body).querySelector('.pc-rf') || {}).textContent;
  const M = pcRefundMatch('tublamu').res;
  return { c: ['r1', 'r2', 'r3'].map(chip), how: ['r1', 'r2', 'r3'].map(k => M[k] && M[k].how),
    list: [...document.querySelectorAll('#pc-host-tublamu .pc2-clms .pc2-cl .st')].map(e => e.textContent) }; });
if (r5.c[0] === '↩ 15 ต.ค. · ตรง' && r5.c[1] === '↩ รถตู้ชุดแรก · ตรง' && r5.c[2] === '↩ น้ำแข็ง · ตรง' && r5.how.join() === 'text,name,run'
  && r5.list.length === 2 && r5.list.every(t => /^คืนครบ/.test(t)))
  ok('5 เงินคืน: "15/10" → 15 ต.ค. ตรง · ชื่อ → รถตู้ชุดแรก ตรง · 4,000 → น้ำแข็ง ตรง · การ์ด: คืนครบทั้งสอง');
else fail('5 ' + JSON.stringify(r5));

// 6
const r6 = await page.evaluate(() => {
  const s0 = window._saves; pcSave(); const same = window._saves === s0;
  _PC_ARR = null; _PC_MEM = {}; _pcDate = '2026-10-16'; renderPierCash('tublamu');
  const e = document.getElementById('pcr-tublamu-out-a'), ch = e && e.querySelector('em.pc-cl');
  const s1 = window._saves; pcSave(); const same2 = window._saves === s1;
  return { same, same2, chip: ch && ch.textContent, n: document.querySelectorAll('#pc-host-tublamu .pc2-clms .pc2-cl').length }; });
if (r6.same && r6.same2 && r6.chip === 'ตั้งเบิก · รถตู้ชุดแรก' && r6.n === 2) ok('6 สร้าง view ใหม่จากตาราง → ชิป/รายการยังอยู่ · เซฟซ้ำไม่มีอะไรเปลี่ยน');
else fail('6 ' + JSON.stringify(r6));

// 7
const r7 = await page.evaluate(id => { let html = ''; const o = window.open; window.open = () => ({ document: { open() {}, write(h) { html += h; }, close() {} }, focus() {} });
  pcPrintClaim(id); window.open = o; const d = document.createElement('div'); d.innerHTML = html;
  const rows = [...d.querySelectorAll('.cf-tb tbody tr')].filter(t => t.querySelector('td.t').textContent.trim());
  return { h1: (d.querySelector('.pcp-hd .h1') || {}).textContent, ttl: (d.querySelector('.cf-t') || {}).textContent, name: (d.querySelector('.cf-co .fill') || {}).textContent,
    n: rows.length, txt: rows.map(t => t.querySelector('td.t').textContent), sum: (d.querySelector('.cf-tb tr.sum') || {}).textContent,
    ft: (d.querySelector('.cf-ft') || {}).textContent, th: [...d.querySelectorAll('.cf-tb thead th')].map(e => e.textContent).join('|'), sg: [...d.querySelectorAll('.cf-sg > div')].map(e => e.textContent) }; }, c1);
if (r7.h1 === 'เงินสดย่อย · ใบตั้งเบิก' && r7.ttl === 'ใบตั้งเบิกเงินสดย่อย' && r7.name === 'รถตู้ชุดแรก' && r7.n === 2 && r7.txt.join('|') === 'ค่ารถตู้ นายA|ค่ารถตู้ นายB'
  && /สามพันบาทถ้วน/.test(r7.sum) && /3,000/.test(r7.sum) && /คืนแล้ว 3,000 บาท .* · ครบ/.test(r7.ft) && r7.th === 'วัน เดือน ปี|รายละเอียดรายจ่าย|จำนวนเงิน|หมายเหตุ' && r7.sg.length === 3 && /\(ผู้ขอเบิก\)/.test(r7.sg[0]))
  ok('7 พิมพ์ใบตั้งเบิก: แบบใบรับรองฯ · ไม่มีคอลัมน์จ่ายให้ · ชื่อ "รถตู้ชุดแรก" · เฉพาะ 2 แถวของใบนี้ · สามพันบาทถ้วน · คืนแล้วครบ · ลายเซ็น 3 ช่อง');
else fail('7 ' + JSON.stringify(r7));
const r7b = await page.evaluate(() => { const g = pcGrpOf({ txt: 'ค่าตั๋วอุทยานสิมิลัน 8/5/2026', amt: 1 }, 'out'); return { g: g && g.k }; });
if (r7b.g === 'park_sm') ok('7b "ค่าตั๋วอุทยานสิมิลัน" = กลุ่มอุทยานสิมิลัน');
else fail('7b ' + JSON.stringify(r7b));

// 8
const r8 = await page.evaluate(([c1, c2]) => {
  pcClmUnline(c1, 'a'); pcClmDel(c2);
  const t = {}; pcRowsArr().forEach(x => { t[x.id] = x.claim || ''; });
  const amt = [...document.querySelectorAll('#pc-host-tublamu .pc2-clms .pc2-cl .am')].map(e => e.textContent);
  const ch = id => !!(document.getElementById('pcr-tublamu-out-' + id) || document.body).querySelector('em.pc-cl');
  pcSelSet('out', 'c', true);
  return { t, amt, n: pcClmArr().length, chA: ch('a'), chC: ch('c'), bar: document.getElementById('pc-selbar').innerText.replace(/\s+/g, ' ') }; }, [c1, c2]);
if (!r8.t.a && r8.t.b === c1 && !r8.t.c && r8.n === 1 && JSON.stringify(r8.amt) === '["฿2,000"]' && !r8.chA && !r8.chC && /สรุปตั้งเบิก 1 รายการ/.test(r8.bar))
  ok('8 เอา a ออก → รายการแรก ฿2,000 · ลบรายการที่ 2 → c ไม่มีชิป ตั้งเบิกใหม่ได้');
else fail('8 ' + JSON.stringify(r8));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('9 ไม่มี error'); else fail('9 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
