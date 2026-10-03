// §permSeal · หน้าต่างจัดการผู้ใช้ + สิทธิ์เข้าถึง
//
// ที่มา (2026-09-22) · "ดูเรื่องการจัดการสิทธิ์ ไม่สามารถจัดการได้ แก้ไขแล้วก็ไม่บันทึก"
//   วัดของจริงแล้ว · admin ตั้ง "ท่าเรือ = ไม่มี" ให้คนที่ถือ piercheckin แล้วกดบันทึก
//   หน้าเว็บส่งถูก (ศูนย์หน้าท่าเรือ + หมุด '*explicit') เซิร์ฟเวอร์ก็เก็บศูนย์หน้าจริง
//   แต่ cleanPerms ตัดหมุดทิ้งเพราะไม่เคยมีใครใส่ '*explicit' ลง PERM_KEYS
//   พอไม่มีหมุด laExpandPerms ถือว่าเป็นข้อมูลแบบเก่า แล้ว laBackfillPier ยกหน้าท่าเรือคืนให้หมด
//   เปิดกล่องดูอีกที ท่าเรือกลับมาเป็น "ดู" เหมือนไม่เคยกดบันทึก
//
// ⚠ เซิร์ฟเวอร์ปลอมของเทสนี้ "ไม่ได้เดา" กติกากรองคีย์ · มันอ่าน PERM_KEYS ของจริงจาก server.js
//   และคีย์ที่ laSyncPermKeys เติมจาก LA_NAV ของจริงมาใช้
//   ถ้าวันหนึ่งมีคนถอด PERM_KEYS.add(LA_PERM_EXPLICIT) ออก เทสนี้จะพังทันที
//   ไม่ใช่เพราะเทสจำค่าไว้ แต่เพราะพฤติกรรมเปลี่ยนจริง
//
// กันห้าอย่าง
//   1 หน้าต่างเปิดได้ · รายชื่อขึ้นครบ · ปุ่มสิทธิ์มีจริง
//   2 กดปุ่มพื้นที่แล้วค่าเปลี่ยนบนจอจริง (ไม่ใช่กดแล้วเงียบ)
//   3 ตั้ง "ไม่มี" แล้วบันทึก · เปิดใหม่ต้องยังเป็น "ไม่มี" (ข้อที่ผู้ใช้เจอ)
//   4 หมุดต้องรอดถึงฐานข้อมูล · และคำเตือน "สิทธิ์แบบเก่า" ต้องหายหลังบันทึก
//   5 มีข้อมูลใหม่เข้ามาตอนกล่องเปิดอยู่ ห้ามทำให้กล่องหาย
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP  = path.resolve(HERE, '../../allotment_v2');
const REPO = path.resolve(HERE, '../..');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! ต้องมี LAD=<ไฟล์ข้อมูล> · ข้ามเทสนี้'); process.exit(0); }

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── ชุดคีย์ที่เซิร์ฟเวอร์ "จริง" ยอมรับ · อ่านจาก server.js + LA_NAV ไม่ใช่จำไว้เอง ── */
function realPermKeys(){
  const srvPath = path.join(REPO,'server.js');
  try{ if(!fs.statSync(srvPath).isFile()) return null; }catch(_){ return null; }
  const src = fs.readFileSync(srvPath, 'utf8');
  const m = src.match(/const PERM_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)\s*;/);
  if(!m) return null;
  const keys = new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
  /* laSyncPermKeys เติมคีย์จาก LA_NAV ของหน้าเว็บตอนบูต · ทำแบบเดียวกัน */
  const cli = fs.readFileSync(path.join(APP,'js','01-auth-sync.js'),'utf8').slice(0,400000);
  [...cli.matchAll(/\{\s*v\s*:\s*'([a-z0-9_-]+)'\s*,\s*t\s*:[^}]*?a\s*:\s*'([a-z0-9_-]+)'\s*\}/gi)]
    .forEach(x => keys.add(x[1]));
  /* และบรรทัดที่เติมหมุดเข้าไปเอง (ถ้ามี) */
  if(/PERM_KEYS\.add\(\s*LA_PERM_EXPLICIT\s*\)/.test(src)) keys.add('*explicit');
  [...src.matchAll(/PERM_KEYS\.add\(\s*'([^']+)'\s*\)/g)].forEach(x => keys.add(x[1]));
  return keys;
}
const KEYS = realPermKeys();
if(!KEYS){ console.log('  ! อ่าน PERM_KEYS จาก server.js ไม่ได้ · ข้ามเทสนี้'); process.exit(0); }
const cleanPerms = a => Array.isArray(a) ? a.filter(x => KEYS.has(x)) : null;

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

