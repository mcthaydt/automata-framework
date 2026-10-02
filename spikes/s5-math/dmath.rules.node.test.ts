import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// The S5 pass criterion "built only from bit-exact operations", enforced on the source.
// Math.round is an addition to spec §2's list (it is exact: IEEE round-half-up on an exact value).
const ALLOWED = ['sqrt', 'fround', 'round', 'floor', 'ceil', 'trunc', 'abs', 'min', 'max', 'sign']

/** Math members used in code (comments stripped, so prose mentioning Math.PI doesn't count). */
function mathMembers(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return [...code.matchAll(/\bMath\.([A-Za-z0-9_]+)/g)].map((m) => m[1] as string)
}

test('dmath.ts uses only bit-exact Math members', () => {
  const used = mathMembers(readFileSync(new URL('./dmath.ts', import.meta.url), 'utf8'))
  expect(used.length).toBeGreaterThan(0)
  expect(used.filter((name) => !ALLOWED.includes(name))).toEqual([])
})

test('the rule catches a banned member in code but not in comments (negative control)', () => {
  const sample = '// Math.cos in a comment is fine\nconst y = Math.sin(x) + Math.sqrt(x) /* Math.exp */'
  expect(mathMembers(sample).filter((name) => !ALLOWED.includes(name))).toEqual(['sin'])
})
