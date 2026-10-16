// Row 155 · flRenderProjects ran flProjMigrate(false) on every draw.  Its sweeps auto-link scheduled jobs to a
// project, auto-CREATE a project for any unlinked scheduled job or dry-dock boat-log entry and back-fill one-shot
// fields - all in memory (flSave is a no-op in ops mode), so the Projects screen showed phantom projects with
// browser-made ids the server never had.  In ops mode the sweep is a no-op: the server owns parent_project_id
// (PATCH /v1/fleet/jobs/:id) and the project list (GET /v1/fleet/projects).
//   node --test test/unit/ops-fleet-project-sweeps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.FLEETDAILY_SRC || 'allotment_v2/js/ops/26-ops-fleet-daily.js', 'utf8');

function load(enabled) {
  const FL_PROJECTS = [{ id: 'server_1' }];
  const swept = [];
  const window = {
    laOps: new Proxy({ enabled: () => enabled, today: () => '2026-10-15', shift: () => '2026-10-01', onChange: () => {} },
      { get: (t, k) => (k in t ? t[k] : async () => ({})) }),   // the boot load in ops mode reads empty lists
    flProjMigrate: (force) => { swept.push(force); FL_PROJECTS.push({ id: 'phantom_' + FL_PROJECTS.length }); return { created: 1 }; },
  };
  vm.runInNewContext(SOURCE, {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN, Math,
    FL_PROJECTS,
  });
  return { window, FL_PROJECTS, swept };
}

test('ops mode: the render-time sweep and the re-scan button create nothing and skip the legacy body', () => {
  const rt = load(true);
  const a = rt.window.flProjMigrate(false);
  const b = rt.window.flProjMigrate(true);
  assert.equal(a.created, 0);
  assert.equal(b.linked, 0);
  assert.deepEqual(rt.swept, []);
  assert.deepEqual(rt.FL_PROJECTS.map((p) => p.id), ['server_1']);
});

test('legacy mode: the original sweep runs', () => {
  const rt = load(false);
  rt.window.flProjMigrate(false);
  assert.deepEqual(rt.swept, [false]);
  assert.equal(rt.FL_PROJECTS.length, 2);
});
