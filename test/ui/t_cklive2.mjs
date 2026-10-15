// §ckLive3 · หน้าเช็คอินหน้าท่า · สองเครื่องกดสลับกัน ติ๊กของตัวเองต้องไม่หาย และอีกเครื่องต้องเห็นเร็ว
//
// ที่มา (2026-10-15) · owner: "เช็คอิน กดแล้วเด้ง ต้องกดใหม่ · ทำผ่านสองเครื่อง เครื่องนึงกด อีกเครื่องเห็นดีเลย์ อยากให้เห็นแบบเรียลไทม์ที่สุด"
//
// ⚠ เซิร์ฟเวอร์ปลอมของเทสนี้ "ลงข้อมูลจริง" ตาม ops ที่ไคลเอนต์ส่ง (put/patch/del/putall/meta) เหมือน server.js
//   ตอบการเซฟก่อน แล้วค่อยกระจายเวอร์ชันทาง SSE · behind = baseVersion < เวอร์ชันก่อนลง · /api/ck คืนใบของวันนั้น
//   สองเบราว์เซอร์ (A · B) คุยกับเซิร์ฟเวอร์เดียวกัน · หน่วงเน็ตได้ (NET=ms) จำลองเน็ตหน้าท่า
//
// วัด
//   1 เครื่องเดียวกด · ติ๊กของตัวเองต้องขึ้นและไม่หายเลยตลอด 8 วิ (ไม่ "เด้ง")
//   2 อีกเครื่องเห็นติ๊กนั้นใน ≤ 3 วิ (เน็ตปกติ) · รายงานเวลาจริง
//   3 สองเครื่องกดสลับกัน 6 ใบ (คนละใบ) ห่างกัน 0.7 วิ บนเน็ตหน่วง · ทุกติ๊กต้องอยู่บนเครื่องที่กด และโผล่บนอีกเครื่องครบทุกใบ
//   4 ไม่มี error ในคอนโซลทั้งสองเครื่อง
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! ต้องมี LAD=<ไฟล์ข้อมูล> · ข้ามเทสนี้'); process.exit(0); }
const NET = +(process.env.NET || 0);        // หน่วงทุกคำขอ api (ms) · จำลองเน็ตหน้าท่า
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const S = { version: 1, blob: JSON.parse(fs.readFileSync(BLOB, 'utf8')), sse: new Set(), loads: 0, ck: 0, saves: 0, log: [] };
const resources = {}; Object.keys(S.blob).forEach(k => { resources[k] = Array.isArray(S.blob[k]) ? 'array' : 'map'; });
function applyM(obj, m){ Object.keys(m.p || {}).forEach(k => { const e = m.p[k]; if (e && 'v' in e) obj[k] = e.v; else if (e && e.m){ if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {}; applyM(obj[k], e.m); } }); (m.d || []).forEach(k => { delete obj[k]; }); }
function applyOps(ops){
  ops.forEach(o => {
    if (o.op === 'meta'){ S.blob[o.id] = o.body; return; }
    if (o.op === 'putall'){ S.blob[o.r] = o.body; return; }
    const col = S.blob[o.r];
    if (Array.isArray(col)){
      const i = col.findIndex(x => x && String(x.id) === String(o.id));
      if (o.op === 'put'){ if (i >= 0) col[i] = o.body; else col.push(o.body); }
      else if (o.op === 'patch'){ if (i >= 0) applyM(col[i], o.body.m); else if (o.body.full) col.push(o.body.full); }
      else if (o.op === 'del'){ if (i >= 0) col.splice(i, 1); }
    } else if (col && typeof col === 'object'){
      if (o.op === 'put') col[o.id] = o.body; else if (o.op === 'del') delete col[o.id];
    }
  });
}
function applyDiff(d){ Object.keys(d.sets || {}).forEach(k => { S.blob[k] = d.sets[k]; }); Object.keys(d.objs || {}).forEach(k => { if (!S.blob[k] || typeof S.blob[k] !== 'object') S.blob[k] = {}; applyM(S.blob[k], d.objs[k]); });
  Object.keys(d.cols || {}).forEach(k => { const c = d.cols[k]; const col = Array.isArray(S.blob[k]) ? S.blob[k] : (S.blob[k] = []); (c.up || []).forEach(rec => { const i = col.findIndex(x => x && String(x.id) === String(rec.id)); if (i >= 0) col[i] = rec; else col.push(rec); }); (c.patch || []).forEach(pr => { const i = col.findIndex(x => x && String(x.id) === String(pr.id)); if (i >= 0) applyM(col[i], pr.m); }); (c.del || []).forEach(id => { const i = col.findIndex(x => x && String(x.id) === String(id)); if (i >= 0) col.splice(i, 1); }); }); }
