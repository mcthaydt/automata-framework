// The sectors golden: three walkers pace through three rooms, a raised step and a pilastered wall for
// 600 steps, and a scene change at step 300 loads a second map. Paths are triangle waves in exact binary fractions, so
// the positions the game writes are the same in every engine; what the golden proves is the sim's own arithmetic.
import { canonicalJson, type Sim } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import type { SectorMap } from '../entries/sim'
import { createWalkers, load, type Order, spawn, stepWith, type WalkersOptions, walk } from './walkers'

export const rooms: SectorMap = {
  sectors: [
    {
      id: 'west',
      zone: 'ward',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0, { pilaster: { start: [0.5, 0.25] } }],
        [4, 0, { next: 'east' }],
        [4, 4],
        [0, 4],
      ],
    },
    {
      id: 'east',
      zone: 'hall',
      floor: { z: 0.25 },
      ceiling: { z: 3 },
      light: 0.8,
      corners: [
        [4, 0],
        [8, 0, { next: 'annex' }],
        [8, 4],
        [4, 4, { next: 'west' }],
      ],
      holes: [
        [
          [5.5, 1.5],
          [6.5, 1.5],
          [6.5, 2.5],
          [5.5, 2.5],
        ],
      ],
    },
    {
      id: 'annex',
      zone: 'hall',
      floor: { z: 0 },
      ceiling: { z: 2.5 },
      light: 1,
      corners: [
        [8, 0],
        [12, 0],
        [12, 4],
        [8, 4, { next: 'east' }],
      ],
    },
  ],
  masses: [
    {
      points: [
        { x: 5.5, z: 1.5 },
        { x: 6.5, z: 1.5 },
        { x: 6.5, z: 2.5 },
        { x: 5.5, z: 2.5 },
      ],
      top: 3,
    },
  ],
}
export const yard: SectorMap = {
  sectors: [
    {
      id: 'yard',
      zone: 'yard',
      floor: { z: 0 },
      ceiling: { z: 9 },
      light: 1,
      corners: [
        [0, 0, { next: 'shed' }],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
    {
      id: 'shed',
      zone: 'shed',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 0.5,
      corners: [
        [6, 0],
        [0, 0, { next: 'yard' }],
        [0, -3],
        [6, -3],
      ],
    },
  ],
}

/** A triangle wave from `low` to `high` and back, `period` steps long, in steps of a power of two. */
const wave = (tick: number, period: number, low: number, high: number): number => {
  const phase = tick % period
  const half = period / 2
  const t = phase < half ? phase / half : (period - phase) / half
  return low + (high - low) * t
}

const TICKS = 600
const SCENE_CHANGE = 300

function orders(tick: number): Order[] {
  if (tick === 0) return [load('rooms'), spawn(1, 2), spawn(6, 0.5), spawn(10, 3)]
  if (tick === SCENE_CHANGE) return [load('yard')]
  return [
    walk(1, wave(tick, 128, 0.5, 11.5), 2),
    walk(2, wave(tick, 64, 4.5, 7.5), wave(tick, 32, 0.25, 3.75)),
    walk(3, 10, wave(tick, 256, -2, 5)),
  ]
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
}

/**
 * Runs the script straight, or restored from a snapshot at `restoreAt`, and hashes the state and every event. With
 * `physics`, each map brings its collider boxes, which the hash then covers.
 */
export async function runGolden(restoreAt?: number, options: WalkersOptions = {}): Promise<GoldenRun> {
  const maps = { rooms, yard }
  let sim: Sim = await createWalkers(maps, options)
  const lines: string[] = []
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await createWalkers(maps, options)
      sim.restore(bytes)
    }
    for (const e of stepWith(sim, orders(sim.tick)).events) lines.push(canonicalJson(e))
  }
  const run = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
  }
  sim.dispose()
  return run
}
