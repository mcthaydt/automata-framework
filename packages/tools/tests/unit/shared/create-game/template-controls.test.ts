import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { controlsFileSchema } from '@automata/content/controls'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'

// A new game's default controls are data: content/controls.toml, which the Tuner edits, read by the game's
// `controlsFrom`. The arrows, WASD and the D-pad moved out of the code unchanged.

let dir: string
const read = (path: string): string => readFileSync(join(dir, path), 'utf8')

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'af-template-controls-'))
  await Effect.runPromise(
    createGame({ targetDir: join(dir, 'game'), id: 'square-game', title: 'Square Game' }),
  )
  dir = join(dir, 'game')
})
afterAll(() => rmSync(join(dir, '..'), { recursive: true, force: true }))

describe('the new game’s controls', () => {
  it('are a controls file the schema reads: arrows and WASD for each direction, and the D-pad', () => {
    const file = controlsFileSchema.parse(parse(read('content/controls.toml')))
    expect(file.command).toBe('move')
    expect(file.action.map((action) => [action.id, action.label, action.send])).toEqual([
      ['left', 'Left', { x: -1 }],
      ['right', 'Right', { x: 1 }],
      ['up', 'Up', { y: -1 }],
      ['down', 'Down', { y: 1 }],
    ])
    expect(file.action.map((action) => action.keys)).toEqual([
      ['ArrowLeft', 'KeyA'],
      ['ArrowRight', 'KeyD'],
      ['ArrowUp', 'KeyW'],
      ['ArrowDown', 'KeyS'],
    ])
    expect(file.action.map((action) => action.pad)).toEqual([[14], [15], [12], [13]])
  })

  it('are read by the game with controlsFrom, and compiled with the controls kind', () => {
    const game = read('src/app/game.ts')
    expect(game).toContain('controlsFrom(Move, CONTROLS)')
    expect(game).not.toContain('keys(')
    expect(read('vite.config.ts')).toContain(
      'automataContent({ schemas: [...level2dKinds(), controlsKind()] })',
    )
    expect(read('src/features/level/compiled-content.d.ts')).toContain('readonly controls?: unknown')
  })

  it('are listed for the Tuner in the editors list, beside the level', () => {
    const list = read('content/editors.toml')
    expect(list).toContain('glob = "content/levels/*.af2d.json"')
    expect(list).toContain('glob = "content/controls.toml"')
    expect(list).toContain('editor = "tuner"')
  })
})
