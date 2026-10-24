import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkArchitecture, type Violation } from './testing/architecture'

// The boundary rules of the 2D editor spec §4, as a test over the import graph (`pnpm boundaries` covers only the sim,
// whose rules are far stricter). The rules run on a map of path to source, so they are tested on planted trees first
// and then on the real one.

const rules = (violations: readonly Violation[]): string[] => violations.map((violation) => violation.rule)

function tree(files: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(files))
}

describe('checkArchitecture: the pure core (model and tiles)', () => {
  it('accepts relative imports, zod and the kit field rules', () => {
    const files = tree({
      'model/a.ts':
        "import { z } from 'zod'\nimport { b } from './b'\nexport const a = z.string()\nexport const c = b",
      'model/b.ts':
        "import { checkValues } from '@mcthaydt/automata-editor-kit/fields'\nexport const b = checkValues",
      'tiles/t.ts': "import { a } from '../model/a'\nexport const t = a",
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('refuses Svelte, Pixi, the kit root and any other package', () => {
    for (const specifier of ['svelte', 'pixi.js', '@mcthaydt/automata-editor-kit', 'smol-toml', 'node:fs']) {
      const files = tree({ 'model/a.ts': `import x from '${specifier}'\nexport default x` })
      expect(rules(checkArchitecture(files)), specifier).toEqual(['pure-imports'])
    }
  })

  it('refuses a .svelte import, however it is spelled', () => {
    const files = tree({ 'tiles/a.ts': "export { default } from './Palette.svelte'" })
    expect(rules(checkArchitecture(files))).toEqual(['pure-imports'])
  })

  it('refuses the DOM, the clock, timers and randomness', () => {
    const banned = [
      'const t = Date.now()',
      'const t = new Date()',
      'setTimeout(() => {}, 1)',
      'setInterval(f, 1)',
      'requestAnimationFrame(f)',
      'const t = performance.now()',
      'const r = Math.random()',
      'crypto.getRandomValues(bytes)',
      'document.createElement("div")',
      'window.addEventListener("x", f)',
      'localStorage.getItem("k")',
      'fetch("/x")',
    ]
    for (const code of banned) {
      const files = tree({ 'model/a.ts': `export const f = () => { ${code} }` })
      expect(rules(checkArchitecture(files)), code).toEqual(['pure-globals'])
    }
  })

  it('does not mistake a word in a comment, a string, a property or a type for the global', () => {
    const files = tree({
      'model/a.ts': [
        '// Date and Math.random are banned; so is document',
        'export const label = "Date: setTimeout"',
        'export const row = { Date: 1, performance: 2 }',
        'export const x = row.Date + row.performance',
        'export type Stamp = Date',
        'export const floor = Math.floor(1.5)',
      ].join('\n'),
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('is not applied outside model and tiles', () => {
    const files = tree({
      'app/a.ts': "import x from 'svelte'\nexport const t = Date.now()\nexport default x",
    })
    expect(checkArchitecture(files)).toEqual([])
  })
})

describe('checkArchitecture: profiles', () => {
  it('lets only app/profiles.ts import a profile', () => {
    const profile = { 'profiles/level-project/index.ts': 'export const levelProject = 1' }
    const allowed = tree({
      ...profile,
      'app/profiles.ts':
        "import { levelProject } from '../profiles/level-project'\nexport const all = [levelProject]",
    })
    expect(checkArchitecture(allowed)).toEqual([])
    for (const from of ['model/a.ts', 'tiles/a.ts', 'canvas/a.ts', 'app/other.ts']) {
      const files = tree({
        ...profile,
        [from]: `import { levelProject } from '../profiles/level-project'\nexport const a = levelProject`,
      })
      expect(rules(checkArchitecture(files)), from).toContain('profiles-from-app-only')
    }
  })

  it('may share the Profile interface, which sits beside the profile folders', () => {
    const files = tree({
      'profiles/profile.ts': 'export interface Profile {}',
      'profiles/level-project/index.ts':
        "import type { Profile } from '../profile'\nexport const p: Profile = {}",
      'app/profiles.ts': "import { p } from '../profiles/level-project'\nexport const all = [p]",
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('never lets one profile import another', () => {
    const files = tree({
      'profiles/level-project/index.ts': 'export const a = 1',
      'profiles/floorfifty-stage/index.ts': "import { a } from '../level-project'\nexport const b = a",
    })
    expect(rules(checkArchitecture(files))).toEqual(['profile-isolation'])
  })

  it('keeps template and profile ids out of app, tiles and canvas (G-s)', () => {
    for (const id of ['level-project', 'floorfifty-stage', 'platformer', 'topdown-rpg', 'blank']) {
      for (const area of ['app', 'tiles', 'canvas']) {
        const files = tree({ [`${area}/a.ts`]: `export const which = '${id}'` })
        expect(rules(checkArchitecture(files)), `${area} ${id}`).toEqual(['no-profile-ids'])
      }
    }
    const allowed = tree({ 'profiles/level-project/index.ts': "export const id = 'level-project'" })
    expect(checkArchitecture(allowed)).toEqual([])
  })
})

describe('checkArchitecture: the import graph', () => {
  it('has no cycle between files', () => {
    const files = tree({
      'model/a.ts': "import { b } from './b'\nexport const a = b",
      'model/b.ts': "import { c } from './c'\nexport const b = c",
      'model/c.ts': "import { a } from './a'\nexport const c = a",
    })
    expect(rules(checkArchitecture(files))).toEqual(['import-cycle'])
  })

  it('resolves a folder import to its index, and flags a relative import that goes nowhere', () => {
    const ok = tree({
      'model/a.ts': "import { b } from './sub'\nexport const a = b",
      'model/sub/index.ts': 'export const b = 1',
    })
    expect(checkArchitecture(ok)).toEqual([])
    const lost = tree({ 'model/a.ts': "import { b } from './missing'\nexport const a = b" })
    expect(rules(checkArchitecture(lost))).toEqual(['unresolved-import'])
  })
})

describe('the real tree', () => {
  function sources(dir: string, prefix = ''): [string, string][] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, string][] => {
      const path = `${prefix}${entry.name}`
      if (entry.isDirectory())
        return entry.name === 'testing' ? [] : sources(join(dir, entry.name), `${path}/`)
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return []
      return [[path, readFileSync(join(dir, entry.name), 'utf8')]]
    })
  }

  it('obeys every rule', () => {
    const files = new Map(sources(new URL('.', import.meta.url).pathname))
    expect(files.size).toBeGreaterThan(10)
    expect(checkArchitecture(files)).toEqual([])
  })
})
