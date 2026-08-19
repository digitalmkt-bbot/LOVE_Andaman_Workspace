import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

export const legacyHtmlPath = resolve('allotment_v2/allotment_v2.html');
export const legacySource = readFileSync(legacyHtmlPath, 'utf8');

/** Extract one top-level function without executing the legacy application. */
export function extractFunction(name, occurrence = 0) {
  const marker = `function ${name}(`;
  let start = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    start = legacySource.indexOf(marker, start + 1);
    if (start < 0) throw new Error(`Missing legacy function: ${name} (occurrence ${occurrence})`);
  }
  const bodyStart = legacySource.indexOf('{', start);
  let depth = 0;
  let state = 'code';
  for (let i = bodyStart; i < legacySource.length; i += 1) {
    const c = legacySource[i];
    const next = legacySource[i + 1];
    if (state === 'line-comment') {
      if (c === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (c === '*' && next === '/') { state = 'code'; i += 1; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (c === '\\') { i += 1; continue; }
      if (c === quote) state = 'code';
      continue;
    }
    if (c === '/' && next === '/') { state = 'line-comment'; i += 1; continue; }
    if (c === '/' && next === '*') { state = 'block-comment'; i += 1; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '"') { state = 'double'; continue; }
    if (c === '`') { state = 'template'; continue; }
    if (c === '{') depth += 1;
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return legacySource.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed legacy function: ${name}`);
}

/** Evaluate only named production functions with test-owned globals. */
export function loadLegacyFunctions(names, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  for (const entry of names) {
    const { name, occurrence = 0 } = typeof entry === 'string' ? { name: entry } : entry;
    vm.runInContext(extractFunction(name, occurrence), context, { filename: legacyHtmlPath });
  }
  return context;
}
