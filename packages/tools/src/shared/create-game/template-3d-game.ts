import { ROOM_FILES } from './template-3d-room.ts'
import { WICK_FILES } from './template-3d-wick.ts'
import type { TemplateFile } from './template-file.ts'

// The 3D game itself: Wick walking around a room. The sim is in `src/features/wick/` (his state, the move command, the
// system that walks him) and `src/features/room/` (the room read into the floor, the props and the start); the code
// both the sim and the screen read is in `src/shared/`, the wiring in `src/app/`. Wick's `.view.ts` and the room's
// draw them; nothing else touches the renderer, so the sim's tests need no browser.

/** The game's code and its tests. */
export const GAME_3D_FILES: readonly TemplateFile[] = [
  {
    path: 'src/shared/constants.ts',
    content: () => `import { type CameraView, cameraView } from '@automata/3d/sim'

// The numbers the game is built from. Both the sim and the screen read them, so they live here. How fast Wick walks is
// not here: a designer changes it, in content/tuning.toml.

/** Fixed steps a second: the sim's default, which the page runs at. */
export const TICK_HZ = 60

/** Half the side of the square Wick collides as, in metres. */
export const WICK_HALF = 0.3

/** The camera: 24 mm, 25 degrees down and 5 m back, following Wick, turned freely by the player. */
export const FOLLOW: CameraView = cameraView('follow')
`,
  },
  {
    path: 'src/shared/tuning.ts',
    content:
      () => `// The numbers a designer changes, in content/tuning.toml (the Tuner opens it). The compiler checks each against its
// range; this reads them once, so a missing one stops the game at boot with a sentence that says which.

/** The tunables content/tuning.toml holds. */
export interface Tuning {
  /** Wick's walk at a full push of the stick, in metres a second. */
  readonly WALK_SPEED: number
}

/** The tunables of the game's compiled content (virtual:automata/content). */
export function tuningOf(content: unknown): Tuning {
  const table = (content as { readonly tuning?: Readonly<Record<string, unknown>> } | null)?.tuning
  const speed = table?.WALK_SPEED
  if (typeof speed !== 'number' || !(speed > 0))
    throw new Error('The content has no walking speed. Check content/tuning.toml.')
  return { WALK_SPEED: speed }
}
`,
  },
  {
    path: 'src/shared/screen.ts',
    content: () => `import { DEFAULT_LOOK, targetSize } from '@automata/3d'

// The screen's size, which the game and what the player feels (Feel's shakes and flashes are drawn to it) both read. It is
// the pixel-art look's field: its short side is the look's, the long side a phone held sideways.

/** The size of the game's screen. */
export const SIZE = targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short)
`,
  },
  ...ROOM_FILES,
  ...WICK_FILES,
  {
    path: 'src/app/game.ts',
    content: (options) => `import { content } from 'virtual:automata/content'
import { createPixi3dRenderer, DEFAULT_LOOK, render3dExtension } from '@automata/3d'
import { CameraTurn, STICK_MAX } from '@automata/3d/sim'
import { defaultContent, defineGame, inputs, keys } from '@automata/framework'
import { cameraTurnUnits, labelled, moveFromStick } from './controls.ts'
import { drawRoom, worldLibraryOf } from '../features/room/room.view.ts'
import { roomIn } from '../features/room/room.ts'
import type { PlayContent } from '../features/room/read-room.ts'
import { Move } from '../features/wick/move.command.ts'
import { spawnWick, wickPlugin } from '../features/wick/wick.plugin.ts'
import { Wick } from '../features/wick/wick.component.ts'
import { wickView } from '../features/wick/wick.view.ts'
import { FOLLOW, TICK_HZ } from '../shared/constants.ts'
import { SIZE } from '../shared/screen.ts'
import { tuningOf } from '../shared/tuning.ts'
import { audio, feelOnStage } from './feel-audio.ts'

const TUNING = tuningOf(content)
const ROOM = roomIn(content)
/** What the sim reads: the room and the tuning. */
const PLAY: PlayContent = { room: ROOM, tuning: TUNING }

/** The keyboard turns the camera 120 degrees a second: 65,536 units a turn, about 364 units a tick. */
const KEY_TURN = Math.round((65_536 * 120) / 360 / TICK_HZ)

// WASD and the arrows move; the left touch stick and the pad's stick do too. Q and E, the right stick, two buttons and a
// drag on the screen turn the camera. Each is its own command, sent every tick.
const MOVE = keys(
  Move,
  {
    KeyW: { y: -STICK_MAX },
    ArrowUp: { y: -STICK_MAX },
    KeyS: { y: STICK_MAX },
    ArrowDown: { y: STICK_MAX },
    KeyA: { x: -STICK_MAX },
    ArrowLeft: { x: -STICK_MAX },
    KeyD: { x: STICK_MAX },
    ArrowRight: { x: STICK_MAX },
  },
  { idle: { x: 0, y: 0 }, touch: false, analog: { touchStick: true, read: moveFromStick } },
)
// The turn keys are the screen's two buttons as well, so a phone can turn the camera without a drag.
const TURN = labelled(
  keys(
    CameraTurn,
    { KeyQ: { units: -KEY_TURN }, KeyE: { units: KEY_TURN } },
    { idle: { units: 0 }, analog: { drag: true, read: cameraTurnUnits } },
  ),
  { KeyQ: 'Turn left', KeyE: 'Turn right' },
)

/** ${options.title}: Wick walking around a room, on the default title, play and pause screens. */
export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: SIZE,
  orientation: 'landscape',
  sim: { plugins: [wickPlugin], seed: 1, setup: (sim) => spawnWick(sim, ROOM) },
  // The camera's heading is a sim plugin of the 3D extension; defineGame adds it.
  extensions: [render3dExtension],
  input: inputs(MOVE, TURN),
  // The default screens' flow, and the room and tuning as the sim's content (what its systems read as ctx.content).
  content: { ...defaultContent(), sim: PLAY },
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      // What the player feels (shake, flash, words), from the file the Feel editor writes.
      setup: feelOnStage,
      look: DEFAULT_LOOK,
      views: { [Wick.id]: wickView(content, TUNING) },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Wick.id },
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        drawRoom(view.root, occluders, worldLibraryOf(content), DEFAULT_LOOK)
        return undefined
      },
    }),
  // What the player hears, from the file the Audio editor writes.
  audio,
})
`,
  },
  {
    path: 'src/main.ts',
    content:
      () => `// The page's entry: starts the game. \`no-eval\` comes first, because the web targets allow no eval.
import '@automata/3d/no-eval'
import { startGame } from '@automata/framework'
import { game } from './app/game.ts'

let running = startGame(game)

// While \`pnpm dev\` runs, saving a room in the editor (or a setting in the Tuner) brings new content here
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
    path: 'tests/unit/room/read-room.test.ts',
    content: () => `import { readLevel } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { roomOf, standsAt } from '../../../src/features/room/read-room.ts'
import { ROOM_LEVEL } from '../../../src/features/room/room.ts'
import { WICK_HALF } from '../../../src/shared/constants.ts'

// A room as the editor writes it, cut down: a 4 m square floor, one crate in the middle, and the start point.
const small = (entities: { def: string; id: string; x: number; z: number }[]) =>
  readLevel({
    format: 'af-sector/2',
    name: 'small',
    sectors: [
      {
        id: 'floor',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
      },
    ],
    props: [{ id: 'crate-1', use: 'crate', at: [2, 2] }],
    entityDefs: [{ id: 'spawn' }],
    entities,
  }).level

const CRATE = { crate: { kind: 'box', size: [0.6, 0.6, 0.6] } }
const START = [{ def: 'spawn', id: 'spawn', x: 1, z: 1 }]

describe('reading a room', () => {
  it('reads its start point, its floor and its props', () => {
    const room = roomOf(small(START), CRATE)
    expect(room.start).toEqual({ x: 1, z: 1 })
    expect(room.floors).toHaveLength(1)
    expect(room.blockers).toHaveLength(1)
    expect(room.blockers[0]).toMatchObject({ x: 2, z: 2 })
  })

  it('needs exactly one start point', () => {
    expect(() => roomOf(small([]), CRATE)).toThrow('needs one start point')
  })

  it('lets Wick stand on the floor and not off it', () => {
    const room = roomOf(small(START), CRATE)
    expect(standsAt(room, 1, 1, WICK_HALF)).toBe(true)
    expect(standsAt(room, 5, 1, WICK_HALF)).toBe(false)
    // His body reaches the wall before his centre does.
    expect(standsAt(room, 0.1, 1, WICK_HALF)).toBe(false)
  })

  it('keeps Wick out of a prop and lets him stand beside it', () => {
    const room = roomOf(small(START), CRATE)
    expect(standsAt(room, 2, 2, WICK_HALF)).toBe(false)
    expect(standsAt(room, 3.4, 2, WICK_HALF)).toBe(true)
  })

  it("starts Wick standing in the game's own room", () => {
    const room = roomOf(ROOM_LEVEL, {})
    expect(standsAt(room, room.start.x, room.start.z, WICK_HALF)).toBe(true)
  })
})
`,
  },
  {
    path: 'tests/unit/wick/wick-walk.test.ts',
    content: (options) => `import { readLevel } from '@automata/3d/level'
import { cameraHeadingPlugin } from '@automata/3d/sim'
import { createSim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { type PlayContent, roomOf } from '../../../src/features/room/read-room.ts'
import { Move } from '../../../src/features/wick/move.command.ts'
import { Wick } from '../../../src/features/wick/wick.component.ts'
import { spawnWick, wickPlugin } from '../../../src/features/wick/wick.plugin.ts'
import { Bumped } from '../../../src/features/wick/bumped.event.ts'
import { TICK_HZ } from '../../../src/shared/constants.ts'

// The sim is plain code, so its test needs no browser: make a sim on a small room, send it commands, read what it holds.
// A 4 m square room with a crate beside the start point, so one test can walk into a wall and one into a prop.
const ROOM = roomOf(
  readLevel({
    format: 'af-sector/2',
    name: 'test-room',
    sectors: [
      {
        id: 'floor',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
      },
    ],
    props: [{ id: 'crate-1', use: 'crate', at: [2, 3] }],
    entities: [{ def: 'spawn', id: 'spawn', x: 2, z: 1 }],
  }).level,
  { crate: { kind: 'box', size: [0.6, 0.6, 0.6] } },
)
const SPEED = 4
const CONTENT: PlayContent = { room: ROOM, tuning: { WALK_SPEED: SPEED } }
// Forward is the stick pushed up, which walks away from the camera: toward +z.
const FORWARD = { x: 0, y: -127 }
const RIGHT = { x: 127, y: 0 }

async function wickAfter(sticks: readonly { x: number; y: number }[]) {
  const sim = await createSim({
    seed: 1,
    tickHz: TICK_HZ,
    plugins: [cameraHeadingPlugin, wickPlugin],
    content: CONTENT,
  })
  spawnWick(sim, ROOM)
  for (const payload of sticks)
    sim.step([{ tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload }])
  const [wick] = sim.query(Wick)
  const result = { position: wick?.get(Wick), hash: sim.hash() }
  sim.dispose()
  return result
}

const holding = (stick: { x: number; y: number }, ticks: number) => Array.from({ length: ticks }, () => stick)

describe('${options.title}: Wick', () => {
  it('stands on the start point until the player holds something', async () => {
    const { position } = await wickAfter([{ x: 0, y: 0 }])
    expect(position).toMatchObject({ x: 2, z: 1, walking: false })
  })

  it('walks away from the camera at the walking speed when the stick is pushed up', async () => {
    // A quarter of a second at 4 m/s is a metre, and the crate is further on.
    const { position } = await wickAfter(holding(FORWARD, TICK_HZ / 4))
    expect(position?.z).toBeCloseTo(1 + SPEED / 4, 2)
    expect(position?.x).toBeCloseTo(2, 3)
    expect(position?.walking).toBe(true)
  })

  it('faces the way he goes', async () => {
    const { position } = await wickAfter(holding(RIGHT, 5))
    // Pushed right he walks sideways to the camera: a quarter turn either way from facing away from it.
    expect(Math.abs(position?.yaw ?? 0)).toBeCloseTo(Math.PI / 2, 2)
    expect(position?.x).not.toBeCloseTo(2, 1)
  })

  it('stops at the wall, and at the prop in his way', async () => {
    // Wick starts a metre in; two seconds of walking forward would carry him 8 m, past the crate and the wall.
    const { position } = await wickAfter(holding(FORWARD, TICK_HZ * 2))
    expect(position?.z).toBeLessThan(3 - 0.3)
    expect(position?.walking).toBe(false)
  })

  it('says he bumped once when he is pushed into the wall, not every tick he is held there', async () => {
    const sim = await createSim({
      seed: 1,
      tickHz: TICK_HZ,
      plugins: [cameraHeadingPlugin, wickPlugin],
      content: CONTENT,
    })
    spawnWick(sim, ROOM)
    const step = () =>
      sim.step([{ tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload: FORWARD }])
    // Two seconds of pushing forward carry him into the crate and hold him there: he says so once, not every tick after.
    let bumps = 0
    for (let tick = 0; tick < TICK_HZ * 2; tick++) bumps += step().events.filter((e) => e.type === Bumped.id).length
    expect(bumps).toBe(1)
    sim.dispose()
  })

  it('ends in the same state every time the same moves are played', async () => {
    const moves = [...holding(FORWARD, 20), ...holding(RIGHT, 20), ...holding({ x: -90, y: 60 }, 20)]
    expect((await wickAfter(moves)).hash).toBe((await wickAfter(moves)).hash)
  })
})
`,
  },
  {
    path: 'tests/unit/content/content.test.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { ROOM_LEVEL } from '../../../src/features/room/room.ts'
import { tuningOf } from '../../../src/shared/tuning.ts'

// What the content folder holds has to fit together: the room names props and swatches that exist, and Wick's figure
// names a gait and colours that exist. The compiler checks each file on its own; this checks the names between them.

const kinds = content as Record<string, Record<string, Record<string, unknown>> | undefined>
const names = (kind: string): string[] => Object.keys(kinds[kind] ?? {})

describe("the game's content", () => {
  it('has a walking speed in the range the Tuner shows', () => {
    expect(tuningOf(content).WALK_SPEED).toBeGreaterThan(0)
  })

  it('has every prop the room places', () => {
    for (const prop of ROOM_LEVEL.props ?? []) expect(names('world-prop'), prop.id).toContain(prop.use)
  })

  it('has every colour the room and the props name', () => {
    const swatches = names('world-swatch')
    for (const sector of ROOM_LEVEL.sectors)
      for (const name of [sector.floorTexture, sector.ceilingTexture, sector.wallTexture])
        if (typeof name === 'string') expect(swatches, name).toContain(name)
    for (const [id, prop] of Object.entries(kinds['world-prop'] ?? {}))
      expect(swatches, id).toContain(prop.swatch)
  })

  it("has the gait and the colours Wick's figure names", () => {
    const wick = kinds.figure?.wick as { skin: string; gait: string; outfits: Record<string, Record<string, unknown>[]> }
    expect(names('figure-gait')).toContain(wick.gait)
    expect(names('figure-swatch')).toContain(wick.skin)
    for (const garment of Object.values(wick.outfits).flat())
      for (const value of Object.values(garment))
        if (typeof value === 'string' && /^(wick-|sole$|lid$|brow$|mouth$)/.test(value))
          expect(names('figure-swatch'), value).toContain(value)
  })
})
`,
  },
]
