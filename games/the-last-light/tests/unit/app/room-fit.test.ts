import { content } from 'virtual:automata/content'
import {
  bestLookHeight,
  type FloorRect,
  fitFocus,
  followLook,
  insideFrame,
  spriteBoxAt,
} from '@automata/3d/camera-view'
import type { CameraView } from '@automata/3d/sim'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { ADA_RADIUS } from '#src/features/ada/walk.system.ts'
import { LEVEL } from '#src/features/room/room.ts'

// The rooms under a camera the player turns freely, stood back as the old game's (a density-2 texel one field pixel: Ada is her cell's
// 124 rows, 124 field pixels, of a 384-line field; on a phone's 195-line field she is painted at density 1, 62 rows). Her whole sprite
// must be in the frame from every side, in every room, at every corner and doorway. The views' look height, focus box, lead and lag are derived (`fitFocus`, `bestLookHeight`) from each room's walkable floor
// and her projected sprite, never set by hand; these tests pin the level's numbers to the derivation and then sweep the real follow
// rule (`zoneShot`) through headings, places, walking directions and the follow's dead zone and lag.

const PLAY = playOf(content)
/** Her sprite: the cell's 124 rows and 4 of head room at 1 field pixel a texel; 24 texels either side of her middle. */
const SPRITE = { heightPx: 124 + 4, halfWidthPx: 24 }
/** The fields the derivation fits (`app/field.ts`): a 4:3 window's 512 by 384 and a 16:9 window's 640 by 360. */
const FIELDS = [
  { lines: 384, aspect: 4 / 3 },
  { lines: 360, aspect: 16 / 9 },
]
/** A phone held sideways (844 by 390): a 422 by 195 field, her density-1 cell's 62 rows and 2 of head room, 12 texels either side. */
const PHONE = { field: { lines: 195, aspect: 422 / 195 }, sprite: { heightPx: 62 + 2, halfWidthPx: 12 } }
/** Every field the sweeps check, each with her sprite as it is drawn there. */
const DRAWN = [...FIELDS.map((field) => ({ field, sprite: SPRITE })), PHONE]
/** Field pixels kept clear between her and the frame's edge. */
const MARGIN = 8
const SPEED = PLAY.tuning.WALK_SPEED

/** The floor Ada's feet can reach in a view: its sectors' extent, less her radius. */
function walkableOf(viewId: string): FloorRect {
  const corners = LEVEL.sectors.filter((sector) => sector.view === viewId).flatMap((sector) => sector.corners)
  const xs = corners.map((corner) => corner[0])
  const zs = corners.map((corner) => corner[1])
  return {
    min: [Math.min(...xs) + ADA_RADIUS, Math.min(...zs) + ADA_RADIUS],
    max: [Math.max(...xs) - ADA_RADIUS, Math.max(...zs) - ADA_RADIUS],
  }
}

const viewOf = (id: string): CameraView => {
  const view = PLAY.views.find((each) => each.id === id)
  if (view === undefined) throw new Error(`no view ${id}`)
  return view
}

/** The doorways between the rooms, where she crosses from one view to the next. */
const DOORWAYS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  hall: [[0, -0.875 + ADA_RADIUS]],
  corridor: [
    [0, -0.875 - ADA_RADIUS],
    [1.6, -4],
  ],
  closet: [[1.725 + ADA_RADIUS, -4]],
}

const ROOMS = ['hall', 'corridor', 'closet'] as const

describe('the rooms under a turning camera, stood back', () => {
  for (const id of ROOMS) {
    it(`${id}: the look height, focus box, lead and lag are the derivation's`, () => {
      const view = viewOf(id)
      const height = bestLookHeight(view, SPRITE, FIELDS, MARGIN)
      expect(view.look?.[1], 'look height').toBe(height)
      const fit = fitFocus(view, walkableOf(id), SPEED, SPRITE, FIELDS, MARGIN)
      expect(fit.reach, 'her sprite fits at all').toBeGreaterThan(0.3)
      expect(view.focusBounds).toEqual(fit.focusBounds)
      expect(view.lead ?? 0).toBe(fit.lead)
      expect(view.lag).toBe(fit.lag)
      // A peek round a doorway leaned 1.2 m and took her out of the frame: it leans no further than the reach leaves.
      expect(view.peekReach, 'peek reach').toBe(fit.peekReach)
    })

    it(`${id}: her whole sprite is in the frame from every heading, at every corner and doorway, walking any way`, () => {
      const view = viewOf(id)
      const room = walkableOf(id)
      const [x0, z0] = room.min
      const [x1, z1] = room.max
      const places = [
        [x0, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
        [(x0 + x1) / 2, (z0 + z1) / 2],
        ...(DOORWAYS[id] ?? []),
      ]
      const lag = view.lag * SPEED
      const lead = view.lead ?? 0
      const out: string[] = []
      for (const [x, z] of places as [number, number][])
        for (let heading = 0; heading < 360; heading += 15)
          for (let walk = 0; walk < 8; walk++)
            for (let held = 0; held < 8; held++) {
              const w = { x: Math.sin((walk * Math.PI) / 4), z: Math.cos((walk * Math.PI) / 4) }
              const h = { x: Math.sin((held * Math.PI) / 4), z: Math.cos((held * Math.PI) / 4) }
              const feet = { x, y: 0, z }
              // The look the dead zone holds (from any side), with the lead ahead of her, then trailing her by the lag.
              const from = { x: x + lead * w.x + 0.3 * h.x, y: 0, z: z + lead * w.z + 0.3 * h.z }
              const target = followLook(view, feet, { x: lead * w.x, z: lead * w.z }, from)
              const look = { x: target.x - lag * w.x, y: target.y, z: target.z - lag * w.z }
              for (const { field, sprite } of DRAWN) {
                const box = spriteBoxAt(view, look, heading, feet, sprite, field)
                if (!insideFrame(box, field, MARGIN))
                  out.push(`${x.toFixed(2)},${z.toFixed(2)} heading ${heading} ${field.lines} lines`)
              }
            }
      expect(out.slice(0, 5)).toEqual([])
    })

    it(`${id}: her whole sprite stays in the frame while she stands and the camera peeks, any way, from every heading`, () => {
      const view = viewOf(id)
      const room = walkableOf(id)
      const reach = view.peekReach ?? 0
      const out: string[] = []
      const ways = Array.from({ length: 8 }, (_, i) => ({
        x: Math.sin((i * Math.PI) / 4),
        z: Math.cos((i * Math.PI) / 4),
      }))
      for (const [x, z] of [room.min, room.max, ...(DOORWAYS[id] ?? [])] as [number, number][])
        for (let heading = 0; heading < 360; heading += 15)
          for (const held of ways)
            for (const lean of ways) {
              const feet = { x, y: 0, z }
              // Standing: the dead zone holds the look from any side, and the peek slides it on by its reach.
              const settled = followLook(
                view,
                feet,
                { x: 0, z: 0 },
                { x: x + 0.3 * held.x, y: 0, z: z + 0.3 * held.z },
              )
              const look = { x: settled.x + reach * lean.x, y: settled.y, z: settled.z + reach * lean.z }
              for (const { field, sprite } of DRAWN)
                if (!insideFrame(spriteBoxAt(view, look, heading, feet, sprite, field), field, MARGIN))
                  out.push(`${x.toFixed(2)},${z.toFixed(2)} heading ${heading} ${field.lines} lines`)
            }
      expect(out.slice(0, 5)).toEqual([])
    })
  }
})
