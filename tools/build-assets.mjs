#!/usr/bin/env node
// §assetBuild (2026-10-05) · smaller JS for allotment_v2, built at deploy time
//
//   npm run build:deploy     Railway's build step (railway.json buildCommand) · rewrites allotment_v2/ in place
//   npm run build:try        anywhere · copies allotment_v2/ to .build/ and builds there (LA_APP_ROOT=.build to test it)
//
// What it does, in order:
//   1. js/booking/*.js (one function per file, ~620 <script> tags) → js/booking.bundle.js, one tag.
//      Concatenated in the HTML's own order. Classic scripts share one global scope either way;
//      checked when this was written: no top-level let/const/class is declared twice, and only two
//      files run code at load (both harmless). Tags that are NOT in the main block stay as they are —
//      bookingV2LocalYMD.js loads ahead of 08-app.js on purpose (§loadOrder).
//   2. every js file → whitespace + comments removed (esbuild minifyWhitespace). NO renaming and no
//      syntax rewriting: ~2,500 inline onclick="" handlers call top-level functions by name, and a
//      mangled or inlined name would break them silently. Measured: 2.5MB → 1.8MB gzip, 1.27MB brotli.
//   3. every js/css <script>/<link> gets ?v= = first 8 hex of the BUILT file's md5 · the source's
//      hand-maintained ?v= stops mattering on deploy (it was easy to forget, see §assetVer).
//
// In-place mode rewrites files under allotment_v2/ · it refuses unless it is on Railway (or forced
// with LA_BUILD_IN_PLACE=1), so `npm run build` on a dev machine can't minify the working tree.
// If esbuild is missing it says so and leaves the files unminified · a deploy still serves.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'allotment_v2');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;

let APP;
if (outArg) {
  APP = path.resolve(outArg);
  fs.rmSync(APP, { recursive: true, force: true });
  fs.cpSync(SRC, APP, { recursive: true, filter: (p) => !/[\\/](BACKUP|data_exports)([\\/]|$)/.test(p) });
} else {
  // Railway's build container: Linux, project at /app, RAILWAY_* variables · any one of those is enough
  const onRailway = Object.keys(process.env).some((k) => k.startsWith('RAILWAY_')) || (process.platform === 'linux' && process.cwd() === '/app');
  if (!args.includes('--in-place') || (!onRailway && process.env.LA_BUILD_IN_PLACE !== '1')) {
    console.log('[build] skipping in-place build · it only runs in the Railway build (npm run build:deploy) · try it with: npm run build:try');
    process.exit(0);
  }
  APP = SRC;
}

const HTML = path.join(APP, 'allotment_v2.html');
let html = fs.readFileSync(HTML, 'utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const t0 = Date.now();

// ── 1 · bundle the main js/booking block ──
const lines = html.split(/\r?\n/);
const isBk = (l) => /^<script src="js\/booking\/[^"]+\.js(\?v=[^"]*)?"><\/script>\s*$/.test(l.trim());
let best = null;
for (let i = 0; i < lines.length; i++) {
  if (!isBk(lines[i])) continue;
  let j = i; while (j + 1 < lines.length && isBk(lines[j + 1])) j++;
  if (!best || j - i > best[1] - best[0]) best = [i, j];
  i = j;
}
let bundled = 0;
if (best && best[1] - best[0] >= 10) {
  const files = lines.slice(best[0], best[1] + 1).map((l) => /src="(js\/booking\/[^"?]+)/.exec(l)[1]);
  const parts = files.map((f) => '/* ' + f + ' */\n' + fs.readFileSync(path.join(APP, f), 'utf8') + '\n;\n');
  fs.writeFileSync(path.join(APP, 'js', 'booking.bundle.js'), parts.join(''));
  lines.splice(best[0], best[1] - best[0] + 1, '<script src="js/booking.bundle.js"></script>');
  html = lines.join(nl);
  bundled = files.length;
}

// ── 2 · minify ──
let esbuild = null;
try { esbuild = await import('esbuild'); } catch (_) { console.warn('[build] esbuild not installed · serving unminified'); }
const jsFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) jsFiles.push(p);
  }
})(path.join(APP, 'js'));
let before = 0, after = 0;
if (esbuild) {
  for (const f of jsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    before += Buffer.byteLength(src);
    // a file that esbuild can't handle is left as it is · one unminified file beats a broken deploy
    try {
      const r = await esbuild.transform(src, { minifyWhitespace: true, legalComments: 'none', charset: 'utf8', target: 'esnext', loader: 'js' });
      fs.writeFileSync(f, r.code); after += Buffer.byteLength(r.code);
    } catch (e) {
      console.warn('[build] left unminified: ' + path.relative(APP, f) + ' · ' + String(e.message).split('\n')[0]);
      after += Buffer.byteLength(src);
    }
  }
}

// ── 3 · ?v= from the built bytes ──
const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
let stamped = 0;
html = html.replace(/(<script\s+src="|<link\s+rel="stylesheet"\s+href=")((?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g, (m, a, rel, z) => {
  const p = path.join(APP, rel);
  if (!fs.existsSync(p)) return m;
  stamped++;
  return a + rel + '?v=' + md5(p) + z;
});
fs.writeFileSync(HTML, html);

const mb = (n) => (n / 1e6).toFixed(2) + 'MB';
console.log('[build] ' + (bundled ? bundled + ' booking files → js/booking.bundle.js · ' : '') +
  (esbuild ? jsFiles.length + ' js minified ' + mb(before) + ' → ' + mb(after) + ' · ' : '') +
  stamped + ' tags stamped · ' + (Date.now() - t0) + 'ms · ' + (outArg ? 'out ' + APP : 'in place'));