/* Pier.Mgr ถือ piercheckin อยู่ · เป็นคีย์ที่ปลุก laBackfillPier ให้ยกหน้าท่าเรือคืน */
const USERS = [
  { id:1, username:'ADMIN01',  name:'Boss', role:'admin', perms:null, canEdit:true, editAreas:null, dept:'admin', salesId:'' },
  { id:3, username:'Pier.Mgr', name:'Ruk',  role:'staff',
    perms:['piercheckin','po-panwa','poj-panwa'], canEdit:true, editAreas:['pier'], dept:'pier', salesId:'' },
];
const S = { version:1, blob:JSON.parse(fs.readFileSync(BLOB,'utf8')), sse:new Set(), posts:[], loads:0 };

const srv = http.createServer((req,res)=>{
  const u = req.url.split('?')[0];
  const J = (c,o)=>{ res.writeHead(c,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(o)); };
  if(u==='/api/me') return J(200,{username:'ADMIN01',name:'Boss',role:'admin',canEdit:true,perms:null,editAreas:null,salesId:null});
  if(u==='/api/version') return J(200,{version:S.version});
  if(u==='/api/load'){ S.loads++; return J(200,{version:S.version,data:JSON.stringify(S.blob)}); }
  if(u==='/api/users' && req.method==='GET') return J(200,{users:USERS});
  if(u==='/api/users/perms' && req.method==='POST'){
    let b=''; req.on('data',c=>b+=c);
    return req.on('end',()=>{
      let j={}; try{ j=JSON.parse(b); }catch(e){}
      S.posts.push(JSON.parse(JSON.stringify(j)));
      const t=USERS.find(x=>x.id===parseInt(j.id,10));
      if(t){ t.perms=cleanPerms(j.perms); t.role=j.role||t.role;   /* กรองแบบเดียวกับของจริง */
             t.editAreas=Array.isArray(j.editAreas)?j.editAreas:null;
             t.dept=j.dept||t.dept; t.salesId=j.salesId||''; }
      J(200,{ok:true});
    });
  }
  if(u==='/api/events'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});
    res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close',()=>S.sse.delete(res)); return; }
  if(u==='/api/save'||u==='/api/v1/_batch'){ let b=''; req.on('data',c=>b+=c); return req.on('end',()=>J(200,{ok:true,version:++S.version})); }
  if(u.startsWith('/api/')) return J(200,{});
  const f = path.join(APP, decodeURIComponent(u).replace(/^\/+/,'') || 'allotment_v2.html');
  if(!f.startsWith(APP) || !fs.existsSync(f)){ res.writeHead(404); return res.end(); }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r=>srv.listen(0,'127.0.0.1',()=>r(srv.address().port)));

