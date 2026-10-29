// Daily Report e-mail: the legacy modal stays, the subject / HTML / text come from GET /v1/reports/daily/mail (the server composes
// them from the report; nothing is sent). The typed note and the ticked parts are sent with the request.
//   node --test test/unit/ops-daily-report-mail.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, DATE } from './dailyreport-harness.mjs';

const MAIL = { date: DATE, subject: 'Daily Report 15 Oct', html: '<table>server html</table>', text: 'server text', recipients_default: { to: 'a@x', cc: '' }, note: 'hi', sections: {} };

function setup({ fail = false, cfg = { to: 'a@x', cc: '', note: 'Dear team', inc: { ov: 1, bt: 1, vn: 0 } } } = {}) {
  const paints = [], toasts = [], origCalls = [], mailReads = [];
  const h = load({ extra: {
    _drMailOpen: false, clearTimeout, drMailCfg: () => cfg,
    drMailPaint() { paints.push({ subject: h.ctx.drMailSubject({ date: DATE }), html: h.ctx.drMailHTML({ date: DATE }) }); },
    drMailToast: (t) => toasts.push(t),
    drMailCopy() { origCalls.push('copy:' + h.ctx.drMailHTML({ date: DATE })); },
    drMailEml() { origCalls.push('eml'); }, drMailto() { origCalls.push('mailto'); },
    drmEnsureImgs() { origCalls.push('imgs'); },
    drMailSubject() { origCalls.push('legacy-subject'); return 'L'; }, drMailHTML() { return 'L'; }, drMailText() { return 'L'; },
  } });
  const get = h.ctx.laOps.get;
  h.ctx.laOps.get = (path, q) => {
    if (path !== '/v1/reports/daily/mail') return get(path, q);
    mailReads.push(q);
    return fail ? Promise.reject(new Error('boom')) : Promise.resolve({ ...MAIL });
  };
  return { h, paints, toasts, origCalls, mailReads };
}
// The adapter asks for the mail from a setTimeout(…, 0) (mailFor). Node runs that timer only once 1 ms has passed, and 20
// setImmediate turns can finish sooner on an idle machine, so the request was sometimes still waiting (a flaky copy test).
// Each turn now also waits a timer tick, which runs after any timer the adapter set before it.
const settle = async () => { for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setImmediate(r)); } };

test('opening the form asks the server for the mail of the open day, with the typed note and ticked parts, and repaints with it', async () => {
  const s = setup();
  s.h.ctx.drMailShow(); await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(s.mailReads)), [{ date: DATE, note: 'Dear team', sections: 'ov,bt' }]);
  assert.equal(s.h.ctx._drMailOpen, true);
  const last = s.paints[s.paints.length - 1];
  assert.equal(last.subject, 'Daily Report 15 Oct');
  assert.equal(last.html, '<table>server html</table>');
  assert.equal(s.h.localReads(), 0, "the browser's own booking list is not read");
  assert.equal(s.h.toasts.length, 0, 'no "not available" toast');
});

test('copy runs the legacy copy once the server mail is here; before that it only says it is preparing', async () => {
  const s = setup();
  s.h.ctx.drMailShow();
  s.h.ctx.drMailCopy();                                  // the answer has not landed yet
  assert.deepEqual(s.origCalls, []);
  assert.match(s.toasts[0], /Preparing/);
  await settle();
  s.h.ctx.drMailCopy(); s.h.ctx.drMailEml(); s.h.ctx.drMailto();
  assert.deepEqual(s.origCalls, ['copy:<table>server html</table>', 'eml', 'mailto']);
});

test('the chart-image preparation stays off (the server mail uses bar charts)', async () => {
  const s = setup();
  s.h.ctx.drmEnsureImgs({}); assert.deepEqual(s.origCalls, []);
});

test('a refusal shows the server message once and does not loop', async () => {
  const s = setup({ fail: true });
  s.h.ctx.drMailShow(); await settle();
  s.h.ctx.drMailPaint(); await settle();
  assert.deepEqual(s.h.fails, ['Daily Report e-mail did not load']);
  assert.equal(s.mailReads.length, 1);
});

test('legacy mode: the originals, no request', async () => {
  const h = load({ enabled: false, extra: { drMailCfg: () => ({}), drMailSubject: () => 'legacy' } });
  let asked = 0; const get = h.ctx.laOps.get; h.ctx.laOps.get = (p, q) => { asked++; return get(p, q); };
  h.ctx.drMailShow();
  assert.equal(h.ctx.drMailSubject({}), 'legacy');
  assert.equal(asked, 0);
  assert.deepEqual(h.legacy, ['drMailShow']);
});
