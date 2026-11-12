import { describe, expect, it } from 'vitest'
import {
  LetterboxFrame,
  PORTRAIT_FIELD_TOP,
  portraitFieldHeight,
} from '#src/features/render/letterbox/letterbox.ts'

const LOGICAL = { width: 960, height: 540 }
const DESKTOP = { width: 1280, height: 720 }
const PORTRAIT = { width: 780, height: 1688 }
const LANDSCAPE_WIDE = { width: 2216, height: 1024 }

describe('portraitFieldHeight', () => {
  it('calculates portrait field height clamped to base height', () => {
    const scale = 780 / 960
    const band = 180
    const calculated = portraitFieldHeight(1688, scale, band, 540)
    expect(calculated).toBeGreaterThanOrEqual(540)
    expect(calculated).toBe(Math.floor((1688 - PORTRAIT_FIELD_TOP - band) / scale))
  })
})

describe('LetterboxFrame', () => {
  it('fits 16:9 viewport exactly and scales to canvas width', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    const geo = frame.layout(DESKTOP.width, DESKTOP.height)

    expect(geo.scale).toBeCloseTo(DESKTOP.width / LOGICAL.width)
    expect(geo.width).toBeCloseTo(DESKTOP.width)
    expect(geo.height).toBeCloseTo(DESKTOP.height)
    expect(geo.x).toBe(0)
    expect(geo.y).toBe(0)
    expect(geo.portrait).toBe(false)
    expect(frame.bars.visible).toBe(true)
  })

  it('overflows vertically on wide viewports without pillarboxing', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    const geo = frame.layout(LANDSCAPE_WIDE.width, LANDSCAPE_WIDE.height)

    expect(geo.x).toBe(0)
    expect(geo.width).toBeCloseTo(LANDSCAPE_WIDE.width)
    expect(geo.height).toBeGreaterThan(LANDSCAPE_WIDE.height)
    expect(geo.y).toBeLessThan(0)
  })

  it('lifts the field and hides crop bars on portrait canvas', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    const geo = frame.layout(PORTRAIT.width, PORTRAIT.height)

    expect(geo.portrait).toBe(true)
    expect(geo.y).toBe(PORTRAIT_FIELD_TOP)
    expect(frame.bars.visible).toBe(false)
  })

  it('maintains expected scene, root, world, ui and bars hierarchy', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    expect(frame.scene.children).toContain(frame.backdrop)
    expect(frame.scene.children).toContain(frame.root)
    expect(frame.scene.children).toContain(frame.mask)
    expect(frame.root.children).toContain(frame.world)
    expect(frame.root.children).toContain(frame.ui)
    expect(frame.bars.children).toContain(frame.topBar)
    expect(frame.bars.children).toContain(frame.bottomBar)
    expect(frame.root.mask).toBe(frame.mask)
  })

  it('adjusts bar tint with setBarBlack', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    frame.setBarBlack(1.0)
    expect(frame.topBar.tint).toBe(0x000000)
    expect(frame.bottomBar.tint).toBe(0x000000)

    frame.setBarBlack(0.0)
    expect(frame.topBar.tint).toBe(0xffffff)
    expect(frame.bottomBar.tint).toBe(0xffffff)
  })

  it('handles zero or negative viewport dimensions gracefully without NaN', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    const geo = frame.layout(0, 0)
    expect(geo.scale).toBe(1)
    expect(geo.width).toBe(0)
    expect(geo.height).toBe(0)
  })

  it('cleans up masks and children on destroy', () => {
    const frame = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
    })
    frame.destroy()
    expect(frame.root.mask == null).toBe(true)
    expect(frame.root.destroyed).toBe(true)
  })
})

describe('LetterboxFrame with whole-pixel scale', () => {
  const whole = (size = LOGICAL) =>
    new LetterboxFrame({ logicalWidth: size.width, logicalHeight: size.height, scale: 'whole' })

  it('keeps the fractional fit by default and with scale "fit", frame for frame', () => {
    const plain = new LetterboxFrame({ logicalWidth: LOGICAL.width, logicalHeight: LOGICAL.height })
    const fit = new LetterboxFrame({
      logicalWidth: LOGICAL.width,
      logicalHeight: LOGICAL.height,
      scale: 'fit',
    })
    for (const view of [DESKTOP, PORTRAIT, LANDSCAPE_WIDE, { width: 1000, height: 700 }])
      expect(fit.layout(view.width, view.height, 2)).toEqual(plain.layout(view.width, view.height))
  })

  it('draws a 320 x 180 field at a whole number of pixels a pixel, centred', () => {
    const frame = whole({ width: 320, height: 180 })
    const geo = frame.layout(1000, 700)
    expect(geo.scale).toBe(3)
    expect(geo.width).toBe(960)
    expect(geo.height).toBe(540)
    expect(geo.x).toBe(20)
    expect(geo.y).toBe(80)
  })

  it('counts device pixels: at a ratio of 2 a 1000 px view is 2000 device pixels, 6 a pixel, which is 3 CSS px', () => {
    expect(whole({ width: 320, height: 180 }).layout(1000, 700, 2).scale).toBe(3)
  })

  it('rounds down to a whole device pixel a pixel at a ratio of 3: 3300 / 320 is 10.3, so 10 device px, 10/3 CSS px', () => {
    expect(whole({ width: 320, height: 180 }).layout(1100, 700, 3).scale).toBeCloseTo(10 / 3, 9)
  })

  it('puts every edge on a whole device pixel', () => {
    const geo = whole({ width: 320, height: 180 }).layout(1001, 701, 1.5)
    for (const v of [geo.x, geo.y, geo.width, geo.height])
      expect(Number.isInteger(Math.round(v * 1.5 * 1e6) / 1e6)).toBe(true)
    expect(Number.isInteger(Math.round(geo.scale * 1.5 * 1e6) / 1e6)).toBe(true)
  })

  it('clips the field to its own rectangle, not the whole width', () => {
    const frame = whole({ width: 320, height: 180 })
    const geo = frame.layout(1000, 700)
    const bounds = frame.mask.getLocalBounds()
    expect(bounds.x).toBe(geo.x)
    expect(bounds.width).toBe(geo.width)
  })

  it('falls back to the fit when the field is bigger than the view, so it never has a scale of 0', () => {
    const geo = whole().layout(480, 270)
    expect(geo.scale).toBeCloseTo(0.5)
    expect(geo.width).toBeCloseTo(480)
  })

  it('does not go NaN on a view with no area', () => {
    const geo = whole().layout(0, 0)
    expect(geo.scale).toBe(1)
  })
})
