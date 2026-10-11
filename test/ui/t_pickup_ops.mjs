// §opsPickup · Pickup Setup against the real operation-backend in-process store.
// Run from the frontend repo:
//   node test/ui/t_pickup_ops.mjs
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.stdout.on('data', b => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(timer); resolve(+m[1]); } });
  backend.stderr.on('data', b => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const login = await (await fetch(OPS + '/v1/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ username:'tester', password:'pw' }) })).json();
const token = login.access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers:{ authorization:'Bearer ' + token, 'content-type':'application/json', ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const body = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(body)}`);
  return body;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel:'chrome' });
const ctx = await browser.newContext({ viewport:{ width:1440, height:900 } });
await ctx.addInitScript(t => sessionStorage.setItem('la_ops_token', t), token);
await ctx.route(PROD, async route => {
  const req = route.request(), u = new URL(req.url());
  const r = await fetch(OPS + u.pathname + u.search, {
    method:req.method(),
    headers:{ authorization:req.headers().authorization || '', ...(req.headers()['content-type'] ? {'content-type':req.headers()['content-type']} : {}) },
    body:['GET','HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined)
  });
  await route.fulfill({ status:r.status, headers:{'content-type':r.headers.get('content-type') || 'application/json', 'access-control-allow-origin':'*'}, body:r.status === 204 ? '' : Buffer.from(await r.arrayBuffer()) });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|assets\//.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', d => d.accept());
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const failures = [];
const ok = (name, condition, details) => {
  console.log((condition ? '  ✓ ' : '  ✗ ') + name + (condition ? '' : ' → ' + JSON.stringify(details).slice(0, 500)));
  if (!condition) failures.push(name);
};
try {
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/pickup-setup`);
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout:30000 });
  await page.waitForFunction(() => window.laOps.pickup && window.laOps.pickup.isReady(), null, { timeout:30000 });
  await page.waitForTimeout(500);

  let s = await ev(() => ({ areas:SB_PICKUP_AREAS.length, profiles:SB_PICKUP_TIME_PROFILES.length, flat:Object.keys(SB_PICKUP_TIMES || {}).length, text:document.querySelector('#psu-host')?.innerText || '' }));
  ok('Pickup Setup hydrates from API before editing', s.areas === 0 && s.profiles === 0 && s.flat === 0 && /Pickup Setup/.test(s.text), s);

  const pickupCacheBefore = await ev(() => localStorage.getItem('loveandaman_v2'));
  const areaName = 'Ops Pickup C2 ' + Date.now();
  await ev(name => {
    psuOpenAddArea();
    Object.assign(_psuAreaDraft, { name, zone:'PK', region:'test-region', timeGroup:'C2-TEST' });
    return psuSaveArea();
  }, areaName);
  await idle();
  let areas = await api('/v1/pickup-areas?active=true');
  const area = areas.areas.find(x => x.name === areaName);
  s = await ev(id => ({ area:SB_PICKUP_AREAS.find(x => x.id === id), persisted:localStorage.getItem('loveandaman_v2') }), area.id);
  ok('area create uses POST and replaces the local projection after success', area && s.area && s.area.id === area.id && s.area.timeGroup === 'C2-TEST' && s.persisted === pickupCacheBefore, s);

  const profileName = 'Ops C2 Profile ' + Date.now();
  await ev(name => {
    psuOpenNewProfile(false);
    Object.assign(_psuProfileDraft, { name, from:'2055-01-01', to:'2055-12-31', notes:'C2 test' });
    return psuSaveProfile();
  }, profileName);
  await idle();
  let detail = await api('/v1/pickup-time-profiles');
  const profile = detail.profiles.find(x => x.name === profileName);
  ok('profile create uses POST with snake_case dates', !!profile && profile.from_date === '2055-01-01' && profile.to_date === '2055-12-31', profile);

  await ev(({ pid, aid }) => { _psuActiveProfileId = pid; return psuSetTimeCell('r5', aid, '07:00-07:15'); }, { pid:profile.id, aid:area.id });
  await idle();
  let profileDetail = await api('/v1/pickup-time-profiles/' + profile.id);
  let cell = profileDetail.times.find(x => x.route_id === 'r5' && x.target === area.id);
  ok('normal time cell maps to pickup_time + pickup_time_end', cell && cell.pickup_time === '07:00' && cell.pickup_time_end === '07:15' && !cell.pickup_at_pier, cell);

  await ev(({ pid, aid }) => { _psuActiveProfileId = pid; return psuSetTimeCell('r5', aid, 'Before 08:30 at pier'); }, { pid:profile.id, aid:area.id });
  await idle();
  profileDetail = await api('/v1/pickup-time-profiles/' + profile.id);
  cell = profileDetail.times.find(x => x.route_id === 'r5' && x.target === area.id);
  ok('pier deadline maps to pickup_time_end + pickup_at_pier', cell && cell.pickup_time_end === '08:30' && cell.pickup_at_pier === true && !cell.pickup_time, cell);

  const siblingName = 'Ops Pickup C2 Sibling ' + Date.now();
  await ev(name => {
    psuOpenAddArea();
    Object.assign(_psuAreaDraft, { name, zone:'PK', region:'test-region', timeGroup:'C2-TEST' });
    return psuSaveArea();
  }, siblingName);
  await idle();
  areas = await api('/v1/pickup-areas?active=true');
  const sibling = areas.areas.find(x => x.name === siblingName);
  profileDetail = await api('/v1/pickup-time-profiles/' + profile.id);
  cell = profileDetail.times.find(x => x.route_id === 'r5' && x.target === sibling.id);
  ok('new sibling area inherits its group cells on the server', !!sibling && cell && cell.pickup_time_end === '08:30' && cell.pickup_at_pier === true, { sibling, cell });

  const cloneName = 'Ops C2 Clone ' + Date.now();
  await ev(({ pid, name }) => {
    psuOpenCloneProfile(pid);
    Object.assign(_psuProfileDraft, { name, from:'2056-01-01', to:'2056-12-31' });
    return psuSaveProfile();
  }, { pid:profile.id, name:cloneName });
  await idle();
  detail = await api('/v1/pickup-time-profiles');
  const clone = detail.profiles.find(x => x.name === cloneName);
  const cloneDetail = clone && await api('/v1/pickup-time-profiles/' + clone.id);
  ok('profile clone uses clone_from and copies server cells', !!clone && clone.cloned_from === profile.id && cloneDetail.times.some(x => x.target === area.id), { clone, times:cloneDetail && cloneDetail.times });

  const resolved = await ev(({ aid }) => window.laOps.pickup.resolve('r5', aid, '2055-03-01'), { aid:area.id });
  ok('resolve endpoint returns the authoritative window', resolved && resolved.pickup_time_end === '08:30' && resolved.pickup_at_pier === true && resolved.target === area.id, resolved);
  const noResolve = await ev(({ aid }) => window.laOps.pickup.resolve('r5', aid, '2057-03-01').then(() => 'unexpected', e => ({ status:e.status, code:e.code })), { aid:area.id });
  ok('resolve 404 rejects without a local fallback', noResolve && noResolve.status === 404, noResolve);

  await ev(id => psuDeleteArea(id), sibling.id);
  await idle();
  areas = await api('/v1/pickup-areas?active=true');
  ok('area delete is a server soft-delete', !areas.areas.some(x => x.id === sibling.id), areas);

  await ev(id => psuDeleteProfile(id), clone.id);
  await idle();
  detail = await api('/v1/pickup-time-profiles');
  ok('profile delete removes the server profile', !detail.profiles.some(x => x.id === clone.id), detail);
  ok('no browser errors during pickup integration', errors.length === 0, errors);
} finally {
  await browser.close();
  srv.close();
  backend.kill();
}
console.log(failures.length ? `\n✗ ${failures.length} failed` : '\n✓ pickup integration passed');
process.exit(failures.length ? 1 : 0);
