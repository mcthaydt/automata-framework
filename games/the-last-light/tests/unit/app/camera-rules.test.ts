import { fovOf, LENS_MM } from '@automata/3d/camera-view'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '#src/features/room/room.ts'

// Ada on the screen is the painter's density-2 figure, a texel one field pixel (the Owner, 2026-11-12: "do whatever it takes to make the
// character look like how it looks on the left during gameplay"). The old game's camera (50 mm, 30 degrees down, 16 m back) drew her at
// density 1; the views now say their own lens, and these pin the numbers that make a density-2 texel exactly one pixel of the 384-line
// field at her feet in every view.

const TILT = 30
const FIELD_LINES = 384
/** The painter's density-1 texels to a metre (a 96-row cell is 2.6 m): `zoomOf` counts screen pixels per one of them. */
const D1_TEXELS = 96 / 2.6
type View = {
  distance: number
  lensMm?: number
  look: [number, number, number]
  follow: number
  lead?: number
}
const views = LEVEL.views as Record<string, View>

/** The zoom at Ada's feet in `id`: field pixels a metre there over a density-1 texel's. The focus is the view's `look` height up. */
function zoomAtFeet(id: string): number {
  const view = views[id] as View
  const fov = fovOf(view.lensMm ?? LENS_MM)
  const depth = view.distance + view.look[1] * Math.sin((TILT * Math.PI) / 180)
  return FIELD_LINES / (2 * depth * Math.tan((fov * Math.PI) / 360)) / D1_TEXELS
}

describe('the play camera', () => {
  it('has a long lens in every view, the same one: 79 mm through a 24 mm gate', () => {
    for (const id of ['hall', 'corridor', 'closet']) expect(views[id]?.lensMm, id).toBe(79)
  })

  it('gives a density-2 texel one field pixel at her feet in every view: a zoom of 2, to 3 %', () => {
    for (const id of ['hall', 'corridor', 'closet']) {
      expect(zoomAtFeet(id) / 2, id).toBeGreaterThan(0.97)
      expect(zoomAtFeet(id) / 2, id).toBeLessThan(1.03)
    }
  })

  it('stands the camera back 16.6 m in the hall and 16.8 in the corridor and the closet', () => {
    expect(['hall', 'corridor', 'closet'].map((id) => views[id]?.distance)).toEqual([16.6, 16.8, 16.8])
  })

  it('locks on to Ada in every view and looks ahead of her where she walks far', () => {
    for (const id of ['hall', 'corridor', 'closet']) expect(views[id]?.follow, id).toBe(1)
    expect(views.hall?.lead).toBeGreaterThan(0)
    expect(views.corridor?.lead).toBeGreaterThan(0)
  })
})
