// t_smoke · เปิดทุกหน้าในแอป แล้วดูว่ามีหน้าไหนพังไหม
//
//   node test/ui/t_smoke.mjs                       ← ข้อมูล seed
//   LAD=allotment_v2/data_exports/backup_x.json node test/ui/t_smoke.mjs   ← ข้อมูลจริง
//
// ต้องได้ "พัง 0" ก่อน deploy ทุกครั้ง (HANDOFF.md §4d)
// ตัวนี้จับ error ตอน "เปิดหน้า" เท่านั้น ไม่ได้จับว่าตัวเลขถูกไหม — นั่นเป็นงานของ t_vals
import { open, views, goView } from './_harness.mjs';

const { page, errors, close } = await open();
const V = await views(page);
console.log('หน้าทั้งหมด', V.length, 'หน้า' + (process.env.LAD ? ' · ข้อมูลจริง' : ' · ข้อมูล seed'));

const broken = [];
for (const v of V){
  errors.length = 0;
  try {
    await goView(page, v);
    // หน้าที่วาดแล้วต้องมีอะไรอยู่จริง ไม่ใช่ div ว่าง
    const empty = await page.evaluate(() => {
      const a = document.querySelector('.view.active');
      return !a || a.innerText.trim().length < 2;
    });
    if (empty) errors.push('หน้าว่าง · ไม่มีอะไรวาดออกมา');
  } catch (e){
    errors.push('throw: ' + String(e).slice(0, 160));
  }
  if (errors.length){
    broken.push({ v, why: [...new Set(errors)].slice(0, 3) });
    console.log('  ✖ ' + v);
    for (const w of [...new Set(errors)].slice(0, 3)) console.log('      ' + w);
  }
}

console.log('\nพัง ' + broken.length);
await close();
process.exit(broken.length ? 1 : 0);
