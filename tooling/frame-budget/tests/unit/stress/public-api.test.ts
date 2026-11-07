import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The stress example stands for a game written on AF's public core API (PRODUCT spec §2 F5). Every import in its
// source is relative, a public `exports` entry of a core package (never `./testing`), or one of the libraries a
// core game is built with. A deep `src/` import, Koota, or an extension would make its numbers about something
// other than core.

// The example's source stays in stress/, beside the package's src/; its tests are in tests/unit/stress/.
const here = join(import.meta.dirname, '../../../stress')
const repoRoot = join(here, '../../..')
const LIBRARIES = new Set(['pixi.js', 'effect', 'svelte', 'zod'])

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|svelte)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })

const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)].map(
    (match) => (match[1] ?? match[2]) as string,
  )

function isPublicCoreEntry(specifier: string): boolean {
  // `@mcthaydt/automata` is the folder `packages/automata`; the others are `@mcthaydt/automata-<folder>`.
  const match = /^@mcthaydt\/automata(?:-([a-z0-9-]+))?(\/.*)?$/.exec(specifier)
  if (match === null) return false
  const [, name = 'automata', subpath] = match
  const exportsMap = JSON.parse(readFileSync(join(repoRoot, 'packages', name, 'package.json'), 'utf8'))
    .exports as Record<string, unknown>
  const entry = subpath === undefined ? '.' : `.${subpath}`
  return entry !== './testing' && entry in exportsMap
}

describe('the stress example uses only public core APIs', () => {
  const files = sourceFiles(here)

  it('has an entry and a game to scan', () => {
    const names = files.map((path) => path.slice(here.length + 1))
    expect(names).toEqual(expect.arrayContaining(['main.ts', 'stress-game.ts', 'stress-screen.ts']))
  })

  it.each(files.map((path) => [path.slice(here.length + 1), path]))('%s', (_name, path) => {
    for (const specifier of importsOf(readFileSync(path, 'utf8'))) {
      const allowed = specifier.startsWith('./') || LIBRARIES.has(specifier) || isPublicCoreEntry(specifier)
      expect(allowed, `${specifier} is not a public core entry`).toBe(true)
    }
  })

  it('rejects what it should: a deep src import, the testing entry, Koota', () => {
    expect(isPublicCoreEntry('@mcthaydt/automata-sim/src/world/sim')).toBe(false)
    expect(isPublicCoreEntry('@mcthaydt/automata/testing')).toBe(false)
    expect(isPublicCoreEntry('@mcthaydt/automata-sim/math')).toBe(true)
    expect(LIBRARIES.has('koota')).toBe(false)
  })
})
