import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectSimBySuffix } from '#src/sim-by-suffix.ts'

// Core and 2D refactor spec §3.3: in a game laid out by feature, a file whose name ends in a sim role suffix is a
// sim file, wherever it sits, and so is every file a sim file imports by relative path.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function game(files: Readonly<Record<string, string>>): string {
  const src = mkdtempSync(join(tmpdir(), 'af-sim-suffix-'))
  roots.push(src)
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(src, name)), { recursive: true })
    writeFileSync(join(src, name), code)
  }
  return src
}

const names = (src: string): string[] => collectSimBySuffix(src).map((file) => relative(src, file))

describe('collectSimBySuffix', () => {
  it('takes a file by its role suffix, a file it imports by relative path, and leaves the rest', () => {
    const src = game({
      'features/player/player-move.system.ts':
        "import { SPEED } from './tuning.ts'\nexport const move = SPEED\n",
      'features/player/tuning.ts': 'export const SPEED = 1\n',
      'features/player/hud.ts': 'export const hud = 1\n',
    })
    expect(names(src)).toEqual(['features/player/player-move.system.ts', 'features/player/tuning.ts'])
  })

  it.each(['component', 'system', 'command', 'event', 'resource', 'plugin'])(
    'knows the .%s.ts suffix',
    (role) => {
      const src = game({ [`features/a/b.${role}.ts`]: 'export const x = 1\n' })
      expect(names(src)).toEqual([`features/a/b.${role}.ts`])
    },
  )

  it('follows imports through several files, and a folder import to its index', () => {
    const src = game({
      'features/a/a.system.ts': "import { b } from './b.ts'\nexport const a = b\n",
      'features/a/b.ts': "import { c } from '../shared/c'\nexport const b = c\n",
      'features/shared/c/index.ts': 'export const c = 1\n',
    })
    expect(names(src)).toEqual(['features/a/a.system.ts', 'features/a/b.ts', 'features/shared/c/index.ts'])
  })

  it('does not follow a type-only import, which brings no code', () => {
    const src = game({
      'features/a/a.system.ts': "import type { Hud } from './hud.ts'\nexport const a = (h: Hud) => h\n",
      'features/a/hud.ts': 'export type Hud = number\n',
    })
    expect(names(src)).toEqual(['features/a/a.system.ts'])
  })

  it('ignores tests and files in node_modules, and returns nothing when no file has a role suffix', () => {
    const src = game({
      'features/a/a.system.test.ts': 'export {}\n',
      'features/a/readme.ts': 'export {}\n',
    })
    expect(names(src)).toEqual([])
  })

  it('leaves a data file a sim file imports out of the set', () => {
    const src = game({
      'features/a/a.system.ts': "import table from './table.json'\nexport const a = table\n",
      'features/a/table.json': '{}\n',
    })
    expect(names(src)).toEqual(['features/a/a.system.ts'])
  })

  it('terminates on an import cycle', () => {
    const src = game({
      'a.system.ts': "import './b.ts'\nexport {}\n",
      'b.ts': "import './a.system.ts'\nexport {}\n",
    })
    expect(names(src)).toEqual(['a.system.ts', 'b.ts'])
  })
})
