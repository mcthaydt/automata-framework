import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { checkSource } from './check'

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
