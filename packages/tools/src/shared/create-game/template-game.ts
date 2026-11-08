import { feelAudioFile } from './template-feel-audio.ts'
import type { TemplateFile } from './template-file.ts'
import { LEVEL_FILES } from './template-level.ts'

// The game itself: a square the player moves around a level, to show the shape every game has: the sim in
// `src/features/<name>/`, the code both the sim and the screen read in `src/shared/`, the wiring in `src/app/`, and tests
// of the sim. The level feature is in template-level.ts; the level itself is in `content/` (template-content.ts).

/** The square feature: what it holds, what the player sends it, how it moves and how it looks. */
const SQUARE_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/square/square.component.ts',
    content: () => `import { defineComponent } from '@automata/sim'

/** Where the square's centre is, in the game's pixels, and whether it was pressed into a wall last tick. */
export const Square = defineComponent('square', { x: 'f32', y: 'f32', blocked: 'bool' })
`,
  },
  {
    path: 'src/features/square/bumped.event.ts',
    content: () => `import { defineEvent } from '@automata/sim'
import { z } from 'zod'

/**
 * The square met a wall it was pushed into. Feel and Audio answer events like this one: open \`content/feel/feel.toml\`
 * or \`content/audio/audio.toml\` in the editors and change what the player feels and hears.
 */
export const Bumped = defineEvent('square.bumped', z.object({}))
`,
  },
  {
    path: 'src/features/square/move.command.ts',
    content: () => `import { defineCommand } from '@automata/sim'
import { z } from 'zod'

const axis = z.number().int().min(-1).max(1).default(0)

/** What the player holds this tick: -1, 0 or 1 on each axis. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
`,
  },
  {
    path: 'src/features/square/move.system.ts',
    content: () => `import { defineSystem } from '@automata/sim'
import { playIn } from '../level/read-level.ts'
import { hitsWall } from '../level/walls.ts'
import { Bumped } from './bumped.event.ts'
import { Move } from './move.command.ts'
import { Square } from './square.component.ts'

/**
 * Moves the square by what the player holds, unless a wall is in the way, and says so once when it first is. Only the
 * sim changes the game, so a replay ends where play did.
 */
export const move = defineSystem('move', (ctx) => {
  const { level, player, tuning } = playIn(ctx.content)
  for (const { payload } of ctx.commands.of(Move))
    for (const square of ctx.query(Square)) {
      const { x, y, blocked } = square.get(Square)
      // One axis at a time, so a square pushed into a wall at an angle slides along it instead of stopping.
      const nextX = x + payload.x * tuning.SPEED
      const movedX = hitsWall(level, nextX, y, player) ? x : nextX
      const nextY = y + payload.y * tuning.SPEED
      const movedY = hitsWall(level, movedX, nextY, player) ? y : nextY
      // Pressed into a wall: a move was asked for and none of it happened. Said once, not every tick it is held.
      const pressed = (payload.x !== 0 || payload.y !== 0) && movedX === x && movedY === y
      if (pressed && !blocked) ctx.emit(Bumped, {})
      square.set(Square, { x: movedX, y: movedY, blocked: pressed })
    }
})
`,
  },
  {
    path: 'src/features/square/square.plugin.ts',
    content: (options) => `import { definePlugin } from '@automata/sim'
import { Bumped } from './bumped.event.ts'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'
import { Square } from './square.component.ts'

/** The square's part of the sim: what it holds, what it hears, what it says and what runs each tick. */
export const squarePlugin = definePlugin({ name: '${options.id}', defs: [Square, Move, Bumped, move] })
`,
  },
  {
    path: 'src/features/square/square.view.ts',
    content: () => `import { pictureView } from '@automata/framework'
import { images, project } from '../level/level-scene.ts'
import { Square } from './square.component.ts'

/**
 * How the square is drawn: as the player start looks in the editor (change it in Characters, press Save). The square's
 * position is the character's pivot, the middle of its feet, so the picture stands where the square does and the box it
 * is drawn in is the box it collides with (src/features/level/player-box.ts).
 */
export const squareView = {
  [Square.id]: pictureView(project, 'player-start', images),
}
`,
  },
]

