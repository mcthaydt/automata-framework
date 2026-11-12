import { describe, expect, it } from 'vitest'
import { BAR_FRACTION, FIELD_CAP, fieldFor, wholeScaleFor } from '#src/app/field.ts'

// The rule is the old game's `letterboxScale` (`src/render/crisp.ts` at 92e6704), run on each window below for the expected values:
// the whole scale `k` is the window's device pixels per field pixel rounded down when that still fills 80% of it, else rounded up (a
// black border beats a coarser picture, so a picture that would leave one shrinks instead); the field is the window divided by `k`,
// capped at 640 by 480. So the picture fills the window in whole pixels, with no bars where the window allows it.
const OLD_RULE: readonly (readonly [
  window: [number, number],
  ratio: number,
  scale: number,
  field: [number, number],
])[] = [
  [[1024, 768], 1, 2, [512, 384]],
  [[1280, 720], 1, 2, [640, 360]],
  [[1920, 1080], 1, 3, [640, 360]],
  [[844, 390], 1, 2, [422, 195]],
  [[1366, 768], 1, 2, [640, 384]],
  [[844, 390], 3, 4, [633, 292]],
  [[800, 600], 1, 1, [640, 480]],
  [[500, 300], 1, 1, [500, 300]],
  [[1440, 900], 2, 4, [640, 450]],
  [[1280, 1000], 1, 2, [640, 480]],
  // The game is landscape: a window held upright has the same picture as one held sideways.
  [[1000, 1280], 1, 2, [640, 480]],
  [[390, 844], 3, 4, [633, 292]],
]

describe('the picture', () => {
  it('is capped at 640 by 480', () => {
    expect(FIELD_CAP).toEqual({ width: 640, height: 480 })
  })

  for (const [[width, height], ratio, scale, [fieldWidth, fieldHeight]] of OLD_RULE) {
    it(`is ${fieldWidth} by ${fieldHeight} at ${scale}x in a ${width} by ${height} window at device ratio ${ratio}`, () => {
      expect(wholeScaleFor({ width, height }, ratio)).toBe(scale)
      expect(fieldFor({ width, height }, ratio)).toEqual({ width: fieldWidth, height: fieldHeight })
    })
  }

  it('never draws past the window, and where the cap does not bind fills it to within a pixel of the scale', () => {
    for (const [[width, height], ratio, scale, [fieldWidth, fieldHeight]] of OLD_RULE) {
      const [long, short] = [Math.max(width, height) * ratio, Math.min(width, height) * ratio]
      expect(fieldWidth * scale).toBeLessThanOrEqual(long)
      expect(fieldHeight * scale).toBeLessThanOrEqual(short)
      if (fieldWidth < 640) expect(long - fieldWidth * scale).toBeLessThan(scale)
      if (fieldHeight < 480) expect(short - fieldHeight * scale).toBeLessThan(scale)
    }
  })

  it('falls back to the phone sideways for a window with no size', () => {
    expect(fieldFor({ width: 0, height: 0 })).toEqual(fieldFor({ width: 844, height: 390 }))
  })

  it('has no letterbox bars in play: the old game drew the whole window, and the framework\u2019s 5% bars would crop 24 of 480 lines', () => {
    expect(BAR_FRACTION).toBe(0)
  })
})
