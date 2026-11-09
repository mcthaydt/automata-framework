import { describe, expect, it } from 'vitest'
import { fieldFor, fieldOfWindow } from '#src/features/scene/field.ts'

// G6: the pixel field is drawn full width and centred, so the share of the screen's height it fills is the screen's
// aspect over the field's. A field fixed at a phone's 844 x 390 fills 66% of an iPad's height.
const share = (field: { width: number; height: number }, view: { width: number; height: number }): number =>
  Math.min(1, view.width / view.height / (field.width / field.height))

describe('the pixel field follows the screen it boots on', () => {
  for (const view of [
    { width: 1194, height: 834 }, // an iPad held sideways
    { width: 844, height: 390 }, // a phone held sideways
    { width: 1920, height: 1080 },
    { width: 1366, height: 1024 },
  ])
    it(`fills at least 80% of the height of ${view.width} x ${view.height}`, () => {
      expect(share(fieldFor(view), view)).toBeGreaterThanOrEqual(0.8)
    })

  it('keeps the look’s 180 pixel short side', () => {
    expect(fieldFor({ width: 1194, height: 834 }).height).toBe(180)
  })

  it('bounds an ultra-wide screen, and falls back to the phone’s field when the screen has no size', () => {
    expect(fieldFor({ width: 5120, height: 1080 }).width / 180).toBeLessThanOrEqual(2.4)
    expect(fieldFor({ width: 0, height: 0 })).toEqual(fieldFor({ width: 844, height: 390 }))
  })

  it('is the phone’s field with no window (Node)', () => {
    expect(fieldOfWindow()).toEqual(fieldFor({ width: 844, height: 390 }))
  })
})
