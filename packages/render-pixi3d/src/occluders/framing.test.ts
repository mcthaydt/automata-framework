// D3-g's check (M3 spec §8, §13): at every 15° of heading, at 4:3 and 21:9, with the player at the room's centre,
// the focus point and every corner of the room's floor outline must be inside the frame. `games/base-3d`'s authored
// views run it on their rooms (M3.7b); here it runs on the example's room and view and on fixtures.
import { describe, expect, it } from 'vitest'
import { cameraView } from '../sim/camera-view.schema.js'
import { framingMisses } from './framing.js'
import { ONE_ROOM } from './testing/rooms.js'

// `examples/render3d/render3d-angled-camera.ts`: a 4 m room, its view 30° down and 8 m back.
const EXAMPLE_OUTLINE = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 4 },
  { x: 0, z: 4 },
]
const EXAMPLE_VIEW = cameraView('room', { tiltDeg: 30, distance: 8 })

describe('framingMisses (D3-g)', () => {
  it('finds nothing for the example’s view of its room, every 15° at 4:3 and 21:9', () => {
    expect(framingMisses({ view: EXAMPLE_VIEW, outline: EXAMPLE_OUTLINE })).toEqual([])
  })

  it('reports each heading and aspect at which a corner leaves the frame, naming the corner', () => {
    const misses = framingMisses({ view: cameraView('close'), outline: ONE_ROOM.outline })
    expect(misses.length).toBeGreaterThan(0)
    // Looking +z from the centre, the two south corners (behind the player) fall below the frame at 4:3.
    const atZero = misses.filter((m) => m.headingDeg === 0 && m.aspect === 4 / 3).map((m) => m.point)
    expect(atZero).toEqual([0, 1])
    expect(misses.every((m) => m.point !== 'focus')).toBe(true)
  })

  it('reports the player’s focus when the view’s bounds hold the camera away from it (review of #249, 1)', () => {
    // The bounds pin the focus at the origin; the player stands 5 m off, and behind the eye when it looks −z.
    const pinned = cameraView('pinned', { bounds: { min: [0, 1, 0], max: [0, 1, 0] } })
    const misses = framingMisses({
      view: pinned,
      outline: [{ x: 0, z: 0 }],
      at: { x: 5, y: 0, z: 5 },
      aspects: [4 / 3],
    })
    expect(misses).toContainEqual({ headingDeg: 180, aspect: 4 / 3, point: 'focus' })
    // Looking toward it the player is in frame: the check is not simply always failing.
    expect(misses).not.toContainEqual({ headingDeg: 45, aspect: 4 / 3, point: 'focus' })
  })

  it('counts a point behind the eye as outside, whatever its projected x and y', () => {
    const misses = framingMisses({
      view: cameraView('close'),
      outline: [{ x: 0, z: -20 }],
      at: { x: 0, y: 0, z: 0 },
      aspects: [16 / 9],
      stepDeg: 360,
    })
    expect(misses).toEqual([{ headingDeg: 0, aspect: 16 / 9, point: 0 }])
  })
})
