// t_router · hash routing · js/11-router.js
//
//   node test/ui/t_router.mjs
//
// เช็คว่า URL กับหน้าที่เปิดอยู่ตรงกันเสมอ ทั้งสองทิศ
//   1. กดเมนู → URL เปลี่ยนตาม (และนับเป็น 1 รายการใน history)
//   2. Back / Forward → หน้าเปลี่ยนตาม
//   3. เปิด / reload ด้วย URL → ได้หน้านั้น ไม่ใช่ Dashboard
//   4. แท็บ+วันของ Booking อยู่ใน URL · เปลี่ยนแท็บ = push · เลื่อนวัน = replace
//   5. URL มั่ว / หน้าที่ไม่มี → ไม่พัง และ URL ถูกคืนเป็นหน้าปัจจุบัน
//   6. ?embed=1 → router ไม่ทำงาน
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
/* ⚠ ณ วันที่เขียน 08-app.js บนกิ่งนี้พังตั้งแต่บูต (bookingV2LocalYMD ถูกเรียกก่อนไฟล์ booking/ โหลด)
   หน้าหลายหน้าจึงโยน ReferenceError ตอนวาดอยู่แล้ว ไม่ว่าจะมี router หรือไม่
   ข้อนี้จึงนับเฉพาะ error ที่ "เกิดใน" 11-router.js (บรรทัดแรกของ stack) */
const fromRouter = st => { const f = String(st || '').split('\n').find(l => /^\s*at /.test(l)) || ''; return /11-router\.js/.test(f); };
page.on('pageerror', e => { if (fromRouter(e.stack)) errors.push('pageerror: ' + String(e.stack).slice(0, 300)); });
page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && fromRouter(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });

const base = `http://127.0.0.1:${port}/allotment_v2.html`;
const fails = [];
const ok = (name, cond, got) => {
  console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got)));
  if (!cond) fails.push(name);
};

const settle = (ms = 400) => page.waitForTimeout(ms);
async function load(hash = '', qs = ''){
  await page.goto('about:blank');          // ให้เป็นการโหลดใหม่จริง ไม่ใช่แค่เปลี่ยน # ในหน้าเดิม
  await page.goto(base + qs + hash);
  await page.waitForFunction(() => typeof window.nav === 'function'
    && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 20000 });
  await settle(4400);                      // เลย _laRestoreView 850ms / ตัวสำรอง 4s ของ router
}
const state = () => page.evaluate(() => ({
  hash: location.hash,
  nav: (document.querySelector('.nav-item.active[data-view]') || {}).dataset?.view || null,
  view: (document.querySelector('.view.active') || {}).id || null,
  tab: window._bkV2 ? _bkV2.tab : null,
  date: window._bkV2 ? _bkV2.filterDate : null,
  hist: history.length,
}));
const click = async v => { await page.evaluate(vv => document.querySelector(`.nav-item[data-view="${vv}"]:not([data-citytour])`).click(), v); await settle(); };

console.log('\n[1] เปิดเปล่า ๆ แล้วกดเมนู');
await load();
let s = await state();
ok('เปิดมาเป็น Dashboard', s.nav === 'dashboard', s);
ok('URL ถูกเขียนเป็น #/dashboard ตอนบูต', s.hash === '#/dashboard', s.hash);
const h0 = s.hist;
await click('agents');
s = await state();
ok('กด Agents → #/agents', s.hash === '#/agents' && s.view === 'view-agents', s);
ok('history +1', s.hist === h0 + 1, { before: h0, after: s.hist });
await click('fl-maintenance');
s = await state();
ok('กด Maintenance → #/fl-maintenance', s.hash === '#/fl-maintenance', s.hash);

console.log('\n[2] Back / Forward');
await page.goBack(); await settle();
s = await state();
ok('Back → Agents', s.nav === 'agents' && s.hash === '#/agents', s);
await page.goBack(); await settle();
s = await state();
ok('Back อีกที → Dashboard', s.nav === 'dashboard', s);
await page.goForward(); await settle();
s = await state();
ok('Forward → Agents', s.nav === 'agents', s);

