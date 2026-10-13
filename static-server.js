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

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT) || 3000;
const APP = '/allotment_v2/allotment_v2.html';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon', '.pdf':'application/pdf', '.woff2':'font/woff2' };

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
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length':stat.size, 'Cache-Control':cache, 'X-Content-Type-Options':'nosniff'});
    if(req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => send(res, 500, 'Read error')).pipe(res);
  });
}).listen(PORT, () => console.log('Operation frontend static host on ' + PORT));
