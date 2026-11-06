import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// `automata check` runs `automata-check-boundaries src/sim` in a game folder, with no flags. A game that uses an
// extension must pass that run when the extension declares its sim entries (P5-D2).
const cli = join(import.meta.dirname, '../../../src/features/boundaries/cli.ts')

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

  it('a game laid out by feature: a role-suffixed file and the helper it imports are sim, a HUD no sim file imports is not', () => {
    const files = {
      'features/player/player-move.system.ts':
        "import { SPEED } from './tuning.ts'\nexport const move = SPEED\n",
      'features/player/tuning.ts': 'export const SPEED = Math.random()\n',
      'features/player/hud.ts': 'export const hud = document.title\n',
    }
    const result = game(files)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('src/features/player/tuning.ts:1:')
    expect(result.stdout).not.toContain('hud.ts')
    expect(result.stdout).toContain('check-boundaries: 2 files, 1 findings')
  })

  it('B5: a game root with no sim files exits 2', () => {
    const result = game({ 'views.ts': 'export const v = 1\n' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('no sim files in src (constants.ts, components.ts')
  })
})

describe('--features and --browser (core and 2D refactor spec §3.5)', () => {
  function pkg(files: Record<string, string>, args: (root: string) => string[]) {
    const root = mkdtempSync(join(tmpdir(), 'af-boundaries-features-'))
    try {
      for (const [name, code] of Object.entries(files)) {
        mkdirSync(join(root, 'src', name, '..'), { recursive: true })
        writeFileSync(join(root, 'src', name), code)
      }
      const result = spawnSync(process.execPath, [cli, ...args(root)], { cwd: root, encoding: 'utf8' })
      return { status: result.status, stdout: result.stdout, stderr: result.stderr }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  it('--features prints a break under its location, indented, and exits 1', () => {
    const result = pkg(
      {
        'features/saves/a.ts': "import { b } from '../settings/b.ts'\nexport const a = b\n",
        'features/settings/b.ts': 'export const b = 1\n',
      },
      () => ['--features', '.'],
    )
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'src/features/saves/a.ts:1:1\n  "saves" imports "settings" (features/settings/b.ts).',
    )
    expect(result.stdout).toContain('check-boundaries: 2 files, 1 findings')
  })

  it('--features passes a clean package with exit 0', () => {
    const result = pkg({ 'features/saves/a.ts': 'export const a = 1\n' }, () => ['--features', '.'])
    expect(result).toMatchObject({ status: 0 })
  })

  it('--browser names the entries after a colon, and exits 1 on Effect in a reachable file', () => {
    const files = {
      'entries/index.ts': "export { run } from '../app/run.ts'\n",
      'entries/locale.ts': "export { t } from '../app/t.ts'\n",
      'app/run.ts': "import { Effect } from 'effect'\nexport const run = Effect.void\n",
      'app/t.ts': 'export const t = 1\n',
    }
    expect(pkg(files, () => ['--browser', '.:locale'])).toMatchObject({ status: 0 })
    const all = pkg(files, () => ['--browser', '.'])
    expect(all.status).toBe(1)
    expect(all.stdout).toContain(
      'runs in the browser and imports "effect". Effect is for Node tooling only (ADR 0003).',
    )
  })

  it('--features --shared-island fails the island importing the rest of shared/', () => {
    const files = {
      'shared/kit/a.ts': "import { b } from '../level/b.ts'\nexport const a = b\n",
      'shared/level/b.ts': 'export const b = 1\n',
    }
    expect(pkg(files, () => ['--features', '.'])).toMatchObject({ status: 0 })
    const island = pkg(files, () => ['--features', '.', '--shared-island', 'kit'])
    expect(island.status).toBe(1)
    expect(island.stdout).toContain('"shared/kit" imports "shared/level" (shared/level/b.ts).')
    expect(pkg(files, () => ['--features', '.', '--shared-island'])).toMatchObject({ status: 2 })
    expect(pkg(files, () => ['--browser', '.', '--shared-island', 'kit'])).toMatchObject({ status: 2 })
  })

  it('--forbid names the packages after a colon, and fails an import of one', () => {
    const files = { 'a.ts': "import '@pixi/3d'\n", 'src/b.ts': "import 'zod'\n" }
    const result = pkg(files, (root) => ['--forbid', `${root}:@pixi/3d,other`])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('imports "@pixi/3d", which')
    expect(pkg({ 'src/b.ts': "import 'zod'\n" }, (root) => ['--forbid', `${root}:@pixi/3d`])).toMatchObject({
      status: 0,
    })
    expect(pkg(files, (root) => ['--forbid', root])).toMatchObject({ status: 2 })
  })

  it('--features and --browser need a package root', () => {
    expect(pkg({}, () => ['--features'])).toMatchObject({ status: 2 })
    expect(pkg({}, () => ['--browser'])).toMatchObject({ status: 2 })
    expect(pkg({}, () => ['--forbid'])).toMatchObject({ status: 2 })
  })
})
