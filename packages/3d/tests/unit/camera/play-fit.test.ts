// The near camera's fit, derived from the figure's projected sprite (`play-fit.ts`): where the sprite lands in the frame, how far the
// look may stand from the feet with the whole sprite inside it (the reach), the focus box, lead, lag and peek a room may keep, and the
// look height that gives the most reach.
import { describe, expect, it } from 'vitest'
import { FOLLOW_DEAD_ZONE } from '#src/features/camera/play-camera.ts'
import {
  bestLookHeight,
  fitFocus,
  followLook,
  insideFrame,
  reachOf,
  spriteBoxAt,
} from '#src/features/camera/play-fit.ts'
import { cameraView } from '#src/features/camera/sim/camera-view.schema.ts'

/** The Last Light's numbers: a 79 mm lens 8 m back at 30 degrees, a sprite 256 field pixels tall and 96 wide. */
const VIEW = cameraView('near', { look: [0, 1.05, 0], distance: 8, lensMm: 79, lead: 1.5, lag: 1 / 7 })
const SPRITE = { heightPx: 256, halfWidthPx: 48 }
const FIELDS = [
  { lines: 384, aspect: 4 / 3 },
  { lines: 360, aspect: 16 / 9 },
]
const FEET = { x: 0, y: 0, z: 0 }

describe('spriteBoxAt', () => {
  it('stands the sprite on the projected feet: its bottom is the feet, its height and width the sprite’s', () => {
    const box = spriteBoxAt(VIEW, { x: 0, y: 1.05, z: 0 }, 0, FEET, SPRITE, FIELDS[0] as (typeof FIELDS)[0])
    expect(box.bottom - box.top).toBe(256)
    expect(box.right - box.left).toBe(96)
    // Looking at a point 1.05 m over the feet, the feet sit under the frame's middle, and centred across it.
    expect(box.bottom).toBeGreaterThan(192)
    expect((box.left + box.right) / 2).toBeCloseTo(256, 6)
  })
  it('moves the feet down the frame as the look moves away from them along the view', () => {
    const field = FIELDS[0] as (typeof FIELDS)[0]
    const near = spriteBoxAt(VIEW, { x: 0, y: 1.05, z: 0 }, 0, FEET, SPRITE, field)
    const ahead = spriteBoxAt(VIEW, { x: 0, y: 1.05, z: 0.5 }, 0, FEET, SPRITE, field)
    expect(ahead.bottom).toBeGreaterThan(near.bottom)
  })
})

describe('reachOf', () => {
  it('is the farthest the look may stand from the feet with the sprite inside every field, from every heading', () => {
    const reach = reachOf(VIEW, SPRITE, FIELDS, 8)
    expect(reach).toBeGreaterThan(0.3)
    for (const heading of [0, 45, 90, 135, 180, 225, 270, 315])
      for (const field of FIELDS)
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ] as const) {
          const look = { x: dx * (reach - 0.01), y: 1.05, z: dz * (reach - 0.01) }
          expect(insideFrame(spriteBoxAt(VIEW, look, heading, FEET, SPRITE, field), field, 8)).toBe(true)
        }
  })
  it('is 0 when the sprite does not fit even with the look on the feet', () => {
    expect(reachOf(VIEW, { heightPx: 400, halfWidthPx: 48 }, FIELDS, 8)).toBe(0)
  })
})

