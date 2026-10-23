// ED3D-D1: `format`, `geometry`, `codec` and `profile` import no Svelte, no DOM, no clock and no Node. The rule is
// enforced here and not only written down, so a later change cannot quietly add one.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findImpurities } from './testing/purity'

describe('findImpurities', () => {
  it('flags a forbidden import, a DOM global, a clock, a timer and randomness', () => {
    const bad = [
      "import { writable } from 'svelte/store'",
      "import ts from 'typescript'",
      "import { Effect } from 'effect'",
      "import { readFileSync } from 'node:fs'",
      'const now = Date.now()',
      'const when = new Date()',
      'setTimeout(() => {}, 1)',
      'requestAnimationFrame(tick)',
      'const t = performance.now()',
      'const r = Math.random()',
      'const el = document.body',
      "localStorage.setItem('a', 'b')",
      'const width = window.innerWidth',
      'addEventListener(window, 1)',
    ]
    for (const line of bad) expect(findImpurities(line), line).not.toEqual([])
  })

  it('passes ordinary code, and mentions in comments and words that only contain a name', () => {
    const fine = [
      "import { z } from 'zod'",
      "import { scan } from './locate'",
      '// no Date, no Math.random, no document here',
      '/* setTimeout is banned */ const x = 1',
      'const update = 1',
      'const mandate = 2',
      // `window` and `document` are also names of a wall's members in the format.
      'readonly window?: WindowDef | undefined',
      'window: windowSchema.optional(),',
      'const piece = wall.window',
      "const key = 'window'",
    ]
    for (const line of fine) expect(findImpurities(line), line).toEqual([])
  })
})

const sources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
  })

describe('the pure layers', () => {
  for (const layer of ['format', 'geometry', 'checks', 'codec', 'profile']) {
    it(`src/${layer} has no impure import or global`, () => {
      const root = new URL(`./${layer}`, import.meta.url).pathname
      const files = sources(root)
      expect(files.length).toBeGreaterThan(0)
      const findings = files.flatMap((file) =>
        findImpurities(readFileSync(file, 'utf8')).map((finding) => `${file}: ${finding}`),
      )
      expect(findings).toEqual([])
    })
  }
})
