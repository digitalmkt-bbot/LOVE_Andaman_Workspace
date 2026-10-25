// §flwDbl · Fleet Work · ดับเบิลคลิกงาน → เปิดหน้างานเต็ม · คลิกเดียวยังเลือกงานเหมือนเดิม
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await page.evaluate(async () => { nav(document.querySelector('.nav-item[data-view="fl-work"]')); await new Promise(f => setTimeout(f, 600)); });
const view = () => page.evaluate(() => (document.querySelector('.view.active') || {}).id);
const rows = await page.$$('#view-fl-work .flw-row');
const keys = await page.$$eval('#view-fl-work .flw-row', ns => ns.map(n => n.dataset.k));
const mjIx = keys.findIndex(k => /^mj:/.test(k));
// 1 · คลิกเดียว
await rows[mjIx].click(); await page.waitForTimeout(700);
const sel = await page.evaluate(() => FLW.item), v1 = await view();
if (sel === keys[mjIx] && v1 === 'view-fl-work') ok('คลิกเดียว · เลือกงาน ' + sel + ' · ยังอยู่หน้า Fleet Work'); else fail('single ' + sel + ' ' + v1);
// 2 · ดับเบิลคลิก (แถวถูกวาดใหม่หลังคลิกแรก)
await page.locator('#view-fl-work .flw-row[data-k="' + keys[mjIx] + '"]').dblclick(); await page.waitForTimeout(800);
const v2 = await view(), mid = keys[mjIx].slice(3);
const shown = await page.evaluate(id => { const m = (FL_MAINT || []).find(x => x.id === id); return m ? (document.querySelector('.view.active') || {}).innerText.includes(m.no) : false; }, mid);
if (v2 === 'view-fl-maintenance' && shown) ok('ดับเบิลคลิก · เปิดหน้า Maintenance ที่งาน ' + mid); else fail('dbl ' + v2 + ' ' + shown);
// 3 · INC
await page.evaluate(async () => { nav(document.querySelector('.nav-item[data-view="fl-work"]')); await new Promise(f => setTimeout(f, 500)); });
const k2 = await page.$$eval('#view-fl-work .flw-row', ns => ns.map(n => n.dataset.k).find(k => /^inc:/.test(k)) || '');
if (k2) { await page.locator('#view-fl-work .flw-row[data-k="' + k2 + '"]').dblclick(); await page.waitForTimeout(800);
  const v3 = await view(); if (v3 === 'view-fl-incident') ok('ดับเบิลคลิก INC · เปิดหน้า Incident'); else fail('inc ' + v3); }
else console.log('    (ไม่มีแถว INC บนลำแรก)');
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
