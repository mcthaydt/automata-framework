import { readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkArchitecture, RULE_PREFIXES, type Violation } from '#src/testing/level-2d/architecture.ts'

// The boundary rules of the 2D editor spec §4, as a test over the import graph (`pnpm boundaries` covers only the sim,
// whose rules are far stricter). The rules run on a map of path to source, so they are tested on planted trees first
// and then on the real one.

const rules = (violations: readonly Violation[]): string[] => violations.map((violation) => violation.rule)

/** Where the planted files sit in the real tree: `app/…` is the 2D editor's app, the other areas are its shared code. */
const APP = 'app/editor-2d/'
const CORE = 'shared/level-2d/'
const REAL_ROOTS = /^(shared|features|entries|testing)\//

/** Where a planted file sits: a key that names no real root (`model/a.ts`, `app/b.ts`) goes where that area really lives. */
function placed(path: string): string {
  if (path.startsWith('app/')) return `${APP}${path.slice('app/'.length)}`
  return REAL_ROOTS.test(path) ? path : `${CORE}${path}`
}

function tree(files: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(files).map(([path, code]): [string, string] => [placed(path), code]))
}

describe('checkArchitecture: the pure core (model and tiles)', () => {
  it('accepts relative imports, zod, the level format and the kit field rules', () => {
    const files = tree({
      'model/a.ts':
        "import { z } from 'zod'\nimport type { FieldDef } from '@automata/content/level-2d'\nimport { b } from './b'\nexport const a = z.string()\nexport const c = b",
      'model/b.ts': "import { checkValues } from '../../kit/fields/check'\nexport const b = checkValues",
      'shared/kit/fields/check.ts': 'export const checkValues = 1',
      'tiles/t.ts': "import { a } from '../model/a'\nexport const t = a",
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('refuses code from the rest of the kit, which is the Svelte shell', () => {
    const files = tree({
      'model/a.ts': "import { shell } from '../../kit/shell/shell'\nexport const a = shell",
      'shared/kit/shell/shell.ts': 'export const shell = 1',
    })
    expect(rules(checkArchitecture(files))).toEqual(['pure-imports'])
  })

  it('refuses Svelte, Pixi, the kit and any other package', () => {
    for (const specifier of [
      'svelte',
      'pixi.js',
      '@automata/editor/kit',
      '@automata/editor/kit/fields',
      'smol-toml',
      'node:fs',
    ]) {
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

  it('holds the draw list in canvas/draw to the same rules, and lets the rest of canvas import Pixi', () => {
    for (const code of [
      "import { Sprite } from 'pixi.js'\nexport const s = Sprite",
      'export const t = () => Date.now()',
    ]) {
      const files = tree({ 'canvas/draw/level-draw-list.ts': code })
      expect(rules(checkArchitecture(files)), code).toEqual([
        code.includes('pixi') ? 'pure-imports' : 'pure-globals',
      ])
    }
    const pure = tree({
      'canvas/draw/a.ts': "import { b } from '../../model/b'\nexport const a = b",
      'model/b.ts': 'export const b = 1',
    })
    expect(checkArchitecture(pure)).toEqual([])
    const renderer = tree({
      'canvas/level-view.ts':
        "import { Sprite } from 'pixi.js'\nimport { a } from './draw/a'\nexport const v = () => [Sprite, a, document.body]",
      'canvas/draw/a.ts': 'export const a = 1',
    })
    expect(checkArchitecture(renderer)).toEqual([])
  })

  it('refuses a core file that imports code from outside the core, but lets it import types from there', () => {
    const renderer = { 'canvas/level-view.ts': 'export const view = 1\nexport type View = number' }
    const value = tree({
      ...renderer,
      'canvas/draw/a.ts': "import { view } from '../level-view'\nexport const a = view",
    })
    expect(rules(checkArchitecture(value))).toEqual(['pure-imports'])
    const fromApp = tree({
      'app/level-editor.ts': 'export const make = () => 1',
      'model/a.ts': "import { make } from '../../../app/editor-2d/level-editor'\nexport const a = make",
    })
    expect(rules(checkArchitecture(fromApp))).toEqual(['pure-imports'])
    const typeOnly = tree({
      ...renderer,
      'canvas/draw/a.ts': "import type { View } from '../level-view'\nexport const a: View = 1",
    })
    expect(checkArchitecture(typeOnly)).toEqual([])
  })

  it('is not applied outside model and tiles', () => {
    const files = tree({
      'app/a.ts': "import x from 'svelte'\nexport const t = Date.now()\nexport default x",
    })
    expect(checkArchitecture(files)).toEqual([])
  })
})

describe('checkArchitecture: profiles', () => {
  it('lets only the registration list import a profile', () => {
    const profile = { 'profiles/level-project/index.ts': 'export const levelProject = 1' }
    const allowed = tree({
      ...profile,
      'profiles/app-profiles.ts':
        "import { levelProject } from './level-project'\nexport const all = [levelProject]",
    })
    expect(checkArchitecture(allowed)).toEqual([])
    for (const from of ['model/a.ts', 'tiles/a.ts', 'canvas/a.ts', 'app/other.ts']) {
      const files = tree({
        ...profile,
        [from]: `import { levelProject } from '${posix.relative(posix.dirname(placed(from)), `${CORE}profiles/level-project`)}'\nexport const a = levelProject`,
      })
      expect(rules(checkArchitecture(files)), from).toContain('profiles-from-app-only')
    }
  })

  it('lets the entries re-export a profile and test helpers build from one', () => {
    const profile = { 'profiles/level-project/index.ts': 'export const levelProject = 1' }
    for (const from of ['entries/level-export.ts', 'testing/level-2d/samples.ts']) {
      const specifier = posix.relative(posix.dirname(from), `${CORE}profiles/level-project`)
      const files = tree({ ...profile, [from]: `export { levelProject } from '${specifier}'` })
      expect(checkArchitecture(files), from).toEqual([])
    }
  })

  it('may share the Profile interface, which sits beside the profile folders', () => {
    const files = tree({
      'profiles/profile.ts': 'export interface Profile {}',
      'profiles/level-project/index.ts':
        "import type { Profile } from '../profile'\nexport const p: Profile = {}",
      'profiles/app-profiles.ts': "import { p } from './level-project'\nexport const all = [p]",
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('never lets one profile import another', () => {
    const files = tree({
      'profiles/level-project/index.ts': 'export const a = 1',
      'profiles/stage-profile/index.ts': "import { a } from '../level-project'\nexport const b = a",
    })
    expect(rules(checkArchitecture(files))).toEqual(['profile-isolation'])
  })

  it('keeps template and profile ids out of app, tiles and canvas (G-s)', () => {
    for (const id of ['level-project', 'platformer', 'topdown-rpg', 'blank']) {
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

describe('checkArchitecture: Svelte components', () => {
  const profile = { 'profiles/level-project/index.ts': 'export const levelProject = 1' }

  it('reads the imports of a component script, however it is typed', () => {
    const files = tree({
      ...profile,
      'app/Planted.svelte':
        '<script lang="ts">\n  import { levelProject } from \'../../shared/level-2d/profiles/level-project\'\n  let shown: number = levelProject\n</script>\n<p>{shown}</p>',
    })
    expect(rules(checkArchitecture(files))).toEqual(['profiles-from-app-only'])
  })

  it('reads the module script of a component too', () => {
    const files = tree({
      ...profile,
      'app/Shared.svelte':
        '<script module lang="ts">\n  import { levelProject } from \'../../shared/level-2d/profiles/level-project\'\n  export const shared = levelProject\n</script>\n<p>shared</p>',
    })
    expect(rules(checkArchitecture(files))).toEqual(['profiles-from-app-only'])
  })

  it('lets the registration list stay the only importer even when a component sits beside it', () => {
    const files = tree({
      ...profile,
      'profiles/app-profiles.ts':
        "import { levelProject } from './level-project'\nexport const all = [levelProject]",
      'app/Home.svelte':
        '<script lang="ts">\n  import { all } from \'../../shared/level-2d/profiles/app-profiles\'\n</script>\n<p>{all.length}</p>',
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('keeps profile and template ids out of a component, in its script and in its markup (G-s)', () => {
    const inScript = tree({
      'app/A.svelte': '<script lang="ts">\n  const which = \'platformer\'\n</script>\n<p>{which}</p>',
    })
    expect(rules(checkArchitecture(inScript))).toEqual(['no-profile-ids'])
    const inAttribute = tree({ 'app/B.svelte': '<p class="blank">hello</p>' })
    expect(rules(checkArchitecture(inAttribute))).toEqual(['no-profile-ids'])
    const inText = tree({ 'app/D.svelte': '<span>level-project</span>' })
    expect(rules(checkArchitecture(inText))).toEqual(['no-profile-ids'])
    const inExpression = tree({ 'app/C.svelte': "<p>{'topdown-rpg'}</p>" })
    expect(rules(checkArchitecture(inExpression))).toEqual(['no-profile-ids'])
  })

  it('resolves a component import to the component, and flags one that goes nowhere', () => {
    const ok = tree({
      'app/A.svelte': '<script lang="ts">\n  import B from \'./B.svelte\'\n</script>\n<B />',
      'app/B.svelte': '<p>b</p>',
    })
    expect(checkArchitecture(ok)).toEqual([])
    const lost = tree({
      'app/A.svelte': '<script lang="ts">\n  import B from \'./Missing.svelte\'\n</script>\n<B />',
    })
    expect(rules(checkArchitecture(lost))).toEqual(['unresolved-import'])
  })

  it('finds a ring that runs through components, and a script the parser refuses', () => {
    const ring = tree({
      'app/A.svelte': '<script lang="ts">\n  import B from \'./B.svelte\'\n</script>\n<B />',
      'app/B.svelte': '<script lang="ts">\n  import A from \'./A.svelte\'\n</script>\n<A />',
    })
    expect(rules(checkArchitecture(ring))).toEqual(['import-cycle'])
    const broken = tree({ 'app/C.svelte': '<script lang="ts">\n  const = \n</script>' })
    expect(rules(checkArchitecture(broken))).toEqual(['parse-error'])
    expect(checkArchitecture(broken)[0]?.message).toMatch(/\S/)
  })

  it('keeps components out of the headless core, whether it imports one or holds one', () => {
    const imports = tree({
      'tiles/a.ts': "import Palette from '../../../app/editor-2d/Palette.svelte'\nexport default Palette",
      'app/Palette.svelte': '<p>palette</p>',
    })
    expect(rules(checkArchitecture(imports))).toEqual(['pure-imports'])
    const holds = tree({ 'model/Field.svelte': '<p>field</p>' })
    expect(rules(checkArchitecture(holds))).toEqual(['pure-imports'])
  })

  it('does not count a component outside the headless core as part of it', () => {
    const files = tree({
      'app/A.svelte':
        '<script lang="ts">\n  import { mount } from \'svelte\'\n  const t = Date.now()\n</script>',
    })
    expect(checkArchitecture(files)).toEqual([])
  })
})

describe('the real tree', () => {
  /** Every source file under `dir`, keyed by its path from `src/`; tests are not source. */
  function sources(dir: string, prefix = ''): [string, string][] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, string][] => {
      const path = `${prefix}${entry.name}`
      if (entry.isDirectory()) return sources(join(dir, entry.name), `${path}/`)
      if (!/\.(ts|svelte)$/.test(entry.name) || /\.test\.ts$|\.d\.ts$/.test(entry.name)) return []
      return [[path, readFileSync(join(dir, entry.name), 'utf8')]]
    })
  }
  const files = new Map(sources(new URL('../../../../src/', import.meta.url).pathname))

  it('finds files under every prefix a rule is written against', () => {
    // A prefix that matches nothing leaves its rule checking an empty set: a moved folder would pass unnoticed.
    expect(files.size).toBeGreaterThan(100)
    for (const prefix of RULE_PREFIXES) {
      expect(
        [...files.keys()].some((path) => path.startsWith(prefix)),
        prefix,
      ).toBe(true)
    }
  })

  it('obeys every rule', () => {
    expect(checkArchitecture(files)).toEqual([])
  })
})
