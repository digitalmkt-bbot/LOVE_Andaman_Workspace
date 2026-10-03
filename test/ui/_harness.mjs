// ฮาร์เนสร่วมของเทส UI · เสิร์ฟ allotment_v2/ แบบ static แล้วเปิดด้วย Chrome ในเครื่อง
//
// ทำไมเป็น static: บน localhost ตัวบูตใน js/01-auth-sync.js เจอ /api/me ไม่ได้แล้ว
// _laLocalHost() จะ return ออกไปใช้ localStorage ล้วน (ตั้งใจให้เป็นแบบนั้น)
// เทส UI จึงไม่ต้องมี backend และไม่แตะฐานข้อมูลจริงเลย
//
// ทำไม channel:'chrome': ไม่ต้องโหลด browser ของ playwright (~150MB)
// ลง dependency ด้วย PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci ก็พอ
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../allotment_v2');

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

export function serve(root = ROOT){
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'allotment_v2.html';
    const f = path.join(root, rel);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){
      res.writeHead(404).end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, port: srv.address().port })));
}

// เปิดแอป · LAD=<ไฟล์ blob json> เพื่อยัดข้อมูลจริงลง localStorage ก่อนโหลด
// ไม่ใส่ = ใช้ข้อมูล seed จาก DEFAULT_* (ตารางจะสั้น แต่ทุกหน้ายังเปิดได้)
export async function open({ width = 1440, height = 900, blob = process.env.LAD } = {}){
  const { srv, port } = await serve();
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

  const url = `http://127.0.0.1:${port}/allotment_v2.html`;
  if (blob){
    if (!fs.existsSync(blob)) throw new Error('LAD ไม่เจอไฟล์: ' + blob);
    await page.goto(url);
    await page.evaluate(txt => localStorage.setItem('loveandaman_v2', txt), fs.readFileSync(blob, 'utf8'));
  }
  await page.goto(url);
  await page.waitForFunction(() => typeof window.nav === 'function'
    && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  errors.length = 0;                      // ไม่นับ error ตอนบูต · แต่ละเทสเริ่มนับจากศูนย์

  const close = async () => { await browser.close(); srv.close(); };
  return { page, errors, close, url };
}

export async function views(page){
  return [...new Set(await page.$$eval('.nav-item[data-view]', ns => ns.map(n => n.dataset.view)))];
}

// เปิดหน้าหนึ่ง แล้วรอให้วาดเสร็จ
export async function goView(page, v, wait = 380){
  await page.evaluate(vv => {
    const el = document.querySelector('.nav-item[data-view="' + vv + '"]')
            || { dataset: { view: vv }, classList: { add(){}, remove(){} } };
    nav(el);
  }, v);
  await page.waitForTimeout(wait);
}
