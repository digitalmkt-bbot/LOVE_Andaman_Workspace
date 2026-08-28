'use strict';
/**
 * Route-level API proxy — the switch that moves `/api` traffic to the new backend.
 *
 * Why a server-side proxy rather than a base URL in the client:
 *
 *   · allotment_v2 has no base URL to set. Every call is a hardcoded same-origin absolute path
 *     (`/api/load`, `/api/save`, `/api/v1/_batch`, `/api/me`, …, mostly in
 *     allotment_v2/js/01-auth-sync.js). There is nothing to repoint, and the app is classic
 *     <script src> files, so `import.meta.env.VITE_API_BASE_URL` does not exist there.
 *   · Cross-origin calls would need CORS with credentials AND session cookies re-issued as
 *     `SameSite=None; Secure`. Proxying keeps every request same-origin, so the existing
 *     `SameSite=Lax` cookie keeps working and nothing about auth changes.
 *   · It can move ONE route at a time. The new backend does not implement the whole surface yet,
 *     so an all-or-nothing switch would be an outage. `API_PROXY_ROUTES` is the strangler-fig seam:
 *     listed prefixes go upstream, everything else is still served locally by this process.
 *
 * Env:
 *   API_PROXY_URL        target origin, e.g. https://operationbackend-production.up.railway.app
 *                        Unset = this module does nothing at all.
 *   API_PROXY_ROUTES     comma-separated path prefixes to send upstream, e.g.
 *                        `/api/v1/rate-types,/api/agents`. Default `*` = every /api route.
 *   API_PROXY_TIMEOUT_MS default 30000.
 */
const http  = require('http');
const https = require('https');

const TARGET     = (process.env.API_PROXY_URL || '').trim().replace(/\/+$/, '');
const RAW_ROUTES = (process.env.API_PROXY_ROUTES || '').trim();
const TIMEOUT_MS = Math.max(1000, parseInt(process.env.API_PROXY_TIMEOUT_MS || '30000', 10) || 30000);

// Hop-by-hop headers are meaningful only on a single connection and must not be relayed
// (RFC 7230 §6.1). `host` is dropped separately because the upstream needs its OWN host for
// vhost routing — forwarding ours would make Railway serve the wrong service.
const HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization',
                     'te','trailer','transfer-encoding','upgrade','host']);

const ROUTES = RAW_ROUTES.split(',').map(s => s.trim()).filter(Boolean);
const ALL    = ROUTES.length === 0 || ROUTES.includes('*');

function enabled(){ return !!TARGET; }

/**
 * Only ever true for an /api path. A misconfigured route list must not be able to send the app
 * HTML, the JS bundle or /auth/* upstream — that would be an unexplainable white screen.
 */
function matches(pathname){
  if(!TARGET) return false;
  if(pathname !== '/api' && !pathname.startsWith('/api/')) return false;
  if(ALL) return true;
  return ROUTES.some(r => pathname === r || pathname.startsWith(r.replace(/\/+$/,'') + '/'));
}

function forward(req, res, pathname, query){
  let target;
  try { target = new URL(TARGET); }
  catch(e){ return fail(res, 'API_PROXY_URL is not a valid URL: ' + TARGET, pathname); }
  const isHttps = target.protocol === 'https:';
  const mod = isHttps ? https : http;

  const headers = {};
  for(const k of Object.keys(req.headers)) if(!HOP.has(k.toLowerCase())) headers[k] = req.headers[k];
  headers.host = target.host;
  // The upstream is behind our proxy now, so it can no longer see who the browser really asked for.
  // Without these it would build redirect/callback URLs pointing at ITSELF instead of at this app.
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
             || (req.socket && req.socket.encrypted ? 'https' : 'http');
  headers['x-forwarded-proto'] = proto;
  headers['x-forwarded-host']  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  headers['x-forwarded-for']   = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '')
                               + ((req.socket && req.socket.remoteAddress) || '');

  const base = target.pathname.replace(/\/+$/, '');   // supports a target with a path prefix
  const up = mod.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    method: req.method,
    path: base + pathname + (query ? '?' + query : ''),
    headers,
  }, r => {
    const out = {};
    for(const k of Object.keys(r.headers)) if(!HOP.has(k.toLowerCase())) out[k] = r.headers[k];
    res.writeHead(r.statusCode || 502, out);
    r.pipe(res);            // piped, not buffered — /api/events is an SSE stream and must not stall
  });

  up.setTimeout(TIMEOUT_MS, () => up.destroy(new Error('upstream did not respond within ' + TIMEOUT_MS + 'ms')));
  up.on('error', err => {
    // Once bytes are on the wire the status is already sent; the only honest signal left is to cut it.
    if(res.headersSent){ try{ res.destroy(); }catch(e){} return; }
    fail(res, err.message, pathname);
  });
  req.on('aborted', () => up.destroy());
  req.pipe(up);
}

function fail(res, message, pathname){
  console.error('[proxy] ' + (pathname || '') + ' -> ' + TARGET + ' failed: ' + message);
  res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'api proxy failed: ' + message, target: TARGET, path: pathname || null}));
}

function describe(){
  if(!TARGET) return null;
  return '[proxy] /api -> ' + TARGET + ' · routes: ' + (ALL ? '* (all)' : ROUTES.join(' '))
       + ' · timeout ' + TIMEOUT_MS + 'ms';
}

module.exports = { enabled, matches, forward, describe, _internal: { TARGET, ROUTES, ALL, HOP } };
