// §flpMulti · อัปหลายรูป แล้วมีการดึงข้อมูลใหม่จากเซิร์ฟเวอร์คั่นกลาง (FL_MAINT ถูกแทนด้วยอ็อบเจ็กต์ชุดใหม่) · รูปต้องไม่หาย
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'fl-work', 1200);
const r = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  window.LA_ME = { name: 'Tester' };
  const it = flwItems().find(x => x.kind === 'mj'); FLW.boat = it.boatId; FLW.item = it.key; flRenderWork(); await zz(300);
  const id = it.id;
  // picker gives 3 files · upload is slow and, between file 1 and 2, a "remote update" swaps every fleet array (what _laReloadData does)
  window._flProjPickFiles = (acc, multi, cb) => cb([{ name: 'a.jpg', type: 'image/jpeg' }, { name: 'b.jpg', type: 'image/jpeg' }, { name: 'c.jpg', type: 'image/jpeg' }]);
  let busyDuring = null;
  window._flProjUploadAll = async (files, key, each, done) => {
    for (let i = 0; i < files.length; i++) {
      await zz(60);
      each({ id: 'att_' + i, name: files[i].name, mime: 'image/jpeg', size: 1 }, files[i]);
      if (i === 0) { busyDuring = !!window._flpUploading; FL_MAINT = JSON.parse(JSON.stringify(FL_MAINT)); FL_INCIDENTS = JSON.parse(JSON.stringify(FL_INCIDENTS)); }   // swap identities · photo 1 stays only if the save already ran
    }
    done(files.length);
  };
  flpAdd('mj', id, 'โน้ต'); await zz(800);
  const m = FL_MAINT.find(x => x.id === id);
  return { busyDuring, busyAfter: window._flpUploading, n: (m.photos || []).length, ids: (m.photos || []).map(p => p.attId), cap0: m.photos && m.photos[0].cap,
    tiles: document.querySelectorAll('#flw-rp .flp-t').length, log: (m.progressLog.slice(-1)[0] || {}).text };
});
if (r.busyDuring === true && r.busyAfter === 0) ok('1 ระหว่างอัป _flpUploading=1 (ตัวซิงก์เลื่อนการดึงข้อมูล) · จบแล้วกลับเป็น 0'); else fail('1 ' + JSON.stringify(r));
if (r.n === 3 && r.ids.join() === 'att_0,att_1,att_2' && r.cap0 === 'โน้ต') ok('2 ข้อมูลถูกแทนกลางคัน · รูปครบ 3 ใบ เรียงถูก · caption รูปแรกเป็นโน้ต'); else fail('2 ' + JSON.stringify(r));
if (r.tiles === 3 && /Photo added · 3 files/.test(r.log)) ok('3 การ์ดแสดง 3 รูป · timeline "Photo added · 3 files"'); else fail('3 ' + JSON.stringify(r));
const errs = errors.filter(e => !/404/.test(e));
if (errs.length) fail('errors: ' + errs.join(' | ')); else ok('4 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
