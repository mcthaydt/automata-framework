import { describe, expect, it } from 'vitest'
import { frameMap } from '#src/features/levels-3d/frame-map.ts'
import { planViewport, toScreen } from '#src/features/levels-3d/plan/plan-viewport.ts'
import { selectionOf } from '#src/shared/edit/selection-of.ts'
import { orbitCamera, projectPoint } from '#src/shared/geometry/camera-3d.ts'
import { buildSectorMesh, type Vec3 } from '#src/shared/geometry/sector-mesh.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

// One place says where each view of a level looks from (spec 10.3): the Plan over the whole level, the 3D view round it,
// Walk at the spawn. The tests frame the toy level (a hall and a dock, 14 m by 6 m) in a phone-sized canvas.

const SIZE = { w: 390, h: 640 }
const level = toyAfSector()
const layers = afSectorProfile.geometry(level).layers
const mesh = buildSectorMesh(layers, selectionOf(afSectorProfile, level))
const input = { layers, mesh }

describe('frameMap', () => {
  it('frames the plan on the whole level, inside the canvas', () => {
    const viewport = planViewport(frameMap(input, 'plan', SIZE), SIZE)
    for (const corner of [
      { x: 0, z: 0 },
      { x: 14, z: 6 },
    ]) {
      const at = toScreen(viewport, corner)
      expect(at.x).toBeGreaterThanOrEqual(0)
      expect(at.x).toBeLessThanOrEqual(SIZE.w)
      expect(at.y).toBeGreaterThanOrEqual(0)
      expect(at.y).toBeLessThanOrEqual(SIZE.h)
    }
  })

  it('keeps the level in the part of the canvas the tools and a sheet leave', () => {
    const usable = { x: 0, y: 80, w: 390, h: 400 }
    const viewport = planViewport(frameMap(input, 'plan', SIZE, usable), SIZE)
    for (const corner of [
      { x: 0, z: 0 },
      { x: 14, z: 6 },
    ]) {
      const at = toScreen(viewport, corner)
      expect(at.y).toBeGreaterThanOrEqual(usable.y)
      expect(at.y).toBeLessThanOrEqual(usable.y + usable.h)
    }
  })

  it('frames the 3D view on the middle of the level, every corner of it in the canvas', () => {
    const orbit = frameMap(input, 'diorama', SIZE)
    const { min, max } = mesh.bounds
    expect(orbit.target).toEqual([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2])
    const camera = orbitCamera(orbit)
    for (const x of [min[0], max[0]])
      for (const y of [min[1], max[1]])
        for (const z of [min[2], max[2]]) {
          const at = projectPoint(camera, SIZE, [x, y, z] satisfies Vec3)
          expect(at, `${x},${y},${z} is ahead of the eye`).toBeDefined()
          expect(at?.x).toBeGreaterThanOrEqual(0)
          expect(at?.x).toBeLessThanOrEqual(SIZE.w)
          expect(at?.y).toBeGreaterThanOrEqual(0)
          expect(at?.y).toBeLessThanOrEqual(SIZE.h)
        }
  })

  it('starts Walk at the spawn, facing as it faces, with no warning', () => {
    const start = frameMap({ ...input, spawn: { x: 2, z: 3, facing: 0 } }, 'walk', SIZE)
    expect(start.camera.eye[0]).toBe(2)
    expect(start.camera.eye[2]).toBe(3)
    expect(start.warning).toBeUndefined()
  })

  it('starts Walk in the first room with a warning when the level has no spawn', () => {
    const start = frameMap(input, 'walk', SIZE)
    expect(start.warning).toMatch(/no spawn/)
    expect(start.camera.eye[0]).toBeGreaterThan(0)
    expect(start.camera.eye[0]).toBeLessThan(8)
  })

  it('gives a level with no rooms a view of its own in each: a box round the origin, Walk at the origin with a warning', () => {
    const empty = toyAfSector({ sectors: [] })
    const bare = {
      layers: afSectorProfile.geometry(empty).layers,
      mesh: buildSectorMesh(afSectorProfile.geometry(empty).layers, selectionOf(afSectorProfile, empty)),
    }
    expect(frameMap(bare, 'plan', SIZE).zoom).toBeGreaterThan(0)
    expect(frameMap(bare, 'diorama', SIZE).distance).toBeGreaterThan(0)
    expect(frameMap(bare, 'walk', SIZE).warning).toMatch(/no sectors/)
  })

  it('takes the eye height and field of view the level’s profile gives Walk', () => {
    const start = frameMap(
      { ...input, spawn: { x: 2, z: 3, facing: 0 }, walk: { eyeHeight: 2, fov: 1 } },
      'walk',
      SIZE,
    )
    expect(start.camera.eye[1]).toBe(2)
    expect(start.camera.fov).toBe(1)
  })
})
