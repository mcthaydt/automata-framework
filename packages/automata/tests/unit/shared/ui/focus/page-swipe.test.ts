import { describe, expect, it } from 'vitest'
import { isTap, releaseStep, WheelPager } from '#src/shared/ui/focus/page-swipe.ts'

describe('page swipe', () => {
  it('counts under 8 px of travel as a tap', () => {
    expect(isTap(5, 5)).toBe(true)
    expect(isTap(9, 0)).toBe(false)
    expect(isTap(0, 9)).toBe(false)
  })

  it('snaps to the nearest page on a slow release', () => {
    expect(releaseStep(-120, 1000, 300)).toBe(0) // under half a page: back
    expect(releaseStep(-160, 1000, 300)).toBe(1) // past half a page: next
    expect(releaseStep(160, 1000, 300)).toBe(-1)
  })

  it('turns one page on a quick flick, whatever the distance', () => {
    expect(releaseStep(-30, 50, 300)).toBe(1)
    expect(releaseStep(30, 50, 300)).toBe(-1)
    expect(releaseStep(-900, 50, 300)).toBe(1) // never more than one
  })

  it("pages a trackpad's horizontal swipe once per gesture, and ignores vertical scroll", () => {
    const wheel = new WheelPager()
    expect(wheel.push(0, 80)).toBe(0)
    expect(wheel.push(20, 0)).toBe(0)
    expect(wheel.push(25, 0)).toBe(1)
    expect(wheel.push(200, 0)).toBe(0) // still the same gesture
    wheel.reset()
    expect(wheel.push(-50, 0)).toBe(-1)
  })
})
