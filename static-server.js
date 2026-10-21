#!/usr/bin/env node
/*
 * Integration frontend host. This intentionally has no legacy API, database,
 * session, migration, OIDC, proxy, or embed-token behaviour from server.js.
 * The browser talks to operation-backend directly via laOpsFetch.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT) || 3000;
const APP = '/allotment_v2/allotment_v2.html';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon', '.pdf':'application/pdf', '.woff2':'font/woff2' };

// §compress · text assets go out brotli/gzip (the app's JS is ~10MB raw, ~1.5MB compressed). Compressed once per file
// version, kept in memory, shared by concurrent requests · versioned URLs are immutable so one copy per process is enough.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);
const packed = new Map();
function pack(target, stat, enc){
  const key = enc + ':' + target + ':' + stat.mtimeMs + ':' + stat.size;
  let p = packed.get(key);
  if(!p){
    p = fs.promises.readFile(target).then((raw) => new Promise((ok, fail) => {
      const done = (e, buf) => e ? fail(e) : ok(buf);
      if(enc === 'br') zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }, done);
      else zlib.gzip(raw, { level: 9 }, done);
    }));
    p.catch(() => packed.delete(key));
    packed.set(key, p);
  }
  return p;
}
function redirect(res, location){ res.writeHead(302, { Location:location, 'Cache-Control':'no-store' }); res.end(); }
function send(res, code, body){ res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); res.end(body); }
function filePath(urlPath){
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch (_) { return null; }
  if(decoded.includes('\0')) return null;
  const target = path.resolve(ROOT, '.' + decoded);
  return target === ROOT || target.startsWith(ROOT + path.sep) ? target : null;
}

http.createServer((req, res) => {
  if(req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (_) { return send(res, 400, 'Bad request'); }
  if(url.pathname === '/') return redirect(res, APP + url.search);
  // Local static-server compatibility and a friendlier direct frontend URL.
  if(url.pathname === '/allotment_v2.html') return redirect(res, APP + url.search);
  if(url.pathname === '/health') { res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end('{"ok":true,"service":"operation-frontend"}'); }

  const target = filePath(url.pathname);
  if(!target) return send(res, 403, 'Forbidden');
  fs.stat(target, (statError, stat) => {
    if(statError || !stat.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(target).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
    const accept = String(req.headers['accept-encoding'] || '');
    const enc = COMPRESSIBLE.has(ext) && stat.size > 1024 ? (/\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null) : null;
    if(enc){
      return pack(target, stat, enc).then((buf) => {
        res.writeHead(200, {'Content-Type': MIME[ext], 'Content-Encoding':enc, 'Content-Length':buf.length, 'Vary':'Accept-Encoding', 'Cache-Control':cache, 'X-Content-Type-Options':'nosniff'});
        res.end(req.method === 'HEAD' ? undefined : buf);
      }, () => send(res, 500, 'Read error'));
    }
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length':stat.size, 'Cache-Control':cache, 'X-Content-Type-Options':'nosniff'});
    if(req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => send(res, 500, 'Read error')).pipe(res);
  });
}).listen(PORT, () => {
  console.log('Operation frontend static host on ' + PORT);
  // warm the compressed copies in the background so the first visitor doesn't wait for brotli on a 4MB file
  (async () => {
    const todo = [];
    (function walk(d){
      for(const e of fs.readdirSync(d, { withFileTypes:true })){
        const p = path.join(d, e.name);
        if(e.isDirectory()){ if(e.name !== 'node_modules' && e.name !== 'data_exports' && e.name !== 'BACKUP') walk(p); }
        else if(COMPRESSIBLE.has(path.extname(e.name).toLowerCase())) todo.push(p);
      }
    })(path.join(ROOT, 'allotment_v2', 'js'));
    todo.push(path.join(ROOT, 'allotment_v2', 'allotment_v2.html'));
    for(const p of todo){
      try { const st = fs.statSync(p); if(st.size > 1024){ await pack(p, st, 'br'); await pack(p, st, 'gzip'); } } catch (_) {}
    }
    console.log('Compressed ' + todo.length + ' files');
  })();
});