/** The game's code and its tests. */
export const GAME_FILES: readonly TemplateFile[] = [
  {
    path: 'src/shared/tuning.ts',
    content:
      () => `// The numbers a designer changes, in content/tuning.toml (the Tuner opens it). The compiler checks each against its
// range; this reads them once, so a missing one stops the game at boot with a sentence that says which.

/** The tunables content/tuning.toml holds. */
export interface Tuning {
  /** How far the square moves each tick, in the game's pixels. */
  readonly SPEED: number
}

/** The tunables of the game's compiled content (virtual:automata/content). */
export function tuningOf(content: unknown): Tuning {
  const table = (content as { readonly tuning?: Readonly<Record<string, unknown>> } | null)?.tuning
  const speed = table?.SPEED
  if (typeof speed !== 'number' || !(speed > 0))
    throw new Error('The content has no speed. Check content/tuning.toml.')
  return { SPEED: speed }
}
`,
  },
  ...LEVEL_FILES,
  ...SQUARE_FILES,
  {
    path: 'src/app/game.ts',
    content: (options) => `import { controlsFileSchema } from '@automata/content/controls'
import { controlsFrom, defaultContent, defineGame } from '@automata/framework'
import { content } from 'virtual:automata/content'
import { LEVEL } from '../features/level/level.ts'
import { playerBoxOf } from '../features/level/player-box.ts'
import { LEVEL_SCENE, project } from '../features/level/level-scene.ts'
import type { PlayContent } from '../features/level/read-level.ts'
import { Move } from '../features/square/move.command.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { squareView } from '../features/square/square.view.ts'
import { tuningOf } from '../shared/tuning.ts'
import { audio, feelOnStage } from './feel-audio.ts'

/** What the sim reads: the level, the player's box and the tuning. */
const PLAY: PlayContent = { level: LEVEL, player: playerBoxOf(project), tuning: tuningOf(content) }

/** The default controls, as content/controls.toml (arrows or WASD, the pad's D-pad, and touch buttons). */
if (content.controls === undefined) throw new Error('There is no controls file. Add content/controls.toml.')
const CONTROLS = controlsFileSchema.parse(content.controls)

/** ${options.title}: a square the player moves around the level, on the default title, play and pause screens. */
export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: {
    plugins: [squarePlugin],
    seed: 1,
    // The square stands on the level's player start: its position is its feet, as the editor's is.
    setup: (sim) => {
      sim.spawn([[Square, { x: LEVEL.start.x, y: LEVEL.start.y }]])
    },
  },
  // The default screens' flow, and the level and tuning as the sim's content (what its systems read as \`ctx.content\`).
  content: { ...defaultContent(), sim: PLAY },
  // The keys, pad buttons and touch buttons are content/controls.toml, which the Tuner edits.
  input: controlsFrom(Move, CONTROLS),
  views: squareView,
  // The level's tiles and placed characters, drawn by core from what the editor saved.
  level: LEVEL_SCENE,
  // What the player feels (shake, flash, words) and hears, from the files the Feel and Audio editors write.
  renderer: { setup: feelOnStage },
  audio,
})
`,
  },
  feelAudioFile({
    import: "import { LEVEL } from '../features/level/level.ts'",
    expr: '{ width: LEVEL.width, height: LEVEL.height }',
  }),
  {
    path: 'src/main.ts',
    content:
      () => `// The page's entry: starts the game. \`no-eval\` comes first, because the web targets allow no eval.
import '@automata/framework/no-eval'
import { startGame } from '@automata/framework'
import { game } from './app/game.ts'

let running = startGame(game)

// While \`pnpm dev\` runs, saving a level in the editor (or a setting in the Tuner) brings new content here
// through app/game.ts. The game starts over on it, on the same page and on the screen you were on: the old one shuts
// down first, one restart after another. A build has no \`import.meta.hot\`, so this never ships. Keep
// \`import.meta.hot.accept\` as written: Vite looks for it by name.
if (import.meta.hot) {
  let restarts = Promise.resolve()
  import.meta.hot.accept('./app/game.ts', (fresh) => {
    if (fresh === undefined) return
    restarts = restarts.then(async () => {
      const at = running.screen
      await running.shutdown()
      running = startGame(fresh.game, { at })
    })
  })
}
`,
  },
  {
    path: 'tests/unit/level/read-level.test.ts',
    content: () => `import { levelContentSchema } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '../../../src/features/level/level.ts'
import { levelOf, SOLID } from '../../../src/features/level/read-level.ts'

// A level as the editor exports it, cut down: 4 cells wide on a 16 px grid, a floor, and the player start on it.
const small = (items: { id: string; def: string; x: number; y: number }[]) =>
  levelContentSchema.parse({
    format: 'af2d-content',
    version: 1,
    id: 'small',
    name: 'Small',
    size: { w: 64, h: 32 },
    background: { color: '#000000', mode: 'fit' },
    fields: {},
    layers: [
      { def: 'entities', kind: 'entities', items: items.map((item) => ({ ...item, fields: {} })) },
      { def: 'collision', kind: 'intgrid', rows: ['.*4', '1*4'] },
    ],
  })

describe('reading a level', () => {
  it('reads its size, walls and player start', () => {
    const level = levelOf(small([{ id: '1', def: 'player-start', x: 24, y: 16 }]))
    expect(level).toMatchObject({ width: 64, height: 32, tile: 16, start: { x: 24, y: 16 } })
    expect(level.cells).toEqual([
      [0, 0, 0, 0],
      [SOLID, SOLID, SOLID, SOLID],
    ])
  })

  it('needs exactly one player start', () => {
    expect(() => levelOf(small([]))).toThrow('needs one player start')
  })

  it("reads the game's own level, with the start inside it", () => {
    expect(LEVEL.start.x).toBeGreaterThan(0)
    expect(LEVEL.start.x).toBeLessThan(LEVEL.width)
    expect(LEVEL.start.y).toBeLessThanOrEqual(LEVEL.height)
  })
})
`,
  },
  {
    path: 'tests/unit/level/player-box.test.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { projectContentSchema } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '../../../src/features/level/level.ts'
import { playerBoxOf } from '../../../src/features/level/player-box.ts'
import { hitsWall } from '../../../src/features/level/walls.ts'

// What you see is what touches: the player collides with the box it is drawn in, the size of the player start in
// Characters, standing on its feet.

const project = projectContentSchema.parse(content.project)

describe('the player’s box', () => {
  it('is the size of the player start in the project', () => {
    const start = project.entities.find((each) => each.id === 'player-start')
    expect(playerBoxOf(project)).toEqual({ w: start?.size.w, h: start?.size.h })
  })

  it('follows a resized player start with no code change', () => {
    const resized = {
      ...project,
      entities: project.entities.map((each) =>
        each.id === 'player-start' ? { ...each, size: { w: 12, h: 12 } } : each,
      ),
    }
    expect(playerBoxOf(resized)).toEqual({ w: 12, h: 12 })
  })

  it('stands on the level’s start without touching the floor, and touches it one pixel lower', () => {
    const box = playerBoxOf(project)
    expect(hitsWall(LEVEL, LEVEL.start.x, LEVEL.start.y, box)).toBe(false)
    expect(hitsWall(LEVEL, LEVEL.start.x, LEVEL.start.y + 1, box)).toBe(true)
  })

  it('reaches as high as it is tall: its head meets the ceiling, not its middle', () => {
    const box = playerBoxOf(project)
    expect(hitsWall(LEVEL, LEVEL.start.x, box.h, box)).toBe(false)
    expect(hitsWall(LEVEL, LEVEL.start.x, box.h - 1, box)).toBe(true)
  })
})
`,
  },
  {
    path: 'tests/unit/square/square-move.test.ts',
    content: (options) => `import { createSim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '../../../src/features/level/level.ts'
import { Bumped } from '../../../src/features/square/bumped.event.ts'
import { Move } from '../../../src/features/square/move.command.ts'
import { Square } from '../../../src/features/square/square.component.ts'
import { squarePlugin } from '../../../src/features/square/square.plugin.ts'
import type { PlayContent } from '../../../src/features/level/read-level.ts'

// The sim is plain code, so its test needs no browser: make a sim on the level, send it commands, read what it holds.
const SPEED = 2
const PLAY: PlayContent = { level: LEVEL, player: { w: 16, h: 24 }, tuning: { SPEED } }
const OPEN = { x: 100, y: 50 }
const ON_THE_START = { x: LEVEL.start.x, y: LEVEL.start.y }

async function squareAfter(moves: readonly { x?: number; y?: number }[], from = OPEN) {
  const sim = await createSim({ seed: 1, tickHz: 60, plugins: [squarePlugin], content: PLAY })
  sim.spawn([[Square, from]])
  for (const payload of moves)
    sim.step([{ tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload: { x: 0, y: 0, ...payload } }])
  const [square] = sim.query(Square)
  const result = { position: square?.get(Square), hash: sim.hash() }
  sim.dispose()
  return result
}

describe('${options.title}: the square', () => {
  it('moves one step in the direction the player holds', async () => {
    const { position } = await squareAfter([{ x: 1 }])
    expect(position).toMatchObject({ x: OPEN.x + SPEED, y: OPEN.y })
  })

  it('stays put when the player holds nothing', async () => {
    const { position } = await squareAfter([{}])
    expect(position).toMatchObject(OPEN)
  })

  it('stops at the floor', async () => {
    const { position } = await squareAfter([{ y: 1 }, { y: 1 }], ON_THE_START)
    expect(position).toMatchObject(ON_THE_START)
  })

  it('says it bumped once when it is pressed into the floor, not every tick it is held there', async () => {
    const sim = await createSim({ seed: 1, tickHz: 60, plugins: [squarePlugin], content: PLAY })
    sim.spawn([[Square, ON_THE_START]])
    const press = () =>
      sim.step([{ tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload: { x: 0, y: 1 } }])
    const bumps = [press(), press(), press()].map((result) => result.events.filter((e) => e.type === Bumped.id).length)
    expect(bumps).toEqual([1, 0, 0])
    sim.dispose()
  })

  it('ends in the same state every time the same moves are played', async () => {
    const moves = [{ x: 1 }, { y: -1 }, { x: -1, y: 1 }]
    expect((await squareAfter(moves)).hash).toBe((await squareAfter(moves)).hash)
  })
})
`,
  },
]
