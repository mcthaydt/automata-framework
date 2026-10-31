// The content check over a compiled world (G3-p, DESIGN.md §9.2, §10, GAME-3D.1f part 5): every sling target at 0.5 to
// 3 m, every hook post reachable from a floor within the chain's 8 m in plan, and every door's lock naming something
// that opens it. A failing area per rule, and the shipped world clean.
import { describe, expect, it } from 'vitest'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { base3dSim } from '../state/index.ts'
import { BASE3D_SIM } from '../testing/sim.ts'
import { type AreaSource, checkWorld, compileWorld } from './index.ts'

/** One open 20 × 20 m room with `entities`, `foes` and `pits`. */
const room = (
  entities: AreaSource['entities'],
  more: Partial<Pick<AreaSource, 'foes' | 'pits' | 'walls'>> = {},
): AreaSource => ({
  id: 'vault',
  spawn: { x: 0, z: -8 },
  views: [{ id: 'vault', yawDeg: 0 }],
  rooms: [{ view: 'vault', min: [-10, -10], max: [10, 10] }],
  walls: [],
  targets: [],
  ember: { x: 9, z: 9 },
  ...more,
  entities,
})
const check = (...areas: AreaSource[]) => checkWorld(compileWorld(areas))

describe('the content check (G3-p)', () => {
  it('passes the shipped world', () => {
    expect(checkWorld(BASE3D_SIM.content)).toEqual([])
    expect(check(FIRST_SLICE)).toEqual([])
  })

  it('names a sling target outside 0.5 to 3 m', () => {
    // The schema already refuses one when it is authored; the check holds the compiled content to it too.
    const world = compileWorld([room([{ def: 'sling-target', id: 'eye', x: 0, z: 0, height: 2 }])])
    const [area] = world.areas
    const bad = { ...world, areas: [{ ...area, entities: [{ ...area?.entities[0], height: 4 * 65_536 }] }] }
    expect(checkWorld(bad as typeof world)).toEqual([
      { area: 'vault', path: 'entities[0].height', rule: 'sling-target-height' },
    ])
  })

  it('names a hook post with no floor within 8 m in plan', () => {
    const pit = { min: [-10, -10] as [number, number], max: [10, 10] as [number, number] }
    const near = room([{ def: 'hook-post', id: 'post', x: 0, z: 0 }], {
      pits: [{ min: [-10, 2], max: [10, 10] }],
    })
    expect(check(near)).toEqual([])
    const far = room([{ def: 'hook-post', id: 'post', x: 0, z: 9.5 }], {
      pits: [{ min: [-10, 0], max: [10, 10] }],
      walls: [{ min: [-10, -0.2], max: [10, 0] }],
    })
    expect(check(far)).toEqual([{ area: 'vault', path: 'entities[0]', rule: 'hook-post-reach' }])
    // A post the whole room's pit surrounds has no floor at all.
    expect(check(room([{ def: 'hook-post', id: 'post', x: 0, z: 0 }], { pits: [pit] }))[0]?.rule).toBe(
      'hook-post-reach',
    )
  })

  it('names a small-key or boss-key door with no such key in a chest, and a clear door with no foe to clear', () => {
    const door = (lock: string) => ({ def: 'door', id: 'door', x: 0, z: 5, width: 2, depth: 0.3, lock })
    expect(check(room([door('small-key')]))).toEqual([
      { area: 'vault', path: 'entities[0].lock', rule: 'door-lock' },
    ])
    expect(check(room([door('boss-key')]))).toEqual([
      { area: 'vault', path: 'entities[0].lock', rule: 'door-lock' },
    ])
    expect(check(room([door('clear')]))).toEqual([
      { area: 'vault', path: 'entities[0].lock', rule: 'door-lock' },
    ])
    const chest = (contents: string) => ({ def: 'chest', id: `chest-${contents}`, x: 3, z: 0, contents })
    expect(check(room([door('small-key'), chest('small-key')]))).toEqual([])
    expect(check(room([door('boss-key'), chest('boss-key')]))).toEqual([])
    expect(check(room([door('clear')], { foes: [{ kind: 'sootling', x: 0, z: 2, facing: 0 }] }))).toEqual([])
    expect(check(room([door('none')]))).toEqual([])
  })

  it('stops the game at boot on a world that fails it, naming each fault', () => {
    const world = compileWorld([room([{ def: 'door', id: 'door', x: 0, z: 5, lock: 'boss-key' }])])
    expect(() => base3dSim(world)).toThrow('vault: entities[0].lock (door-lock)')
  })
})
