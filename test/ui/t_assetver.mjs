// §bustGuard · ตัวเลข ?v= ท้าย js/css ต้องตรงกับไฟล์จริงเสมอ
//
// ที่มา (2026-09-23) · ผู้ใช้ส่งภาพหน้าเช็คอินมาถามว่า "ที่ยังขึ้นแบบนี้เพราะอะไร"
//   วัดสีพื้นแถวจากภาพได้ (245,246,247) = โค้ดตัวเก่าเป๊ะ ทั้งที่ deploy ไปแล้ว
//   สาเหตุ: js/08-app.js ใน html ยังเขียน ?v=993d226e แต่ไฟล์จริงเป็น 2a8349c4
//   Cloudflare เขียนทับ Cache-Control เป็น max-age=14400 (§assetVer)
//   URL ไม่เปลี่ยน = เบราว์เซอร์ไม่ยิงเน็ตเลย ถือของเก่าไว้สี่ชั่วโมง
//   วันนั้นค้างอยู่ 3 ไฟล์ · 01-auth-sync (ตัวซิงก์) · 05-fleet · 08-app
//
// เรื่องนี้เคยเกิดมาแล้วและถูกแก้ด้วยมือใน 8d1ddc9 (§bustFix)
//   "ไฟล์นี้คือตัวซิงก์ · เบราว์เซอร์ที่ถือเวอร์ชันเก่าค้างอยู่ = เสี่ยงกว่าหน้าจอเพี้ยนมาก"
//   แก้ด้วยมือแล้วก็ค้างอีก เพราะไม่มีอะไรคอยเตือน · อันนี้คือตัวเตือน
//
// ⚠ เทสนี้ไม่เปิดเบราว์เซอร์ · อ่านไฟล์เทียบ md5 ตรง ๆ วิ่งไม่ถึงวินาที
//    ควรรันทุกครั้งก่อน commit ที่แตะ js/ หรือ css/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const HTML = path.join(ROOT, 'allotment_v2.html');

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

if (!fs.existsSync(HTML)){ fail('ไม่พบ allotment_v2.html'); console.log('\nพัง ' + bad); process.exit(1); }
const html = fs.readFileSync(HTML, 'utf8');
const md5 = p => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 8);

/* ── เก็บทุกแท็กที่ชี้ไป js/ หรือ css/ ของเราเอง ──────────────────────── */
const tags = [];
const reJs  = /<script\s+src="(js\/[^"?]+\.js)(\?v=([0-9a-f]+))?"/g;
const reCss = /<link rel="stylesheet" href="(css\/[^"?]+\.css)(\?v=([0-9a-f]+))?"/g;
for (const re of [reJs, reCss]){
  let m; while ((m = re.exec(html))) tags.push({ path:m[1], v:m[3] || '' });
}

if (!tags.length){ fail('ไม่เจอแท็ก js/css สักตัว · รูปแบบไฟล์เปลี่ยนไปแล้วหรือเปล่า'); }
else ok('เจอแท็ก js/css ' + tags.length + ' ตัว');

/* ══ 1 · ทุกตัวที่ใส่ ?v= ไว้ ต้องตรงกับไฟล์จริง ═══════════════════════════ */
const stale = [], missing = [];
tags.forEach(t => {
  const f = path.join(ROOT, t.path);
  if (!fs.existsSync(f)){ missing.push(t.path); return; }
  if (!t.v) return;                       /* ไม่ใส่ = ให้เซิร์ฟเวอร์เติมเอง (§assetVer) */
  const real = md5(f);
  if (t.v !== real) stale.push(t.path + ' · html=' + t.v + ' ไฟล์จริง=' + real);
});
if (missing.length) fail('แท็กชี้ไปไฟล์ที่ไม่มีอยู่ · ' + missing.join(' · '));
else ok('ทุกแท็กชี้ไปไฟล์ที่มีอยู่จริง');

if (stale.length){
  fail('cache-bust ค้างของเก่า ' + stale.length + ' ไฟล์ — เบราว์เซอร์จะยังรันโค้ดเดิมหลัง deploy');
  stale.forEach(x => console.log('      ' + x));
  console.log('      แก้: เปลี่ยน ?v= ให้เป็นค่า md5 8 ตัวแรกของไฟล์จริง');
} else ok('cache-bust ตรงกับไฟล์จริงทุกตัว');

/* ══ 2 · ไฟล์ js/css ที่มีอยู่ ต้องถูกอ้างถึงครบ ═══════════════════════════
   ไฟล์ที่ไม่มีใครโหลดคือโค้ดตายที่ยังแก้อยู่ · เคยเกิดกับ 10-embed.js มาแล้ว */
{
  const listed = new Set(tags.map(t => t.path));
  const onDisk = [];
  for (const d of ['js', 'css']){
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir).filter(f => /\.(js|css)$/.test(f)).forEach(f => onDisk.push(d + '/' + f));
  }
  const orphan = onDisk.filter(f => !listed.has(f));
  if (orphan.length) fail('มีไฟล์ที่ไม่ถูกอ้างถึงในหน้า · ' + orphan.join(' · '));
  else ok('ไฟล์ใน js/ และ css/ ถูกอ้างถึงครบทั้ง ' + onDisk.length + ' ไฟล์');
}

/* ══ 3 · ลำดับสคริปต์ต้องไม่สลับ ═══════════════════════════════════════════
   ทั้งหมดเป็น <script src> แบบคลาสสิก ไม่มี defer/async · ลำดับคือสัญญา
   สลับเมื่อไหร่ = ตัวแปรที่ไฟล์หลังใช้ยังไม่ถูกสร้าง */
{
  const js = tags.filter(t => t.path.startsWith('js/')).map(t => t.path);
  const num = js.filter(p => /js\/\d\d-/.test(p));
  const seq = num.map(p => parseInt(p.slice(3, 5), 10));
  const sorted = seq.slice().sort((a, z) => a - z);
  /* 10-embed.js มาก่อน 01 โดยตั้งใจ (§embed) · ตัวที่เหลือต้องเรียงขึ้น */
  const rest = seq.filter(n => n !== 10);
  const restSorted = rest.slice().sort((a, z) => a - z);
  if (rest.join() !== restSorted.join())
    fail('ลำดับสคริปต์สลับ · ได้ ' + rest.join(',') + ' ควรเป็น ' + restSorted.join(','));
  else ok('ลำดับสคริปต์ถูกต้อง · ' + seq.join(' → '));
}

/* ══ 4 · ห้ามมี defer/async/module ═════════════════════════════════════════ */
{
  const wrong = [];
  const re = /<script\s+[^>]*src="js\/[^"]+"[^>]*>/g;
  let m; while ((m = re.exec(html))){
    if (/\b(defer|async)\b/.test(m[0]) || /type="module"/.test(m[0])) wrong.push(m[0].slice(0, 90));
  }
  if (wrong.length) fail('มีแท็กที่ใส่ defer/async/module · ' + wrong.join(' | '));
  else ok('ไม่มีแท็กไหนใส่ defer/async/module');
}

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
process.exit(bad ? 1 : 0);
