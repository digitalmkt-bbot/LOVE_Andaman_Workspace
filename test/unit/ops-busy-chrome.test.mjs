// §busyChrome / §loadingOver (UI parity N7, N1, gap 6, G17) · a focused field in the app's frame (the sidebar's menu search, the
// topbar) is no edit, so laOps.whenFree runs a repaint at once; a field on the page still holds it back. loadingOver puts the
// placeholder in an empty host and a loading line over a host that still shows the previous choice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './fe-harness.mjs';

function field({ tag = 'INPUT', type = 'search', frame = false } = {}) {
  return { tagName: tag, type, isConnected: true, getClientRects: () => [1], closest: (sel) => (frame && /\.sidebar/.test(sel) ? {} : null) };
}
function boot(active) {
  const doc = { activeElement: active, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
  return runtime({ globals: { document: doc, setInterval: () => 1, clearInterval: () => {} } });
}

test('the sidebar menu search holding focus is not an edit: whenFree repaints at once', () => {
  const { O } = boot(field({ frame: true }));
  assert.equal(O.busy(), false);
  let ran = 0; O.whenFree(() => { ran++; });
  assert.equal(ran, 1);
});

test('a text field on the page holding focus still defers the repaint', () => {
  const { O } = boot(field({ type: 'text' }));
  assert.equal(O.busy(), true);
  let ran = 0; O.whenFree(() => { ran++; });
  assert.equal(ran, 0);
});

test('loadingOver: placeholder in an empty host, one loading line over old content', () => {
  const { O, ctx } = boot(null);
  ctx.document.createElement = () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } });
  const empty = { firstChild: null, innerHTML: '' };
  O.loadingOver(empty, 'Loading PR/PO…');
  assert.match(empty.innerHTML, /la-ops-loading[\s\S]*Loading PR\/PO…/);

  const old = { kids: [{ getAttribute: () => null }], get firstChild() { return this.kids[0]; }, get firstElementChild() { return this.kids[0]; },
    insertBefore(n) { this.kids.unshift(n); } };
  O.loadingOver(old, 'Loading PR/PO…');
  O.loadingOver(old, 'Loading PR/PO…');
  assert.equal(old.kids.length, 2, 'one line, not one per call');
  assert.match(old.kids[0].innerHTML, /Loading PR\/PO…/);
});
