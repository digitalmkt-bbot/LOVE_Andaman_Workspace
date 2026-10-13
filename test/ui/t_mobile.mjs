// t_mobile · บนจอมือถือ ทุกหน้าต้องยังเหลือที่ให้อ่านข้อมูล และต้องไม่ล้นแนวนอน
//
//   node test/ui/t_mobile.mjs
//   LAD=allotment_v2/data_exports/backup_x.json node test/ui/t_mobile.mjs
//
// ที่มา: §mobUnstick (2026-09-14) · คอลัมน์ข้าง/แถบหัวของจอกว้างเป็น position:sticky
// ที่ไม่มี breakpoint ปลดบนจอแคบ · พอ layout ยุบเป็นคอลัมน์เดียว มันไปกองบนสุดแล้วยังตรึงอยู่
// สูง 250-750px บนจอ 812px = ตรึงเกือบเต็มจอ ข้อมูลข้างล่างเลื่อนลอดอยู่ข้างหลัง
// พังแบบนี้ไม่มี error ให้จับ หน้าเปิดได้ปกติ t_smoke จึงมองไม่เห็น ต้องวัดพื้นที่เอา
import { open, views, goView } from './_harness.mjs';

const MIN_FREE = 60;      // ต้องเหลือที่ให้อ่านอย่างน้อยกี่ % ของความสูงจอ
const MAX_OVF  = 4;       // ล้นแนวนอนได้ไม่เกินกี่ px
// 812 = iPhone ตอนแถบ URL ยุบ · 664 = ตอนแถบกางอยู่ (เตี้ยกว่า เห็นปัญหาชัดกว่า)
const SIZES = [{ w: 390, h: 812 }, { w: 390, h: 664 }];

let failed = 0;
for (const { w, h } of SIZES){
  const { page, close } = await open({ width: w, height: h });
  const V = await views(page);
  console.log(`\n=== ${w}x${h} · ${V.length} หน้า ===`);
  for (const v of V){
    await goView(page, v);
    const r = await page.evaluate(() => {
      const m = document.querySelector('.main');
      const sc = (m && m.scrollHeight > m.clientHeight + 20) ? m : document.scrollingElement;
      if (sc === document.scrollingElement) window.scrollTo(0, 999999); else sc.scrollTop = sc.scrollHeight;
      const vh = innerHeight, vw = innerWidth, iv = [];
      for (const n of document.querySelectorAll('body *')){
        const cs = getComputedStyle(n);
        if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
        // sticky ที่ไม่ระบุ top/bottom = ตรึงแนวนอน (freeze คอลัมน์) ไม่ได้บังอะไร
        if (cs.position === 'sticky' && cs.top === 'auto' && cs.bottom === 'auto') continue;
        const b = n.getBoundingClientRect();
        if (b.height < 2 || b.width < vw * 0.35) continue;
        if (b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw) continue;  // ลิ้นชักที่ซ่อนออกข้าง
        iv.push([Math.max(b.top, 0), Math.min(b.bottom, vh),
                 n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
                 (typeof n.className === 'string' && n.className.trim()
                   ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '')]);
      }
      iv.sort((a, b2) => a[0] - b2[0]);
      const mg = [];
      for (const x of iv){ const l = mg[mg.length - 1];
        if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else mg.push([x[0], x[1]]); }
      const pinned = mg.reduce((s, x) => s + (x[1] - x[0]), 0);
      const worst = iv.sort((a, b2) => (b2[1] - b2[0]) - (a[1] - a[0]))[0];
      return { free: Math.round((vh - pinned) / vh * 100),
               ovf: Math.max(0, Math.round(document.documentElement.scrollWidth - vw)),
               worst: worst ? worst[2] : '' };
    });
    if (r.free < MIN_FREE || r.ovf > MAX_OVF){
      failed++;
      console.log(`  ✖ ${v}  เหลือที่อ่าน ${r.free}%  ล้นแนวนอน ${r.ovf}px  ${r.worst}`);
    }
  }
  await close();
}
console.log('\nพัง ' + failed);
process.exit(failed ? 1 : 0);
