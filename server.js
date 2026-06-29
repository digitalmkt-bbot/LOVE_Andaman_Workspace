// LOVE Andaman · static server + cloud-sync API for Railway (Postgres)
// Serves the app; /api/load + /api/save persist the whole localStorage blob (loveandaman_v2) in Postgres.
// Optional HTTP Basic Auth: set APP_USER + APP_PASS to gate everything.
const http = require('http');
const fs   = require('fs');
const path = require('path');

let Pool = null;
try { Pool = require('pg').Pool; } catch(e){ console.warn('[db] pg not installed — cloud sync disabled'); }

const ROOT   = __dirname;
const PORT   = process.env.PORT || 3000;
const USER   = process.env.APP_USER || '';
const PASS   = process.env.APP_PASS || '';
const DB_URL = process.env.DATABASE_URL || '';
const STATE_KEY = 'loveandaman_v2';

let pool = null;
if (Pool && DB_URL) {
  pool = new Pool({
    connectionString: DB_URL,
    ssl: (DB_URL.includes('proxy.rlwy') || DB_URL.includes('railway') || process.env.PGSSL) ? { rejectUnauthorized: false } : false
  });
  pool.query('CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data TEXT, updated_at TIMESTAMPTZ DEFAULT now())')
    .then(() => console.log('[db] ready'))
    .catch(e => console.error('[db] init failed:', e.message));
} else {
  console.warn('[db] no DATABASE_URL — cloud sync endpoints will return 503');
}

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webp':'image/webp',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv':'text/csv; charset=utf-8', '.txt':'text/plain; charset=utf-8'
};

function authed(req){
  if(!USER) return true;
  const m = (req.headers.authorization || '').match(/^Basic (.+)$/);
  if(!m) return false;
  const [u, p] = Buffer.from(m[1], 'base64').toString().split(':');
  return u === USER && p === PASS;
}
function readBody(req, cb){
  let chunks = [], size = 0;
  req.on('data', c => { size += c.length; if(size > 15*1024*1024){ req.destroy(); return; } chunks.push(c); });
  req.on('end', () => cb(Buffer.concat(chunks).toString('utf8')));
}
function sendJSON(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(obj)); }

http.createServer((req, res) => {
  if(!authed(req)){ res.writeHead(401, {'WWW-Authenticate':'Basic realm="LOVE Andaman"'}); return res.end('Authentication required'); }
  const u = (req.url || '/').split('?')[0];

  // ── Cloud-sync API (whole-blob, last-write-wins) ──
  if(u === '/api/load'){
    if(!pool) return sendJSON(res, 503, {error:'no database'});
    pool.query('SELECT data, updated_at FROM app_state WHERE id=$1', [STATE_KEY])
      .then(r => r.rows[0] ? sendJSON(res, 200, {data:r.rows[0].data, updated_at:r.rows[0].updated_at})
                           : sendJSON(res, 200, {data:null}))
      .catch(e => sendJSON(res, 500, {error:e.message}));
    return;
  }
  if(u === '/api/save' && req.method === 'POST'){
    if(!pool) return sendJSON(res, 503, {error:'no database'});
    readBody(req, body => {
      try { JSON.parse(body); } catch(e){ return sendJSON(res, 400, {error:'invalid JSON'}); }
      pool.query('INSERT INTO app_state(id,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=now()', [STATE_KEY, body])
        .then(() => sendJSON(res, 200, {ok:true, bytes:body.length}))
        .catch(e => sendJSON(res, 500, {error:e.message}));
    });
    return;
  }

  // ── Static files ──
  let p = decodeURIComponent(u);
  if(p === '/' || p === '') p = '/allotment_v2/allotment_v2.html';
  const fp = path.normalize(path.join(ROOT, p));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (err, data) => {
    if(err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('LOVE Andaman on port ' + PORT + (USER?' · auth ON':'') + (pool?' · cloud sync ON':' · cloud sync OFF')));
