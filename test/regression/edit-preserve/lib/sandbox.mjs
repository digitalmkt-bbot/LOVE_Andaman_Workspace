// LAM-25: runs a small snippet of extracted allotment_v2.html source in an isolated Node `vm`
// context and hands back the named functions/values it defined. Built-ins (Math, JSON, Date,
// Array, Object, String, RegExp, structuredClone, ...) are present automatically in every vm
// context — only app-specific globals need to be injected, and none of the edit-preserve carry-
// over lines need any (they only touch their own `editing`/`newBk` locals).
import vm from 'node:vm';

export function runInSandbox(code, globals, exportNames) {
  const context = vm.createContext({ ...globals });
  const script = code + '\n;globalThis.__exp = { ' + exportNames.join(', ') + ' };';
  vm.runInContext(script, context, { filename: 'edit-preserve-extract.js' });
  return context.__exp;
}
