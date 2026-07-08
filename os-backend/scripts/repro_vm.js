'use strict';
// Run the allotment app script in a Node vm with a stub DOM + real live data,
// then exercise Booking-view render paths for 2026-07-09 to find the forEach crash.
//   node scripts/repro_vm.js [date]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATE = process.argv[2] || '2026-07-09';
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'allotment_v2', 'allotment_v2.html'), 'utf8');
const blobTxt = fs.readFileSync(path.join(ROOT, 'allotment_v2', 'data_exports', 'live_blob_20260708.json'), 'utf8');

// ---- extract inline <script> blocks (skip src=) ----
const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);
console.log('inline script blocks:', scripts.length, 'total', (scripts.join('').length / 1048576).toFixed(2), 'MB');

// ---- stub DOM ----
function el(tag) {
  const e = {
    tagName: (tag || 'div').toUpperCase(), children: [], style: {}, dataset: {},
    innerHTML: '', textContent: '', value: '', checked: false, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {}, insertBefore(c) { return c; },
    querySelector: () => null, querySelectorAll: () => [], getElementsByClassName: () => [], closest: () => null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, focus() {}, blur() {}, click() {}, scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    scrollTop: 0, scrollLeft: 0, offsetHeight: 0, offsetWidth: 0, clientHeight: 800, clientWidth: 1200,
    parentElement: null, parentNode: null, nextSibling: null, previousSibling: null, firstChild: null,
    getContext: () => null, cloneNode() { return el(tag); }, contains: () => false,
    content: null, attributes: [],
  };
  return e;
}
const byId = {};
const document = {
  getElementById: id => (byId[id] = byId[id] || el('div')),
  createElement: t => el(t), createTextNode: () => el('text'), createDocumentFragment: () => el('frag'),
  querySelector: () => null, querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [],
  addEventListener() {}, removeEventListener() {},
  body: el('body'), head: el('head'), documentElement: el('html'),
  title: '', readyState: 'complete', activeElement: null, hidden: false, visibilityState: 'visible',
  createEvent: () => ({ initEvent() {} }),
};
document.documentElement.setAttribute = () => {};
const storage = { _d: { loveandaman_v2: blobTxt } };
const localStorage = {
  getItem: k => (k in storage._d ? storage._d[k] : null),
  setItem: (k, v) => { storage._d[k] = String(v); },
  removeItem: k => { delete storage._d[k]; },
  key: i => Object.keys(storage._d)[i] || null,
  get length() { return Object.keys(storage._d).length; },
  clear() { storage._d = {}; },
};
const noop = () => {};
const sandbox = {
  console: { log: noop, warn: noop, error: noop, info: noop, debug: noop, table: noop, group: noop, groupEnd: noop },
  document, localStorage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'node-repro', language: 'en', clipboard: { writeText: () => Promise.resolve() } },
  screen: { width: 1920, height: 1080 },
  location: { href: 'http://localhost:8765/allotment_v2.html', origin: 'http://localhost:8765', pathname: '/allotment_v2.html', search: '', hash: '', protocol: 'http:', host: 'localhost:8765', reload() {} },
  history: { pushState() {}, replaceState() {} },
  fetch: () => Promise.reject(new Error('offline-repro')),
  XMLHttpRequest: function () { return { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} }; },
  setTimeout: (fn) => 0,        // don't run deferred boot hooks — we drive renders manually
  clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  alert: m => console.log('[alert]', String(m).slice(0, 160)), confirm: () => false, prompt: () => null,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop }),
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
  MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
  IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
  EventSource: function () { return { addEventListener() {}, close() {} }; },
  Image: function () { return el('img'); },
  FileReader: function () { return { readAsDataURL() {}, addEventListener() {} }; },
  URL: Object.assign(function (u) { return { href: String(u) }; }, { createObjectURL: () => 'blob:x', revokeObjectURL: noop }),
  Blob: function () {},
  performance: { now: () => Date.now() },
  innerWidth: 1440, innerHeight: 900, scrollX: 0, scrollY: 0, scrollTo: noop, open: () => null, print: noop,
  btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
  structuredClone: x => JSON.parse(JSON.stringify(x)),
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Promise, Map, Set, WeakMap, WeakSet, Symbol, Intl, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape: global.escape, unescape: global.unescape, NaN, Infinity, undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.top = sandbox;
vm.createContext(sandbox);

// ---- load app scripts ----
let loaded = 0, failed = 0;
for (const [i, src] of scripts.entries()) {
  try { vm.runInContext(src, sandbox, { filename: 'inline-' + i + '.js', timeout: 120000 }); loaded++; }
  catch (e) { failed++; console.log('script block', i, 'threw during load:', String(e.message).slice(0, 200)); }
}
console.log('loaded', loaded, 'blocks ·', failed, 'failed');
const RUN = (code) => vm.runInContext(code, sandbox, { timeout: 120000 });
console.log('SB_BOOKINGS:', RUN('typeof SB_BOOKINGS!=="undefined" ? SB_BOOKINGS.length : "undef"'),
  '· bkV2Render:', RUN('typeof bkV2Render'));

// ---- drive the Booking view (all inside the vm) ----
function attempt(label, code) {
  try { const r = RUN('(function(){ '+code.replace(/const h=/g,'var h=').replace(/; h$/,'; return h;').replace(/:'ok'$/, ":'ok'")+' })()'); console.log('OK  ', label, typeof r === 'string' ? ('html ' + r.length) : ''); }
  catch (e) {
    console.log('FAIL', label, '→', e.message);
    console.log((e.stack || '').split('\n').slice(0, 10).map(s => '     ' + s.trim()).join('\n'));
  }
}
RUN(`_bkV2.tab='bytrip'; _bkV2.filterDate='${DATE}'; if(typeof _bkV2T2Cursor!=='undefined') _bkV2T2Cursor='${DATE.slice(0,7)}';`);
attempt('bkV2RenderTab2 ' + DATE, 'bkV2RenderTab2()');

// van + boat assign modes hit different code paths
attempt('bytrip vanMode', `_bkV2.vanAssignMode=true; const h=bkV2RenderTab2(); _bkV2.vanAssignMode=false; h`);
attempt('bytrip boatMode', `_bkV2.boatAssignMode=true; const h=bkV2RenderTab2(); _bkV2.boatAssignMode=false; h`);

attempt('bkV2RenderCalendar', 'typeof bkV2RenderCalendar==="function" ? bkV2RenderCalendar() : "n/a"');
attempt('bkV2Render (bytrip full)', 'bkV2Render(); "ok"');
console.log('boundary shown:', /render error/i.test(RUN('document.getElementById("bkv2-host").innerHTML') || ''));

const ids = RUN(`JSON.stringify(SB_BOOKINGS.filter(b=>(b.trips||[]).some(t=>t.date==='${DATE}')).map(b=>b.id))`);
const list = JSON.parse(ids);
console.log('bookings on', DATE, ':', list.length);
for (const id of list) {
  attempt('detail ' + id, `_bkV2.tab='bytrip'; _bkV2.detailId='${id}'; bkV2Render(); const h=document.getElementById('bkv2-host').innerHTML; _bkV2.detailId=null; /render error/i.test(h)?(()=>{throw new Error('boundary error shown')})():'ok'`);
}
for (const id of list) {
  attempt('edit ' + id, `bkV2EditBooking('${id}'); const h=document.getElementById('bkv2-host').innerHTML; _bkV2.newBooking=null; _bkV2.editingId=null; _bkV2.detailId=null; /render error/i.test(h)?(()=>{throw new Error('boundary error shown')})():'ok'`);
}
console.log('done');
