// What the Walk view's overlay says (ED3D.8b; ED3D spec §6, §9): the minimap of the level's rooms with the eye on it, and the
// words for what the crosshair is on. Pure: the view draws what these give.
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { toyAfSector } from '../testing/toy-af-sector'
import { createGeometryCache } from './geometry-cache'
import { aimWords, minimapOf } from './walk-hud'

const layersOf = () => {
  const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
  return createGeometryCache(editor)().layers
}

describe('minimapOf', () => {
  const box = { w: 120, h: 90 }
  const camera = { eye: [4, 1.6, 3] as const, yaw: 0, pitch: 0, fov: 1 }

  it('draws each room as a polygon inside the box, the whole level fitted with a margin', () => {
    const map = minimapOf(layersOf(), camera, box)
    expect(map.rooms).toHaveLength(2)
    for (const room of map.rooms)
      for (let i = 0; i < room.length; i += 2) {
        expect(room[i]).toBeGreaterThanOrEqual(0)
        expect(room[i]).toBeLessThanOrEqual(box.w)
        expect(room[i + 1]).toBeGreaterThanOrEqual(0)
        expect(room[i + 1]).toBeLessThanOrEqual(box.h)
      }
  })

  it('puts the eye inside the room it is in and a heading mark ahead of it: north is up the map', () => {
    const map = minimapOf(layersOf(), camera, box)
    expect(map.eye.x).toBeGreaterThan(0)
    expect(map.eye.x).toBeLessThan(box.w)
    expect(map.heading.y).toBeLessThan(map.eye.y)
    expect(map.heading.x).toBeCloseTo(map.eye.x, 6)
    const east = minimapOf(layersOf(), { ...camera, yaw: Math.PI / 2 }, box)
    expect(east.heading.x).toBeGreaterThan(east.eye.x)
  })

  it('has no rooms for a level with none, and puts the eye in the middle', () => {
    const map = minimapOf([], camera, box)
    expect(map.rooms).toEqual([])
    expect(map.eye).toEqual({ x: box.w / 2, y: box.h / 2 })
  })
})

describe('aimWords', () => {
  const at = { point: [0, 0, 0] as const, distance: 3.24 }
  it('names a wall counted from 1, a floor and a ceiling, with how far away', () => {
    expect(aimWords({ ...at, role: 'wall', sector: 'hall', selection: 'wall:hall/1' })).toBe(
      'Wall 2 of hall · 3.2 m',
    )
    expect(aimWords({ ...at, role: 'floor', sector: 'hall', selection: 'sector:hall' })).toBe(
      'Floor of hall · 3.2 m',
    )
    expect(aimWords({ ...at, role: 'ceiling', sector: 'dock', selection: 'sector:dock' })).toBe(
      'Ceiling of dock · 3.2 m',
    )
  })

  it('says a surface nothing selects is locked, and nothing when the crosshair is on nothing', () => {
    expect(aimWords({ ...at, role: 'wall', sector: 'hall', selection: undefined })).toBe(
      'A locked or hidden surface of hall · 3.2 m',
    )
    expect(aimWords(undefined)).toBe('Nothing there')
  })
})
