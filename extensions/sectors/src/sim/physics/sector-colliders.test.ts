// Colliders (M6 spec §4.3): when the game registers physics, the map adds one fixed Rapier box behind each span a
// walker cannot pass (a solid wall, a step taller than STEP, a blocking masked portal), as deep as the wall's `thick`
// (WALL_THICK when it has none), and a new scene's map replaces them. Without physics, `segmentBlocked` is the query.
import {
  BodyKind,
  Collider3D,
  physics3d,
  RigidBody3D,
  ShapeKind,
  Transform3D,
} from '@mcthaydt/automata-physics/3d'
import { WALL_THICK } from '@mcthaydt/automata-sector-format'
import { createSim, defineCommand, definePlugin, defineSystem, type Sim } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { resolveMap, type SectorMap, sectorsPlugin } from '../index'
import { loadSectorMapWithColliders, SectorCollider, sectorCollidersPlugin } from './index'

/** A 4 × 2 room with a portal on its east wall into a room whose floor is 0.5 m higher (a step too tall to climb). */
const rooms = {
  sectors: [
    {
      id: 'low',
      zone: 'a',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0, { thick: 0.3 }],
        [4, 0, { next: 'high' }],
        [4, 2],
        [0, 2],
      ],
    },
    {
      id: 'high',
      zone: 'a',
      floor: 0.5,
      ceiling: 3,
      light: 1,
      corners: [
        [4, 0],
        [6, 0],
        [6, 2],
        [4, 2, { next: 'low' }],
      ],
    },
  ],
} as unknown as SectorMap
const yard = {
  sectors: [
    {
      id: 'yard',
      zone: 'y',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
    },
  ],
} as unknown as SectorMap

const Load = defineCommand('test.load', z.object({ map: z.enum(['rooms', 'yard']) }))
const loader = definePlugin({
  name: 'test-loader',
  dependsOn: ['sectors-physics'],
  commands: [Load],
  systems: [
    defineSystem('test.load', 'gameplay', (ctx) => {
      for (const { payload } of ctx.commands.of(Load))
        loadSectorMapWithColliders(ctx, payload.map === 'rooms' ? rooms : yard)
    }),
  ],
})

let sim: Sim | undefined
afterEach(() => sim?.dispose())
const loadAt = (map: 'rooms' | 'yard') =>
  (sim as Sim).step([{ tick: (sim as Sim).tick, source: 0, seq: 0, type: 'test.load', payload: { map } }])
const colliders = () => (sim as Sim).query(SectorCollider, Collider3D, RigidBody3D, Transform3D)

describe('sector colliders', () => {
  it('adds one fixed box per collider span, and replaces them with the next scene’s', async () => {
    sim = await createSim({ seed: 1, plugins: [physics3d(), sectorsPlugin, sectorCollidersPlugin, loader] })
    loadAt('rooms')
    expect(colliders().length).toBe(resolveMap(rooms).colliders.length)
    for (const box of colliders()) {
      expect(box.get(RigidBody3D).kind).toBe(BodyKind.fixed)
      expect(box.get(Collider3D).shape).toBe(ShapeKind.cuboid)
    }
    loadAt('yard')
    loadAt('yard') // despawns are flushed at the end of a tick
    expect(colliders().length).toBe(4)
  })

  it('sits a solid wall’s box behind its face, as deep as its thick, along the wall', async () => {
    sim = await createSim({ seed: 1, plugins: [physics3d(), sectorsPlugin, sectorCollidersPlugin, loader] })
    loadAt('rooms')
    const south = colliders().find((c) => c.get(SectorCollider).index === 0)
    // The south wall runs 0,0 → 4,0 with the room on its left (z > 0), so its masonry is at z < 0.
    expect(south?.get(Collider3D)).toMatchObject({ hx: 2, hy: 1.5, hz: expect.closeTo(0.15, 6) })
    const at = south?.get(Transform3D)
    expect(at).toMatchObject({ x: 2, y: 1.5, z: expect.closeTo(-0.15, 6), qx: 0, qy: 0, qz: 0, qw: 1 })
  })

  it('turns a box to its wall, and spans a tall step from floor to floor', async () => {
    sim = await createSim({ seed: 1, plugins: [physics3d(), sectorsPlugin, sectorCollidersPlugin, loader] })
    loadAt('rooms')
    const map = resolveMap(rooms)
    const step = map.colliders.findIndex((c) => map.sectors[c.sector]?.id === 'low' && c.index === 1)
    const box = colliders().find((c) => c.get(SectorCollider).index === step)
    // The step runs 4,0 → 4,2 (north): a quarter turn, its 0.5 m height centred at 0.25, one WALL_THICK deep.
    expect(box?.get(Collider3D)).toMatchObject({ hx: 1, hy: 0.25, hz: expect.closeTo(WALL_THICK / 2, 6) })
    const at = box?.get(Transform3D)
    expect(at?.y).toBeCloseTo(0.25, 6)
    expect(at?.x).toBeCloseTo(4 + WALL_THICK / 2, 6)
    // The source's turn: yaw = atan2(-dir.z, dir.x), here -π/2, so (0, sin(yaw / 2), 0, cos(yaw / 2)).
    const yaw = Math.atan2(-1, 0)
    expect(at?.qy).toBeCloseTo(Math.sin(yaw / 2), 6)
    expect(at?.qw).toBeCloseTo(Math.cos(yaw / 2), 6)
  })
})
