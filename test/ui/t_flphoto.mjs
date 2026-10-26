// §flPhoto · รูปในงาน · Fleet Work (การ์ด · กล้องในโน้ต · ตัวนับ · บล็อก Done) · Maintenance · Job Assignment · ซ่อน/กู้คืน
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'fl-work', 1200);
const z = ms => page.waitForTimeout(ms);
// no backend in the harness · stub the file picker + upload pipe · same callback shape as the real ones
await page.evaluate(() => {
  window._flProjPickFiles = (acc, multi, cb) => cb([{ name: 'a.jpg', type: 'image/jpeg', size: 1000 }, { name: 'b.jpg', type: 'image/jpeg', size: 1000 }]);
  window._flProjUploadAll = (files, key, each, done) => { files.forEach((f, i) => each({ id: 'att_' + key + '_' + i, name: f.name, mime: f.type, size: f.size }, f)); done(files.length); };
  window.LA_ME = { name: 'Tester' };
});

const r1 = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const it = flwItems().find(x => x.kind === 'mj'); FLW.boat = it.boatId; FLW.item = it.key; FLW.stage = -1; flRenderWork(); await zz(400);
  const card = document.querySelector('#flw-rp .flp'); const cam = document.querySelector('#flw-rp button[onclick*="notephoto"]');
  const row = document.querySelector('#flw-ml .flw-row.on');
  return { id: it.id, stage: FLW_ST[it.stage].t, card: !!card, n: card && card.querySelector('.flp-h .n').textContent, cam: !!cam, chip: !!(row && row.querySelector('.flp-cnt')) };
});
if (r1.card && r1.n === '0' && r1.cam && !r1.chip) ok(`1 Fleet Work · งาน ${r1.id} มีการ์ด PHOTOS (0) + ปุ่มกล้องในช่องโน้ต · ไม่มีตัวนับเมื่อไม่มีรูป`); else fail('1 ' + JSON.stringify(r1));

const r2 = await page.evaluate(async (id) => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  document.getElementById('flw-note').value = 'ถอดเกียร์แล้ว';
  flwAct('notephoto', id, ''); await zz(500);
  const m = FL_MAINT.find(x => x.id === id); const ph = m.photos || [];
  const log = (m.progressLog || []).slice(-1)[0] || {};
  const card = document.querySelector('#flw-rp .flp'); const row = document.querySelector('#flw-ml .flw-row.on');
  return { n: ph.length, stage: ph[0] && ph[0].stage, cap0: ph[0] && ph[0].cap, cap1: ph[1] && ph[1].cap, by: ph[0] && ph[0].by, url: ph[0] && ph[0].url, log: log.text,
    tiles: card && card.querySelectorAll('.flp-g:not(.hid) .flp-t').length, chip: row && (row.querySelector('.flp-cnt') || {}).textContent, note: document.getElementById('flw-note').value };
}, r1.id);
if (r2.n === 2 && r2.stage === r1.stage && r2.cap0 === 'ถอดเกียร์แล้ว' && !r2.cap1 && r2.by === 'Tester' && /^\/api\/attach\//.test(r2.url) && /ถอดเกียร์แล้ว · Photo added · 2 files/.test(r2.log) && r2.tiles === 2 && /2/.test(r2.chip || '') && r2.note === '')
  ok(`2 กล้อง+โน้ต · 2 รูป · stage "${r2.stage}" · caption รูปแรก = โน้ต · timeline "${r2.log}" · ตัวนับ 2 · ช่องโน้ตว่าง`); else fail('2 ' + JSON.stringify(r2));

const r3 = await page.evaluate(async (id) => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const m = FL_MAINT.find(x => x.id === id); const pid = m.photos[0].id;
  flpHide('mj', id, pid); await zz(200);
  const a = { vis: document.querySelectorAll('#flw-rp .flp .flp-g:not(.hid) .flp-t').length, removed: !!m.photos[0].removed, by: m.photos[0].removedBy, link: (document.querySelector('#flw-rp .flp .flp-f a') || {}).textContent };
  flpTogHidden('mj', id); await zz(200);
  const b = { hid: document.querySelectorAll('#flw-rp .flp .flp-g.hid .flp-t').length, restore: !!document.querySelector('#flw-rp .flp .flp-hb button') };
  flpRestore('mj', id, pid); await zz(200);
  const c = { vis: document.querySelectorAll('#flw-rp .flp .flp-g:not(.hid) .flp-t').length, removed: !!m.photos[0].removed, n: m.photos.length };
  return { a, b, c };
}, r1.id);
if (r3.a.vis === 1 && r3.a.removed && r3.a.by === 'Tester' && /(hidden · 1 photo|รูปที่ซ่อน · 1 รูป)/.test(r3.a.link)   /* §flwTH · โหมดไทยเป็นค่าตั้งต้น */ && r3.b.hid === 1 && r3.b.restore && r3.c.vis === 2 && !r3.c.removed && r3.c.n === 2)
  ok('3 ซ่อน → เหลือ 1 · ลิงก์ "hidden · 1 photo" · กดดูเห็นปุ่ม Restore · กู้คืน → กลับเป็น 2 · ไม่มีอะไรถูกลบ'); else fail('3 ' + JSON.stringify(r3));