const browser = await chromium.launch();
const page = await (await browser.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
page.on('dialog',d=>d.accept());
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`);
await page.waitForFunction(()=>typeof window.nav==='function'&&document.querySelectorAll('.nav-item[data-view]').length>0,null,{timeout:25000});
await page.waitForTimeout(1200); errs.length=0;

/* ══ 1 · เปิดหน้าต่างได้ · รายชื่อครบ ═══════════════════════════════════ */
await page.evaluate(()=>{ try{ __laUsers(); }catch(e){ window.__e=String(e); } });
await page.waitForTimeout(900);
const A = await page.evaluate(()=>({
  win:!!document.getElementById('la-uwin'),
  err:window.__e||'',
  permBtns:document.querySelectorAll('#la-uwin [onclick^="__laEditPerms"]').length
}));
if(!A.win) fail('เปิดหน้าต่างจัดการผู้ใช้ไม่ได้'+(A.err?(' · '+A.err):''));
else if(A.permBtns!==USERS.length) fail('รายชื่อไม่ครบ · ปุ่มสิทธิ์ '+A.permBtns+' จาก '+USERS.length);
else ok('เปิดหน้าต่างได้ · รายชื่อครบ '+A.permBtns+' คน');

/* ══ 2 · กดปุ่มพื้นที่แล้วค่าเปลี่ยนบนจอ ════════════════════════════════ */
const pierBtns = () => page.evaluate(()=>[].slice.call(document.querySelectorAll('#la-pmask [onclick^="__laSetArea"]'))
  .filter(b=>/'pier'/.test(b.getAttribute('onclick')))
  .map(b=>b.textContent.trim()+(/\bon\b/.test(b.className)?'*':'')));
await page.evaluate(()=>{ const b=document.querySelector('#la-uwin [onclick="__laEditPerms(3)"]'); if(b) b.click(); });
await page.waitForTimeout(600);
const before = await pierBtns();
await page.evaluate(()=>{ const b=[].slice.call(document.querySelectorAll('#la-pmask [onclick^="__laSetArea"]'))
  .find(x=>/'pier','no'/.test(x.getAttribute('onclick'))); if(b) b.click(); });
await page.waitForTimeout(300);
const afterClick = await pierBtns();
if(!before.length) fail('ไม่มีปุ่มพื้นที่ท่าเรือในกล่องสิทธิ์');
else if(afterClick.join('|')===before.join('|')) fail('กดปุ่ม "ไม่มี" แล้วหน้าจอไม่เปลี่ยนอะไรเลย');
else if(afterClick[0]!=='ไม่มี*') fail('กดแล้วไม่ติดที่ "ไม่มี" · ได้ '+afterClick.join(' '));
else ok('กดปุ่มพื้นที่แล้วค่าเปลี่ยนจริง · '+before.join(' ')+' → '+afterClick.join(' '));

/* ══ 3+4 · บันทึกแล้วเปิดใหม่ ต้องยังเป็น "ไม่มี" ═══════════════════════ */
await page.evaluate(()=>{ const b=document.querySelector('#la-pmask [onclick^="__laSavePerms"]'); if(b) b.click(); });
await page.waitForTimeout(1400);
const sent = S.posts[0]||{};
const PIER = ['po-panwa','po-tublamu','po-ranong','poj-panwa','poj-tublamu','poj-ranong',
              'pol-panwa','poa-panwa','pop-panwa','pok-panwa'];
const sentPier = PIER.filter(p=>(sent.perms||[]).includes(p));
const keptPier = PIER.filter(p=>(USERS[1].perms||[]).includes(p));
if(!S.posts.length) fail('กดบันทึกแล้วไม่ได้ส่งอะไรขึ้นเซิร์ฟเวอร์เลย');
else if(sentPier.length) fail('ส่งขึ้นไปยังมีหน้าท่าเรือติดไปด้วย · '+sentPier.join(','));
else if(keptPier.length) fail('เก็บจริงยังมีหน้าท่าเรือ · '+keptPier.join(','));
else ok('บันทึกแล้ว · ส่งและเก็บจริงไม่มีหน้าท่าเรือสักหน้า');

if(!(sent.perms||[]).includes('*explicit')) fail('หน้าเว็บไม่ได้ปิดหมุดก่อนส่ง');
else if(!(USERS[1].perms||[]).includes('*explicit'))
  fail('หมุดถูกตัดทิ้งตอนกรองคีย์ · สิทธิ์ที่ถอดออกจะถูกยกคืนตอนเปิดใหม่ (ใส่ \'*explicit\' ใน PERM_KEYS)');
else ok('หมุด \'*explicit\' รอดถึงที่เก็บ · ของที่ถอดออกจะไม่ถูกยกคืน');

await page.evaluate(()=>{ const b=document.querySelector('#la-uwin [onclick="__laEditPerms(3)"]'); if(b) b.click(); });
await page.waitForTimeout(700);
const reopened = await pierBtns();
const stillWarn = await page.evaluate(()=>{ const m=document.getElementById('la-pmask');
  return !!m && /สิทธิ์แบบเก่า/.test(m.textContent); });
if(reopened[0]!=='ไม่มี*')
  fail('เปิดใหม่แล้วท่าเรือกลับมาเอง · ได้ '+reopened.join(' ')+' (อาการที่ผู้ใช้เจอ)');
else ok('เปิดใหม่แล้วท่าเรือยังเป็น "ไม่มี" · การแก้ไขอยู่จริง');
if(stillWarn) fail('บันทึกแล้วยังขึ้นคำเตือน "สิทธิ์แบบเก่า" · แปลว่าหมุดไม่ติด');
else ok('คำเตือน "สิทธิ์แบบเก่า" หายหลังบันทึก');

/* ══ 5 · ข้อมูลใหม่เข้ามาตอนกล่องเปิดอยู่ ═══════════════════════════════ */
const loads0 = S.loads;
S.version++; S.sse.forEach(r=>{ try{ r.write('data: '+JSON.stringify({version:S.version})+'\n\n'); }catch(_){} });
await sleep(4000);
const alive = await page.evaluate(()=>({ win:!!document.getElementById('la-uwin'), mask:!!document.getElementById('la-pmask') }));
if(!alive.win || !alive.mask) fail('มีข้อมูลใหม่เข้ามาแล้วกล่องสิทธิ์หายไปกลางคัน');
else if(S.loads > loads0)
  fail('กล่องสิทธิ์เปิดค้างอยู่แต่ระบบยังดึงข้อมูลมาทับ '+(S.loads-loads0)+' ครั้ง · '
    +'รอบไหนที่ลงข้อมูลในเครื่องไม่สำเร็จจะ reload ทับ ติ๊กที่ค้างไว้หายทั้งชุด');
else ok('กล่องสิทธิ์เปิดค้าง · ระบบไม่ดึงข้อมูลมาทับเลย');

if(errs.length) fail('มี error บนหน้า · '+errs.slice(0,2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
