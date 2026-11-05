import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The module boundaries (docs/superpowers/specs/2026-11-05-base-pair-refactor-design.md, "Module boundaries"). The
 * renderer is a pipeline, so its features are layers, lowest first: a module imports only from its own layer and the
 * ones below it (src/lib/ only from itself); a feature's library JSON only from its own feature; nothing in src/ or
 * base/ from scripts/ or tests/; no module reaches itself round a cycle (type-only imports count); and no test sits
 * beside the source. A fork adds its own features to LAYERS where they fit. There is no ESLint here, so this test walks
 * the import graph itself.
 */
const ROOT = resolve(import.meta.dirname, '..');
const LAYERS = [
  'src/lib', 'src/features/body', 'src/features/paint', 'src/features/lighting', 'src/features/motion',
  'src/features/hair', 'src/features/outfit', 'src/features/figure', 'base', 'src/features/actors', 'src/index.ts',
];
const layerOf = (file: string) => LAYERS.findIndex(l => file === l || file.startsWith(`${l}/`));
const walk = (dir: string): string[] => !existsSync(join(ROOT, dir)) ? [] : readdirSync(join(ROOT, dir)).flatMap(n => {
  const p = join(dir, n);
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(ts|json)$/.test(n) ? [p] : [];
});
/** Every relative specifier in a module (`import … from`, `export … from`, `import '…'`, `import('…')`), resolved. */
const SPEC = /(?:^|\n)\s*(?:import|export)\b[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;
function importsOf(file: string): string[] {
  if (!file.endsWith('.ts')) return [];
  return [...readFileSync(join(ROOT, file), 'utf8').matchAll(SPEC)].map(m => {
    const spec = m[1] ?? m[2] ?? m[3], p = relative(ROOT, resolve(ROOT, dirname(file), spec));
    const hit = [p, `${p}.ts`, `${p}/index.ts`].find(c => existsSync(join(ROOT, c)) && statSync(join(ROOT, c)).isFile());
    if (!hit) throw new Error(`${file}: cannot resolve ${spec}`);
    return hit;
  });
}
const MODULES = [...walk('src'), ...walk('base')];
const GRAPH = new Map(MODULES.map(m => [m, importsOf(m)]));

describe('module boundaries', () => {
  it('every module in src/ and base/ belongs to a layer', () => {
    expect(MODULES.filter(m => layerOf(m) < 0)).toEqual([]);
  });
  it('no module imports a layer above its own, or anything outside src/ and base/', () => {
    const bad: string[] = [];
    for (const [m, deps] of GRAPH) for (const d of deps) if (layerOf(d) < 0 || layerOf(d) > layerOf(m)) bad.push(`${m} → ${d}`);
    expect(bad).toEqual([]);
  });
  it("a feature's library JSON is imported only by that feature", () => {
    const bad: string[] = [];
    for (const [m, deps] of GRAPH) for (const d of deps) if (d.endsWith('.json') && layerOf(d) !== layerOf(m)) bad.push(`${m} → ${d}`);
    expect(bad).toEqual([]);
  });
  it('the import graph has no cycles', () => {
    const state = new Map<string, 1 | 2>(), stack: string[] = [], found: string[] = [];
    const visit = (m: string) => {
      state.set(m, 1); stack.push(m);
      for (const n of GRAPH.get(m) ?? []) {
        if (state.get(n) === 1) found.push([...stack.slice(stack.indexOf(n)), n].join(' → '));
        else if (!state.has(n)) visit(n);
      }
      stack.pop(); state.set(m, 2);
    };
    for (const m of MODULES) if (!state.has(m)) visit(m);
    expect(found).toEqual([]);
  });
  it('no test sits beside the source', () => {
    expect(MODULES.filter(m => /\.(test|spec)\.ts$/.test(m))).toEqual([]);
  });
});
