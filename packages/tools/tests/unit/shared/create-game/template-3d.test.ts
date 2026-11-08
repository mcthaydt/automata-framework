import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { editorRows } from '@automata/editor/editor-list'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { TEMPLATE_3D_CONTENT_PATHS } from '#src/shared/create-game/template-3d-content.ts'
import { feelAudioFile } from '#src/shared/create-game/template-feel-audio.ts'
import { THREE_D_NOT_PUBLIC } from '#src/shared/create-game/three-d-gate.ts'

// What a new 3D game is made of: one room, Wick walking in it, a tuning file, the editor list, and the same feature
// layout as the 2D game (features by name, shared numbers, the app that wires them, tests of the sim).

// The source projects' names are written in pieces, so this file names none of them either.
const SOURCE_NAMES = ['Figure' + 'Builder', 'Environment' + 'Builder', 'Last' + ' Light', 'Floor' + 'Fifty']
const NO_SOURCE_NAMES = new RegExp(`${SOURCE_NAMES.join('|')}|Ruken M\\d|\\b[A-Z]{1,3}\\d\\.\\d\\b`)

let root: string
let dir: string
let files: string[]
const read = (path: string): string => readFileSync(join(dir, path), 'utf8')
const listing = (folder: string): string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(folder.length + 1))
    .sort()

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'af-template-3d-'))
  dir = join(root, 'game')
  await Effect.runPromise(
    createGame({ targetDir: dir, id: 'hall-game', title: 'Hall Game', template: '3d', threeD: true }),
  )
  files = listing(dir)
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('the new 3D game’s files', () => {
  it('keeps its code in features, with the app and the shared numbers beside them', () => {
    expect(files.filter((file) => file.startsWith('src/') || file.startsWith('tests/'))).toEqual([
      'src/app/controls.ts',
      'src/app/feel-audio.ts',
      'src/app/game.ts',
      'src/features/room/compiled-content.d.ts',
      'src/features/room/read-room.ts',
      'src/features/room/room.ts',
      'src/features/room/room.view.ts',
      'src/features/wick/bumped.event.ts',
      'src/features/wick/move.command.ts',
      'src/features/wick/walk.system.ts',
      'src/features/wick/wick.component.ts',
      'src/features/wick/wick.plugin.ts',
      'src/features/wick/wick.view.ts',
      'src/main.ts',
      'src/shared/constants.ts',
      'src/shared/screen.ts',
      'src/shared/tuning.ts',
      'tests/unit/content/content.test.ts',
      'tests/unit/room/read-room.test.ts',
      'tests/unit/wick/wick-walk.test.ts',
    ])
  })

  it('has one room, Wick, a tuning file and the editor list that opens them (Characters gets every figure folder: Wick names his swatches and gait)', () => {
    expect(files.filter((file) => file.startsWith('content/'))).toEqual(
      TEMPLATE_3D_CONTENT_PATHS.map((path) => `content/${path}`).sort(),
    )
    expect(files).toContain('content/levels/room.af-sector.json')
    expect(files).toContain('content/figures/wick.toml')
    expect(files).toContain('content/tuning.toml')
    const list = parse(read('content/editors.toml')) as { file: { glob: string; editor: string }[] }
    expect(list.file.map((row) => [row.glob, row.editor])).toEqual([
      ['content/levels/*.af-sector.json', 'levels-3d'],
      ['content/figure*/*.toml', 'studio'],
      ['content/tuning.toml', 'tuner'],
      ['content/feel/*.toml', 'feel'],
      ['content/audio/*.toml', 'audio'],
      ['assets/music/*', 'audio'],
    ])
  })

  it('has a room with a box prop, a cylinder prop and one spawn', () => {
    const room = JSON.parse(read('content/levels/room.af-sector.json')) as {
      format: string
      props: { use: string }[]
      entities: { def: string }[]
    }
    expect(room.format).toBe('af-sector/2')
    const kinds = new Set(
      ['crate', 'barrel'].map(
        (name) => (parse(read(`content/world-props/${name}.toml`)) as { kind: string }).kind,
      ),
    )
    expect([...kinds].sort()).toEqual(['box', 'cylinder'])
    expect(new Set(room.props.map((prop) => prop.use))).toEqual(new Set(['crate', 'barrel']))
    expect(room.entities.filter((entity) => entity.def === 'spawn')).toHaveLength(1)
  })

  it('has something to feel and hear at once: Wick bumping into a wall', () => {
    expect(read('src/features/wick/bumped.event.ts')).toContain("defineEvent('wick.bumped'")
    expect(read('src/features/wick/walk.system.ts')).toContain('ctx.emit(Bumped')
    expect(read('content/feel/feel.toml')).toContain('on = "wick.bumped"')
    expect(read('content/audio/audio.toml')).toContain('on = "wick.bumped"')
    for (const row of ['feel', 'audio'])
      expect(editorRows(row)?.match(/glob = "([^"]+)"/g)?.length, row).toBeGreaterThan(0)
    const rows = (parse(read('content/editors.toml')) as { file: { glob: string; editor: string }[] }).file
    for (const id of ['feel', 'audio'])
      for (const glob of (editorRows(id)?.match(/glob = "([^"]+)"/g) ?? []).map((line) => line.slice(8, -1)))
        expect(
          rows.some((row) => row.glob === glob && row.editor === id),
          `${id} ${glob}`,
        ).toBe(true)
  })

  it('plays what Feel and Audio make: on the renderer and on the audio, read from the files the editors write', () => {
    const game = read('src/app/game.ts')
    expect(game).toContain('setup: feelOnStage')
    expect(game).toContain('audio,')
    const wiring = read('src/app/feel-audio.ts')
    expect(wiring).toContain('feelSchema.parse(content.feel?.feel ?? {})')
    expect(wiring).toContain('audioSchema.parse(content.audio?.audio ?? {})')
    expect(wiring).toContain('/assets/music/*')
    expect(read('src/shared/screen.ts')).toContain('targetSize(')
  })

  it('plays Feel and Audio the way the 2D game does, differing only in where the size comes from', () => {
    const twoD = feelAudioFile({
      import: "import { LEVEL } from '../features/level/level.ts'",
      expr: '{ width: LEVEL.width, height: LEVEL.height }',
    }).content({ id: 'g', title: 'G' } as never)
    const swapped = twoD
      .replace(
        "import { LEVEL } from '../features/level/level.ts'",
        "import { SIZE } from '../shared/screen.ts'",
      )
      .replace('{ width: LEVEL.width, height: LEVEL.height }', 'SIZE')
    expect(read('src/app/feel-audio.ts')).toBe(swapped)
  })

  it('names no source project and no plan id in anything it writes', () => {
    for (const file of files) expect(read(file), file).not.toMatch(NO_SOURCE_NAMES)
  })

  it('keeps the sim free of the renderer, so its tests need no browser', () => {
    for (const file of files.filter((each) => /^src\/features\/(wick|room)\/(?!\w+\.view)/.test(each)))
      expect(read(file), file).not.toMatch(/from '@automata\/framework'|from '@automata\/3d'|pixi/)
  })
})

describe('the new 3D game’s project', () => {
  const manifest = () =>
    JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }

  it('depends on the 3D package and Pixi 3D as well as the framework', () => {
    const { dependencies } = manifest()
    for (const name of [
      '@automata/framework',
      '@automata/3d',
      '@automata/content',
      '@automata/sim',
      '@pixi/3d',
    ])
      expect(dependencies[name], name).toBeDefined()
    // Feel and Audio play what their editors make, in the version that made the game.
    expect(dependencies['@automata/feel']).toBe(dependencies['@automata/framework'])
    expect(dependencies['@automata/audio-synth']).toBe(dependencies['@automata/framework'])
  })

  it('tests and checks with one command each, like the 2D game', () => {
    expect(manifest().scripts.test).toBe('vitest run')
    expect(manifest().scripts.check).toBe('automata check')
    expect(manifest().scripts['build:web']).toBe('vite build --mode web')
  })

  it('compiles the figures, swatches and props with the 3D content kinds', () => {
    const config = read('vite.config.ts')
    expect(config).toContain("from '@automata/3d/figures'")
    expect(config).toContain("from '@automata/3d/world-content'")
    expect(config).toContain('figuresExtension.content')
    expect(config).toContain('worldSwatchContent')
    expect(config).toContain('worldPropContent')
    expect(config).toContain('feelContent')
    expect(config).toContain('audioContent')
    expect(read('.gitignore').split('\n')).toContain('content/generated/')
  })

  it('plays landscape and declares its inputs, the stick and the pad', () => {
    expect(read('ship.config.ts')).toContain("orientation: 'landscape'")
    expect(read('ship.config.ts')).toContain("inputs: ['touch', 'keyboard', 'gamepad']")
    expect(read('src/app/game.ts')).toContain("orientation: 'landscape'")
  })

  it('starts the game from main.ts, with the 3D no-eval entry first', () => {
    const main = read('src/main.ts')
    expect(main.indexOf("import '@automata/3d/no-eval'")).toBeGreaterThan(-1)
    expect(main.indexOf("import '@automata/3d/no-eval'")).toBeLessThan(main.indexOf("from './app/game.ts'"))
    expect(main).toContain('startGame(game)')
    expect(main).toContain("import.meta.hot.accept('./app/game.ts'")
  })

  it('has a README that says where the room, Wick and the numbers are', () => {
    const readme = read('README.md')
    for (const where of [
      'pnpm dev',
      'src/features/wick/',
      'src/features/room/',
      'content/levels/room.af-sector.json',
      'content/figures/wick.toml',
      'content/tuning.toml',
      'automata editor',
      'pnpm test',
      'pnpm check',
    ])
      expect(readme, where).toContain(where)
    expect(readme).not.toMatch(/square|docs\/guides|github\.com|workspace:|\.\.\/\.\.\//)
  })
})

describe('--template', () => {
  const into = (name: string) => join(root, name)

  it('without the 3D package says so, exits through the error and writes nothing', async () => {
    const target = into('refused')
    const result = await Effect.runPromise(
      Effect.flip(
        createGame({ targetDir: target, id: 'refused', title: 'Refused', template: '3d', threeD: false }),
      ),
    )
    expect(result.reason).toBe('three-d-unavailable')
    expect(result.message).toBe(THREE_D_NOT_PUBLIC)
    expect(existsSync(target)).toBe(false)
  })

  it('without a template makes the 2D game it always made, whether or not 3D is available', async () => {
    const target = into('plain')
    await Effect.runPromise(createGame({ targetDir: target, id: 'plain', title: 'Plain', threeD: true }))
    expect(existsSync(join(target, 'src/features/square/square.plugin.ts'))).toBe(true)
    expect(existsSync(join(target, 'content/levels/room.af-sector.json'))).toBe(false)
  })

  it('with template 2d is the same 2D game', async () => {
    const target = into('two-d')
    await Effect.runPromise(createGame({ targetDir: target, id: 'two-d', title: 'Two D', template: '2d' }))
    expect(listing(target)).toEqual(listing(into('plain')))
  })
})

describe('the 3D template folder', () => {
  it('lists every file under template-3d-content/, and no other', () => {
    const folder = fileURLToPath(
      new URL('../../../../src/shared/create-game/template-3d-content', import.meta.url),
    )
    expect([...TEMPLATE_3D_CONTENT_PATHS].sort()).toEqual(listing(folder))
  })
})
