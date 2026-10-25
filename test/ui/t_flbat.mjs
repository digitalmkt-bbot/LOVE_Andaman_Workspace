// §flBat · Company Asset → Batteries · เพิ่ม/แก้/เปลี่ยน · อายุ ok/due/over · ส่วนในหน้าเรือ · ชิป Overview · persist
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
page.on('dialog', d => d.accept(d.type() === 'prompt' ? (/Voltage/.test(d.message()) ? '12.1' : 'คลัง Tub Lamu') : undefined));
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="fl-asset"]')); await z(500);
  const tabBtn = [...document.querySelectorAll('#fa-shell .fa-tabs button')].find(b => /Batteries/.test(b.textContent));
  faGo('batteries'); await z(400);
  const W = document.getElementById('fl-bats-pink-wrap');
  const empty = W.textContent;
  const boat = faCompanyBoats()[0];
  const add = (o) => { fbOpenForm(null, {}); const g = (k, v) => { const el = document.getElementById(k); el.value = v; }; g('fb-brand', o.brand); g('fb-model', o.model); g('fb-cap', '150Ah'); g('fb-cost', '4900');
    g('fb-status', o.status || 'installed'); fbFormSync(); g('fb-boat', boat.id); g('fb-pos', o.pos); g('fb-inst', o.inst || ''); g('fb-life', '18'); g('fb-war', '12'); if (o.serial) g('fb-serial', o.serial); fbSave(); };
  const addM = (n) => { const d = new Date(TODAY_STR + 'T12:00:00'); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
  add({ brand: '3K', model: 'N150', pos: 'Port', inst: addM(20) });   // over
  add({ brand: '3K', model: 'N150', pos: 'Std', inst: addM(16) });    // due (เหลือ ~2 เดือน)
  add({ brand: 'Amaron', model: 'DC100', pos: 'House', inst: addM(3) }); // ok
  add({ brand: '3K', model: 'N150', pos: 'Port', status: 'spare', serial: 'SP-TEST-01' });
  await z(200);
  const R = fbRows();
  const states = R.map(x => x.a.state).sort();
  const serials = R.map(x => x.o.serial);
  const over = R.find(x => x.a.state === 'over'), due = R.find(x => x.a.state === 'due');
  const dueTxt = due.a.txt, overTxt = over.a.txt;
  const shell = document.getElementById('fa-shell').textContent.replace(/\s+/g, ' ');
  const list = W.textContent.replace(/\s+/g, ' ');
  // ผ่านฟิลเตอร์ Over age
  faStage('batteries', 4); await z(200); const nOver = document.querySelectorAll('#fl-bat-listpanel .fa-prow').length; faStage('batteries', 4); await z(200);
  // เปลี่ยนลูกใหม่แทน over
  fbOpenForm(null, { replaceId: over.o.id }); const g = (k, v) => { document.getElementById(k).value = v; };
  g('fb-brand', '3K'); g('fb-model', 'N150'); g('fb-cap', '150Ah'); g('fb-inst', TODAY_STR); fbFormSync(); fbSave(); await z(200);
  const old = fbGet(over.o.id), neu = fbGet(FB.sel);
  // วัดโวลต์ + ถอดเก็บ
  fbVolt(neu.id); await z(100); const volt = (neu.log || []).some(l => l.type === 'volt' && l.volt === 12.1);
  // หน้าเรือ
  faGo('boats'); await z(300); faBoatPick(boat.id); await z(400);
  const bsec = (document.querySelector('#fl-boats-pink-wrap .fa-card:nth-child(2)') || document.getElementById('fl-boats-pink-wrap')).textContent.replace(/\s+/g, ' ');
  // overview chips
  faGo('overview'); await z(300); const ovShell = document.getElementById('fa-shell').textContent.replace(/\s+/g, ' ');
  // persist
  const saved = JSON.parse(localStorage.getItem('loveandaman_v2')).fleet_batteries;
  return { tabBtn: !!tabBtn, empty: /ยังไม่มีแบต|Add battery/.test(empty), states, serials, dueTxt, overTxt, shell, list: list.slice(0, 600), nOver, old: { status: old.status, reason: old.retiredReason, boatId: old.boatId }, neu: { status: neu.status, pos: neu.pos, replacedId: neu.replacedId, serial: neu.serial, logN: (neu.log || []).length }, volt, bsec: bsec.slice(0, 900), ovShell, savedN: (saved || []).length };
});
// §flBatLoad · reload → ค่าที่โหลดจาก storage ต้องไม่ถูก `var FL_BATTERIES=[]` ล้างทิ้ง (flLoad วิ่งก่อนบรรทัดประกาศ)
await page.reload({ waitUntil: 'load' }); await new Promise(f => setTimeout(f, 1500));
const rl = await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="fl-asset"]')); await z(400); faGo('batteries'); await z(400);
  const W = document.getElementById('fl-bats-pink-wrap');
  return { n: (FL_BATTERIES || []).length, rows: document.querySelectorAll('#fl-bat-listpanel .fa-prow').length, txt: W ? W.textContent.replace(/\s+/g, ' ').slice(0, 200) : '' }; });
