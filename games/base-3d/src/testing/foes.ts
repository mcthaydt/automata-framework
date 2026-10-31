// base-3d's foe test helpers (GAME-3D.1d): an open room with foes in it, the rows the cases read, and stepping
// helpers, shared by enemies.test.ts and boss.test.ts. Test code (`testing/` is exempt from `pnpm style`).
import type { Sim } from '@mcthaydt/automata-sim'
import { Enemy, Fighter, Hero, Target } from '../components.ts'
import { ENEMIES, ENEMY_MOVES } from '../constants/enemies.ts'
import { HERO_MOVES } from '../constants/index.ts'
import { ITEM_MOVES } from '../constants/items.ts'
import { type Area, type AreaSource, compileArea } from '../systems/index.ts'
import { commandsFor, hero, run, startSim, type TickInput } from './sim.ts'

/** One open room with `foes` in it, and Wick at the origin facing +z. */
export const foeArea = (foes: AreaSource['foes'], walls: AreaSource['walls'] = []): Area =>
  compileArea({
    id: 'foes',
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg: 0 }],
    rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
    walls,
    targets: [],
    ember: { x: 40, z: 40 },
    foes,
  })
export const MOVES = [...HERO_MOVES, ...ENEMY_MOVES, ...ITEM_MOVES]
export const startFoes = (foes: AreaSource['foes'], walls?: AreaSource['walls']) =>
  startSim(foeArea(foes, walls), MOVES)
export const foes = (sim: Sim) => sim.query(Enemy)
export const wickSid = (sim: Sim) => sim.query(Hero)[0]?.sid as number
export const fighter = (sim: Sim, sid: number) => sim.entity(sid)?.get(Fighter)
export const enemy = (sim: Sim, sid: number) => sim.entity(sid)?.get(Enemy)
export const place = (sim: Sim, sid: number) => sim.entity(sid)?.get(Target)
export const kindOf = (id: string) => ENEMIES.findIndex((type) => type.id === id) + 1
export const enemyKind = (kind: number) => ENEMIES[kind - 1]?.id

/** Steps with Wick standing still until `done` holds, at most `limit` ticks; returns the ticks taken. */
export function stepUntil(sim: Sim, done: () => boolean, limit = 600, input: TickInput = {}): number {
  for (let ticks = 1; ticks <= limit; ticks++) {
    run(sim, input)
    if (done()) return ticks
  }
  throw new Error(`not within ${limit} ticks`)
}
export const distance = (sim: Sim, sid: number) => {
  const at = place(sim, sid) as { x: number; z: number }
  const wick = hero(sim)
  return Math.sqrt((at.x - wick.x) ** 2 + (at.z - wick.z) ** 2)
}

/** Steps `ticks` of `input` and returns the kinds of the hits that landed, in order. */
export function hitKinds(sim: Sim, input: TickInput, ticks = 1): string[] {
  const kinds: string[] = []
  for (let i = 0; i < ticks; i++)
    for (const event of sim.step(commandsFor(sim, input)).events)
      if (event.type === 'hit.landed') kinds.push((event.payload as { kind: string }).kind)
  return kinds
}

/** A slash and the 12 ticks after it, as the kinds of the hits it lands. */
export const slashes = (sim: Sim) => [...hitKinds(sim, { act: { slash: true } }), ...hitKinds(sim, {}, 12)]
