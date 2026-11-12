import { describe, expect, it } from 'vitest'
import { figureSnap, letterboxScale, snapRatio, texelRatio } from '#src/features/crisp/crisp-scale.ts'

const CAP = { width: 640, height: 480 }

describe('letterboxScale', () => {
  it('shows a 1280 x 960 window at exactly 2 device pixels a pixel, filling it', () => {
    const l = letterboxScale(1280, 960, 1, CAP)
    expect(l).toMatchObject({
      scale: 2,
      frame: [640, 480],
      size: [1280, 960],
      offset: [0, 0],
      resolution: 0.5,
      cssScale: 2,
    })
  })

  it('rounds the scale down when that still fills 80% of the tighter side, so a border beats a coarser picture', () => {
    const l = letterboxScale(1400, 1000, 1, CAP)
    expect(l.scale).toBe(2)
    expect(l.frame).toEqual([640, 480])
    expect(l.offset).toEqual([60, 20])
  })

  it('rounds up when rounding down would leave too much border, and the frame follows the window', () => {
    const l = letterboxScale(900, 700, 1, CAP)
    expect(l.scale).toBe(2)
    expect(l.frame).toEqual([450, 350])
    expect(l.size).toEqual([900, 700])
  })

  it('gives every device length as a whole number of device pixels on a 3x phone', () => {
    const l = letterboxScale(390, 844, 3, CAP)
    for (const v of [...l.size, ...l.offset]) expect(Number.isInteger(v * 3)).toBe(true)
    expect(l.frame[0]).toBeLessThanOrEqual(640)
    expect(l.frame[1]).toBeLessThanOrEqual(480)
  })

  it('never goes under 1 for a window with no area', () => {
    expect(letterboxScale(0, 0, 1, CAP).scale).toBe(1)
    expect(letterboxScale(100, 100, 0, CAP).scale).toBeGreaterThanOrEqual(1)
  })
})

describe('snapRatio', () => {
  it('goes to the nearest whole number in proportion', () => {
    expect(snapRatio(1.63)).toBe(2)
    expect(snapRatio(1.35)).toBe(1)
    expect(snapRatio(2.5)).toBe(3)
  })

  it('leaves a texel under a pixel alone', () => {
    expect(snapRatio(0.7)).toBeNull()
    expect(snapRatio(Number.NaN)).toBeNull()
  })
})

describe('texelRatio and figureSnap', () => {
  it('counts framebuffer pixels a texel covers at a depth', () => {
    expect(texelRatio(2, Math.PI / 2, 200, 0.05)).toBeCloseTo((200 / (2 * 2)) * 0.05, 9)
    expect(texelRatio(0, 1, 200, 0.05)).toBe(0)
  })

  it('scales a billboard so each texel is a whole number of pixels, exactly', () => {
    const base = { depth: 5, pitchY: 0, anchorY: 0.5, rows: 32, texel: 0.04, fov: 0.6, frameHeight: 180 }
    const k = snapRatio(texelRatio(base.depth, base.fov, base.frameHeight, base.texel)) as number
    const factor = figureSnap(base)
    expect(texelRatio(base.depth, base.fov, base.frameHeight, base.texel * factor)).toBeCloseTo(k, 9)
  })

  it('leaves a figure whose texel is under a pixel as it is', () => {
    expect(
      figureSnap({ depth: 100, pitchY: 0, anchorY: 0.5, rows: 32, texel: 0.01, fov: 0.6, frameHeight: 180 }),
    ).toBe(1)
  })
})
