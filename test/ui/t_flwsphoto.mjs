// §flwsPhoto · Fleet Work · Summary · รูปต้องออกตอนพิมพ์ (Background graphics ปิด) และพิมพ์หลังรูปโหลดครบ
import { open } from './_harness.mjs';
import fs from 'node:fs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 1000 });
const png = (c) => { /* สร้างรูปสีทึบ 400x300 เป็น data URL */ return c; };
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  const mk = col => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 400, 300); g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText('PHOTO', 120, 160); return c.toDataURL('image/png'); };
  const m = (FL_MAINT || []).find(x => x && x.id); if (!m) return { none: true };
  m.photos = [{ id: 'ph1', url: mk('#C0392B'), stage: 'Waiting', cap: 'a', addedAt: '2026-10-19', by: 'T' }, { id: 'ph2', url: mk('#1E8449'), stage: 'Waiting', cap: 'b', addedAt: '2026-10-19', by: 'T' }, { id: 'ph3', url: mk('#2471A3'), stage: 'To close', cap: 'c', addedAt: '2026-10-19', by: 'T' }];
  flwsOpen('mj', m.id); await z(300);
  const S = document.getElementById('flws-sheet');
  const imgs = [...S.querySelectorAll('.ph figure .im img')];
  const bgless = [...S.querySelectorAll('.ph figure .im')].every(d => !d.style.backgroundImage);
  const cols = getComputedStyle(S.querySelector('.ph')).gridTemplateColumns.split(' ').length;
  const w = imgs[0] ? Math.round(imgs[0].getBoundingClientRect().width) : 0;
  let printed = 0; const _p = window.print; window.print = () => { printed++; }; flwsPrint(); await z(300); window.print = _p;
  const cls = document.body.classList.contains('flws-print');
  return { n: imgs.length, bgless, cols, w, printed, cls, no: m.no };
});
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: '/mnt/user-data/outputs/flws_print.pdf', printBackground: false, format: 'A4' });
const R = JSON.stringify(r);
if (r.n === 3 && r.bgless) ok('รูปเป็น <img> จริง 3 รูป · ไม่พึ่ง background-image'); else fail('img ' + R);
if (r.cols === 2 && r.w > 300) ok(`2 รูปต่อแถว · กว้าง ${r.w}px (เดิม 3 ต่อแถว)`); else fail('size ' + R);
if (r.printed === 1 && r.cls) ok('Print / PDF รอรูปโหลดแล้วสั่งพิมพ์'); else fail('print ' + R);
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
