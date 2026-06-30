// LOVE Andaman · server for Railway: static app + login (users) + cloud sync with overwrite-guard.
// Data is one JSON blob (loveandaman_v2) in Postgres, versioned (optimistic concurrency).
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

let Pool = null;
try { Pool = require('pg').Pool; } catch(e){ console.warn('[db] pg not installed'); }

const ROOT   = __dirname;
const PORT   = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // set SESSION_SECRET to keep logins across redeploys
const ADMIN_USER = (process.env.ADMIN_USER || '').trim();
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const STATE_KEY  = 'loveandaman_v2';
const SESS_DAYS  = 14;

let pool = null, dbReady = false;
if (Pool && DB_URL) {
  pool = new Pool({ connectionString: DB_URL, ssl: (DB_URL.includes('rlwy')||DB_URL.includes('railway')||process.env.PGSSL) ? { rejectUnauthorized:false } : false });
  initDb();
} else {
  console.warn('[db] no DATABASE_URL — login & sync disabled');
}
async function initDb(){
  try{
    await pool.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'staff', created_at TIMESTAMPTZ DEFAULT now())");
    await pool.query("CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data TEXT, version INT DEFAULT 0, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT now())");
    await pool.query("ALTER TABLE app_state ADD COLUMN IF NOT EXISTS version INT DEFAULT 0");
    await pool.query("ALTER TABLE app_state ADD COLUMN IF NOT EXISTS updated_by TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS perms TEXT");   // per-user area access (JSON array · null = all)
    // seed first admin from env if there are no users yet
    const c = await pool.query('SELECT count(*)::int n FROM users');
    if (c.rows[0].n === 0 && ADMIN_USER && ADMIN_PASS) {
      await pool.query('INSERT INTO users(username,pass_hash,name,role) VALUES($1,$2,$3,$4)', [ADMIN_USER, hashPw(ADMIN_PASS), 'Admin', 'admin']);
      console.log('[db] seeded admin user:', ADMIN_USER);
    }
    dbReady = true; console.log('[db] ready');
  }catch(e){ console.error('[db] init failed:', e.message); }
}

// ── perms helpers (per-user area access · null/invalid = all areas) ──
function parsePerms(v){ if(v==null) return null; try{ const a=JSON.parse(v); return Array.isArray(a)?a:null; }catch(e){ return null; } }
const PERM_KEYS=new Set(['overview','operations','sales','accounting','fleet','config',  // group keys (back-compat)
  'dashboard','calendar','daily','booking','operation','vehicles','vanjobs','pickup-setup',
  'agents','rate-types','b2c','staff','marketdata','pickupmap','dailypfm',
  'fl-dashboard','fl-boatstatus','fl-dailyreport','fl-incident','fl-projects','fl-maintenance','fl-inventory','fl-consumables','fl-cost','fl-insights','fl-fuel','fl-asset',
  'settings','teammkt','addonsvc']);   // 'accounting' already present as a group key
function cleanPerms(a){ return Array.isArray(a)?a.filter(x=>PERM_KEYS.has(x)):null; }

// ── password hashing (scrypt) ──
function hashPw(pw){ const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return salt+':'+h; }
function verifyPw(pw, stored){ try{ const [salt,h] = String(stored).split(':'); const c = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return crypto.timingSafeEqual(Buffer.from(h,'hex'), Buffer.from(c,'hex')); }catch(e){ return false; } }

