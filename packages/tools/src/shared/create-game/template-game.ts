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

/** Where the square's centre is, in the game's pixels. */
export const Square = defineComponent('square', { x: 'f32', y: 'f32' })
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
import { SPEED, SQUARE_SIZE } from '../../shared/constants.ts'
import { levelIn } from '../level/read-level.ts'
import { hitsWall } from '../level/walls.ts'
import { Move } from './move.command.ts'
import { Square } from './square.component.ts'

/**
 * Moves the square by what the player holds, unless a wall is in the way. Only the sim changes the game, so a replay
 * ends where play did.
 */
export const move = defineSystem('move', (ctx) => {
  const level = levelIn(ctx.content)
  for (const { payload } of ctx.commands.of(Move))
    for (const square of ctx.query(Square)) {
      const { x, y } = square.get(Square)
      // One axis at a time, so a square pushed into a wall at an angle slides along it instead of stopping.
      const nextX = x + payload.x * SPEED
      const movedX = hitsWall(level, nextX, y, SQUARE_SIZE) ? x : nextX
      const nextY = y + payload.y * SPEED
      const movedY = hitsWall(level, movedX, nextY, SQUARE_SIZE) ? y : nextY
      square.set(Square, { x: movedX, y: movedY })
    }
})
`,
  },
  {
    path: 'src/features/square/square.plugin.ts',
    content: (options) => `import { definePlugin } from '@automata/sim'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'
import { Square } from './square.component.ts'

/** The square's part of the sim: what it holds, what it hears and what runs each tick. */
export const squarePlugin = definePlugin({ name: '${options.id}', defs: [Square, Move, move] })
`,
  },
  {
    path: 'src/features/square/square.view.ts',
    content: () => `import { pictureView } from '@automata/framework'
import { images, project } from '../level/level-scene.ts'
import { SQUARE_SIZE } from '../../shared/constants.ts'
import { Square } from './square.component.ts'

/**
 * How the square is drawn: as the player start looks in the editor (change it in Characters, press Save). The square's
 * position is its centre and the character stands on its pivot, its feet, so the picture sits half a square lower.
 */
export const squareView = {
  [Square.id]: pictureView(project, 'player-start', images, { offset: { x: 0, y: SQUARE_SIZE / 2 } }),
}
`,
  },
]

/** The game's code and its tests. */
export const GAME_FILES: readonly TemplateFile[] = [
  {
    path: 'src/shared/constants.ts',
    content:
      () => `// The numbers the game is built from. Both the sim and the screen read them, so they live here. The game's size is
// its level's (content/levels/start.af2d.json, made in the 2D editor).

/** How far the square moves each tick, in the game's pixels. */
export const SPEED = 2

/** The square's side, in the game's pixels. */
export const SQUARE_SIZE = 8
`,
  },
  ...LEVEL_FILES,
  ...SQUARE_FILES,
  {
    path: 'src/app/game.ts',
    content: (options) => `import { defaultContent, defineGame, keys } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'
import { LEVEL_SCENE } from '../features/level/level-scene.ts'
import { Move } from '../features/square/move.command.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { squareView } from '../features/square/square.view.ts'
import { SQUARE_SIZE } from '../shared/constants.ts'

/** ${options.title}: a square the player moves around the level, on the default title, play and pause screens. */
export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: {
    plugins: [squarePlugin],
    seed: 1,
    // The square stands on the level's player start: its bottom edge there, so its centre half a square higher.
    setup: (sim) => {
      sim.spawn([[Square, { x: LEVEL.start.x, y: LEVEL.start.y - SQUARE_SIZE / 2 }]])
    },
  },
  // The default screens' flow, and the level as the sim's content (what its systems read as \`ctx.content\`).
  content: { ...defaultContent(), sim: LEVEL },
  // Arrows or WASD, or the pad's D-pad; on a touch screen, buttons.
  input: keys(
    Move,
    {
      ArrowLeft: { x: -1 },
      KeyA: { x: -1 },
      ArrowRight: { x: 1 },
      KeyD: { x: 1 },
      ArrowUp: { y: -1 },
      KeyW: { y: -1 },
      ArrowDown: { y: 1 },
      KeyS: { y: 1 },
    },
    { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
  ),
  views: squareView,
  // The level's tiles and placed characters, drawn by core from what the editor saved.
  level: LEVEL_SCENE,
})
`,
  },
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
    path: 'tests/unit/square/square-move.test.ts',
    content: (options) => `import { createSim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '../../../src/features/level/level.ts'
import { Move } from '../../../src/features/square/move.command.ts'
import { Square } from '../../../src/features/square/square.component.ts'
import { squarePlugin } from '../../../src/features/square/square.plugin.ts'
import { SPEED, SQUARE_SIZE } from '../../../src/shared/constants.ts'

// The sim is plain code, so its test needs no browser: make a sim on the level, send it commands, read what it holds.
const OPEN = { x: 100, y: 50 }
const ON_THE_START = { x: LEVEL.start.x, y: LEVEL.start.y - SQUARE_SIZE / 2 }

async function squareAfter(moves: readonly { x?: number; y?: number }[], from = OPEN) {
  const sim = await createSim({ seed: 1, tickHz: 60, plugins: [squarePlugin], content: LEVEL })
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
    expect(position).toEqual({ x: OPEN.x + SPEED, y: OPEN.y })
  })

  it('stays put when the player holds nothing', async () => {
    const { position } = await squareAfter([{}])
    expect(position).toEqual(OPEN)
  })

  it('stops at the floor', async () => {
    const { position } = await squareAfter([{ y: 1 }, { y: 1 }], ON_THE_START)
    expect(position).toEqual(ON_THE_START)
  })

  it('ends in the same state every time the same moves are played', async () => {
    const moves = [{ x: 1 }, { y: -1 }, { x: -1, y: 1 }]
    expect((await squareAfter(moves)).hash).toBe((await squareAfter(moves)).hash)
  })
})
`,
  },
]
