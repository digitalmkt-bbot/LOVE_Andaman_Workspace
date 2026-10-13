// §btClip · ข้อความในตาราง By trip ห้ามถูกตัดแบบเงียบ
//
// ที่มา (2026-10-01) · ผู้ใช้ส่งภาพแถวหนึ่งมาแล้วบอกว่า "ดูเรื่องการตัดคำให้หน่อยนะ"
//   ในภาพมีสองอย่างที่ถูกตัดกลางคันโดยไม่มีอะไรบอกว่าถูกตัด
//     "Longtail Join (2..."   ป้าย add-on ที่ยาวกว่าคอลัมน์
//     "จ่าย ฿1,000 · ค้าง ฿3"  ยอดเงินที่เหลือจริงคือ ฿3,200
//
// อันหลังอันตรายกว่ามาก · เลขที่ถูกตัดไม่ได้ดูเหมือนเลขที่ถูกตัด มันดูเหมือนเลขอีกจำนวน
// คนอ่านใบงานไม่มีทางรู้เลยว่ากำลังอ่านตัวเลขผิด
//
// สาเหตุเดียวกันทุกจุด · nowrap + overflow:hidden แต่ไม่มี text-overflow:ellipsis
// เบราว์เซอร์จึงตัดตรง ๆ ไม่มีจุดไข่ปลา และหลายจุดก็ไม่มี title ให้เอาเมาส์ชี้ดูของเต็ม
//
// กติกาที่เทสนี้คุม · ทุกชิ้นในตารางนี้ต้องเข้าข้อใดข้อหนึ่ง
//   1. ไม่ถูกตัดเลย
//   2. ถูกตัด แต่มีจุดไข่ปลา และมี title (ของตัวเองหรือของกล่องที่ครอบอยู่) ให้ตามอ่านต่อได้
// ตัวเลขเงินเข้มกว่านั้นอีกชั้น · ห้ามถูกตัดเลยไม่ว่ากรณีไหน ให้ตกบรรทัดแทน
//
// เทสนี้กันสี่อย่าง
//   1 ไม่มีชิ้นไหนในตารางถูกตัดแบบเงียบ (ไม่มีจุดไข่ปลา หรือไม่มีทางเห็นข้อความเต็ม)
//  1b ชื่อลูกค้าที่ถูกตัด ต้องอ่านชื่อเต็มได้จาก title · ใบงานนี้ใช้เช็คอินหน้าท่า
//   2 บรรทัดยอดเงิน จ่าย/ค้าง ไม่ถูกตัดเลย แม้คอลัมน์แคบ · ตกบรรทัดแทน
//   3 ป้าย add-on ที่ยาวเกินคอลัมน์ มีจุดไข่ปลาและมี title
//   4 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

/* แคบกว่าจอจริงนิดหน่อย · ของแบบนี้โผล่ตอนคอลัมน์ถูกบีบ ไม่ใช่ตอนจอกว้าง */
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1366, height: 1000 });
await goView(page, 'booking', 900);

const GO = await page.evaluate(() => {
  const c = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; });
  });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  if (!day) return { err: 'ไม่มี booking ในชุดนี้' };
  _bkV2.filterDate = day; _bkV2.filterRoute = null;
  if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('bytrip');
  return { day, n: c[day] };
});
if (GO.err) { fail(GO.err); await close(); process.exit(1); }
await page.waitForTimeout(1600);

/* ══ 1 · ไม่มีชิ้นไหนถูกตัดแบบเงียบ ═══════════════════════════════════════════ */
const R1 = await page.evaluate(() => {
  const bad = [];
  let scanned = 0, clipped = 0;
  document.querySelectorAll('.t2-mtbl td, .t2-mtbl td *').forEach(e => {
    const txt = (e.textContent || '').trim();
    if (!txt) return;
    scanned++;
    if (e.scrollWidth <= e.clientWidth + 1) return;      /* ไม่ถูกตัด · ผ่าน */
    clipped++;
    const ell = getComputedStyle(e).textOverflow === 'ellipsis';
    /* title ของกล่องที่ครอบอยู่ก็นับ · ชิปหลายอันเก็บข้อความเต็มไว้ที่ตัวชิป ไม่ใช่ที่ span ข้างใน */
    let t = null, p = e;
    while (p && p.tagName !== 'TABLE') {
      if (p.getAttribute && p.getAttribute('title')) { t = p.getAttribute('title'); break; }
      p = p.parentElement;
    }
    if (ell && t) return;                                 /* ตัดแบบบอกและตามอ่านต่อได้ · ผ่าน */
    bad.push({ cls: String(e.className || e.tagName).slice(0, 30), txt: txt.slice(0, 34),
      ell, hasTitle: !!t, over: e.scrollWidth - e.clientWidth });
  });
  bad.sort((a, b) => b.over - a.over);
  return { scanned, clipped, bad: bad.slice(0, 6), nBad: bad.length };
});
if (!R1.scanned) fail('1 ไม่มีอะไรให้ตรวจในตาราง · เทสนี้พิสูจน์อะไรไม่ได้');
else if (!R1.nBad) ok(`1 ตรวจ ${R1.scanned} ชิ้น · ถูกตัด ${R1.clipped} ชิ้น ทุกชิ้นมีจุดไข่ปลาและตามอ่านต่อได้`);
else fail(`1 ตัดแบบเงียบ ${R1.nBad} จุด: ` + R1.bad.map(x => `${x.cls}="${x.txt}" (ล้น ${x.over}px · จุดไข่ปลา ${x.ell ? 'มี' : 'ไม่มี'} · title ${x.hasTitle ? 'มี' : 'ไม่มี'})`).join(' | '));

