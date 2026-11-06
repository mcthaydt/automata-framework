import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'

// What a new game is made of: one feature (a square that moves), the app that wires it, shared numbers, a test and the
// scripts that run it. A stranger's first look at the code is this layout, so it is pinned (the guide describes it).

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
  it('keeps its code in one feature, with the app and the shared numbers beside it', () => {
    expect(files.filter((file) => file.startsWith('src/') || file.startsWith('tests/'))).toEqual([
      'src/app/game.ts',
      'src/features/square/move.command.ts',
      'src/features/square/move.system.ts',
      'src/features/square/square.component.ts',
      'src/features/square/square.plugin.ts',
      'src/features/square/square.view.ts',
      'src/main.ts',
      'src/shared/constants.ts',
      'tests/unit/square/square-move.test.ts',
    ])
  })

  it('has no src/sim folder and no files laid out by role', () => {
    expect(files.some((file) => file.startsWith('src/sim/'))).toBe(false)
    expect(
      files.filter((file) => /^src\/(constants|components|commands|systems|state|views)\.ts$/.test(file)),
    ).toEqual([])
  })

  it('starts the game from main.ts, with the no-eval entry first', () => {
    const main = read('src/main.ts')
    expect(main.indexOf("import '@mcthaydt/automata/no-eval'")).toBeGreaterThan(-1)
    expect(main.indexOf("import '@mcthaydt/automata/no-eval'")).toBeLessThan(
      main.indexOf("from './app/game.ts'"),
    )
    expect(main).toContain('startGame(game)')
  })

  it('keeps the sim plugin free of the renderer, so its test needs no browser', () => {
    for (const file of files.filter((each) => /^src\/features\/square\/(?!square\.view)/.test(each))) {
      expect(read(file), file).not.toMatch(/from '@mcthaydt\/automata'|pixi/)
    }
  })
})

describe('the new game’s scripts and config', () => {
  const manifest = () =>
    JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }

  it('tests and checks with one command each', () => {
    expect(manifest().scripts.test).toBe('vitest run')
    expect(manifest().scripts.check).toBe('automata check')
    expect(manifest().devDependencies.vitest).toBeDefined()
  })

  it('declares the pad in ship.config.ts, because keys() binds it', () => {
    expect(read('ship.config.ts')).toContain("inputs: ['touch', 'keyboard', 'gamepad']")
  })

  it('type-checks the tests too', () => {
    expect(JSON.parse(read('tsconfig.json')).include).toContain('tests/**/*.ts')
  })

  it('has a first test: a move command moves the square one step, and the hash is the same each run', () => {
    const test = read('tests/unit/square/square-move.test.ts')
    expect(test).toContain('SPEED')
    expect(test).toContain('hash()')
  })
})
