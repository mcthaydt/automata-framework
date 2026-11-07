// base-3d's sim test harness: the game's own sim spec, a sim made the way the game makes it, and one tick's commands
// from the player. Test code (`testing/` is exempt from `pnpm style`).
import { CameraHeading, cameraHeadingPlugin } from '@automata/3d/sim'
import { type Command, createSim, type Sim } from '@automata/sim'
import { Hero } from '../components.ts'
import { ROOM } from '../content/room.ts'
import { base3dPlugin, base3dSim, spawnArea } from '../state/index.ts'
import { type Area, compileArea } from '../systems/index.ts'

/** The game's own sim spec, on the room, as `main.ts` makes it. */
export const BASE3D_SIM = base3dSim(compileArea(ROOM))

/**
 * The game's sim spec as `defineGame` makes it: `BASE3D_SIM`'s plugin, then render3dExtension's heading plugin (RT.EXT1).
 * `game-spec.test.ts` checks the defined game's list is exactly this; this file runs in the browsers too, where the game
 * module's Node-side imports do not load.
 */
export const GAME_PLUGINS = [base3dPlugin, cameraHeadingPlugin]
export const GAME_SIM = { ...BASE3D_SIM, plugins: GAME_PLUGINS }
/** The room. */
export const ROOM_AREA: Area = BASE3D_SIM.content

/** A sim made the way the game makes it (`GAME_SIM`), on the room or a test area. */
export async function startSim(area: Area = ROOM_AREA): Promise<Sim> {
  const sim = await createSim({ ...GAME_SIM, content: area })
  if (area === ROOM_AREA) BASE3D_SIM.setup(sim)
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
  readonly roll?: boolean
}

/** One tick's commands from player slot 0: the stick every tick (as the input layer sends it), a turn, the roll button. */
export function commandsFor(sim: Sim, input: TickInput): Command[] {
  const at = { tick: sim.tick, source: 0 }
  const commands: Command[] = [
    { ...at, seq: sim.tick * 3, type: 'move', payload: input.stick ?? { x: 0, y: 0 } },
  ]
  if (input.turn !== undefined)
    commands.push({ ...at, seq: sim.tick * 3 + 1, type: 'camera-turn', payload: { units: input.turn } })
  commands.push({ ...at, seq: sim.tick * 3 + 2, type: 'act', payload: { roll: input.roll ?? false } })
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
export const openArea = (yawDeg = 0, rotate = true): Area =>
  compileArea({
    id: 'test',
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg, rotate }],
    rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
    walls: [],
    pits: [],
    embers: [],
    goal: { x: 40, z: 40 },
  })
