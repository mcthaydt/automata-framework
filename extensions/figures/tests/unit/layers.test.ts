import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The module boundaries. The
 * renderer is a pipeline, so its features are layers, lowest first: a module imports only from its own layer and the
 * ones below it (src/shared/math only from itself); a feature's library JSON only from its own feature; nothing in
 * src/ from scripts/ or tests/; no module reaches itself round a cycle (type-only imports count); and no test sits
 * beside the source. A fork adds its own features to LAYERS where they fit. There is no ESLint here, so this test walks
 * the import graph itself.
 */
const ROOT = resolve(import.meta.dirname, '../..')
const LAYERS = [
  'src/shared/math',
  'src/shared/body',
  'src/shared/paint',
  'src/shared/lighting',
  'src/shared/motion',
  'src/shared/hair',
  'src/shared/outfit',
  'src/shared/figure',
  'src/shared/base',
  'src/shared/actors',
  'src/shared/stage',
  'src/entries/index.ts',
  'src/entries/kit.ts',
  // The Pixi 3D view, above the public surface and on its own entry, so nothing below it loads Pixi.
  'src/features/view',
  'src/entries/view.ts',
]
const layerOf = (file: string) => LAYERS.findIndex((l) => file === l || file.startsWith(`${l}/`))
const walk = (dir: string): string[] =>
  !existsSync(join(ROOT, dir))
    ? []
    : readdirSync(join(ROOT, dir)).flatMap((n) => {
        const p = join(dir, n)
        return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(ts|json)$/.test(n) ? [p] : []
      })
/** Every relative specifier in a module (`import … from`, `export … from`, `import '…'`, `import('…')`), resolved. */
const SPEC =
  /(?:^|\n)\s*(?:import|export)\b[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/g
function importsOf(file: string): string[] {
  if (!file.endsWith('.ts')) return []
  return [...readFileSync(join(ROOT, file), 'utf8').matchAll(SPEC)].map((m) => {
    const spec = m[1] ?? m[2] ?? m[3],
      p = relative(ROOT, resolve(ROOT, dirname(file), spec))
    const hit = [p, `${p}.ts`, `${p}/index.ts`].find(
      (c) => existsSync(join(ROOT, c)) && statSync(join(ROOT, c)).isFile(),
    )
    if (!hit) throw new Error(`${file}: cannot resolve ${spec}`)
    return hit
  })
}
const MODULES = walk('src')
const GRAPH = new Map(MODULES.map((m) => [m, importsOf(m)]))

describe('module boundaries', () => {
  it('every module in src/ belongs to a layer', () => {
    expect(MODULES.filter((m) => layerOf(m) < 0)).toEqual([])
  })
  it('no module imports a layer above its own, or anything outside src/', () => {
    const bad: string[] = []
    for (const [m, deps] of GRAPH)
      for (const d of deps) if (layerOf(d) < 0 || layerOf(d) > layerOf(m)) bad.push(`${m} → ${d}`)
    expect(bad).toEqual([])
  })
  it("a feature's library JSON is imported only by that feature", () => {
    const bad: string[] = []
    for (const [m, deps] of GRAPH)
      for (const d of deps) if (d.endsWith('.json') && layerOf(d) !== layerOf(m)) bad.push(`${m} → ${d}`)
    expect(bad).toEqual([])
  })
  it('the import graph has no cycles', () => {
    const state = new Map<string, 1 | 2>(),
      stack: string[] = [],
      found: string[] = []
    const visit = (m: string) => {
      state.set(m, 1)
      stack.push(m)
      for (const n of GRAPH.get(m) ?? []) {
        if (state.get(n) === 1) found.push([...stack.slice(stack.indexOf(n)), n].join(' → '))
        else if (!state.has(n)) visit(n)
      }
      stack.pop()
      state.set(m, 2)
    }
    for (const m of MODULES) if (!state.has(m)) visit(m)
    expect(found).toEqual([])
  })
  it('only the view layer and the viewer import Pixi', () => {
    // static, dynamic and required imports, of the packages and of their subpaths
    const PIXI = /(?:from\s*|import\s*\(?\s*|require\(\s*)['"](?:pixi\.js|@pixi\/3d)(?:\/[^'"]*)?['"]/
    for (const hit of [
      "import { A } from 'pixi.js'",
      "import '@pixi/3d'",
      "await import('pixi.js/lib/x')",
      'from "@pixi/3d/dist/y"',
      "require('pixi.js')",
    ])
      expect(PIXI.test(hit), hit).toBe(true)
    for (const miss of ["import { A } from './pixi.js'", "from 'pixi-live'", '// pixi.js'])
      expect(PIXI.test(miss), miss).toBe(false)
    const files = [...MODULES, ...walk('scripts'), ...walk('tests'), ...walk('viewer')].filter(
      (m) =>
        m.endsWith('.ts') &&
        !m.startsWith('src/features/view/') &&
        !m.startsWith('viewer/') &&
        m !== 'tests/fixtures/view-draw.ts' && // the browser suite's page draws through Pixi
        m !== 'tests/unit/layers.test.ts',
    ) // this file holds the pattern's own samples
    expect(files.length).toBeGreaterThan(60) // the walk found the tree, not nothing
    expect(files.filter((m) => PIXI.test(readFileSync(join(ROOT, m), 'utf8')))).toEqual([])
  })
  it('no test sits beside the source', () => {
    expect(MODULES.filter((m) => /\.(test|spec)\.ts$/.test(m))).toEqual([])
  })
})