/* ══ 1b · ชื่อลูกค้าที่ถูกตัด ต้องอ่านชื่อเต็มได้ ══════════════════════════════
   ข้อ 1 ยอมรับ title อะไรก็ได้ ซึ่งพอสำหรับป้ายอธิบาย (COT · Pro Forma) แต่ไม่พอกับชื่อคน
   ของเดิมชื่อที่ถูกตัดมี title ว่า "Re-confirm: Confirmed" ซึ่งไม่ได้บอกชื่อเลย
   ใบงานลำนี้เอาไปใช้เช็คอินหน้าท่า ชื่อผิดหรือชื่อไม่ครบคือปัญหาคนละระดับกับป้ายอธิบาย */
const R1b = await page.evaluate(() => {
  const out = { n: 0, clipped: 0, bad: [] };
  document.querySelectorAll('.t2-mtbl .t2-lead').forEach(e => {
    const txt = (e.textContent || '').trim(); if (!txt) return;
    out.n++;
    if (e.scrollWidth <= e.clientWidth + 1) return;
    out.clipped++;
    const t = e.getAttribute('title') || (e.parentElement && e.parentElement.getAttribute('title')) || '';
    if (t.indexOf(txt) < 0) out.bad.push({ txt: txt.slice(0, 34), title: t.slice(0, 34) });
  });
  return out;
});
if (!R1b.n) fail('1b ไม่มีชื่อลูกค้าในตาราง · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R1b.clipped) fail(`1b ชื่อ ${R1b.n} ชื่อ ไม่มีชื่อไหนถูกตัดเลยในชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้`);
else if (!R1b.bad.length) ok(`1b ชื่อที่ถูกตัด ${R1b.clipped} จาก ${R1b.n} ชื่อ · อ่านชื่อเต็มได้จาก title ครบทุกชื่อ`);
else fail(`1b ชื่อถูกตัดแล้วอ่านเต็มไม่ได้ ${R1b.bad.length} ชื่อ: ` + R1b.bad.slice(0, 3).map(x => `"${x.txt}" → title "${x.title}"`).join(' | '));

/* ══ 2 · ตัวเลขเงินห้ามถูกตัดเลย ══════════════════════════════════════════════
   "ค้าง ฿3,200" ที่โดนตัดเหลือ "ค้าง ฿3" ไม่ได้ดูเหมือนของที่ถูกตัด มันดูเหมือนอีกจำนวน
   จึงเข้มกว่าข้ออื่น · ต้องไม่ถูกตัดเลย ให้ตกบรรทัดแทน                            */
const R2 = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll('.t2-mtbl td.t2-r').forEach(td => {
    td.querySelectorAll('div').forEach(d => {
      const t = (d.textContent || '').trim();
      if (!/จ่าย|ค้าง/.test(t)) return;
      rows.push({ txt: t.slice(0, 40), cut: d.scrollWidth > d.clientWidth + 1,
        nowrap: getComputedStyle(d).whiteSpace === 'nowrap',
        title: !!d.getAttribute('title') });
    });
  });
  return { n: rows.length, cut: rows.filter(r => r.cut), nowrap: rows.filter(r => r.nowrap).length,
    noTitle: rows.filter(r => !r.title).length, sample: rows.slice(0, 2) };
});
if (!R2.n) fail('2 ไม่มีบรรทัดยอดเงินในชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R2.cut.length && !R2.nowrap && !R2.noTitle)
  ok(`2 บรรทัดยอดเงิน ${R2.n} บรรทัด ไม่ถูกตัดสักบรรทัด · ตกบรรทัดแทน และมี title ครบ`);
else
  fail(`2 ยอดเงินถูกตัด ${R2.cut.length} / nowrap ${R2.nowrap} / ไม่มี title ${R2.noTitle} จาก ${R2.n} · ${JSON.stringify(R2.sample)}`);

/* ══ 3 · ป้าย add-on ที่ยาวเกินคอลัมน์ ════════════════════════════════════════ */
const R3 = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.t2-addoncell-badges .t2-rb')];
  const long = chips.filter(c => c.scrollWidth > c.clientWidth + 1);
  return { n: chips.length, long: long.length,
    bad: long.filter(c => getComputedStyle(c).textOverflow !== 'ellipsis' || !c.getAttribute('title'))
             .map(c => (c.textContent || '').trim().slice(0, 30)) };
});
if (!R3.n) fail('3 ไม่มีป้าย add-on ในชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R3.long) ok(`3 ป้าย add-on ${R3.n} อัน ไม่มีอันไหนยาวเกินคอลัมน์`);
else if (!R3.bad.length) ok(`3 ป้าย add-on ที่ยาวเกิน ${R3.long} อัน มีจุดไข่ปลาและ title ครบ`);
else fail(`3 ป้าย add-on ตัดแบบเงียบ: ${R3.bad.join(' | ')}`);

/* ══ 4 ═══════════════════════════════════════════════════════════════════════ */
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (!realErr.length) ok('4 ไม่มี error บนหน้า');
else fail('4 มี error: ' + realErr.slice(0, 3).join(' | '));

await close();
console.log(bad ? `\n§btClip · ไม่ผ่าน ${bad} ข้อ` : '\n§btClip · ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
