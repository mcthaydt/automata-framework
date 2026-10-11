import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { checkSource } from './check'
import { collectSources } from './files'

const fixture = (name: string) => {
  const path = join(import.meta.dirname, '../fixtures', name)
  return checkSource(path, readFileSync(path, 'utf8'))
}

test('the clean fixture (comments, strings, property keys, type positions, allowlisted Math) has no findings', () => {
  expect(fixture('clean.ts')).toEqual([])
})

test.each([
  ['global-date.ts', 'banned-global', 1, 11],
  ['global-window.ts', 'banned-global', 1, 18],
  ['global-timer.ts', 'banned-global', 1, 1],
  ['global-function.ts', 'banned-global', 1, 22],
  ['math-random.ts', 'math-member', 1, 18],
  ['math-sin.ts', 'math-member', 1, 18],
  ['pow-operator.ts', 'pow-operator', 1, 18],
  ['pow-assign.ts', 'pow-operator', 2, 1],
  ['object-keys.ts', 'key-enumeration', 1, 18],
  ['for-in.ts', 'key-enumeration', 2, 1],
  ['import-node.ts', 'import', 1, 1],
  ['import-dynamic.ts', 'import', 1, 28],
  ['import-effect.ts', 'import', 1, 1], // ADR 0003: no Effect inside the sim
  ['namespace-runtime.ts', 'math-member', 2, 20],
  ['object-alias.ts', 'key-enumeration', 1, 11],
  ['reflect-destructure.ts', 'key-enumeration', 1, 21],
  ['locale-compare.ts', 'locale', 1, 44],
  ['intl.ts', 'banned-global', 1, 22],
  // Audit bypasses (2026-10-11): each typechecked and passed before these rules.
  ['constructor-access.ts', 'banned-member', 1, 18], // reaches Function without naming it
  ['template-key.ts', 'key-enumeration', 1, 18],
  ['dynamic-key.ts', 'key-enumeration', 2, 18],
  ['global-weakref.ts', 'banned-global', 1, 22], // GC timing
  ['global-shared-buffer.ts', 'banned-global', 1, 22], // shared memory between threads
  ['global-atomics.ts', 'banned-global', 1, 18],
] as const)('%s -> %s at %i:%i', (file, rule, line, col) => {
  const findings = fixture(file)
  expect(findings.map((f) => [f.rule, f.line, f.col])).toEqual([[rule, line, col]])
})

test('util/sorted.ts may enumerate keys (it is the sanctioned implementation); other rules still apply', () => {
  const src = 'export const k = (o: object) => Object.keys(o).sort()\nexport const r = Math.random()\n'
  expect(checkSource('/x/packages/sim/src/util/sorted.ts', src).map((f) => f.rule)).toEqual(['math-member'])
})

test('syntax errors are reported as a finding, not a crash', () => {
  expect(checkSource('/x/bad.ts', 'const = 1').map((f) => f.rule)).toEqual(['parse-error'])
})

test('a relative import that leaves the source root is reported; one inside it is not', () => {
  const root = '/repo/packages/sim/src'
  const file = `${root}/world/sim.ts`
  const src = "import { a } from '../util/sorted'\nimport { b } from '../../../content/src/x'\n"
  expect(checkSource(file, src, { root }).map((f) => [f.rule, f.line])).toEqual([['import', 2]])
})

test('collectSources finds every TS and JS module kind, skipping tests, declarations and other files', () => {
  const dir = join(import.meta.dirname, '../fixtures/tree')
  const names = collectSources(dir).map((f) => f.slice(dir.length + 1).replaceAll('\\', '/'))
  expect(names).toEqual(['a.ts', 'b.mts', 'c.cts', 'nested/d.js'])
})

test('sim plugins outside packages/sim may import the sim’s public entry points, and only those', () => {
  const imports = (source: string) =>
    checkSource('/x/packages/physics/src/a.ts', `import { x } from '${source}'\n`).map((f) => f.rule)
  expect(imports('@mcthaydt/automata-sim')).toEqual([])
  expect(imports('@mcthaydt/automata-sim/math')).toEqual([])
  expect(imports('@mcthaydt/automata-sim/hash')).toEqual([])
  expect(imports('@mcthaydt/automata-sim/src/world/sim')).toEqual(['import'])
})

test('game sims may import the physics extension’s sim entry points, and only those', () => {
  const imports = (source: string) =>
    checkSource('/x/examples/physics/bodies-2d/sim/a.ts', `import { x } from '${source}'\n`).map(
      (f) => f.rule,
    )
  expect(imports('@mcthaydt/automata-physics/2d')).toEqual([])
  expect(imports('@mcthaydt/automata-physics/3d')).toEqual([])
  expect(imports('@mcthaydt/automata-physics/src/2d')).toEqual(['import'])
})

test('a root may allow another checked sim folder’s entry point by its exact name', () => {
  const imports = (source: string, allow: readonly string[] = []) =>
    checkSource('/x/demo/sim/a.ts', `import { x } from '${source}'\n`, { allow }).map((f) => f.rule)
  expect(imports('@af-examples/base-2d/sim')).toEqual(['import'])
  expect(imports('@af-examples/base-2d/sim', ['@af-examples/base-2d/sim'])).toEqual([])
  // Exact names only: the package root (which reaches the host bridge) stays out.
  expect(imports('@af-examples/base-2d', ['@af-examples/base-2d/sim'])).toEqual(['import'])
})
