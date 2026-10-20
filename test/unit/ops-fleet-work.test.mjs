import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runtime, plain } from './fe-harness.mjs';

// FE-11: Fleet Work reads the server's oil board, closed jobs and job summary (answers built by the backend's own domain functions).
const A = JSON.parse(fs.readFileSync('test/unit/fixtures/fleet-work-answers.json', 'utf8'));
const PRE = `
var FL_MAINT = [{ id: 'j1', status: 'done', endDate: '2026-10-15', boatId: 'b1' }, { id: 'jold', no: 'MJ-0', title: 'Old', status: 'done', endDate: '2026-01-01', boatId: 'b1' }];
var FLW = { item: '' }; var redraws = 0; function flRenderWork(){ redraws++; }
function getBoat(id){ return { id: id, name: id === 'b1' ? 'Boat One' : 'Boat Two' }; }
var opened = []; function flwsOpen(k, i){ opened.push([k, i]); return 'legacy'; }
function flwOilRows(){ return ['legacy']; } function flwOilRate(){ return 'legacy'; } function flwDoneItems(){ return ['legacy']; }
function flwsData(){ return 'legacy'; } function flwsText(){ return 'legacy-text'; } function flwsShort(){ return 'legacy-short'; } function flwMemoLabel(m){ return 'legacy:' + m.status; }
`;
const H = {
  'GET /v1/fleet/oil-board': { body: A.oil },
  'GET /v1/fleet/work/done': { body: A.done },
  'GET /v1/fleet/work/summary': { body: A.summary },
};
function rt(handlers = H, enabled = true) {
  const r = runtime({ files: [], pre: PRE, handlers, enabled });
  r.O.activeView = () => 'fl-work'; r.O.busy = () => false;
  r.O.fleetJobs = { fromServerJob: (j) => ({ id: j.id, no: j.no, status: j.status, title: j.title }), fromServerIncident: (i) => ({ id: i.id, no: i.no, title: i.title }) };
  r.O.fleetPhotoFrom = (p) => ({ id: p.id, url: '/api/attach/' + p.attachment_id, removed: !!p.hidden, cap: p.caption });
  r.load('99-ops-fleet-work.js');
  return r;
}

test('oil board: a miss answers empty and asks once; the rows come back in legacy shape and the page is drawn again', async () => {
  const r = rt();
  assert.deepEqual(plain(r.ctx.flwOilRows()), []);
  await r.settle();
  assert.ok(r.ctx.redraws >= 1);
  const rows = plain(r.ctx.flwOilRows());
  assert.equal(r.requests.length, 1, 'one ask');
  assert.deepEqual(rows.map((x) => [x.b.id, x.st, x.pier, x.nNo]), A.oil.rows.map((x) => [x.boat.id, x.state, x.pier, x.no_data_count]));
  const b1 = rows[0];
  const w = A.oil.rows[0].worst;
  assert.deepEqual([b1.worst.e.id, b1.worst.ss.curH, b1.worst.ss.interval, b1.worst.ss.since, b1.worst.ss.left, b1.worst.noData], [w.id, w.hours, w.interval, w.since, w.left, false]);
  assert.equal(b1.worst.e.lastServiceDate, '2026-08-01');
  assert.deepEqual([b1.gb.g.id, typeof b1.gb.ss.left], ['g1', 'number']);
  assert.deepEqual([rows[1].mj.key, rows[1].mj.no], ['mj:j9', 'MJ-9'], 'the open oil job');
  assert.equal(r.ctx.flwOilRate('e1'), A.oil.rows[0].engines[0].rate);
});

test('closed jobs: the server list is mapped; a job closed long ago still opens from the Maintenance page', async () => {
  const r = rt();
  assert.deepEqual(plain(r.ctx.flwDoneItems('b1')), []);
  await r.settle();
  const items = plain(r.ctx.flwDoneItems('b1'));
  assert.deepEqual(items.map((i) => [i.key, i.kind, i.stage, i.done, i.boatId, i.cost]), [['dn:j1', 'mj', 6, true, 'b1', 100]]);
  assert.equal(items[0].ref.id, 'j1', 'the local job record when it is held');
  r.ctx.FLW.item = 'dn:jold';
  assert.deepEqual(plain(r.ctx.flwDoneItems('b1')).map((i) => i.key), ['dn:j1', 'dn:jold']);
  assert.match(r.requests[0].path, /boat_id=b1/);
});

test('summary: the sheet opens only after the answer; data, copy texts and the memo label are the server\'s', async () => {
  const r = rt();
  assert.equal(r.ctx.flwsData('mj', 'j1'), null, 'nothing before the answer');
  await r.ctx.flwsOpen('mj', 'j1');
  assert.deepEqual(plain(r.ctx.opened), [['mj', 'j1']]);
  assert.match(r.requests[0].path, /kind=job&id=j1/);
  const D = r.ctx.flwsData('mj', 'j1');
  assert.equal(D.m.id, 'j1'); assert.equal(D.inc.id, 'i1'); assert.equal(D.b.name, 'Boat One');
  assert.deepEqual([D.cost, D.pc, D.hidPk, D.log.length, D.photos.length, D.parts.length], [A.summary.cost, A.summary.parts_cost, A.summary.hidden_part_lines, A.summary.log.length, 1, 1]);
  assert.deepEqual(plain(D.log[0]), { d: A.summary.log[0].date, t: A.summary.log[0].text, by: A.summary.log[0].by, o: 0 });
  assert.equal(D.photos[0].url, '/api/attach/a1');
  assert.equal(r.ctx.flwsText(D), A.summary.text);
  assert.equal(r.ctx.flwsShort(D), A.summary.short_text);
  assert.equal(r.ctx.flwMemoLabel(D.memos[0]), A.summary.memos[0].label);
  assert.equal(r.ctx.flwMemoLabel({ status: 'x' }), 'legacy:x', 'a memo that is not the summary\'s keeps legacy\'s label');
  await r.ctx.flwsOpen('inc', 'i1');
  assert.match(r.requests[1].path, /kind=incident&id=i1/);
});

test('a refused summary is a toast and the sheet does not open; ops off is legacy', async () => {
  const r = rt({ 'GET /v1/fleet/work/summary': { status: 404, body: { statusCode: 404, message: 'Job not found' } } });
  await r.ctx.flwsOpen('mj', 'zz');
  assert.equal(r.ctx.opened.length, 0);
  assert.ok(r.toasts.some((t) => /Job not found/.test(t.sub)));
  const off = rt({}, false);
  assert.deepEqual(plain(off.ctx.flwOilRows()), ['legacy']);
  assert.equal(off.ctx.flwsText({}), 'legacy-text');
  assert.equal(off.requests.length, 0);
});
