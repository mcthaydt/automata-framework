// The dollhouse as a paint list (ED3D.5e step 2; ED3D spec §6, ED3D-D6): each surface the orbit camera sees, as triangles
// in canvas pixels, flat-shaded, far to near, the near walls cut away and a faded wall at a quarter, the selection in the
// accent. Surfaces here are made by hand so each number is plain.
import { describe, expect, it } from 'vitest'
import type { Orbit } from '../view/mesh/camera-3d'
import type { SectorMesh, Surface } from '../view/mesh/sector-mesh'
import { PLAN_COLORS } from '../view/plan/plan-colors'
import { dollhousePaint } from './dollhouse-paint'

const SIZE = { w: 400, h: 300 }

/** A square of side 2 in the plane y = `y`, facing up or down. */
const flat = (role: 'floor' | 'ceiling', y: number, sector = 'room'): Surface => ({
  role,
  sector,
  selection: `sector:${sector}`,
  normal: role === 'floor' ? [0, 1, 0] : [0, -1, 0],
  occlude: role === 'floor' ? 'never' : 'cut',
  shade: 1,
  positions: [0, y, 0, 2, y, 0, 2, y, 2, 0, y, 2],
  indices: role === 'floor' ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3],
})

/** A wall 2 m wide and 2 m high along z = `z`, facing +z or −z. */
const wall = (z: number, facing: 1 | -1, occlude: Surface['occlude'] = 'cut', shade = 0.5): Surface => ({
  role: 'wall',
  sector: 'room',
  selection: `wall:room/${facing === 1 ? 0 : 2}`,
  normal: [0, 0, facing],
  occlude,
  shade,
  positions: [0, 0, z, 2, 0, z, 2, 2, z, 0, 2, z],
  indices: [0, 1, 2, 0, 2, 3],
})

const meshOf = (...surfaces: Surface[]): SectorMesh => ({
  surfaces,
  bounds: { min: [0, 0, 0], max: [2, 2, 2] },
})

// Looking north (yaw 0, along −z) from the south, 30° up, at the middle of the box.
const ORBIT: Orbit = { target: [1, 1, 1], distance: 8, yaw: 0, pitch: (30 * Math.PI) / 180 }

describe('dollhousePaint', () => {
  it('draws the floor and cuts away the ceiling seen from above', () => {
    const paint = dollhousePaint(meshOf(flat('floor', 0), flat('ceiling', 2)), ORBIT, SIZE, new Set())
    expect(paint.polygons).toHaveLength(2)
    expect(paint.polygons.every((polygon) => polygon.role === 'floor')).toBe(true)
    for (const polygon of paint.polygons)
      for (let i = 0; i < polygon.points.length; i += 2) {
        expect(polygon.points[i]).toBeGreaterThan(0)
        expect(polygon.points[i]).toBeLessThan(SIZE.w)
      }
  })

  it('cuts the near wall, which faces away from the eye, and draws the far one; a fading wall is drawn at a quarter', () => {
    // The eye is south of the room (+z). The far wall (z = 0) faces +z, into the room and towards the eye: drawn. The
    // near wall (z = 2) faces −z, into the room and away from the eye: cut, so the dollhouse sees in.
    const far = wall(0, 1)
    const near = wall(2, -1)
    expect(
      dollhousePaint(meshOf(far, near), ORBIT, SIZE, new Set()).polygons.map((p) => p.selection),
    ).toEqual(['wall:room/0', 'wall:room/0'])
    const faded = dollhousePaint(meshOf(wall(2, -1, 'fade')), ORBIT, SIZE, new Set()).polygons
    expect(faded.map((polygon) => polygon.alpha)).toEqual([0.25, 0.25])
  })

  it('shades each surface flat by its shade, and puts the selection in the accent', () => {
    const plain = dollhousePaint(meshOf(wall(0, 1, 'cut', 0.5)), ORBIT, SIZE, new Set()).polygons[0]
    const lit = dollhousePaint(meshOf(wall(0, 1, 'cut', 1)), ORBIT, SIZE, new Set()).polygons[0]
    expect(plain?.color).not.toBe(lit?.color)
    expect(plain?.selected).toBe(false)
    // Selecting the room selects all its surfaces; selecting the wall selects the wall.
    expect(
      dollhousePaint(meshOf(wall(0, 1)), ORBIT, SIZE, new Set(['sector:room'])).polygons[0]?.selected,
    ).toBe(true)
    expect(
      dollhousePaint(meshOf(wall(0, 1)), ORBIT, SIZE, new Set(['wall:room/0'])).polygons[0]?.selected,
    ).toBe(true)
    expect(dollhousePaint(meshOf(), ORBIT, SIZE, new Set()).accent).toBe(PLAN_COLORS.accent)
  })

  it('orders the triangles far to near, so a nearer surface is drawn over a farther one', () => {
    const paint = dollhousePaint(meshOf(flat('floor', 0), wall(0, 1)), ORBIT, SIZE, new Set())
    const depths = paint.polygons.map((polygon) => polygon.depth)
    expect(depths).toEqual([...depths].sort((a, b) => b - a))
  })

  it('leaves out a triangle with a point behind the eye', () => {
    const close: Orbit = { ...ORBIT, distance: 0.5, pitch: (5 * Math.PI) / 180 }
    const paint = dollhousePaint(meshOf(flat('floor', 0)), close, SIZE, new Set())
    for (const polygon of paint.polygons) expect(polygon.points.every(Number.isFinite)).toBe(true)
  })
})
