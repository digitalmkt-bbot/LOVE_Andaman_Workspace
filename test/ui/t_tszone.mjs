// §tsManZone · Daily Manifest (Travel Summary หมวด 04) · คอลัมน์ Zone ถัดจาก Pickup
// ที่มา (2026-10-15) · owner: "เพิ่ม Zone ให้หน่อย" (ภาพหน้า Manifest ประจำวัน)
// กัน
//   1 หัวตารางมี Zone เป็นคอลัมน์ที่ 10 (ถัดจาก Pickup point · Room) · ตารางมี 18 คอลัมน์ + # · ตัวเลือกคอลัมน์มี Zone
//   2 แถวที่มีจุดรับ ช่อง Zone = ชื่อพื้นที่รับ (เหมือนช่อง โซน หน้าเช็คอิน) และ/หรือ PK/KL · แถว No pickup = —
//   3 ซ่อนคอลัมน์หลัง Zone (เช่น Status = 18) ยังซ่อนถูกช่อง · แถวรวม colspan ยังตรง (ไม่มีช่องเกิน)
//   5 (§tsManZone2) ในเอเจนต์เดียวกันเรียง PK → KL → Own · ช่อง Zone มีป้าย PK/KL/Own
//   4 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'travelsum', 800);
const DATE = await page.evaluate(() => { const by = {}; (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => { if (b.hotelName || b.pickup) by[t.date] = (by[t.date] || 0) + 1; })); return Object.keys(by).sort((a, z) => by[z] - by[a])[0]; });
await page.evaluate((D) => { _tsDate = D; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; try { localStorage.removeItem(tsManColsKey()); } catch (_) {} _tsManHC = null; renderTravelSum(); }, DATE); await page.waitForTimeout(600);
const st = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'); const tbl = h.querySelector('.ts-man');
  const ths = [...tbl.querySelectorAll('thead th')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
  const rows = [...tbl.querySelectorAll('tr[data-tsman]')].slice(0, 40).map(tr => { const td = tr.children; return { n: td.length, pick: td[9].textContent.trim(), zone: td[10].textContent.replace(/\s+/g, ' ').trim(), vis: [...td].map(c => getComputedStyle(c).display !== 'none') }; });
  const sums = [...tbl.querySelectorAll('tr.ts-gsum, tr.ts-gtot')].map(tr => [...tr.children].reduce((a, c) => a + (getComputedStyle(c).display === 'none' ? 0 : (c.colSpan || 1)), 0));
  const cols = [...h.querySelectorAll('.ts-mcols-pop label')].map(l => l.textContent.trim());
  return { ths, rows, sums, cols, visTh: ths.length }; });
let a = await st();
if (a.ths[10] === 'Zone' && a.ths[9].startsWith('Pickup point') && a.ths.length === 19 && a.cols[9] === 'Zone' && a.cols.length === 18) ok(`1 หัวตาราง ${a.ths.length - 1} คอลัมน์ · ที่ 10 = Zone ถัดจาก "${a.ths[9]}" · ตัวเลือกคอลัมน์มี Zone`); else fail('1 ' + JSON.stringify({ ths: a.ths, cols: a.cols }));
const exp = await page.evaluate((D) => { const m = {}; tsRows(D).forEach(r => { const b = r.b; const key = String(b.hotelName || b.pickup || ''); const area = b.pickupArea || (b.pickupAreaId && typeof bookingV2GetArea === 'function' ? ((bookingV2GetArea(b.pickupAreaId) || {}).name || '') : '') || ''; const zk = (typeof bookingV2EffZone === 'function') ? (bookingV2EffZone(b, r.t) || '') : ''; (m[key] = m[key] || []).push({ area, zl: zk ? bookingV2ZoneLabel(zk) : '' }); }); return m; }, DATE);
const withPick = a.rows.filter(r => !/No pickup/.test(r.pick)), noPick = a.rows.filter(r => /No pickup/.test(r.pick));
const z2 = a.rows.every(r => { if (/No pickup/.test(r.pick)) return r.zone === 'Own'; const key = Object.keys(exp).find(k => k && r.pick.startsWith(k)); const cands = key ? exp[key] : []; if (!cands.length) return r.zone.length > 0; return cands.some(x => /^(PK|KL|Own)/.test(r.zone) && (x.area ? r.zone.includes(x.area) : true)); }) && a.rows.every(r => r.n === 19);
if (z2 && withPick.length) ok(`2 ช่อง Zone · ${withPick.length} แถวมีจุดรับ เช่น "${withPick[0].pick.slice(0, 24)}" → "${withPick[0].zone}" · No pickup ${noPick.length} แถว = Own`); else fail('2 ' + JSON.stringify({ rows: a.rows.slice(0, 4), keys: Object.keys(exp).slice(0, 5) }));
// เตรียมเคสผสม · เอเจนต์ที่มี ≥3 ใบในเส้นทางเดียวกัน · ใบแรกเป็น KL · ใบที่สองมาเอง (pickupSelf) → ต้องเรียงใหม่เป็น PK…, KL, Own
const mix = await page.evaluate((D) => { const g = {}; tsRows(D).forEach(r => { const k = r.routeId + '|' + tsAgName(r.b); (g[k] = g[k] || []).push(r); }); const k = Object.keys(g).find(k => g[k].length >= 3); if (!k) return null; const L = g[k];
  L[0].t.zone = 'KL'; L[0].b.pickupZone = 'KL'; L[1].b.pickupSelf = true; renderTravelSum(); return { ag: tsAgName(L[0].b), kl: L[0].b.voucherRef || L[0].b.id, own: L[1].b.voucherRef || L[1].b.id, n: L.length }; }, DATE);