// ── signed session cookie ──
function sign(payloadObj){ const p = Buffer.from(JSON.stringify(payloadObj)).toString('base64url'); const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); return p+'.'+sig; }
function verify(token){ try{ const [p,sig] = String(token).split('.'); const exp = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp))) return null; const o = JSON.parse(Buffer.from(p,'base64url').toString()); if(o.exp && Date.now() > o.exp) return null; return o; }catch(e){ return null; } }
function cookies(req){ const h = req.headers.cookie||''; const o={}; h.split(';').forEach(s=>{ const i=s.indexOf('='); if(i>0) o[s.slice(0,i).trim()] = decodeURIComponent(s.slice(i+1).trim()); }); return o; }
function session(req){ return verify(cookies(req).sess||''); }

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8' };
function readBody(req, cb){ let ch=[], n=0; req.on('data',c=>{ n+=c.length; if(n>20*1024*1024){req.destroy();return;} ch.push(c); }); req.on('end',()=>cb(Buffer.concat(ch).toString('utf8'))); }
function J(res, code, obj, extra){ const h=Object.assign({'Content-Type':'application/json; charset=utf-8'}, extra||{}); res.writeHead(code,h); res.end(JSON.stringify(obj)); }
// Deep-merge a plain-object patch onto target · patch={p:{key:{v:val}|{m:subdiff}}, d:[deletedKeys]}
function applyObj(target, diff){
  const p=(diff&&diff.p)||{}, d=(diff&&diff.d)||[];
  Object.keys(p).forEach(k=>{ const e=p[k]||{};
    if('v' in e) target[k]=e.v;
    else if('m' in e){ if(!target[k]||typeof target[k]!=='object'||Array.isArray(target[k])) target[k]={}; applyObj(target[k], e.m); } });
  d.forEach(k=>{ delete target[k]; });
}
// Merge a client diff onto the server blob (concurrent-safe per record + per object sub-key).
// diff = { sets:{key:value|null}, cols:{key:{idf,up,del}}, objs:{key:{p,d}} }
function applyDiff(blob, diff){
  const sets = (diff && diff.sets) || {}, cols = (diff && diff.cols) || {}, objs = (diff && diff.objs) || {};
  Object.keys(sets).forEach(k=>{ const v=sets[k]; if(v===null) delete blob[k]; else blob[k]=v; });
  Object.keys(objs).forEach(k=>{ if(!blob[k]||typeof blob[k]!=='object'||Array.isArray(blob[k])) blob[k]={}; applyObj(blob[k], objs[k]); });
  Object.keys(cols).forEach(k=>{ const c=cols[k]||{}; const idf=c.idf||'id';
    const arr = Array.isArray(blob[k]) ? blob[k] : [];
    const map = new Map(); let n=0;
    arr.forEach(x=>{ if(x && x[idf]!=null) map.set(String(x[idf]), x); else map.set('__noid_'+(n++), x); });
    (c.up||[]).forEach(rec=>{ if(rec && rec[idf]!=null) map.set(String(rec[idf]), rec); });
    (c.del||[]).forEach(id=>{ map.delete(String(id)); });
    blob[k] = Array.from(map.values());
  });
}

