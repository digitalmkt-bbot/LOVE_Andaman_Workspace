// §flwTH · Fleet Work (ภาพรวม) มีภาษาไทยตามปุ่ม TH/EN · โหมด EN ยังเป็นอังกฤษเหมือนเดิม
//
// ที่มา (2026-10-26) · owner ส่งภาพหน้า Fleet Work "ขอเวอร์ชั่น ภาษาไทยด้วย ให้ User เข้าใจ"
// ข้อมูลทดสอบ: งานซ่อม MJ-999 บนเรือลำแรก (กำลังซ่อม · ไม่มีผู้รับผิดชอบ)
// กัน
//   1 โหมดไทย (ค่าตั้งต้น): หัว "เรือจอดซ่อม" · แท็บ "ภาพรวม" · สเตจ "แจ้งปัญหา…รอบิล" · หัวตาราง "เลขที่ / งาน / ขั้น"
//     แผงขวา "ถึงขั้นไหนแล้ว" "ขั้นต่อไป" "ปิดงาน" "เพิ่มโน้ต" · การ์ดรูป "รูปภาพ" · ไม่มีคำอังกฤษชุดหลักหลงเหลือ
//   2 สลับ EN: กลับเป็น "Boats down" "Overview" "Reported" "Where it stands" "Next step" "Close job" "Photos" · ไม่มีคำไทยจากพจนานุกรม
//   3 ชื่องานที่พนักงานพิมพ์ไม่ถูกแปล · ไม่มี error
//   4 (§flwTH2) หน้าต่าง + เพิ่มงาน: ไทย "เกิดอะไรขึ้น" "สิ่งที่จะถูกสร้าง" "บันทึก · สร้าง" · ตัวเลือกประเภทงาน · EN กลับเป็นอังกฤษ
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'fl-work', 900);
const snap = () => page.evaluate(() => {
  const b = BOATS.filter(x => x && !x.retired && x.ownership !== 'charter')[0];
  if (!FL_MAINT.some(m => m.id === 'zzmj')) FL_MAINT.push({ id: 'zzmj', no: 'MJ-999', title: 'Repair Test Pump', boatId: b.id, status: 'inprogress', startDate: TODAY_STR, progressLog: [] });
  FLW.boat = b.id; FLW.item = 'mj:zzmj'; FLW.stage = -1; FLW.bf = 'work'; flRenderWork();
  const w = document.getElementById('fl-work-wrap'); return { txt: w.textContent.replace(/\s+/g, ' '), lang: laLangGet() };
});
const has = (t, a) => a.filter(x => !t.includes(x));
const T1 = await snap();
const thNeed = ['เรือจอดซ่อม', 'ภาพรวม', 'แจ้งปัญหา', 'เปิดงานแล้ว', 'กำลังซ่อม', 'รอปิดงาน', 'รอบิล', 'เลขที่', 'ถึงขั้นไหนแล้ว', 'ขั้นต่อไป', 'ปิดงาน', 'เพิ่มโน้ต', 'รูปภาพ', 'ไม่มีผู้รับผิดชอบ'];
const enGone = ['Boats down', 'Where it stands', 'Next step', 'Add note', 'Photos', 'Show all stages', 'No owner'];
const m1 = has(T1.txt, thNeed), left1 = enGone.filter(x => T1.txt.includes(x));
if (T1.lang === 'th' && !m1.length && !left1.length && T1.txt.includes('Repair Test Pump')) ok('1 โหมดไทย: ' + thNeed.slice(0, 8).join(' · ') + ' … · ไม่มีอังกฤษชุดหลักหลง · ชื่องานไม่ถูกแปล');
else fail('1 ' + JSON.stringify({ lang: T1.lang, missing: m1, left: left1 }));

await page.evaluate(() => laLangToggle()); await page.waitForTimeout(500);
const T2 = await snap();
const enNeed = ['Boats down', 'Overview', 'Reported', 'Repairing', 'Billing', 'Where it stands', 'Next step', 'Close job', 'Add note', 'Photos', 'No owner'];
const m2 = has(T2.txt, enNeed), th2 = ['เรือจอดซ่อม', 'ภาพรวม', 'ถึงขั้นไหนแล้ว', 'ขั้นต่อไป', 'เพิ่มโน้ต', 'รูปภาพ'].filter(x => T2.txt.includes(x));
if (T2.lang === 'en' && !m2.length && !th2.length) ok('2 โหมด EN: ' + enNeed.join(' · ') + ' · ไม่มีคำไทยจากพจนานุกรม');
else fail('2 ' + JSON.stringify({ lang: T2.lang, missing: m2, th: th2 }));
/* ══ 4 · §flwTH2 · หน้าต่าง + เพิ่มงาน ══ */
const dlg = () => page.evaluate(() => { flnOpen(); const a = document.getElementById('fln').textContent.replace(/\s+/g, ' ');
  FLN.kind = 'job'; flnRender(); const b = document.getElementById('fln').textContent.replace(/\s+/g, ' '); flnClose();
  flwAdd(); const c = document.getElementById('flw-add').textContent.replace(/\s+/g, ' '); flwAddClose(); return { a, b, c, lang: laLangGet() }; });
const D2 = await dlg();
const enA = ['What happened, and what should start now?', 'What will be created', 'Save · create 2 records', 'Open a job'], enB = ['What work is planned?', 'Start the job now'], enC = ['What kind of work is it?', 'Report a problem'];
await page.evaluate(() => laLangToggle());
const D1 = await dlg();
const thA = ['เกิดอะไรขึ้น และต้องเริ่มอะไรตอนนี้?', 'สิ่งที่จะถูกสร้าง', 'บันทึก · สร้าง 2 รายการ', 'เปิดงาน', 'ปัญหาคืออะไร'], thB = ['วางแผนงานอะไร?', 'เริ่มงานเลย'], thC = ['เป็นงานประเภทไหน?', 'แจ้งปัญหา'];
const miss = [].concat(has(D1.a, thA), has(D1.b, thB), has(D1.c, thC), has(D2.a, enA), has(D2.b, enB), has(D2.c, enC));
if (D1.lang === 'th' && D2.lang === 'en' && !miss.length && !D1.a.includes('What will be created')) ok('4 หน้าต่าง + เพิ่มงาน: ไทย "' + thA[0] + '" · "' + thA[2] + '" · งานตามแผน / ตัวเลือกประเภท · EN ยังเป็นอังกฤษ');
else fail('4 ' + JSON.stringify({ miss, l1: D1.lang, l2: D2.lang }));
if (errors.length === 0) ok('3 ไม่มี error'); else fail('3 ' + JSON.stringify(errors.slice(0, 3)));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
