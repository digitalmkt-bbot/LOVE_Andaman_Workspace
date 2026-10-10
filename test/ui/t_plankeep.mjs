// §planKeep · วางเรือล่วงหน้าไว้ (ทั้งที่ใบงานยังเปิด) แล้วปิด/เริ่ม MJ · แผนของคนต้องไม่หาย
//
// ที่มา (10 ต.ค. 2026) · เจ้าของ: "เรือที่เราระบุว่าพร้อม เราทำเพื่อวางแผนล่วงหน้า คาดการณ์ว่างานจะเสร็จทัน
//   จึงเปิดให้เรือพร้อมไปก่อน" · แล้ว Okeanos กลับไป Unavailable เองตอนปิด MJ-118 เพราะ PRJ-015 ยังเปิด
//   สาเหตุ · flMaintClose เรียก autoClosePrevLog(b,วันนี้) ซึ่งลบทุกแถวที่เริ่มตั้งแต่วันนี้ → แถววางล่วงหน้าหาย
//
// 1 วางล่วงหน้า "พร้อม" ตั้งแต่พรุ่งนี้ (ยกเว้น PRJ) → ปิด MJ วันนี้ → แถวแผนยังอยู่ · แถวปิดงานจบวันนี้ · พรุ่งนี้เรือพร้อม
// 2 วางล่วงหน้า "พร้อม" ตั้งแต่วันนี้ → ปิด MJ → ไม่เขียนแถวใหม่ทับ · วันนี้เรือพร้อม
// 3 เริ่ม MJ ใหม่วันนี้ ขณะมีแผน "พร้อม" พรุ่งนี้ → แผนยังอยู่ · แถวซ่อมจบวันนี้ (MJ ใหม่ยังกันพรุ่งนี้ได้เพราะไม่อยู่ในรายการยกเว้น)
// 4 โค้ดเดิม (ก่อนแพตช์) ข้อ 1 ต้องล้ม · ยืนยันว่าเทสจับบั๊กได้จริง
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 900 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(600);

const r = await page.evaluate(() => {
  const T = TODAY_STR, TM = _flDayAfter(T), D2 = _flDayAfter(TM);
  const b = BOATS.find(x => !x.retired && String(x.ownership || '') !== 'charter');
  const snap = JSON.stringify({ log: b.log, mj: FL_MAINT, prj: FL_PROJECTS });
  const reset = () => { b.log = []; FL_MAINT.length = 0; FL_PROJECTS.length = 0; };
  const mkPrj = () => { FL_PROJECTS.push({ id: 'zz_prj', no: 'PRJ-900', boatId: b.id, status: 'inprogress', type: 'drydock', planFrom: '2026-01-01', title: 'zz_test' }); };
  const mkMj = (no) => { const m = { id: 'zz_' + no, no, boatId: b.id, status: 'inprogress', startDate: '2026-01-02', setFixing: true, boatStatus: 'fixing', title: 'zz_test', assets: [] }; FL_MAINT.push(m); return m; };
  const plan = (from) => b.log.push({ id: 'zz_plan', s: 'available', from, to: null, loc: 'x', note: 'วางล่วงหน้าทั้งที่ยังมีงานค้าง · PRJ-900 · MJ-901' });
  const st = (ds) => boatEffStatus(b, ds).s;
  const out = {};

  // 1
  reset(); mkPrj(); const m1 = mkMj('MJ-901');
  b.log.push({ id: 'zz_fix', s: 'fixing', from: '2026-01-02', to: null, loc: 'x', note: 'Maintenance Job MJ-901' });
  plan(TM);
  const before1 = st(TM);
  flMaintClose(m1.id, 'success', '');
  const planRow = b.log.find(e => e.id === 'zz_plan');
  const closeRow = b.log.find(e => /ปิด Job MJ-901/.test(e.note || ''));
  out.t1 = { before: before1, planAlive: !!planRow, closeTo: closeRow && closeRow.to, closeS: closeRow && closeRow.s, today: st(T), tomorrow: st(TM), rows: b.log.length };

  // 2
  reset(); mkPrj(); const m2 = mkMj('MJ-901');
  b.log.push({ id: 'zz_fix', s: 'fixing', from: '2026-01-02', to: (function(d){const p=d.split('-').map(Number);const x=new Date(p[0],p[1]-1,p[2]);x.setDate(x.getDate()-1);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');})(T), loc: 'x', note: 'Maintenance Job MJ-901' });
  plan(T);
  const n0 = b.log.length;
  flMaintClose(m2.id, 'success', '');
  out.t2 = { planAlive: !!b.log.find(e => e.id === 'zz_plan'), added: b.log.length - n0, today: st(T), stored: getStoredStatus(b, T).id };

  // 3
  reset(); mkPrj(); plan(TM);
  const m3 = { id: 'zz_MJ-902', no: 'MJ-902', boatId: b.id, status: 'planned', startDate: T, setFixing: true, boatStatus: 'fixing', title: 'zz_test', assets: [] }; FL_MAINT.push(m3);
  _flMaintStartProceed(m3.id);
  const fixRow = b.log.find(e => /Maintenance Job MJ-902/.test(e.note || ''));
  out.t3 = { planAlive: !!b.log.find(e => e.id === 'zz_plan'), fixTo: fixRow && fixRow.to, today: st(T), tomorrowBlockedBy: (boatEffStatus(b, TM).jobBlockNos || ''), tomorrowStored: getStoredStatus(b, TM).s };

  const s0 = JSON.parse(snap); b.log = s0.log; FL_MAINT.length = 0; s0.mj.forEach(x => FL_MAINT.push(x)); FL_PROJECTS.length = 0; s0.prj.forEach(x => FL_PROJECTS.push(x));
  return { T, TM, boat: b.name, ...out };
});

const t1 = r.t1;
if (t1.before === 'available' && t1.planAlive && t1.closeTo === r.T && t1.closeS === 'unavailable' && t1.today === 'unavailable' && t1.tomorrow === 'available')
  ok(`1 ${r.boat} · แผน "พร้อม" ${r.TM} ยังอยู่หลังปิด MJ · แถวปิดงาน (${t1.closeS}) จบ ${t1.closeTo} · วันนี้ ${t1.today} · พรุ่งนี้ ${t1.tomorrow}`);
else fail('1 ' + JSON.stringify(t1));
const t2 = r.t2;
if (t2.planAlive && t2.added === 0 && t2.today === 'available' && t2.stored === 'zz_plan')
  ok('2 แผน "พร้อม" ตั้งแต่วันนี้ · ปิด MJ แล้วไม่เขียนทับ · วันนี้ available จากแถวแผนเดิม');
else fail('2 ' + JSON.stringify(t2));
const t3 = r.t3;
if (t3.planAlive && t3.fixTo === r.T && t3.today === 'fixing' && t3.tomorrowStored === 'available' && /MJ-902/.test(t3.tomorrowBlockedBy))
  ok(`3 เริ่ม MJ ใหม่ · แผนยังอยู่ · แถวซ่อมจบ ${t3.fixTo} · พรุ่งนี้ตารางบอก available แต่ MJ ใหม่ยังกัน (${t3.tomorrowBlockedBy})`);
else fail('3 ' + JSON.stringify(t3));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (!e1.length) ok('ไม่มี error ใน console'); else fail('console: ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
