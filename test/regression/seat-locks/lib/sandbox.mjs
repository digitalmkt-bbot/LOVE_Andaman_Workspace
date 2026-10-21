// Runs extracted allotment_v2.html source in an isolated Node vm context with
// caller-supplied stub globals, then hands back the named functions/values it
// defined. Built-ins (Math, JSON, Date, Array, Object, String, RegExp, ...)
// are present automatically in every vm context — only app-specific globals
// (SB_BOOKINGS, SB_SEAT_LOCKS, TRIPS, BOATS, ...) need to be injected.
//
// LAM-26 note: same-purpose sibling of tests/legacy/lib/sandbox.mjs (LAM-77,
// origin/main only). Kept local to test/regression/seat-locks/ per this task's
// owned-files scope — see lib/source.mjs for the full rationale.
import vm from 'node:vm';

export function runInSandbox(code, globals, exportNames) {
  const context = vm.createContext({ ...globals });
  const exportsObj = '{ ' + exportNames.join(', ') + ' }';
  const script = code + '\n;globalThis.__exp = ' + exportsObj + ';';
  vm.runInContext(script, context, { filename: 'allotment_v2-extract.js' });
  return context.__exp;
}

// Round-trips a vm-Realm result through JSON so assert.deepStrictEqual (which
// checks prototype identity) doesn't spuriously fail on structurally-identical
// arrays/objects that were constructed in the sandbox's separate Realm.
export function plain(x) {
  return JSON.parse(JSON.stringify(x));
}
