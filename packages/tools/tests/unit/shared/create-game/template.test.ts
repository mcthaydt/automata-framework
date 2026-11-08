import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'

// What a new game is made of: two features (a square that moves, and the level it moves in), the app that wires them,
// shared numbers, the level the 2D editor opens, tests and the scripts that run them. A stranger's first look at the code is this layout, so it is pinned (the guide describes it).

let dir: string
let files: string[]
const read = (path: string): string => readFileSync(join(dir, path), 'utf8')

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'af-template-'))
  await Effect.runPromise(
    createGame({ targetDir: join(dir, 'game'), id: 'square-game', title: 'Square Game' }),
  )
  dir = join(dir, 'game')
  files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort()
})

afterAll(() => rmSync(join(dir, '..'), { recursive: true, force: true }))

describe('the new game’s files', () => {
  it('keeps its code in two features, with the app and the shared numbers beside them', () => {
    expect(files.filter((file) => file.startsWith('src/') || file.startsWith('tests/'))).toEqual([
      'src/app/feel-audio.ts',
      'src/app/game.ts',
      'src/features/level/compiled-content.d.ts',
      'src/features/level/level-scene.ts',
      'src/features/level/level.ts',
      'src/features/level/read-level.ts',
      'src/features/level/walls.ts',
      'src/features/square/bumped.event.ts',
      'src/features/square/move.command.ts',
      'src/features/square/move.system.ts',
      'src/features/square/square.component.ts',
      'src/features/square/square.plugin.ts',
      'src/features/square/square.view.ts',
      'src/main.ts',
      'src/shared/constants.ts',
      'tests/unit/level/read-level.test.ts',
      'tests/unit/square/square-move.test.ts',
    ])
  })

  it('has a level the 2D editor opens, and the game files its Save writes', () => {
    expect(files.filter((file) => file.startsWith('content/'))).toEqual([
      'content/audio/audio.toml',
      'content/controls.toml',
      'content/editors.toml',
      'content/feel/feel.toml',
      'content/levels/start.af2d.json',
      'content/levels/start.toml',
      'content/project.toml',
      'content/world.toml',
    ])
    const list = read('content/editors.toml')
    expect(list).toContain('glob = "content/levels/*.af2d.json"')
    expect(list).toContain('editor = "levels-2d"')
    expect(list).toContain('exports = "content"')
  })

  it('compiles the level into the game with the content plugin', () => {
    const config = read('vite.config.ts')
    expect(config).toContain(
      'automataContent({ schemas: [...level2dKinds(), controlsKind(), feelContent, audioContent] })',
    )
    expect(read('.gitignore').split('\n')).toContain('content/generated/')
  })

  it('has no src/sim folder and no files laid out by role', () => {
    expect(files.some((file) => file.startsWith('src/sim/'))).toBe(false)
    expect(
      files.filter((file) => /^src\/(constants|components|commands|systems|state|views)\.ts$/.test(file)),
    ).toEqual([])
  })

  it('starts the game from main.ts, with the no-eval entry first', () => {
    const main = read('src/main.ts')
    expect(main.indexOf("import '@automata/framework/no-eval'")).toBeGreaterThan(-1)
    expect(main.indexOf("import '@automata/framework/no-eval'")).toBeLessThan(
      main.indexOf("from './app/game.ts'"),
    )
    expect(main).toContain('startGame(game)')
  })

  it('restarts the game in place when a saved level or setting changes the content in dev', () => {
    // The content plugin sends an HMR update after each good save; main.ts accepts it through app/game.ts, shuts
    // the running game down and starts the new one, so the page is not reloaded.
    const main = read('src/main.ts')
    expect(main).toContain("import.meta.hot.accept('./app/game.ts'")
    expect(main).toContain('await running.shutdown()')
    // Back on the screen the person was on, so a tuning change is felt without pressing Play again.
    expect(main).toContain('startGame(fresh.game, { at })')
  })

  it('keeps the sim free of the renderer, so its tests need no browser', () => {
    for (const file of files.filter((each) =>
      /^src\/features\/(square|level)\/(?!\w+\.view|level-scene)/.test(each),
    )) {
      expect(read(file), file).not.toMatch(/from '@automata\/framework'|pixi/)
    }
  })
})

