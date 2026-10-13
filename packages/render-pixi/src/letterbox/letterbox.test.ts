import { describe, expect, it } from 'vitest'
import { LetterboxFrame, PORTRAIT_FIELD_TOP, portraitFieldHeight } from './letterbox.js'

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