const r4 = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const boat = FLW.boat; const open = {}; flwItems().forEach(x => open[x.key] = 1);
  const dn = FL_MAINT.find(m => m.boatId === boat && m.status === 'done' && !open['mj:' + m.id]); dn.endDate = TODAY_STR; dn.awaitingInvoice = false;
  flRenderWork(); await zz(400);
  const grp = [...document.querySelectorAll('#flw-ml .flw-grp')].find(g => /Done · last 30 days/.test(g.textContent));
  const row = [...document.querySelectorAll('#flw-ml .flw-row')].find(r => r.dataset.k === 'dn:' + dn.id);
  const foot = document.querySelector('#view-fl-work .flw-card [style*="border-top"] b.mono');
  const before = { grp: !!grp, row: !!row, chipZ: !!(row && row.querySelector('.flp-cnt.z')), pill: row && row.querySelector('.flw-pill').textContent, openN: foot && foot.textContent };
  flwPickItem('dn:' + dn.id); await zz(400);
  const rp = document.getElementById('flw-rp');
  flpAdd('mj', dn.id, ''); await zz(400);
  const ph = (FL_MAINT.find(m => m.id === dn.id).photos || []);
  return { before, id: dn.id, sel: FLW.item === 'dn:' + dn.id, donePill: !!(document.querySelector('#view-fl-work .flw-card .flw-pill') && /Done/.test(document.querySelector('.flw-3 .flw-card:last-child .flw-pill').textContent)),
    card: !!(rp && rp.querySelector('.flp')), doneTag: !!document.querySelector('#flw-rp .flp-done'), noClose: !document.querySelector('#flw-rp button[onclick*="close"]'),
    n: ph.length, stage: ph[0] && ph[0].stage, status: FL_MAINT.find(m => m.id === dn.id).status };
});
if (r4.before.grp && r4.before.row && r4.before.chipZ && r4.before.pill === 'Done' && r4.sel && r4.donePill && r4.card && r4.doneTag && r4.noClose && r4.n === 2 && r4.stage === 'Done' && r4.status === 'done')
  ok(`4 บล็อก Done · งาน ${r4.id} ขึ้นพร้อมป้าย "no photo" · เลือกได้ · แผงขวาไม่มีปุ่มปิดงาน · แนบ 2 รูป stage "Done" · งานยังปิดอยู่`); else fail('4 ' + JSON.stringify(r4));

await goView(page, 'fl-maintenance', 800);
const r5 = await page.evaluate(async (id) => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  flSelMaint(id); await zz(600);
  const card = document.querySelector('#view-fl-maintenance .flp');
  return { card: !!card, n: card && card.querySelector('.flp-h .n').textContent, done: !!(card && card.querySelector('.flp-done')), tiles: card && card.querySelectorAll('.flp-t').length };
}, r4.id);
if (r5.card && r5.n === '2' && r5.done && r5.tiles === 2) ok('5 Maintenance · งานที่ปิดแล้ว มีการ์ด PHOTOS (2) + ป้าย "photos can still be added"'); else fail('5 ' + JSON.stringify(r5));

await goView(page, 'fl-incident', 800);
const r6 = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const inc = FL_INCIDENTS.find(x => (x.status || 'open') === 'open' && !x.maintId); flSelIncident(inc.id); await zz(600);
  const c0 = !!document.querySelector('#view-fl-incident .flp');
  flpAdd('inc', inc.id, ''); await zz(400);
  const card = document.querySelector('#view-fl-incident .flp');
  const ph = inc.photos || [];
  return { c0, n: ph.length, stage: ph[0] && ph[0].stage, tiles: card && card.querySelectorAll('.flp-t').length, log: ((inc.progressLog || []).slice(-1)[0] || {}).text };
});
if (r6.c0 && r6.n === 2 && r6.stage === 'Reported' && r6.tiles === 2 && /Photo added · 2 files/.test(r6.log)) ok(`6 Job Assignment · รายงานปัญหา มีการ์ด · แนบ 2 รูป stage "Reported" · การ์ดวาดใหม่เฉพาะจุด`); else fail('6 ' + JSON.stringify(r6));

const r7 = await page.evaluate(async (id) => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const m = FL_MAINT.find(x => x.id === id); flpView('mj', id, m.photos[1].id); await zz(100);
  const lb = document.getElementById('flp-lb'); const t = lb && lb.innerText;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await zz(50);
  return { open: !!lb, cnt: /2 \/ 2/.test(t || ''), closed: !document.getElementById('flp-lb') };
}, r1.id);
if (r7.open && r7.cnt && r7.closed) ok('7 ดูเต็มจอ · เปิดที่รูป 2/2 · Esc ปิด'); else fail('7 ' + JSON.stringify(r7));

const errs = errors.filter(e => !/404/.test(e));   // รูปจำลองชี้ /api/attach ซึ่งไม่มีในฮาร์เนส
if (errs.length) fail('errors: ' + errs.join(' | ')); else ok('8 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
