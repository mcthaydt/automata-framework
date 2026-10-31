// The Map screen's layout with production CSS in Chromium, WebKit and Firefox (DESIGN.md §9.4, GAME-3D.1e part 5c),
// at 844 × 390 and the compact 780 × 270: the corner Close 44 px, fixed and in view; the plan inside its declared
// scroll region, no wider than it, and scrolling there when the screen is too short for it.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { metres } from '../constants/index.ts'
import { FIRST_AREA } from '../testing/sim.ts'
import MapScreen from './MapScreen.svelte'
import { mapOf } from './map.ts'

const PLAN = mapOf(FIRST_AREA, {
  x: metres(0),
  z: metres(-2),
  facing: 0,
  heading: 0,
  visited: [],
  hasMap: true,
})
const rect = (selector: string): DOMRect => {
  const element = document.querySelector(selector)
  if (element === null) throw new Error(`no ${selector}`)
  return element.getBoundingClientRect()
}
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

describe('the Map screen (GAME-3D.1e part 5c)', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    document.body.replaceChildren()
  })

  for (const [width, height] of [
    [844, 390],
    [780, 270],
  ] as const)
    it(`keeps Close in view and the plan inside its scroll region at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      shown = mount(MapScreen, { target: document.body, props: { plan: PLAN, onClose: () => {} } })
      flushSync()
      await document.fonts.ready
      await nextFrame()
      await nextFrame()
      const close = rect('[data-testid="corner-back"]')
      expect(close.height).toBeGreaterThanOrEqual(44)
      expect(close.width).toBeGreaterThanOrEqual(44)
      expect(close.top).toBeGreaterThanOrEqual(0)
      expect(close.bottom).toBeLessThanOrEqual(height)
      const region = document.querySelector<HTMLElement>('[data-testid="map-scroll"]')
      expect(region?.hasAttribute('data-scroll-region')).toBe(true)
      const box = rect('[data-testid="map-scroll"]')
      const plan = rect('[data-testid="map-plan"]')
      expect(plan.width).toBeGreaterThan(0)
      expect(plan.width).toBeLessThanOrEqual(box.width + 0.5)
      expect(plan.height).toBeGreaterThanOrEqual(240 - 0.5)
      expect(box.bottom).toBeLessThanOrEqual(height + 0.5)
      expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(height)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
      // It opens with Wick's arrow in view, scrolled to him when the plan is taller than the region.
      const wick = rect('[data-testid="map-wick"]')
      expect(wick.top).toBeGreaterThanOrEqual(box.top - 0.5)
      expect(wick.bottom).toBeLessThanOrEqual(box.bottom + 0.5)
      // Taller than its region, the plan scrolls inside it, never off the page.
      if (plan.height > box.height + 0.5)
        expect(region?.scrollHeight ?? 0).toBeGreaterThan(region?.clientHeight ?? 0)
    })
})
