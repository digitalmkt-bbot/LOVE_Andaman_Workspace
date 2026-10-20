import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// FE-4: the flp* functions go to /v1/fleet/{jobs|incidents|projects}/{id}/photos; the record is read again afterwards.
const PRE = `
var FLP_VID_MAX = 6*1024*1024;
var REC = {mj: {j1: {id:'j1', photos:[{id:'ph1', cap:'x', removed:false},{id:'ph2', cap:'y', removed:true}]}}, inc:{}, prj:{}};
function flpRec(k,i){ return (REC[k]||{})[i]||null; }
function flpFind(k,rec,pid){ return (rec.photos||[]).filter(function(p){ return p.id===pid; })[0]||null; }
function flpCan(){ return true; }
var refreshed = 0; function flpRefresh(){ refreshed++; }
var called = []; function legacy(n){ return function(){ called.push(n); }; }
var flpAdd = legacy('flpAdd'), flpAddUrl = legacy('flpAddUrl'), flpCap = legacy('flpCap'), flpHide = legacy('flpHide'), flpRestore = legacy('flpRestore'), flpPurge = legacy('flpPurge');
`;
function rt(handlers, globals = {}, enabled = true) {
  const r = runtime({ files: [], handlers, pre: PRE, globals, enabled });
  const reloads = [];
  r.O.fleetJobs = { reloadJob: (id) => { reloads.push(['job', id]); return Promise.resolve({}); }, reloadIncident: (id) => { reloads.push(['inc', id]); return Promise.resolve({}); } };
  r.O.fleetDaily = { reloadProject: (id) => { reloads.push(['prj', id]); return Promise.resolve({}); } };
  r.load('99-ops-fleet-photos.js');
  return { ...r, reloads };
}

test('hide / restore / purge / caption call the photo routes and read the job again', async () => {
  const h = {
    'POST /v1/fleet/jobs/j1/photos/ph1/hide': { body: { photos: [] } },
    'POST /v1/fleet/jobs/j1/photos/ph2/restore': { body: {} },
    'DELETE /v1/fleet/jobs/j1/photos/ph2': { status: 204 },
    'PATCH /v1/fleet/jobs/j1/photos/ph1': { body: {} },
  };
  const r = rt(h, { prompt: () => 'new cap' });
  r.ctx.flpHide('mj', 'j1', 'ph1'); await r.settle();
  r.ctx.flpRestore('mj', 'j1', 'ph2'); await r.settle();
  r.ctx.flpPurge('mj', 'j1', 'ph2'); await r.settle();
  r.ctx.flpCap('mj', 'j1', 'ph1'); await r.settle();
  assert.deepEqual(r.requests.map((q) => q.method + ' ' + q.path), Object.keys(h));
  assert.deepEqual(plain(r.requests[3].body), { caption: 'new cap' });
  assert.equal(r.reloads.length, 4);
  assert.ok(r.confirms.some((c) => /permanently/.test(c)), 'legacy confirm before delete');
});

test('a photo that is not hidden is not purged; a refused write shows the server message and reads nothing', async () => {
  const r = rt({ 'POST /v1/fleet/jobs/j1/photos/ph1/hide': { status: 409, body: { statusCode: 409, code: 'photo_hidden', message: 'The photo is already hidden' } } });
  r.ctx.flpPurge('mj', 'j1', 'ph1'); await r.settle();
  assert.equal(r.requests.length, 0);
  r.ctx.flpHide('mj', 'j1', 'ph1'); await r.settle();
  assert.equal(r.reloads.length, 0);
  assert.ok(r.toasts.some((t) => /already hidden/.test(t.sub)));
});

test('adding: files upload, then ONE photos call names them all; a clip over 6 MB is left out', async () => {
  const big = { type: 'video/mp4', size: 7 * 1048576, name: 'big.mp4' }, ok = { type: 'image/jpeg', size: 1000, name: 'a.jpg' }, ok2 = { type: 'video/mp4', size: 2000, name: 'b.mp4' };
  let up = 0;
  const g = {
    _flProjPickFiles: (acc, multi, cb) => cb([big, ok, ok2]),
    _flProjUploadAll: (files, owner, each, done) => { files.forEach((f) => each({ id: 'att' + (++up), name: f.name })); done(files.length); },
  };
  const r = rt({ 'POST /v1/fleet/incidents/i9/photos': { status: 201, body: { photos: [] } } }, g);
  r.ctx.REC.inc.i9 = { id: 'i9', photos: [] };
  r.ctx.flpAdd('inc', 'i9', ' note ');
  await r.settle();
  assert.match(r.alerts[0], /Video too large: big\.mp4/);
  assert.deepEqual(plain(r.requests.map((q) => q.body)), [{ attachment_ids: ['att1', 'att2'], note: 'note' }]);
  assert.deepEqual(r.reloads, [['inc', 'i9']]);
});

test('a pasted link sends the url and caption; ops off calls the legacy function', async () => {
  const answers = ['https://youtu.be/abcdefghij', 'My clip'];
  const r = rt({ 'POST /v1/fleet/projects/p1/photos': { status: 201, body: {} } }, { prompt: () => answers.shift() });
  r.ctx.REC.prj.p1 = { id: 'p1' };
  r.ctx.flpAddUrl('prj', 'p1'); await r.settle();
  assert.deepEqual(plain(r.requests[0].body), { url: 'https://youtu.be/abcdefghij', caption: 'My clip' });
  assert.deepEqual(r.reloads, [['prj', 'p1']]);
  const off = rt({}, {}, false);
  off.ctx.flpHide('mj', 'j1', 'ph1');
  assert.deepEqual(plain(off.ctx.called), ['flpHide']);
});
