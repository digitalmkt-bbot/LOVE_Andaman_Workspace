// §flpVideo · คลิปสั้นอัปตรง (ท่อจริง: เลือกไฟล์ → POST → เสิร์ฟกลับ) · คลิปเกิน 6MB ถูกปฏิเสธพร้อมบอกขนาด · ลิงก์ YouTube/Drive เป็นวิดีโอ · ช่อง ▶ · ดูเต็มจอเป็น <video>/<iframe>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../allotment_v2');
const SC = process.env.SC || '/tmp/claude-0/-home-claude/f8179ff1-bab4-5ee3-bb43-3319de33fa67/scratchpad';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json' };
const store = {}; const ups = [];
const srv = http.createServer((req, res) => {
  if (req.url === '/api/attach' && req.method === 'POST') { let b=''; req.on('data', c => b += c); req.on('end', () => { const j = JSON.parse(b); const buf = Buffer.from(j.dataB64, 'base64'); if (buf.length > 6*1024*1024) { res.writeHead(413, {'content-type':'application/json'}); res.end(JSON.stringify({error:'too big'})); return; } const id = 'att_' + (ups.length+1); store[id] = { buf, mime: j.mime }; ups.push({ name: j.filename, mime: j.mime, size: buf.length }); res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ id, filename: j.filename, mime: j.mime, size: buf.length })); }); return; }
  if (req.url.startsWith('/api/attach/') && req.method === 'GET') { const id = decodeURIComponent(req.url.slice(12).split('#')[0]); const f = store[id]; if (!f) { res.writeHead(404).end(); return; } res.writeHead(200, {'content-type': f.mime, 'content-length': f.buf.length, 'accept-ranges': 'bytes'}); res.end(f.buf); return; }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'allotment_v2.html'; const f = path.join(ROOT, rel);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [], dialogs = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
const url = `http://127.0.0.1:${port}/allotment_v2.html`;
await page.goto(url); await page.evaluate(txt => localStorage.setItem('loveandaman_v2', txt), fs.readFileSync(process.env.LAD, 'utf8')); await page.goto(url);
await page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 20000 }); await page.waitForTimeout(900); errors.length = 0;   // ไม่นับ error ตอนบูต (เหมือน _harness.open)
await page.evaluate(() => nav(document.querySelector('.nav-item[data-view="fl-work"]'))); await page.waitForTimeout(1200);
const id = await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms)); const it = flwItems().find(x => x.kind === 'mj'); FLW.boat = it.boatId; FLW.item = it.key; flRenderWork(); await z(400); window.LA_ME = { name: 'Pae' }; return it.id; });
// 1 · คลิป 1.3MB + รูป + คลิปปลอม 7MB ในชุดเดียว
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('#flw-rp .flp-b button.pri')]);
await ch.setFiles([SC + '/clip.mp4', SC + '/big.jpg', SC + '/big.mp4']);
await page.waitForTimeout(5000);
const r = await page.evaluate((id) => { const m = FL_MAINT.find(x => x.id === id); const L = (m.photos || []); const t = document.querySelectorAll('#flw-rp .flp-t'); return { n: L.length, kinds: L.map(p => p.kind), mimes: L.map(p => p.mime), vidTiles: document.querySelectorAll('#flw-rp .flp-t.vid video').length, play: document.querySelectorAll('#flw-rp .flp-play').length, log: (m.progressLog.slice(-1)[0] || {}).text, accept: (document.getElementById('fl-proj-file') || {}).accept }; }, id);
if (r.n === 2 && r.kinds.join() === 'video,photo' && /video\/mp4/.test(r.mimes[0]) && ups.length === 2 && ups[0].size === 1305520) ok(`1 คลิป 5 วิ (1.3MB) อัปตรงทั้งไฟล์ ไม่ย่อ · kind=video · รูปในชุดเดียวกันยังเข้า · เซิร์ฟเวอร์รับ 2 ไฟล์`); else fail('1 ' + JSON.stringify({ r, ups }));
if (dialogs.length === 1 && /too large/i.test(dialogs[0]) && /7\.0 MB/.test(dialogs[0]) && /Paste link/.test(dialogs[0])) ok(`2 คลิป 7MB ถูกปฏิเสธก่อนส่ง · แจ้งขนาดและทางออก: "${dialogs[0].slice(0, 70)}…"`); else fail('2 ' + JSON.stringify(dialogs));
if (r.vidTiles === 1 && r.play === 1 && /Photo\/video added · 2 files/.test(r.log)) ok('3 การ์ด: ช่องวิดีโอเป็น <video> + ปุ่ม ▶ · timeline "Photo/video added · 2 files"'); else fail('3 ' + JSON.stringify(r));
// 4 · ลิงก์ YouTube / Drive / .mp4
const l = await page.evaluate((id) => { const yt = flpVidLink('https://youtu.be/dQw4w9WgXcQ'), dr = flpVidLink('https://drive.google.com/file/d/1AbC_def-9/view?usp=sharing'), mp = flpVidLink('https://x.com/a/clip.MOV?x=1'), no = flpVidLink('https://x.com/a/photo.jpg');
  window.prompt = (q) => /URL/.test(q) ? 'https://youtu.be/dQw4w9WgXcQ' : 'คลิปจากอู่'; flpAddUrl('mj', id);
  const m = FL_MAINT.find(x => x.id === id); const p = m.photos[m.photos.length - 1];
  return { yt, dr, mp, no, kind: p.kind, cap: p.cap, ph: document.querySelectorAll('#flw-rp .flp-vph').length, log: (m.progressLog.slice(-1)[0] || {}).text }; }, id);
if (l.yt && l.yt.embed === 'https://www.youtube.com/embed/dQw4w9WgXcQ' && l.dr && /1AbC_def-9\/preview$/.test(l.dr.embed) && l.mp && l.mp.direct && !l.no) ok('4 รู้จักลิงก์ YouTube · Drive · .mov · ลิงก์รูปไม่ใช่วิดีโอ'); else fail('4 ' + JSON.stringify(l));
if (l.kind === 'video' && l.cap === 'คลิปจากอู่' && l.ph === 1 && /Video link added/.test(l.log)) ok('5 Paste link YouTube → kind=video · ช่องป้าย YouTube + ▶ · timeline "Video link added"'); else fail('5 ' + JSON.stringify(l));
// 6 · ดูเต็มจอ
const v = await page.evaluate(async (id) => { const z = ms => new Promise(f => setTimeout(f, ms)); const m = FL_MAINT.find(x => x.id === id);
  flpView('mj', id, m.photos[0].id); await z(300); const a = { video: !!document.querySelector('#flp-lb video[controls]'), src: (document.querySelector('#flp-lb video') || {}).getAttribute && document.querySelector('#flp-lb video').getAttribute('src') };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  flpView('mj', id, m.photos[2].id); await z(200); const b = { iframe: !!document.querySelector('#flp-lb iframe[src^="https://www.youtube.com/embed/"]') };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return { a, b }; }, id);
if (v.a.video && /^\/api\/attach\//.test(v.a.src) && v.b.iframe) ok('6 ดูเต็มจอ: คลิปที่อัป → <video controls> จาก /api/attach · ลิงก์ YouTube → ฝัง'); else fail('6 ' + JSON.stringify(v));
const errs = errors.filter(e => !/404|ERR_TUNNEL/.test(e));
if (errs.length) fail('errors: ' + errs.join(' | ')); else ok('7 ไม่มี error');
await page.screenshot({ path: '/mnt/user-data/outputs/flp_video.png', clip: { x: 1210, y: 230, width: 360, height: 700 } });
await browser.close(); srv.close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
