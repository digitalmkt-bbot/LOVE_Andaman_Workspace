// t_embed_csp · ใครมีสิทธิ์เอาแอปไปใส่ <iframe> · server.js §embedFrame
//
//   node test/ui/t_embed_csp.mjs
//
// ตัวนี้ต่างจาก t_embed.mjs — ต้องบูต server.js ของจริง เพราะสิ่งที่ทดสอบคือ
// หัว Content-Security-Policy ที่เซิร์ฟเวอร์ติดมา ไม่ใช่พฤติกรรมฝั่งหน้าเว็บ
// ไม่ต้องมีฐานข้อมูล · server.js บูตขึ้นแบบ "db off" แล้วเสิร์ฟไฟล์ static ได้ปกติ
// และ js/01-auth-sync.js เจอ 127.0.0.1 จะเข้าโหมด localStorage ล้วนอยู่แล้ว
//
// เช็ค 3 อย่าง
//   1. ไม่ตั้ง EMBED_ORIGINS → โดเมนอื่นฝังไม่ได้ (ปิดช่อง clickjacking ที่เปิดอยู่เดิม)
//   2. ตั้งแล้ว → โดเมนที่อยู่ในรายชื่อฝังได้จริง และแอปข้างในบูตขึ้นมาจริง
//   3. /embed/* เด้งไปหน้าแอปพร้อมพารามิเตอร์ที่ถูกต้อง · ค่าที่ไม่ผ่านรูปแบบถูกทิ้ง
//
// ⚠ ต้องระบุ PORT เป็นเลขจริง · server.js พิมพ์ค่า env ออกมาตรง ๆ ('LOVE Andaman on '+PORT)
//   ไม่ได้พิมพ์พอร์ตที่ผูกได้จริง · PORT=0 จึงอ่านกลับมาเป็น 0 แล้วต่อไม่ติดทั้งชุด
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fails = [];
const ok = (name, cond, got) => {
  console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got)));
  if (!cond) fails.push(name);
};

const freePort = () => new Promise(r => {
  const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); });
});

/* หน้าแม่ปลอม · เสิร์ฟจาก localhost ส่วนแอปอยู่ที่ 127.0.0.1 = คนละ origin
   ในสายตาเบราว์เซอร์ (เทียบเท่าคนละโดเมนของจริง) แม้จะเป็นเครื่องเดียวกัน

   จับ la-embed-ready ที่ js/10-embed.js ยิงกลับมาหาหน้าแม่ · เป็นสัญญาณเดียว
   ที่บอกได้แน่ ๆ ว่า "แอปโหลดในกรอบและรันจริง" เพราะอ่าน contentDocument ข้าม
   origin ไม่ได้ (คืน null เฉย ๆ ไม่ throw) แยกไม่ออกว่าโดนบล็อกหรือแค่อ่านไม่ได้ */
function parentSite(port, frameSrc){
  const srv = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>host</title>
      <script>window.__ready=false;
        addEventListener('message',function(e){ if(e.data&&e.data.type==='la-embed-ready') window.__ready=e.data; });
      <\/script>
      <iframe id="f" src="${frameSrc}" style="width:1200px;height:700px;border:0"></iframe>`);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

function bootServer(port, env){
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.js'],
      { cwd: REPO, env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const t = setTimeout(() => { proc.kill(); reject(new Error('server did not start in 40s: ' + out)); }, 40000);
    proc.stdout.on('data', d => {
      out += d;
      if (/LOVE Andaman on /.test(out)){ clearTimeout(t); resolve(proc); }
    });
    proc.stderr.on('data', d => { out += d; });
    proc.on('exit', c => { clearTimeout(t); reject(new Error('server exited ' + c + ': ' + out)); });
  });
}

async function withServer(env, fn){
  const port = await freePort();
  const proc = await bootServer(port, env);
  try { return await fn(port); } finally { proc.kill(); }
}

const browser = await chromium.launch({ channel: 'chrome' });

async function tryFrame(hostPort, appPort, embedPath){
  const srv = await parentSite(hostPort, `http://127.0.0.1:${appPort}${embedPath}`);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`http://localhost:${hostPort}/`, { waitUntil: 'load' });
  let ready = false;
  try {
    await page.waitForFunction(() => window.__ready !== false, null, { timeout: 25000 });
    ready = await page.evaluate(() => window.__ready);
  } catch(_){ /* ไม่มาภายในเวลา = ไม่ขึ้น */ }
  /* โดน frame-ancestors ปฏิเสธ = เบราว์เซอร์ไม่พาเฟรมไปไหนเลย ค้างที่ about:blank
     ข้อความ "Refused to frame..." ออกที่คอนโซลของเฟรมที่ถูกบล็อก ซึ่ง Playwright
     ไม่ได้ผูกไว้ · ดูจาก URL ของเฟรมลูกแทน เชื่อถือได้กว่าและไม่ขึ้นกับข้อความ */
  const framed = page.frames().slice(1).map(f => f.url()).filter(Boolean);
  const out = { ready, refused: !framed.some(u => u.includes(`:${appPort}/`)), framed };
  await page.close(); srv.close();
  return out;
}

