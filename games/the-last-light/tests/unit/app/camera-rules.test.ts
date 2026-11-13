import { describe, expect, it } from 'vitest'
import { zoomAtFeet } from '#src/app/figure-density.ts'
import { LEVEL } from '#src/features/room/room.ts'

// The play camera stands back as the old game's did (the Owner, 2026-11-13: "pull camera back until it matches original game somewhat
// closely"). The old game's camera was a 50 mm lens 30 degrees down, 15 to 16.6 m back, and drew Ada 20 to 25% of the screen's height
// (docs/superpowers/audits/2026-11-13-last-light-camera-back). The views keep its lens and tilt and stand back as far as the crisp rule
// lets them: a texel is a whole number of field pixels, never under one, so the farthest whole step is one field pixel a texel, the
// painter's density-2 cell drawn 124 field pixels tall, a third of a 384-line field. That is the step nearest the old frame; the
// distance holds the zoom at her feet so that step is kept in every field the game draws at 1024 by 768 and larger (`figure-density.ts`).

type View = {
  distance: number
  lensMm?: number
  tiltDeg: number
  look: [number, number, number]
  follow: number
  lead?: number
}
const views = LEVEL.views as Record<string, View>
const ROOMS = ['hall', 'corridor', 'closet'] as const

describe('the play camera', () => {
  it('has the old game’s lens in every view: 50 mm through a 24 mm gate', () => {
    for (const id of ROOMS) expect(views[id]?.lensMm, id).toBe(50)
  })

  it('looks down 30 degrees in every view, as the old game did', () => {
    for (const id of ROOMS) expect(views[id]?.tiltDeg, id).toBe(30)
  })

  it('draws a density-2 texel one field pixel at her feet on a 384-line field: a zoom of 2 to 2.5', () => {
    for (const id of ROOMS) {
      const zoom = zoomAtFeet(views[id] as never, 384)
      expect(Math.round(zoom / 2), id).toBe(1)
      expect(zoom, id).toBeGreaterThan(2)
      expect(zoom, id).toBeLessThan(2.5)
    }
  })

  it('keeps density 2 on a 16:9 window’s 360-line field with 5% to spare, and one field pixel a texel on a 480-line field', () => {
    for (const id of ROOMS) {
      expect(zoomAtFeet(views[id] as never, 360) / 1.05, id).toBeGreaterThan(2)
      expect(Math.round(zoomAtFeet(views[id] as never, 480) / 2), id).toBe(1)
    }
  })

  it('stands the camera back 9.26 m in every room', () => {
    expect(ROOMS.map((id) => views[id]?.distance)).toEqual([9.26, 9.26, 9.26])
  })

  it('locks on to Ada in every view and looks ahead of her where she walks far', () => {
    for (const id of ROOMS) expect(views[id]?.follow, id).toBe(1)
    expect(views.hall?.lead).toBeGreaterThan(0)
    expect(views.corridor?.lead).toBeGreaterThan(0)
  })
})
