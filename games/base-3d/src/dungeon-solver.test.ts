// The dungeon solver (G3-q, DESIGN.md §6.5, §19; GAME-3D.1f part 5): from the spawn, with the items held at each point,
// every chest and the boss room can be reached whichever order the small-key doors are opened in, so no small-key door
// can spend a key needed to reach another key. Over the shipped world and the test dungeons until GAME-3D.1i authors
// D1 to D7 (then over those).
import { describe, expect, it } from 'vitest'
import { type AreaSource, compileWorld } from './systems/index.ts'
import { BASE3D_SIM } from './testing/sim.ts'
import { solveWorld } from './testing/solver.ts'

type Entities = NonNullable<AreaSource['entities']>
/**
 * A T of three 10 m rooms: `a` (the spawn, x −5 to 5, z 0 to 10), `b` north of it through a doorway at (0, 10), and
 * `c` east of it through a doorway at (5, 5); each doorway 2 m wide in a wall. `north` and `east` are the doors in
 * them (no door when not given); `entities` the rest.
 */
function tee(
  north: string | undefined,
  east: string | undefined,
  entities: Entities,
  foes: AreaSource['foes'] = [],
) {
  const doors: Entities = [
    ...(north === undefined
      ? []
      : [
          {
            def: 'door',
            id: 'north',
            x: 0,
            z: 10,
            width: 2,
            depth: 0.3,
            lock: north,
            ...(north === 'switch' ? { switch: 'lever' } : {}),
          },
        ]),
    ...(east === undefined
      ? []
      : [{ def: 'door', id: 'east', x: 5, z: 5, width: 0.3, depth: 2, lock: east }]),
  ]
  const area: AreaSource = {
    id: 'kiln',
    spawn: { x: 0, z: 2 },
    views: [
      { id: 'a', yawDeg: 0 },
      { id: 'b', yawDeg: 0 },
      { id: 'c', yawDeg: 0 },
    ],
    rooms: [
      { view: 'a', min: [-5, 0], max: [5, 10] },
      { view: 'b', min: [-5, 10], max: [5, 20] },
      { view: 'c', min: [5, 0], max: [15, 10] },
    ],
    walls: [
      { min: [-5, 9.85], max: [-1, 10.15] },
      { min: [1, 9.85], max: [5, 10.15] },
      { min: [4.85, 0], max: [5.15, 4] },
      { min: [4.85, 6], max: [5.15, 10] },
    ],
    targets: [],
    ember: { x: 0, z: 1 },
    foes,
    entities: [...doors, ...entities],
  }
  return compileWorld([area])
}
const chest = (id: string, x: number, z: number, contents: string, more: Record<string, unknown> = {}) => ({
  def: 'chest',
  id,
  x,
  z,
  contents,
  ...more,
})

describe('the dungeon solver (G3-q)', () => {
  it('reaches every room of the shipped world, with nothing to soft-lock', () => {
    const result = solveWorld(BASE3D_SIM.content)
    expect(result.softLocks).toEqual([])
    expect(result.rooms).toEqual(['first-slice/hall', 'first-slice/kiln'])
  })

  it('opens every chest and reaches the boss room through two key doors, the boss key and the boss door', () => {
    const world = tee(
      'small-key',
      'boss-key',
      [
        chest('key-1', -3, 3, 'small-key'),
        chest('boss-key', 0, 17, 'boss-key'),
        chest('heart', 3, 17, 'heart-piece'),
      ],
      [{ kind: 'warden', x: 10, z: 5, facing: 0 }],
    )
    const result = solveWorld(world)
    expect(result.softLocks).toEqual([])
    expect(result.chests).toEqual(['kiln/boss-key', 'kiln/heart', 'kiln/key-1'])
    expect(result.bossRooms).toEqual(['kiln/c'])
  })

  it('finds the soft-lock where one key opens either door and only one door leads to the next key', () => {
    const world = tee('small-key', 'small-key', [
      chest('key-1', -3, 3, 'small-key'),
      chest('key-2', 0, 17, 'small-key'),
      chest('compass', 10, 5, 'compass'),
    ])
    const result = solveWorld(world)
    // Spending the first key on the east door leaves the second key behind the north door for good.
    expect(result.softLocks).toEqual(['opened kiln/east; unreached kiln/key-2'])
  })

  it('follows a hidden chest, a switch door and a cracked wall that needs bombs', () => {
    const world = tee('switch', undefined, [
      { def: 'switch', id: 'lever', x: -4, z: 8, kind: 'lever' },
      chest('bombs', -3, 3, 'bombs', { hidden: 'lever' }),
      // The doorway east is a cracked wall.
      { def: 'cracked', id: 'crack', x: 5, z: 5, width: 0.3, depth: 2 },
      chest('loot', 10, 5, 'embers:20'),
    ])
    const result = solveWorld(world)
    expect(result.softLocks).toEqual([])
    expect(result.chests).toEqual(['kiln/bombs', 'kiln/loot'])
    expect(result.rooms).toEqual(['kiln/a', 'kiln/b', 'kiln/c'])
  })

  it('names the chest a missing item or a one-way gate leaves out of reach', () => {
    const loot = chest('loot', 10, 5, 'embers:20')
    const cracked = tee(undefined, undefined, [
      { def: 'cracked', id: 'crack', x: 5, z: 5, width: 0.3, depth: 2 },
      loot,
    ])
    expect(solveWorld(cracked).softLocks).toEqual(['opened nothing; unreached kiln/loot'])
    // A one-way gate passable only from `c` is a way back out, never a way in.
    const gate = { def: 'one-way', id: 'gate', x: 5, z: 5, width: 0.3, depth: 2, from: 'c' }
    expect(solveWorld(tee(undefined, undefined, [gate, loot])).softLocks).toEqual([
      'opened nothing; unreached kiln/loot',
    ])
    expect(solveWorld(tee(undefined, undefined, [{ ...gate, from: 'a' }, loot])).softLocks).toEqual([])
  })
})
