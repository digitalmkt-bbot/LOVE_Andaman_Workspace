// §toastOne · laSaveToast keeps one card per booking id: a newer toast for the same booking replaces the one on screen,
// toasts for other bookings or with no id still stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../allotment_v2/js/08-app.js', import.meta.url), 'utf8');
const start = src.indexOf('function laSaveToast(o){');
const end = src.slice(start).search(/\r?\n\}\r?\n/);
const fnSrc = src.slice(start, start + end) + '\n}\n';

function el(tag) {
  const node = {
    tag, id: '', className: '', style: {}, attrs: {}, children: [], parent: null, innerHTML: '', textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
    querySelector() { return { addEventListener() {} }; }, addEventListener() {},
  };
  return node;
}
function page() {
  const body = el('body'), head = el('head');
  const document = {
    body, head, createElement: el,
    getElementById: (id) => [...body.children, ...head.children].find((c) => c.id === id) || null,
  };
  const ctx = vm.createContext({ document, setTimeout: () => 0, clearTimeout() {}, console });
  vm.runInContext(fnSrc, ctx);
  const cards = () => (document.getElementById('la-savetoast-wrap') || { children: [] }).children;
  return { toast: (o) => ctx.laSaveToast(o), cards };
}

test('a booking edit shows one card: each newer toast for the booking replaces the last', () => {
  const { toast, cards } = page();
  toast({ kind: 'success', title: 'อัปเดต booking แล้ว', id: 'BK1', status: 'CONFIRMED' });
  toast({ kind: 'pending', title: 'Saved as pending approval', id: 'BK1', status: 'SERVER' });
  toast({ kind: 'pending', title: 'Server adjusted the booking price', id: 'BK1', status: 'PRICE' });
  assert.equal(cards().length, 1);
  assert.match(cards()[0].innerHTML, /Server adjusted the booking price/);
});

test('toasts for other bookings, or with no id, still stack', () => {
  const { toast, cards } = page();
  toast({ title: 'อัปเดต booking แล้ว', id: 'BK1' });
  toast({ title: 'อัปเดต booking แล้ว', id: 'BK2' });
  toast({ title: 'เติมค่าลงแถวแล้ว' });
  toast({ title: 'เติมค่าลงแถวแล้ว' });
  assert.equal(cards().length, 4);
});