const server = http.createServer((req, res) => {
  const u = (req.url||'/').split('?')[0];
  const q = (req.url||'').split('?')[1]||'';

  // ───── AUTH ─────
  if(u === '/api/login' && req.method === 'POST'){
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let b={}; try{ b=JSON.parse(body); }catch(e){}
      pool.query('SELECT * FROM users WHERE lower(username)=lower($1)', [String(b.username||'').trim()])
        .then(r => { const usr=r.rows[0];
          if(!usr || !verifyPw(b.password||'', usr.pass_hash)) return J(res,401,{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'});
          const perms = parsePerms(usr.perms);
          const tok = sign({uid:usr.id, username:usr.username, name:usr.name, role:usr.role, perms:perms, exp:Date.now()+SESS_DAYS*864e5});
          J(res,200,{username:usr.username,name:usr.name,role:usr.role,perms:perms}, {'Set-Cookie':`sess=${tok}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${SESS_DAYS*86400}`});
        }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u === '/api/logout'){ J(res,200,{ok:true},{'Set-Cookie':'sess=; HttpOnly; Path=/; Max-Age=0'}); return; }
  if(u === '/api/me'){ const s=session(req); return s ? J(res,200,{username:s.username,name:s.name,role:s.role,perms:(s.perms!==undefined?s.perms:null)}) : J(res,401,{error:'not logged in'}); }

  // ───── DATA (require login) ─────
  if(u === '/api/load'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    pool.query('SELECT data,version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r => r.rows[0] ? J(res,200,{data:r.rows[0].data,version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at})
                           : J(res,200,{data:null,version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/version'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r=>J(res,200, r.rows[0]?{version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at}:{version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/save' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let payload; try{ payload=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      const base = (payload.baseVersion==null ? -1 : payload.baseVersion);
      pool.query('SELECT data,version FROM app_state WHERE id=$1',[STATE_KEY]).then(r=>{
        const curVer = r.rows[0] ? r.rows[0].version : 0;
        let blob={}; if(r.rows[0] && r.rows[0].data){ try{ blob=JSON.parse(r.rows[0].data); }catch(e){ blob={}; } }
        const behind = (base !== -1 && base < curVer);   // others saved since this client loaded → recommend refresh
        if(payload.full && typeof payload.full==='string'){ try{ blob=JSON.parse(payload.full); }catch(e){ return J(res,400,{error:'bad full'}); } }   // seed/first push
        else { try{ applyDiff(blob, payload.diff||{}); }catch(e){ return J(res,400,{error:'bad diff: '+e.message}); } }
        const nv = curVer+1, out = JSON.stringify(blob);
        pool.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=$3, updated_by=$4, updated_at=now()',[STATE_KEY,out,nv,s.username])
          .then(()=>J(res,200,{ok:true,version:nv,behind:behind,bytes:out.length})).catch(e=>J(res,500,{error:e.message}));
      }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }

  // ───── ADMIN: user management (admin only) ─────
  if(u === '/api/users'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    if(!pool) return J(res,503,{error:'no database'});
    if(req.method === 'GET'){ pool.query('SELECT id,username,name,role,perms,created_at FROM users ORDER BY id').then(r=>J(res,200,{users:r.rows.map(x=>({id:x.id,username:x.username,name:x.name,role:x.role,perms:parsePerms(x.perms),created_at:x.created_at}))})).catch(e=>J(res,500,{error:e.message})); return; }
    if(req.method === 'POST'){ readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const un=String(b.username||'').trim(); if(!un||!b.password) return J(res,400,{error:'ต้องมี username + password'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      pool.query('INSERT INTO users(username,pass_hash,name,role,perms) VALUES($1,$2,$3,$4,$5)',[un,hashPw(b.password),(b.name||un),(b.role==='admin'?'admin':'staff'),permsStr])
        .then(()=>J(res,200,{ok:true})).catch(e=>J(res, e.code==='23505'?409:500, {error: e.code==='23505'?'username นี้มีอยู่แล้ว':e.message})); }); return; }
    if(req.method === 'DELETE'){ const id=parseInt((q.match(/id=(\d+)/)||[])[1]||'0',10); if(!id) return J(res,400,{error:'no id'}); if(id===s.uid) return J(res,400,{error:'ลบบัญชีตัวเองไม่ได้'});
      pool.query('DELETE FROM users WHERE id=$1',[id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); return; }
  }
  if(u === '/api/users/password' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} if(!b.id||!b.password) return J(res,400,{error:'no id/password'});
      pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2',[hashPw(b.password),parseInt(b.id,10)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }); return;
  }
  if(u === '/api/users/perms' && req.method === 'POST'){   // admin sets a user's area access · role optional
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const id=parseInt(b.id,10); if(!id) return J(res,400,{error:'no id'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      if(b.role==='admin'||b.role==='staff'){ pool.query('UPDATE users SET perms=$1, role=$2 WHERE id=$3',[permsStr,b.role,id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
      else { pool.query('UPDATE users SET perms=$1 WHERE id=$2',[permsStr,id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
    }); return;
  }

  // ───── static files ─────
  let p = decodeURIComponent(u); if(p==='/'||p==='') p='/allotment_v2/allotment_v2.html';
  const fp = path.normalize(path.join(ROOT,p));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp,(err,data)=>{ if(err){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}); res.end(data); });
});
server.listen(PORT, ()=>console.log('LOVE Andaman on '+PORT+(pool?' · db on':' · db off')));