describe('fitFocus', () => {
  const walkable = { min: [-4, -3] as [number, number], max: [4, 6] as [number, number] }
  const fit = fitFocus(VIEW, walkable, 3, SPRITE, FIELDS, 8)
  const budget = fit.reach - FOLLOW_DEAD_ZONE.landscape

  it('cuts the lead and the lag to what the reach leaves past the dead zone', () => {
    expect(fit.lead).toBeLessThanOrEqual(budget)
    expect(fit.lag * 3).toBeLessThanOrEqual(budget + 1e-9)
    expect(fit.lead).toBeLessThan(1.5)
  })
  it('lets a peek lean no further than that budget: a peek starts once the figure stands, with the look held by the dead zone', () => {
    expect(fit.peekReach).toBe(Math.floor(budget * 100) / 100)
  })
  it('is a fixed point: a view given its own derived numbers derives them again (0.29 m stays 0.29, not 0.28)', () => {
    // The Last Light's corridor at 25 degrees: its budget is 0.29 m and more, so a lead of 0.29 m must survive the rounding.
    const corridor = cameraView('corridor', {
      look: [0, 1, 0],
      tiltDeg: 25,
      distance: 8.25,
      lensMm: 79,
      lead: 1.5,
      lag: 0.09,
    })
    const first = fitFocus(corridor, walkable, 3, SPRITE, FIELDS, 8)
    expect(first.lead).toBe(0.29)
    const again = fitFocus({ ...corridor, lead: first.lead, lag: first.lag }, walkable, 3, SPRITE, FIELDS, 8)
    expect([again.lead, again.lag, again.peekReach]).toEqual([first.lead, first.lag, first.peekReach])
  })
  it('keeps the focus box inside the walkable floor', () => {
    expect(fit.focusBounds.min[0]).toBeGreaterThanOrEqual(-4)
    expect(fit.focusBounds.max[1]).toBeLessThanOrEqual(6)
  })
  describe('a view stood back, whose box stands inside the floor', () => {
    // The Last Light stood back (a 50 mm lens 9.26 m back at 30 degrees, a sprite 128 field pixels tall): the reach is about 2.4 m and
    // a short lead and lag leave most of it, so the focus box stands well inside the walls.
    const far = cameraView('far', {
      look: [0, 0.6, 0],
      tiltDeg: 30,
      distance: 9.26,
      lensMm: 50,
      lead: 0.27,
      lag: 0.09,
    })
    const sprite = { heightPx: 128, halfWidthPx: 24 }
    const room = { min: [-1.275, -6.675] as [number, number], max: [1.525, -1.075] as [number, number] }
    const fitted = fitFocus(far, room, 3, sprite, FIELDS, 8)
    it('lets a peek lean only what the box’s inset leaves: standing in a corner the box already holds the look off her', () => {
      // The rig adds the peek to the look the box clamped, so in a corner of the floor she is the dead zone, the inset on both axes
      // and the peek from the look: together no more than the reach.
      const corner = Math.hypot(
        fitted.focusBounds.min[0] - room.min[0],
        fitted.focusBounds.min[1] - room.min[1],
      )
      expect(FOLLOW_DEAD_ZONE.landscape + corner + fitted.peekReach).toBeLessThanOrEqual(fitted.reach + 0.01)
      expect(fitted.peekReach).toBeGreaterThan(0)
    })
    it('writes no negative zero into the box (a level stores it as 0, and must derive the same numbers again)', () => {
      // A floor whose west edge stands a millimetre further out than the inset: the box's edge rounds from -0.001 m.
      const inset = (fitted.reach - FOLLOW_DEAD_ZONE.landscape - 0.27) / Math.SQRT2
      const edge = { min: [-inset - 0.001, -6] as [number, number], max: [inset + 1, 0] as [number, number] }
      const box = fitFocus(far, edge, 3, sprite, FIELDS, 8).focusBounds
      const all = [...box.min, ...box.max]
      expect(all.filter((value) => Object.is(value, -0))).toEqual([])
    })
  })
  it('follows the rule the rig runs: with no lead the look settles on the feet at the view’s look height', () => {
    const look = followLook(VIEW, FEET, { x: 0, z: 0 })
    expect([look.x, look.y, look.z]).toEqual([0, 1.05, 0])
  })
})

describe('bestLookHeight', () => {
  it('is a 5 cm step from 0.5 to 1.5 m whose reach no other step beats', () => {
    const best = bestLookHeight(VIEW, SPRITE, FIELDS, 8)
    expect(Math.round(best * 20)).toBeCloseTo(best * 20, 9)
    const reachAt = (height: number) => reachOf({ ...VIEW, look: [0, height, 0] }, SPRITE, FIELDS, 8)
    for (let step = 10; step <= 30; step++)
      expect(reachAt(step / 20)).toBeLessThanOrEqual(reachAt(best) + 1e-9)
  })
})
