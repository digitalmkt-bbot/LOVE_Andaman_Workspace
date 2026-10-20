// Shared harness for the sync/lk-inbox adapter tests: loads 00-ops-core.js and the adapters under test into one vm context
// with a fake laOpsFetch (handlers keyed 'METHOD /path' without the query string). Not a test file itself.
import fs from 'node:fs';
import vm from 'node:vm';

export const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
export const read = (f) => fs.readFileSync(f, 'utf8');

export function runtime({ files = [], handlers = {}, globals = {}, pre = '', enabled = true, confirm = () => true } = {}) {
  const requests = [], toasts = [], alerts = [], confirms = [];
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Map, Number, String, Math, Date, RegExp, Event: class { constructor(t) { this.type = t; } },
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    alert: (m) => alerts.push(String(m)),
    confirm: (m) => { confirms.push(String(m)); return confirm(m); },
    laSaveToast: (o) => toasts.push(plain(o)),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    setTimeout: (fn) => { Promise.resolve().then(fn); return 1; }, clearTimeout: () => {},
    ...globals,
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body, headers: opts.headers });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  vm.createContext(ctx);
  if (pre) vm.runInContext(pre, ctx);
  vm.runInContext(read('allotment_v2/js/ops/00-ops-core.js'), ctx);
  for (const f of files) vm.runInContext(read('allotment_v2/js/ops/' + f), ctx);
  const settle = async () => { for (let i = 0; i < 60; i++) await new Promise((r) => setImmediate(r)); };
  return { ctx, requests, toasts, alerts, confirms, settle, O: ctx.laOps };
}
