// §swA · Staff & Welfare · ทะเบียนแบบ A · กลุ่มตามแผนก · แถบโควต้า · ghost input · กรอง · รหัสซ้ำ
//
// ที่มา (2026-10-14) · owner (screenshot ทะเบียน 2026): "ปรับดีไซน์หน้านี้หน่อย" → เลือก A
// กัน
//   1 แถวจัดกลุ่มตามแผนก · หัวกลุ่มสรุป โควต้า/ใช้/เหลือ ตรงกับผลรวมของแถวในกลุ่ม
//   2 KPI 4 ใบ · ตัวเลขตรงกับข้อมูล (active / quota / used / remaining)
//   3 รหัสซ้ำขึ้นป้าย "รหัสซ้ำ" ทั้งสองแถว · ใช้เกินโควต้าแถบแดงและเลขเหลือเป็นลบ
//   4 ชิปแผนกกรองได้ · ชิป "ยังไม่ใช้" กรองได้ · ค้นหาชื่อได้ · ล้างแล้วกลับครบ
//   5 แก้ชื่อผ่าน ghost input บันทึกลง SB_STAFF · แก้โควต้า · สวิตช์ active · ปุ่มลบโผล่เมื่อชี้
//   6 แท็บ ทริปพนักงาน / ของบริษัท ยังเปิดได้ · ปีเปลี่ยนได้ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'staff', 600);
const prep = await page.evaluate(() => {
  const yr = _staffYear;
  SB_STAFF.length = 0;
  const add = (id, code, name, dept, q, active) => SB_STAFF.push({ id, code, name, dept, active: active !== false, quota: { [String(yr)]: q } });
  add('st01', 'EMP-001', 'Arisa Phongsawat', 'Sales', 3); add('st02', 'EMP-002', 'Napat Thongdee', 'Sales', 3);
  add('st03', 'EMP-010', 'Kittipong Wongsa', 'Sales', 0); add('st04', 'EMP-010', 'Suchawadee Onruan', 'Intern', 3);
  add('st05', 'EMP-020', 'Captain Somsak', 'Marine', 3); add('st06', 'EMP-014', 'Piya Jongdee', 'Content', 3, false);
  /* ใบสวัสดิการ · st04 ใช้ 4 จาก 3 (เกิน) · st05 ใช้ 2 */
  const rt = (ROUTES || [])[0];
  const mk = (id, staffId, date, foc) => ({ id, schemaVer: 2, staffId, purpose: 'staff_welfare', status: 'confirmed', createdAt: date + 'T08:00:00', trips: [{ routeId: rt.id, date, pax: { ad_th: 0, foc } }] });
  SB_BOOKINGS.push(mk('zz_sw1', 'st04', yr + '-10-11', 4), mk('zz_sw2', 'st05', yr + '-10-09', 2));
  _staffDept = 'all'; _staffUse = 'all'; _staffQ = ''; _staffTab = 'roster';
  renderStaff();
  return { yr, rtName: rt.name };
});
await page.waitForTimeout(300);
const read = () => page.evaluate(() => {
  const T = s => s.textContent.replace(/\s+/g, ' ').trim();
  const grps = [...document.querySelectorAll('#staff-host tr.sw-grp')].map(tr => { const tds = tr.querySelectorAll('td'); return { name: T(tds[1]).replace(/\d+ คน$/, '').trim(), q: +T(tds[2]), u: +T(tds[3]), rem: +T(tds[4]) }; });
  const rows = [...document.querySelectorAll('#staff-host tr.sw-row')].map(tr => ({ code: tr.querySelector('.sw-ghost.mono').value, name: tr.querySelector('.sw-ghost.name').value, dept: tr.querySelector('.sw-ghost.dept').value, dup: !!tr.querySelector('.sw-warn'), over: !!tr.querySelector('.sw-bar .o'), rem: T(tr.querySelector('.sw-num.rem')), sub: T(tr.querySelector('.sw-sub')), off: tr.classList.contains('off'), on: tr.querySelector('.sw-sw').classList.contains('on'), del: getComputedStyle(tr.querySelector('.sw-del')).opacity }));
  const kpis = [...document.querySelectorAll('#staff-host .sw-kpi .val')].map(T);
  const chips = [...document.querySelectorAll('#staff-host .sw-chip')].map(c => ({ t: T(c), on: c.classList.contains('on') }));
  return { grps, rows, kpis, chips };
});
const a = await read();
const g = Object.fromEntries(a.grps.map(x => [x.name, x]));
if (a.grps.length === 4 && g.Sales && g.Sales.q === 6 && g.Sales.u === 0 && g.Intern && g.Intern.u === 4 && g.Intern.rem === -1 && g.Marine.u === 2 && a.rows.length === 6) ok(`1 กลุ่ม ${a.grps.map(x => x.name).join(' / ')} · หัวกลุ่มสรุปถูก`); else fail('1 ' + JSON.stringify(a.grps));
if (/^5\s*\/\s*6$/.test(a.kpis[0].replace(/[^\d/]/g, '')) && a.kpis[1] === '15' && /^6/.test(a.kpis[2]) && a.kpis[3] === '9') ok(`2 KPI ${a.kpis.join(' · ')}`); else fail('2 ' + JSON.stringify(a.kpis));
const dups = a.rows.filter(r => r.dup).map(r => r.code), overRow = a.rows.find(r => r.name === 'Suchawadee Onruan');
if (dups.length === 2 && dups.every(c => c === 'EMP-010') && overRow && overRow.over && overRow.rem === '−1' && /ใช้ล่าสุด 11 Oct/.test(overRow.sub)) ok(`3 รหัสซ้ำ 2 แถว · ใช้เกิน: แถบแดง เหลือ ${overRow.rem} · "${overRow.sub}"`); else fail('3 ' + JSON.stringify({ dups, overRow }));
await page.click('#staff-host .sw-chip:nth-of-type(2)'); await page.waitForTimeout(250); const b = await read();
await page.evaluate(() => staffSetDept('all')); await page.evaluate(() => staffSetUse('unused')); await page.waitForTimeout(250); const c = await read();
await page.evaluate(() => { staffSetUse('all'); staffSetQ('somsak'); }); await page.waitForTimeout(250); const d = await read();
await page.evaluate(() => staffSetQ('')); await page.waitForTimeout(250); const e = await read();
if (b.rows.length === 3 && b.rows.every(r => r.dept === 'Sales') && c.rows.length === 3 && c.rows.every(r => !r.off) && d.rows.length === 1 && d.rows[0].name === 'Captain Somsak' && e.rows.length === 6) ok(`4 กรองแผนก ${b.rows.length} · ยังไม่ใช้ ${c.rows.length} · ค้นหา ${d.rows.length} · ล้างแล้ว ${e.rows.length}`); else fail('4 ' + JSON.stringify({ b: b.rows.length, c: c.rows.map(r => r.name), d: d.rows.map(r => r.name), e: e.rows.length }));
const nameIn = page.locator('#staff-host tr.sw-row').first().locator('.sw-ghost.name');
await nameIn.fill('Arisa P. (แก้)'); await nameIn.blur(); await page.waitForTimeout(250);
await page.locator('#staff-host tr.sw-row').first().locator('.sw-qin').fill('5'); await page.locator('#staff-host tr.sw-row').first().locator('.sw-qin').press('Tab'); await page.waitForTimeout(250);
await page.locator('#staff-host tr.sw-row').first().locator('.sw-sw').click(); await page.waitForTimeout(250);
await page.locator('#staff-host tr.sw-row').first().hover(); await page.waitForTimeout(200);
const f = await page.evaluate(() => { const s = SB_STAFF.find(x => x.id === 'st01'); const tr = document.querySelector('#staff-host tr.sw-row'); return { name: s.name, q: s.quota[String(_staffYear)], active: s.active, del: getComputedStyle(tr.querySelector('.sw-del')).opacity, off: tr.classList.contains('off') }; });
if (f.name === 'Arisa P. (แก้)' && f.q === 5 && f.active === false && f.del === '1' && f.off) ok('5 แก้ชื่อ / โควต้า / สวิตช์ บันทึกลง SB_STAFF · ปุ่มลบโผล่เมื่อชี้'); else fail('5 ' + JSON.stringify(f));
const t = await page.evaluate(async () => { const out = {}; staffSetTab('trips'); out.trips = !!document.querySelector('#staff-host table') && /ทริปพนักงาน/.test(document.querySelector('#staff-host').textContent); staffSetTab('internal'); out.internal = /ของบริษัท|Internal/.test(document.querySelector('#staff-host').textContent); staffSetTab('roster'); staffSetYear(1); out.yr = document.querySelector('#staff-host .sw-year b').textContent; staffSetYear(-1); return out; });
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (t.trips && t.internal && t.yr === String(prep.yr + 1) && !e1.length) ok('6 แท็บอื่นเปิดได้ · ปีเปลี่ยนได้ · no page errors'); else fail('6 ' + JSON.stringify({ t, e1: e1.slice(0, 3) }));
if (process.env.SHOT) { await page.evaluate(() => { _staffQ = ''; renderStaff(); }); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT }); }
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