function broadcast(by){ const t = 'data: ' + JSON.stringify({ version: S.version, updated_by: by }) + '\n\n'; S.sse.forEach(r => { try { r.write(t); } catch (_) {} }); }
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => setTimeout(() => { res.writeHead(code, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }); res.end(JSON.stringify(obj)); }, NET);
  const who = (req.headers['x-machine'] || 'test');
  if (u === '/api/me') return J(200, { username: who, name: who, role:'admin', canEdit:true });
  if (u === '/api/v1' && req.method === 'GET') return J(200, { resources });
  if (u === '/api/version') return J(200, { version: S.version, updated_by:'x', updated_at:new Date().toISOString() });
  if (u === '/api/load'){ S.loads++; return J(200, { version: S.version, data: JSON.stringify(S.blob), updated_by:'x', updated_at:new Date().toISOString() }); }
  if (u === '/api/ck'){ S.ck++; const date = new URLSearchParams(req.url.split('?')[1] || '').get('date') || '';
    const recs = (S.blob.sb_bookings || []).filter(b => (b.trips || []).some(x => x && x.date === date));
    return J(200, { date, version: S.version, bookings: JSON.parse(JSON.stringify(recs)) }); }
  if (u === '/api/events'){ res.writeHead(200, { 'content-type':'text/event-stream; charset=utf-8', 'cache-control':'no-cache', 'connection':'keep-alive' }); res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close', () => S.sse.delete(res)); return; }
  if ((u === '/api/v1/_batch' || u === '/api/save') && req.method === 'POST'){
    let body = ''; req.on('data', c => body += c);
    return req.on('end', () => { S.saves++; let p = {}; try { p = JSON.parse(body); } catch (_) {}
      const base = p.baseVersion == null ? -1 : p.baseVersion; const behind = base !== -1 && base < S.version;
      setTimeout(() => { if (Array.isArray(p.ops)) applyOps(p.ops); else if (p.diff) applyDiff(p.diff); S.version++; S.log.push({ t: Date.now(), by: who, n: (p.ops || []).length, behind });
        res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:true, version:S.version, behind, applied:(p.ops || []).length }));
        setTimeout(() => broadcast(who), 5); }, NET); });
  }
  if (u.startsWith('/api/')) return J(200, {});
  const rel = decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const browser = await chromium.launch();