// ── 1) ไม่ตั้ง EMBED_ORIGINS · โดเมนอื่นต้องฝังไม่ได้ ──────────────────────
console.log('\nไม่ตั้ง EMBED_ORIGINS · หน้าแม่คนละ origin');
await withServer({ EMBED_ORIGINS: '' }, async (appPort) => {
  const csp = (await fetch(`http://127.0.0.1:${appPort}/allotment_v2/allotment_v2.html`))
                .headers.get('content-security-policy');
  ok("หัว CSP เปิดให้เฉพาะ 'self'", csp === "frame-ancestors 'self'", csp);
  const r = await tryFrame(await freePort(), appPort, '/embed/calendar');
  ok('เบราว์เซอร์ปฏิเสธการฝัง', r.refused === true, r);
  ok('แอปไม่ได้รันในกรอบ',      r.ready === false, r);
});

// ── 2) ตั้งชื่อ origin ของหน้าแม่ไว้ · ต้องฝังได้ ─────────────────────────
console.log('\nตั้ง EMBED_ORIGINS ให้ตรงกับหน้าแม่');
const hostPort = await freePort();
await withServer({ EMBED_ORIGINS: `http://localhost:${hostPort}` }, async (appPort) => {
  const r = await tryFrame(hostPort, appPort, '/embed/bytrip?date=2026-09-20');
  ok('เบราว์เซอร์ยอมให้ฝัง',        r.refused === false, r);
  ok('แอปรันในกรอบจริง',           !!r.ready, r);
  ok('ไปโผล่แท็บ By trip · date',   r.ready && r.ready.tab === 'bytrip', r.ready);
  ok('วันที่ตรงกับที่สั่ง',          r.ready && r.ready.date === '2026-09-20', r.ready);
});

// ── 3) /embed/* เด้งไปที่ถูกต้อง และกรองค่าที่ไม่ผ่านรูปแบบทิ้ง ───────────
console.log('\n/embed/* · ปลายทางของการเด้ง');
await withServer({}, async (appPort) => {
  const hit = async (p) => {
    const res = await fetch(`http://127.0.0.1:${appPort}${p}`, { redirect: 'manual' });
    return { status: res.status, loc: res.headers.get('location') || '' };
  };
  let r = await hit('/embed/calendar');
  ok('calendar → tab=cal', r.status === 302 && r.loc.endsWith('embed=1&view=booking&tab=cal'), r);
  r = await hit('/embed/bytrip?date=2026-09-20&route=r5');
  ok('bytrip → tab=bytrip + date + route',
     r.status === 302 && r.loc.endsWith('embed=1&view=booking&tab=bytrip&date=2026-09-20&route=r5'), r);
  r = await hit('/embed/bytrip?date=NOT-A-DATE&route=../../etc/passwd');
  ok('ค่าที่ผิดรูปแบบถูกทิ้ง ไม่ส่งต่อเข้า Location',
     r.status === 302 && !/NOT-A-DATE|passwd/.test(r.loc), r);
  /* §embedRO · ไม่ใส่ edit = ไม่มี edit=1 ไปถึงหน้าแอป = ดูอย่างเดียว
     default ต้องอยู่ฝั่งปลอดภัย · ลืมใส่แล้วได้หน้าแก้ไม่ได้ ดีกว่าลืมแล้วจัดรถได้ */
  r = await hit('/embed/bytrip?date=2026-09-20');
  ok('ไม่ขอ edit → ไม่มี edit=1 ติดไป', r.status === 302 && !/edit=1/.test(r.loc), r);
  r = await hit('/embed/bytrip?date=2026-09-20&edit=1');
  ok('ขอ edit=1 → ส่งต่อให้', r.status === 302 && r.loc.endsWith('&edit=1'), r);
  r = await hit('/embed/bytrip?edit=yes');
  ok('edit ที่ไม่ใช่ 1 ถูกทิ้ง', r.status === 302 && !/edit/.test(r.loc), r);

  r = await hit('/embed/nope');
  ok('หน้าที่ไม่รู้จัก → 404', r.status === 404, r);
});

await browser.close();
console.log('\nพัง ' + fails.length + (fails.length ? ' · ' + fails.join(' · ') : ''));
process.exit(fails.length ? 1 : 0);
