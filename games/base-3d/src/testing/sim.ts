// base-3d's sim test harness: the game's own sim spec, a sim made the way the game makes it, and one tick's commands
// from the player, shared by game.test.ts and enemies.test.ts. Test code (`testing/` is exempt from `pnpm style`).
import { CameraHeading, cameraHeadingPlugin } from '@mcthaydt/automata-render-pixi3d/sim'
import { type Command, createSim, type Sim } from '@mcthaydt/automata-sim'
import { Hero } from '../components.ts'
import { HERO_MOVES, type MoveDef } from '../constants/index.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { base3dPlugin, base3dSim, spawnArea } from '../state/index.ts'
import { type Area, type AreaSource, compileArea, compileWorld } from '../systems/index.ts'

/** The game's own sim spec, on the first slice, as `main.ts` makes it. */
export const BASE3D_SIM = base3dSim(compileWorld([FIRST_SLICE]))

/**
 * The game's sim spec as `defineGame` makes it: `BASE3D_SIM`'s plugin, then render3dExtension's heading plugin
 * (RT.EXT1). `game-spec.test.ts` checks the defined game's list is exactly this; this file runs in the browsers too,
 * where the game module's Node-side imports do not load.
 */
export const GAME_PLUGINS = [base3dPlugin, cameraHeadingPlugin]
export const GAME_SIM = { ...BASE3D_SIM, plugins: GAME_PLUGINS }
/** The first slice, the world's only area. */
export const FIRST_AREA = BASE3D_SIM.content.areas[0] as Area

/** A sim made the way the game makes it (`GAME_SIM`), on the first slice or a test area. */
export async function startSim(
  area: Area = FIRST_AREA,
  moves: readonly MoveDef[] = BASE3D_SIM.content.moves,
): Promise<Sim> {
  const sim = await createSim({ ...GAME_SIM, content: { areas: [area], moves } })
  if (area === FIRST_AREA) BASE3D_SIM.setup(sim)
  else spawnArea(sim, area)
  return sim
}

export function hero(sim: Sim) {
  const [entity] = sim.query(Hero, CameraHeading)
  if (entity === undefined) throw new Error('no hero')
  return { ...entity.get(Hero), ...entity.get(CameraHeading) }
}

export interface TickInput {
  readonly stick?: { readonly x: number; readonly y: number }
  readonly turn?: number
  readonly lock?: boolean
  /** The player's Lock mode, sent on every `lock` command; the tests default to hold (a held button is a lock). */
  readonly mode?: 'toggle' | 'hold'
  /** A `lock-cycle` this tick: 1 clockwise, −1 anticlockwise. */
  readonly cycle?: 1 | -1
  readonly act?: Partial<Record<'slash' | 'guard' | 'point' | 'pickup' | 'action' | 'item', boolean>>
}

/**
 * One tick's commands from player slot 0: the stick every tick (as the input layer sends it), a turn, lock, and
 * the action buttons held.
 */
export function commandsFor(sim: Sim, input: TickInput): Command[] {
  const at = { tick: sim.tick, source: 0 }
  const commands: Command[] = [
    { ...at, seq: sim.tick * 5, type: 'move', payload: input.stick ?? { x: 0, y: 0 } },
  ]
  if (input.turn !== undefined)
    commands.push({ ...at, seq: sim.tick * 5 + 1, type: 'camera-turn', payload: { units: input.turn } })
  const lock = { down: input.lock ?? false, mode: input.mode ?? 'hold' }
  commands.push({ ...at, seq: sim.tick * 5 + 2, type: 'lock', payload: lock })
  const act = {
    slash: false,
    guard: false,
    point: false,
    pickup: false,
    action: false,
    item: false,
    ...input.act,
  }
  commands.push({ ...at, seq: sim.tick * 5 + 3, type: 'act', payload: act })
  if (input.cycle !== undefined)
    commands.push({ ...at, seq: sim.tick * 5 + 4, type: 'lock-cycle', payload: { dir: input.cycle } })
  return commands
}

/** Steps `ticks` ticks of `input` and returns the events they emitted, as `type@tick`. */
export function run(sim: Sim, input: TickInput, ticks = 1): string[] {
  const events: string[] = []
  for (let i = 0; i < ticks; i++) {
    const result = sim.step(commandsFor(sim, input))
    if (result.rejected.length > 0) throw new Error(`rejected: ${JSON.stringify(result.rejected)}`)
    for (const event of result.events) events.push(`${event.type}@${result.tick}`)
  }
  return events
}

export const UP = { x: 0, y: -127 }
export const RIGHT = { x: 127, y: 0 }

/** One open room, no walls, a view with `yawDeg` and `rotate`. */
export const openArea = (
  yawDeg = 0,
  rotate = true,
  targets: AreaSource['targets'] = [],
  ember: AreaSource['ember'] = { x: 40, z: 40 },
): Area =>
  compileArea({
    id: 'test',
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg, rotate }],
    rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
    walls: [],
    targets,
    ember,
  })
export const DOWN = { x: 0, y: 127 }
