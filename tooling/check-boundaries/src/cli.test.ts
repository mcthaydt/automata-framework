import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// `automata check` runs `automata-check-boundaries src/sim` in a game folder, with no flags. A game that uses an
// extension must pass that run when the extension declares its sim entries (P5-D2).
const cli = join(import.meta.dirname, 'cli.ts')

function run(importSource: string): { status: number | null; stdout: string } {
  const game = mkdtempSync(join(tmpdir(), 'af-boundaries-cli-'))
  try {
    const installed = join(game, 'node_modules/@x/ext')
    mkdirSync(installed, { recursive: true })
    writeFileSync(
      join(installed, 'package.json'),
      JSON.stringify({ name: '@x/ext', automata: { simEntries: ['./2d'] } }),
    )
    mkdirSync(join(game, 'src/sim'), { recursive: true })
    writeFileSync(join(game, 'src/sim/a.ts'), `import { x } from '${importSource}'\nexport const y = x\n`)
    const result = spawnSync(process.execPath, [cli, 'src/sim'], { cwd: game, encoding: 'utf8' })
    return { status: result.status, stdout: result.stdout }
  } finally {
    rmSync(game, { recursive: true, force: true })
  }
}

it('passes a game sim that imports a declared extension entry, with no flags', () => {
  expect(run('@x/ext/2d')).toMatchObject({ status: 0 })
})

it('fails a game sim that imports an entry the extension did not declare', () => {
  const result = run('@x/ext/3d')
  expect(result.status).toBe(1)
  expect(result.stdout).toContain('@x/ext declares only ./2d for a sim')
})

describe('--game: a game laid out by role (GL spec §4.5, §5.2, acceptance B1–B5)', () => {
  function game(files: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
    const dir = mkdtempSync(join(tmpdir(), 'af-boundaries-game-'))
    try {
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(join(dir, 'src', name, '..'), { recursive: true })
        writeFileSync(join(dir, 'src', name), text)
      }
      const result = spawnSync(process.execPath, [cli, '--game', 'src'], { cwd: dir, encoding: 'utf8' })
      return { status: result.status, stdout: result.stdout, stderr: result.stderr }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const components =
    "import { defineComponent } from '@mcthaydt/automata-sim'\nexport const A = defineComponent('a', {})\n"

  it('B1: Math.random() in systems.ts fails', () => {
    const result = game({ 'systems.ts': 'export const roll = () => Math.random()\n' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('src/systems.ts:1:')
    expect(result.stdout).toContain('math-member')
  })

  it('B2: a value import from views.ts fails, naming the sim set; components.ts passes', () => {
    const bad = game({
      'systems.ts': "import { draw } from './views.ts'\nexport const s = draw\n",
      'views.ts': 'export const draw = 1\n',
    })
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain(
      'the sim imports ./views.ts, which is outside the sim (constants, components, commands, events, resources, systems, state, sim.ts)',
    )
    const good = game({
      'components.ts': components,
      'systems/move.ts': "import { A } from '../components.ts'\nexport const m = A\n",
      'systems/index.ts': "export { m } from './move.ts'\n",
      'state.ts': "import { m } from './systems/index.ts'\nexport const plugin = m\n",
    })
    expect(good.stdout).toContain('check-boundaries: 4 files, 0 findings')
    expect(good.status).toBe(0)
  })

  it('B3: a type-only import from content/ passes; a value import from it fails', () => {
    const typeOnly = game({
      'state.ts': "import type { Room } from './content/room.ts'\nexport const rooms: Room[] = []\n",
      'content/room.ts': 'export interface Room { id: string }\nexport const ROOM = 1\n',
    })
    expect(typeOnly.status).toBe(0)
    const value = game({
      'state.ts': "import { ROOM } from './content/room.ts'\nexport const r = ROOM\n",
      'content/room.ts': 'export const ROOM = 1\n',
    })
    expect(value.status).toBe(1)
    expect(value.stdout).toContain('the sim imports ./content/room.ts')
  })

  it('B4: views.ts and main.ts are not checked', () => {
    const result = game({
      'components.ts': components,
      'views.ts': 'export const w = document.title\n',
      'main.ts': 'setTimeout(() => {}, 1)\n',
    })
    expect(result.stdout).toContain('check-boundaries: 1 files, 0 findings')
    expect(result.status).toBe(0)
  })

  it('B5: a game root with no sim files exits 2', () => {
    const result = game({ 'views.ts': 'export const v = 1\n' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('no sim files in src (constants.ts, components.ts')
  })
})