async function machine(name){
  const ctx = await browser.newContext({ viewport:{ width:1500, height:950 }, extraHTTPHeaders: { 'x-machine': name } });
  await ctx.addInitScript(() => { try { localStorage.setItem('_nat_bootstrap_done', '1'); sessionStorage.setItem('la_view', JSON.stringify({ view: 'piercheckin' })); } catch (_) {} });   /* ของจริงทำครั้งเดียวต่อเครื่อง · และให้บูตคืนหน้าท่าเอง ไม่ใช่ dashboard */
  const page = await ctx.newPage(); const errors = [];
  page.on('dialog', d => d.accept()); page.on('pageerror', e => errors.push(name + ': ' + e.message));
  const logs = []; page.on('console', m => { const t = m.text(); if (/\[sync\]|\[boot\]|\[ck/.test(t)) logs.push(name + ': ' + t.slice(0, 160)); });
  await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
  await page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:25000 });
  await page.waitForFunction(() => typeof window.renderPierCheckin === 'function' && typeof window._laSoftRefresh === 'function', null, { timeout: 30000 });
  if (process.env.DEBUG) await page.evaluate(() => { window.__ev = []; const chk = () => (SB_BOOKINGS || []).filter(b => (window.__ids || []).includes(b.id) && b.ops && b.ops.pierCheckin && b.ops.pierCheckin.at).map(b => b.id.slice(-4)).sort().join(',');
    const wrap = (nm) => { const o = window[nm]; if (typeof o !== 'function') return; window[nm] = function(){ const before = chk(); const r = o.apply(this, arguments); window.__ev.push([Math.round(performance.now() - (window.__t0 || 0)), nm, r, before === chk() ? 'same' : ('CHANGED ' + before + ' -> ' + chk())]); return r; }; };
    wrap('_laCkApply'); wrap('_laReloadData'); wrap('ckToggle');
    const on = window.nav; window.nav = function(el){ try{ window.__navs = window.__navs || []; window.__navs.push([Math.round(performance.now() - (window.__t0 || 0)), el && el.dataset && el.dataset.view, String(new Error().stack).split('\n').slice(2, 5).map(l => l.replace(/\s+at\s+/, '').replace(/\(.*\//, '(').trim()).join('<')]); }catch(_){} return on.apply(this, arguments); };
    window.__xhr = []; const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m, u){ window.__xhr.push([Math.round(performance.now()), m, String(u).split('?')[0]]); return o.apply(this, arguments); }; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { nav(document.querySelector('.nav-item[data-view="piercheckin"]')); });
  await page.waitForTimeout(800);
  return { name, page, errors, ctx, logs };
}
const A = await machine('A'), B = await machine('B');
// วันที่มีใบยังไม่เช็คอินมากที่สุด
const day = await A.page.evaluate(() => { const by = {}; (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => { const O = (typeof bkOpsRead === 'function') ? bkOpsRead(b, t.date) : (b.ops || {}); if (O && !(O.pierCheckin && O.pierCheckin.at) && O.boatId) by[t.date] = (by[t.date] || 0) + 1; })); return Object.keys(by).sort((a, z) => by[z] - by[a])[0] || ''; });
for (const M of [A, B]) { await M.page.evaluate(d => { _pckDate = d; pckSetView('sheet'); renderPierCheckin(); }, day); }
await sleep(800);
const rows = await A.page.evaluate(() => [...document.querySelectorAll('#piercheckin-host .pck-ok.off')].map(b => { const m = /ckTap\('([^']+)','([^']+)','([^']+)'/.exec(b.getAttribute('onclick') || ''); return m ? { id:m[1], date:m[2], kind:m[3] } : null; }).filter(Boolean));
if (rows.length < 7){ console.log('  ! วัน ' + day + ' มีใบยังไม่เช็คอิน ' + rows.length + ' ใบ · ไม่พอ'); await browser.close(); srv.close(); process.exit(0); }
ok(`เครื่อง A/B เปิดหน้าท่าวัน ${day} · ใบยังไม่เช็คอิน ${rows.length} · เน็ตหน่วง ${NET}ms`);
const has = (M, r) => M.page.evaluate(t => { const b = (SB_BOOKINGS || []).find(x => x && x.id === t.id); const ck = b && ckRead(b, t.date, t.kind); return !!(ck && ck.at); }, r);
const tap = (M, r) => M.page.evaluate(t => { const b = [...document.querySelectorAll('#piercheckin-host .pck-ok')].find(x => (x.getAttribute('onclick') || '').indexOf("'" + t.id + "'") >= 0); if (!b) return { found: false }; const off = b.classList.contains('off'); if (!window.__tg) { window.__tg = 0; const o = window.ckToggle; window.ckToggle = function(){ window.__tg++; return o.apply(this, arguments); }; } const n0 = window.__tg; b.click(); return { found: true, off, pend: !!_ckTapPend[t.id + '|' + t.date + '|' + t.kind], tg0: n0, dirty: null }; }, r);
async function watch(M, r, ms){ const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms){ seen.push([Date.now() - t0, await has(M, r)]); await sleep(60); } return seen; }
function firstTrue(seen){ const f = seen.find(s => s[1]); return f ? f[0] : -1; }
function lostAfter(seen){ const i = seen.findIndex(s => s[1]); return i >= 0 && seen.slice(i).some(s => !s[1]); }

/* 1 + 2 · A กดใบแรก · ติ๊กของ A ต้องอยู่ · B ต้องเห็น */
const r1 = rows[0];
await tap(A, r1);
const [sA, sB] = await Promise.all([watch(A, r1, 8000), watch(B, r1, 8000)]);
if (firstTrue(sA) >= 0 && !lostAfter(sA)) ok(`1 A กดใบ ${r1.id} · ติ๊กขึ้นใน ${firstTrue(sA)}ms และไม่หายตลอด 8 วิ`); else fail('1 ' + JSON.stringify({ first: firstTrue(sA), lost: lostAfter(sA), tail: sA.slice(-5) }));
const tB = firstTrue(sB);
if (process.env.DEBUG) console.log('   logs:', JSON.stringify(A.logs.concat(B.logs).slice(0, 8)));
if (process.env.DEBUG) console.log('   xhr B:', JSON.stringify((await B.page.evaluate(() => window.__xhr.slice(-12)))), 'live:', JSON.stringify(await B.page.evaluate(() => { const a = document.querySelector('.nav-item.active'); return { view: a && a.dataset.view, n: document.querySelectorAll('.nav-item.active').length, d: _pckDate, apply: typeof window._laCkApply }; })));
if (tB >= 0 && tB <= 3000 + NET * 3) ok(`2 B เห็นติ๊กของ A ใน ${tB}ms (เซฟ ${S.saves} · ck ${S.ck} · load ${S.loads})`); else fail('2 B เห็นใน ' + tB + 'ms · ' + JSON.stringify({ saves: S.saves, ck: S.ck, loads: S.loads }));

/* 3 · สลับกันกด 6 ใบ */
const six = rows.slice(1, 7); const ownBy = []; const t3 = Date.now();
const tapInfo = []; for (const M of [A, B]) await M.page.evaluate(ids => { window.__ids = ids; window.__ev = []; window.__t0 = performance.now(); }, six.map(r => r.id));
for (let i = 0; i < six.length; i++){ const M = (i % 2 === 0) ? A : B; ownBy.push(M); await M.page.evaluate(t => { (window.__ev || []).push([Math.round(performance.now() - (window.__t0 || 0)), 'TAP', t.id.slice(-4)]); }, six[i]); const ti = await tap(M, six[i]); await sleep(350); ti.after = await M.page.evaluate(t => ({ tg: window.__tg, has: !!(ckRead((SB_BOOKINGS||[]).find(x => x.id === t.id), t.date, t.kind) || {}).at, pend: !!_ckTapPend[t.id + '|' + t.date + '|' + t.kind] }), six[i]); tapInfo.push(ti); await sleep(350); }
if (process.env.DEBUG) console.log('   taps:', JSON.stringify(tapInfo));
if (process.env.DEBUG) console.log('   who:', JSON.stringify(await A.page.evaluate(() => Object.entries(window.__laSetWho || {}).sort((a, b) => b[1] - a[1]).slice(0, 6))));
if (process.env.DEBUG) for (const M of [A, B]) console.log('   ev ' + M.name + ':', JSON.stringify(await M.page.evaluate(() => window.__ev.slice(-14))), '\n   xhr ' + M.name + ':', JSON.stringify(await M.page.evaluate(() => window.__xhr.filter(x => !/version/.test(x[2])).slice(-12).map(x => [x[0] - Math.round(window.__t0), x[1][0], x[2].replace('/api/', '')]))), JSON.stringify(await M.page.evaluate(() => Object.assign({ banner: !!document.getElementById('la-refresh'), navs: (window.__navs || []).slice(-4), nav: [...document.querySelectorAll('.nav-item.active')].map(a => a.dataset.view + '/' + a.style.display), ckR: (window.__ckR || []).slice(-8), sv: (window.__sv || []).filter(x => x[0] > -100).slice(-10), sw: (window.__sw || []).filter(x => x[0] > -100).slice(-12) }, window.__laDbg ? window.__laDbg() : {}))));
const res3 = await Promise.all(six.map(async (r, i) => { const own = ownBy[i], other = own === A ? B : A; const [so, st] = await Promise.all([watch(own, r, 9000), watch(other, r, 9000)]); return { id: r.id, own: own.name, ownFirst: firstTrue(so), ownLost: lostAfter(so), otherFirst: firstTrue(st) }; }));
const bad3 = res3.filter(x => x.ownFirst < 0 || x.ownLost || x.otherFirst < 0);
const lat = res3.filter(x => x.otherFirst >= 0).map(x => x.otherFirst);
if (!bad3.length) ok(`3 สลับกันกด 6 ใบ · ติ๊กอยู่ครบบนเครื่องที่กด · อีกเครื่องเห็นครบ (ช้าสุด ${Math.max(...lat)}ms · เฉลี่ย ${Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)}ms) · เซฟรวม ${S.saves} · ck ${S.ck} · load ${S.loads}`);
else fail('3 ' + JSON.stringify(bad3) + ' · all=' + JSON.stringify(res3));
// ข้อมูลฝั่งเซิร์ฟเวอร์ต้องมีครบ 7 ใบ (ไม่มีใครทับของใคร)
const srvOk = [r1].concat(six).every(r => { const b = S.blob.sb_bookings.find(x => x.id === r.id); const O = b && b.ops; return !!(O && O.pierCheckin && O.pierCheckin.at); });
if (srvOk) ok('3b เซิร์ฟเวอร์มีติ๊กครบ 7 ใบ · ไม่มีใครเซฟทับของอีกเครื่อง'); else fail('3b เซิร์ฟเวอร์ขาดติ๊กบางใบ');
const errs = A.errors.concat(B.errors).filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!errs.length) ok('4 ไม่มี error ทั้งสองเครื่อง'); else fail('4 ' + errs.slice(0, 4).join(' | '));
await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
