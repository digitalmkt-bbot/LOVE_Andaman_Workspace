// Runs extracted allotment_v2.html source in an isolated Node vm context with
// caller-supplied stub globals, then hands back the named functions/values it
// defined. Built-ins (Math, JSON, Date, Array, Object, String, RegExp, ...)
// are present automatically in every vm context — only app-specific globals
// (SB_BOOKINGS, BOATS, localStorage, alert, confirm, ...) need to be injected.
import vm from 'node:vm';

export function runInSandbox(code, globals, exportNames) {
  const context = vm.createContext({ ...globals });
  const exportsObj = '{ ' + exportNames.join(', ') + ' }';
  const script = code + '\n;globalThis.__exp = ' + exportsObj + ';';
  vm.runInContext(script, context, { filename: 'allotment_v2-extract.js' });
  return context.__exp;
}

// A tiny localStorage stand-in matching the Web Storage API surface the app uses
// (getItem/setItem only — no quota, no events).
export function makeLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    _dump() { return Object.fromEntries(store); },
  };
}
