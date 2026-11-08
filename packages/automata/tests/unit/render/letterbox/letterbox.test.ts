import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BAR_FRACTION,
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

  it('fits the whole field in a wider window and centres it, with bars at the sides', () => {
    const frame = new LetterboxFrame({ logicalWidth: LOGICAL.width, logicalHeight: LOGICAL.height })
    const geo = frame.layout(LANDSCAPE_WIDE.width, LANDSCAPE_WIDE.height)

    expect(geo.scale).toBeCloseTo(LANDSCAPE_WIDE.height / LOGICAL.height)
    expect(geo.height).toBeCloseTo(LANDSCAPE_WIDE.height)
    expect(geo.y).toBe(0)
    expect(geo.x).toBeGreaterThan(0)
    expect(geo.x * 2 + geo.width).toBeCloseTo(LANDSCAPE_WIDE.width, 0)
    expect(geo.gameplay).toMatchObject({ x: geo.x, width: geo.width, y: 0, height: LANDSCAPE_WIDE.height })
    // The scenery is the whole view, bars and all.
    expect(geo.scenery.width * geo.scale).toBeCloseTo(LANDSCAPE_WIDE.width)
  })

  it('fits the whole field in a landscape phone instead of cropping it', () => {
    const frame = new LetterboxFrame({ logicalWidth: 512, logicalHeight: 288 })
    for (const [width, height] of [
      [844, 390],
      [932, 430],
    ] as const) {
      const geo = frame.layout(width, height)
      expect(geo.height, `${width} x ${height}`).toBeLessThanOrEqual(height)
      expect(geo.gameplay.height).toBeCloseTo(288 * geo.scale)
      expect(geo.x).toBeGreaterThan(0)
      expect(geo.x + geo.width).toBeLessThanOrEqual(width)
    }
  })

  it('draws the sides in the bar colour and shows the bars in landscape only', () => {
    const frame = new LetterboxFrame({ logicalWidth: LOGICAL.width, logicalHeight: LOGICAL.height })
    const geo = frame.layout(LANDSCAPE_WIDE.width, LANDSCAPE_WIDE.height)
    expect(frame.bars.visible).toBe(true)
    expect(frame.leftBar.getLocalBounds().width).toBeCloseTo(geo.x)
    expect(frame.rightBar.getLocalBounds().width).toBeCloseTo(LANDSCAPE_WIDE.width - geo.x - geo.width)
    frame.layout(PORTRAIT.width, PORTRAIT.height)
    expect(frame.bars.visible).toBe(false)
  })

  it('crops no top or bottom by default, and the fraction a game asks for still crops', () => {
    expect(DEFAULT_BAR_FRACTION).toBe(0)
    const asked = new LetterboxFrame({ logicalWidth: 960, logicalHeight: 540, barFraction: 0.05 })
    const geo = asked.layout(1280, 720)
    expect(geo.gameplay.height).toBeCloseTo(720 * 0.9)
    expect(geo.height).toBeCloseTo(720)
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
    expect(frame.leftBar.tint).toBe(0x000000)
    expect(frame.rightBar.tint).toBe(0x000000)

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
