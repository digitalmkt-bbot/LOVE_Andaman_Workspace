// LOVE Andaman · static server for Railway (zero-dependency Node)
// Serves the workspace; root → the allotment_v2 app.
// Optional HTTP Basic Auth: set env APP_USER + APP_PASS on Railway to gate the public URL.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const USER = process.env.APP_USER || '';
const PASS = process.env.APP_PASS || '';

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
  if(!USER) return true;                         // no creds configured → open
  const h = req.headers.authorization || '';
  const m = h.match(/^Basic (.+)$/);
  if(!m) return false;
  const [u, p] = Buffer.from(m[1], 'base64').toString().split(':');
  return u === USER && p === PASS;
}

http.createServer((req, res) => {
  if(!authed(req)){
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="LOVE Andaman"' });
    return res.end('Authentication required');
  }
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if(p === '/' || p === '') p = '/allotment_v2/allotment_v2.html';
  const fp = path.normalize(path.join(ROOT, p));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (err, data) => {
    if(err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('LOVE Andaman app serving on port ' + PORT + (USER ? ' · Basic Auth ON' : ' · no auth')));
