import { describe, expect, it } from 'vitest'
import { BAR_FRACTION, FIELD_CAP, fieldFor } from '#src/app/field.ts'

// The picture is the old game's: the window's own shape, drawn at most 640 wide and 480 tall (the old `pixelScale`: the renderer's
// resolution is min(1, 640 / w, 480 / h)), so a 16:9 window draws 640 by 360 and the sizes below are the old game's own.

describe('the picture', () => {
  it('is capped at 640 by 480', () => {
    expect(FIELD_CAP).toEqual({ width: 640, height: 480 })
  })

  it('is 640 by 360 in a 16:9 window, whatever its size', () => {
    expect(fieldFor({ width: 1280, height: 720 })).toEqual({ width: 640, height: 360 })
    expect(fieldFor({ width: 1920, height: 1080 })).toEqual({ width: 640, height: 360 })
  })

  it('is 640 by 480 in a 4:3 window', () => {
    expect(fieldFor({ width: 800, height: 600 })).toEqual({ width: 640, height: 480 })
  })

  it('keeps a phone held sideways its own shape: 844 by 390 draws 640 by 296', () => {
    expect(fieldFor({ width: 844, height: 390 })).toEqual({ width: 640, height: 296 })
  })

  it('is never larger than the window: a small one draws at its own size', () => {
    expect(fieldFor({ width: 500, height: 300 })).toEqual({ width: 500, height: 300 })
  })

  it('has the long side across, a phone held upright included (the game is landscape)', () => {
    expect(fieldFor({ width: 390, height: 844 })).toEqual({ width: 640, height: 296 })
  })

  it('falls back to the phone sideways for a window with no size', () => {
    expect(fieldFor({ width: 0, height: 0 })).toEqual({ width: 640, height: 296 })
  })

  it('has no letterbox bars in play: the old game drew the whole window, and the framework\u2019s 5% bars would crop 24 of 480 lines', () => {
    expect(BAR_FRACTION).toBe(0)
  })
})