console.log('\n[3] เปิดด้วย URL / reload');
await load('#/fl-maintenance');
s = await state();
ok('เปิด #/fl-maintenance ได้หน้านั้น', s.nav === 'fl-maintenance', s);
await click('vehicles');
await page.reload();
await page.waitForFunction(() => typeof window.nav === 'function');
await settle(4400);
s = await state();
ok('reload แล้วยังอยู่หน้าเดิม (vehicles)', s.nav === 'vehicles' && s.hash === '#/vehicles', s);

console.log('\n[4] Booking · แท็บ + วันที่');
await load('#/booking?tab=bytrip&date=2026-10-05');
s = await state();
ok('เปิดตรงเข้า Booking › By trip › 2026-10-05', s.nav === 'booking' && s.tab === 'bytrip' && s.date === '2026-10-05', s);
ok('URL คงเดิม', s.hash === '#/booking?tab=bytrip&date=2026-10-05', s.hash);
const h1 = s.hist;
await page.evaluate(() => bookingV2SwitchTab('all')); await settle();
s = await state();
ok('เปลี่ยนแท็บ → #/booking?tab=all', s.hash === '#/booking?tab=all', s.hash);
ok('เปลี่ยนแท็บ = push', s.hist === h1 + 1, { before: h1, after: s.hist });
await page.evaluate(() => bookingV2SwitchTab('bytrip')); await settle();
const h2 = (await state()).hist;
await page.evaluate(() => { if (typeof bookingV2Tab2DateShift === 'function') bookingV2Tab2DateShift(1); }); await settle();
s = await state();
ok('เลื่อนวัน → URL ตามวัน', /date=2026-10-06/.test(s.hash), s.hash);
ok('เลื่อนวัน = replace ไม่เพิ่ม history', s.hist === h2, { before: h2, after: s.hist });
await page.goBack(); await settle();
s = await state();
ok('Back จาก bytrip → แท็บ all (อยู่หน้า Booking ต่อ)', s.nav === 'booking' && s.tab === 'all', s);
await page.evaluate(() => { location.hash = '#/booking?tab=locks'; }); await settle();
s = await state();
ok('พิมพ์ URL แท็บใหม่ → เปลี่ยนแท็บในหน้าเดิม', s.tab === 'locks', s);
await page.evaluate(() => { location.hash = '#/booking?citytour=1'; }); await settle();
s = await page.evaluate(() => ({ ct: (document.querySelector('.nav-item.active') || {}).dataset?.citytour, h: location.hash }));
ok('#/booking?citytour=1 → เมนู City Tour', s.ct === '1' && /citytour=1/.test(s.h), s);

console.log('\n[5] URL มั่ว');
await click('agents');
await page.evaluate(() => { location.hash = '#/no-such-page'; }); await settle();
s = await state();
ok('หน้าที่ไม่มี → คงหน้าเดิม และคืน URL', s.nav === 'agents' && s.hash === '#/agents', s);
await page.evaluate(() => { location.hash = '#/booking?tab=<script>&date=nope'; }); await settle();
s = await state();
ok('แท็บ/วันมั่ว → ตกไป cal ไม่เอาค่าดิบลง state', s.nav === 'booking' && s.tab === 'cal' && s.date !== 'nope', s);
await page.evaluate(() => { location.hash = '#top'; }); await settle();
s = await state();
ok('#anchor ธรรมดาไม่ถูกแตะ', s.nav === 'booking', s);

console.log('\n[6] embed');
await load('', '?embed=1&view=booking&tab=cal');
s = await page.evaluate(() => ({ r: !!window.laRouter, h: location.hash }));
ok('router ไม่ทำงานในโหมดฝัง', !s.r && s.h === '', s);

ok('ไม่มี error จาก router', errors.length === 0, errors);

await browser.close(); srv.close();
console.log(fails.length ? `\n✖ ${fails.length} ข้อไม่ผ่าน` : '\n✓ ผ่านทุกข้อ');
process.exit(fails.length ? 1 : 0);