await page.waitForTimeout(500);
// 5 (§tsManZone2) ในเส้นทาง+เอเจนต์เดียวกัน เรียง PK → KL → Own (ใบปกติ ไม่นับแถวยกเลิก/เลื่อนวัน)
const r5 = await page.evaluate(() => { const rows = [...document.querySelectorAll('#travelsum-host .ts-man tbody tr')]; let rt = '', out = [], bad = [];
  rows.forEach(tr => { if (tr.classList.contains('ts-grow')) { rt = tr.textContent.trim().slice(0, 30); return; } if (!tr.hasAttribute('data-tsman') || tr.classList.contains('ts-cxlrow')) return; const td = tr.children; const z = (td[10].querySelector('.ts-ztag') || {}).textContent || ''; out.push({ rt, ag: td[2].textContent.trim(), z }); });
  const ord = { PK: 0, KL: 1, Own: 2 }; for (let i = 1; i < out.length; i++) { const a = out[i - 1], b = out[i]; if (a.rt === b.rt && a.ag === b.ag && (ord[a.z] ?? 1.5) > (ord[b.z] ?? 1.5)) bad.push([a, b]); }
  const mixed = {}; out.forEach(o => { const k = o.rt + '|' + o.ag; (mixed[k] = mixed[k] || new Set()).add(o.z); }); const nMixed = Object.values(mixed).filter(s => s.size > 1).length;
  return { n: out.length, bad: bad.slice(0, 3), nMixed, tags: [...new Set(out.map(o => o.z))] }; });
if (!r5.bad.length && r5.n && r5.tags.every(t => /^(PK|KL|Own)$/.test(t)) && (!mix || (r5.nMixed >= 1 && r5.tags.includes('KL') && r5.tags.includes('Own')))) ok(`5 ในเอเจนต์เดียวกันเรียง PK → KL → Own (เคสผสม ${mix ? mix.ag + ' ' + mix.n + ' ใบ' : '—'}) · ${r5.n} แถว · เอเจนต์ที่มีหลายโซน ${r5.nMixed} · ป้าย ${r5.tags.join('/')}`); else fail('5 ' + JSON.stringify(r5));
// 3 hide Status (18) and Zone (10)
await page.evaluate(() => { tsManCol(18, false); tsManCol(10, false); }); await page.waitForTimeout(200); a = await st();
const r0 = a.rows[0];
const hid = r0 && !r0.vis[10] && !r0.vis[18] && r0.vis[17] && r0.vis[9] && a.sums.every(n => n === 17);
await page.evaluate(() => { tsManColsReset(); }); await page.waitForTimeout(200); const a3 = await st();
if (hid && a3.rows[0].vis.every(Boolean) && a3.sums.every(n => n === 19)) ok(`3 ซ่อน Zone+Status → ซ่อนช่องที่ 11 กับ 19 ของแถว · แถวรวมกว้าง 17 · แสดงทั้งหมด → 19`); else fail('3 ' + JSON.stringify({ vis: r0 && r0.vis, sums: a.sums, sums3: a3.sums }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 ไม่มี error'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