if (rl.n === 5 && rl.rows >= 4) ok('reload แล้วแบตยังอยู่ · FL_BATTERIES 5 · แสดง ' + rl.rows + ' แถว'); else fail('reload ' + JSON.stringify(rl));
await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms)); faGo('batteries'); await z(300); });
await page.screenshot({ path: '/mnt/user-data/outputs/flbat.png' });
const J = JSON.stringify(r).slice(0, 1800);
if (r.tabBtn && r.empty) ok('แท็บ Batteries อยู่ใน Company Asset · เริ่มว่าง'); else fail('tab ' + J);
if (JSON.stringify(r.states) === JSON.stringify(['due', 'ok', 'over', 'spare'])) ok('อายุ 4 แบบ · over / due / ok / spare'); else fail('states ' + J);
if (r.serials.every(Boolean) && r.serials.includes('SP-TEST-01') && r.serials.some(s => /-BT-P-01$/.test(s))) ok('serial อัตโนมัติ <เรือ>-BT-<ตำแหน่ง>-NN · ' + r.serials.join(', ')); else fail('serial ' + J);
if (/^เกิน 2 เดือน/.test(r.overTxt) && /(19\.\d|20) \/ 18 เดือน/.test(r.overTxt) && /^เหลือ 2 เดือน/.test(r.dueTxt)) ok('ข้อความอายุ · "' + r.overTxt + '" · "' + r.dueTxt + '"'); else fail('agetxt ' + J);
if (/1 ?เกินอายุ/.test(r.shell) && /1 ?ใกล้หมดอายุ/.test(r.shell) && /Over age/.test(r.shell)) ok('หัวแท็บ · ชิป 1 เกินอายุ · 1 ใกล้หมดอายุ · กล่องสถานะ'); else fail('shell ' + r.shell.slice(0, 300));
if (r.nOver === 1) ok('กรอง Over age → 1 ลูก'); else fail('filter ' + r.nOver);
if (r.old.status === 'retired' && r.old.reason && !r.old.boatId && r.neu.status === 'installed' && r.neu.pos === 'Port' && r.neu.replacedId && r.neu.logN >= 2) ok('เปลี่ยนลูกใหม่ · ลูกเก่า retired (' + r.old.reason + ') · ลูกใหม่ Port · ประวัติทั้งสองลูก'); else fail('replace ' + J);
if (r.volt) ok('วัดโวลต์ลงประวัติ 12.1V'); else fail('volt ' + J);
if (/แบตเตอรี่ · 3 ลูก/.test(r.bsec) && /ใกล้หมด/.test(r.bsec)) ok('หน้าเรือ · ส่วนแบตเตอรี่ 3 ลูก + ป้ายใกล้หมด'); else fail('boat ' + r.bsec.slice(0, 400));
if (/แบตใกล้หมดอายุ/.test(r.ovShell) && !/แบตเกินอายุ/.test(r.ovShell)) ok('Overview · ชิป "แบตใกล้หมดอายุ" (ตัวเกินอายุถูกเปลี่ยนไปแล้ว)'); else fail('ov ' + r.ovShell.slice(0, 300));
if (r.savedN === 5) ok('บันทึกลง fleet_batteries · 5 ลูก (รวมลูกที่ถอดแล้ว)'); else fail('persist ' + r.savedN);
const errs = errors.filter(e => !/404|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(e));
if (errs.length) { fail('page errors'); console.log('    errors:', errs.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