describe('the new game’s README', () => {
  it('starts with how to run it, says where the code is, and points at the site, not the repository', () => {
    const readme = read('README.md')
    expect(readme).toContain('pnpm dev')
    for (const where of [
      'src/features/square/',
      'src/shared/constants.ts',
      'src/app/game.ts',
      'content/levels/start.af2d.json',
      'automata editor',
    ])
      expect(readme, where).toContain(where)
    expect(readme).toContain('pnpm test')
    expect(readme).toContain('pnpm check')
    expect(readme).not.toMatch(/docs\/guides|github\.com|workspace:|\.\.\/\.\.\//)
  })
})

describe('the tools package’s README', () => {
  it('starts with the one command that makes a game, with no install first', () => {
    const readme = readFileSync(new URL('../../../../README.md', import.meta.url), 'utf8')
    const firstCommand = /```sh\n([^\n]+)/.exec(readme)?.[1] ?? ''
    expect(firstCommand).toMatch(/^pnpm dlx @automata\/tools create-game my-game/)
    expect(readme).not.toContain('github.com/mcthaydt/automata-framework')
  })
})

describe('the new game’s scripts and config', () => {
  const manifest = () =>
    JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }

  it('tests and checks with one command each', () => {
    expect(manifest().scripts.test).toBe('vitest run')
    expect(manifest().scripts.check).toBe('automata check')
    expect(manifest().devDependencies.vitest).toBeDefined()
  })

  it('depends on the content package, which compiles and reads the level', () => {
    expect(manifest().dependencies['@automata/content']).toBeDefined()
  })

  it('declares the pad in ship.config.ts, because keys() binds it', () => {
    expect(read('ship.config.ts')).toContain("inputs: ['touch', 'keyboard', 'gamepad']")
  })

  it('type-checks the tests too', () => {
    expect(JSON.parse(read('tsconfig.json')).include).toContain('tests/**/*.ts')
  })

  it('has a first test: a move command moves the square one step, a wall stops it, and the hash is the same each run', () => {
    const test = read('tests/unit/square/square-move.test.ts')
    expect(test).toContain('SPEED')
    expect(test).toContain('stops at the floor')
    expect(test).toContain('hash()')
  })
})

describe('the new game plays what Feel and Audio make', () => {
  it('asks for the packages that play them, in the version that made the game', () => {
    const dependencies = (JSON.parse(read('package.json')) as { dependencies: Record<string, string> })
      .dependencies
    expect(dependencies['@automata/feel']).toBe(dependencies['@automata/framework'])
    expect(dependencies['@automata/audio-synth']).toBe(dependencies['@automata/framework'])
  })

  it('puts Feel on the renderer and Audio on the audio, both read from the files the editors write', () => {
    const game = read('src/app/game.ts')
    expect(game).toContain('renderer: { setup: feelOnStage }')
    expect(game).toContain('audio,')
    const wiring = read('src/app/feel-audio.ts')
    expect(wiring).toContain('feelSchema.parse(content.feel?.feel ?? {})')
    expect(wiring).toContain('audioSchema.parse(content.audio?.audio ?? {})')
    expect(wiring).toContain('/assets/music/*')
  })

  it('has something to feel and hear at once: the square bumping into a wall', () => {
    expect(read('src/features/square/bumped.event.ts')).toContain("defineEvent('square.bumped'")
    expect(read('src/features/square/move.system.ts')).toContain('ctx.emit(Bumped')
    expect(read('content/feel/feel.toml')).toContain('on = "square.bumped"')
    expect(read('content/audio/audio.toml')).toContain('on = "square.bumped"')
  })

  it('lists Feel and Audio, which it plays, and not Writer and Sequence, which it has no box or cutscenes for', () => {
    const list = read('content/editors.toml')
    expect(list).toContain('editor = "feel"')
    expect(list).toContain('editor = "audio"')
    expect(list).not.toContain('editor = "writer"')
    expect(list).not.toContain('editor = "sequence"')
  })
})

describe('the new game shows what the editor made', () => {
  it('draws the level with core and its square as the player start looks, not with its own rectangles', () => {
    const game = read('src/app/game.ts')
    expect(game).toContain('level: LEVEL_SCENE')
    expect(read('src/features/square/square.view.ts')).toContain(
      "pictureView(project, 'player-start', images",
    )
    expect(game).not.toContain('drawLevel')
    for (const file of files.filter((name) => name.startsWith('src/')))
      expect(read(file), file).not.toContain('WALL_COLOR')
  })

  it('reads its pictures from assets/, where Add tiles writes them, and leaves the player start to its own view', () => {
    const scene = read('src/features/level/level-scene.ts')
    expect(scene).toContain("import.meta.glob('/assets/*.{png,webp,jpg,jpeg}'")
    expect(scene).toContain('live: liveCharacters(project)')
    expect(scene).toContain('start: START')
  })

  it('ships an Area definition, so a person can place and stretch areas in Levels', () => {
    const project = read('content/project.toml')
    expect(project).toContain('id = "area"')
    expect(project).toContain('tags = [ "area" ]')
    expect(project).toContain('resizable = "xy"')
  })
})
