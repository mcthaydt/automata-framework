import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { type ContentProject, projectContentSchema } from '@automata/content/level-2d'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'

// What you see is what touches: the player's box is the size of the `player-start` character in the level project, and
// its position is the middle of its feet, as every other placed character's is. The new game's own code is imported
// from the folder it was written to, so these tests run the template's code, not a copy of it.

const SCRATCH = join(process.cwd(), 'scratch-player-box-test')

interface Box {
  readonly w: number
  readonly h: number
}
interface Level {
  readonly width: number
  readonly height: number
  readonly tile: number
  readonly cells: readonly (readonly number[])[]
  readonly start: { readonly x: number; readonly y: number }
}
interface Games {
  readonly dir: string
  readonly read: (path: string) => string
  readonly files: string[]
}

const make = async (name: string, story: boolean): Promise<Games> => {
  const dir = join(SCRATCH, name)
  await Effect.runPromise(createGame({ targetDir: dir, id: name, title: name, story }))
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
  return { dir, files, read: (path) => readFileSync(join(dir, path), 'utf8') }
}

let plain: Games
let story: Games
beforeAll(async () => {
  rmSync(SCRATCH, { recursive: true, force: true })
  mkdirSync(SCRATCH, { recursive: true })
  plain = await make('plain-game', false)
  story = await make('story-game', true)
})
afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }))

const project = (game: Games, size?: { w: number; h: number }) => {
  const raw = parse(game.read('content/project.toml')) as {
    entities: { id: string; size: { w: number; h: number } }[]
  }
  const start = raw.entities.find((each) => each.id === 'player-start')
  if (start !== undefined && size !== undefined) start.size = size
  return projectContentSchema.parse(raw)
}

const walls = (game: Games) =>
  import(join(game.dir, 'src/features/level/walls.ts')) as Promise<{
    hitsWall: (level: Level, x: number, y: number, box: Box) => boolean
  }>
const boxes = (game: Games) =>
  import(join(game.dir, 'src/features/level/player-box.ts')) as Promise<{
    playerBoxOf: (project: ContentProject) => Box
  }>

// Four cells of 16 px: open above a floor. The cell at (row 1, column 2) is a wall, so a wall's left edge is at x = 32.
const LEVEL: Level = {
  width: 64,
  height: 64,
  tile: 16,
  cells: [
    [0, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0],
    [1, 1, 1, 1],
  ],
  start: { x: 8, y: 48 },
}

describe.each([
  ['the plain game', () => plain],
  ['the game with the story', () => story],
])('%s: the player’s box', (_name, which) => {
  it('takes the box from the player start, 16 by 24 in the starter', async () => {
    const game = which()
    expect(game.files).toContain('src/features/level/player-box.ts')
    expect((await boxes(game)).playerBoxOf(project(game))).toEqual({ w: 16, h: 24 })
  })

  it('follows a resized player start with no code change', async () => {
    const game = which()
    expect((await boxes(game)).playerBoxOf(project(game, { w: 12, h: 12 }))).toEqual({ w: 12, h: 12 })
  })

  it('says which character is missing', async () => {
    const game = which()
    const empty = { ...project(game), entities: [] }
    const { playerBoxOf } = await boxes(game)
    expect(() => playerBoxOf(empty)).toThrow('"player-start"')
  })

  it('touches a wall exactly where the picture does: the box stands on its feet, right and bottom edges open', async () => {
    const { hitsWall } = await walls(which())
    const box = { w: 16, h: 24 }
    // Feet at x = 24 put the box's right edge at exactly 32, the wall's left edge: not a touch; half a pixel further is.
    expect(hitsWall(LEVEL, 24, 40, box)).toBe(false)
    expect(hitsWall(LEVEL, 24.5, 40, box)).toBe(true)
    // Standing on the floor (feet on its top edge, y = 48) is not inside it; a pixel lower is.
    expect(hitsWall(LEVEL, 8, 48, box)).toBe(false)
    expect(hitsWall(LEVEL, 8, 49, box)).toBe(true)
    // The box is 24 tall, so its head reaches the ceiling at feet y = 24, not at y = 4.
    expect(hitsWall(LEVEL, 8, 24, box)).toBe(false)
    expect(hitsWall(LEVEL, 8, 23, box)).toBe(true)
  })

  it('is read by the game: the sim’s content carries it, and nothing is drawn offset or sized by a constant', () => {
    const game = which()
    const all = game.files.filter((file) => file.endsWith('.ts')).map((file) => game.read(file))
    expect(all.some((text) => text.includes('SQUARE_SIZE'))).toBe(false)
    expect(game.read('src/features/square/square.view.ts')).not.toContain('offset')
    expect(game.read('src/features/square/move.system.ts')).toContain('player')
    expect(existsSync(join(game.dir, 'src/features/level/player-box.ts'))).toBe(true)
  })
})

describe('where the square stands at the start', () => {
  it('is the level’s start, with no offset, in the plain game', () => {
    expect(plain.read('src/app/game.ts')).toContain('player: playerBoxOf(')
    expect(plain.read('src/app/game.ts')).toMatch(/x: LEVEL\.start\.x, y: LEVEL\.start\.y \}/)
  })

  it('is the placed player start, with no offset, in the game with the story', () => {
    expect(story.read('src/app/story-sim.ts')).toContain('player: playerBoxOf(')
    expect(story.read('src/app/story-sim.ts')).toContain('{ x: start.x, y: start.y }')
  })
})
