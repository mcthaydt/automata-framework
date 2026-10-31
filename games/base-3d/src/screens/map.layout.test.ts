// The Map screen's layout with production CSS in Chromium, WebKit and Firefox (DESIGN.md §9.4, GAME-3D.1e part 5c),
// at 844 × 390 and the compact 780 × 270: the corner Close 44 px, fixed and in view; the plan inside its declared
// scroll region, no wider than it, and scrolling there when the screen is too short for it.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { metres } from '../constants/index.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { compileArea } from '../systems/index.ts'
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
  hasCompass: false,
  flags: [],
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

  it('draws each door kind, the switch link, the chests and the boss ring inside the plan (GAME-3D.1f part 5)', async () => {
    await page.viewport(844, 390)
    const area = compileArea({
      ...FIRST_SLICE,
      foes: [{ kind: 'warden', x: 0, z: 9, facing: 0 }],
      entities: [
        { def: 'switch', id: 'plate', x: -3, z: 2, kind: 'plate' },
        { def: 'door', id: 'key', x: -3, z: 4, width: 1, depth: 0.3, lock: 'small-key' },
        { def: 'door', id: 'boss', x: -1, z: 4, width: 1, depth: 0.3, lock: 'boss-key' },
        { def: 'door', id: 'bars', x: 1, z: 4, width: 1, depth: 0.3, lock: 'clear' },
        { def: 'door', id: 'link', x: 3, z: 4, width: 1, depth: 0.3, lock: 'switch', switch: 'plate' },
        { def: 'chest', id: 'loot', x: 2, z: -2, contents: 'map' },
        { def: 'chest', id: 'far', x: 2, z: 8, contents: 'compass' },
      ],
    })
    const plan = mapOf(area, {
      x: metres(0),
      z: metres(-2),
      facing: 0,
      heading: 0,
      visited: [],
      hasMap: true,
      hasCompass: true,
      flags: ['first-slice/loot'],
    })
    shown = mount(MapScreen, { target: document.body, props: { plan, onClose: () => {} } })
    flushSync()
    await document.fonts.ready
    await nextFrame()
    const doors = [...document.querySelectorAll<SVGElement>('[data-testid="map-door"]')]
    expect(doors.map((door) => door.dataset.lock)).toEqual(['small-key', 'boss-key', 'clear', 'switch'])
    // Each kind is drawn in its own colour.
    expect(new Set(doors.map((door) => getComputedStyle(door).fill)).size).toBe(4)
    expect(document.querySelectorAll('[data-testid="map-link"]')).toHaveLength(1)
    const chests = [...document.querySelectorAll<SVGElement>('[data-testid="map-chest"]')]
    expect(chests.map((chest) => chest.dataset.open)).toEqual(['true', 'false'])
    const box = rect('[data-testid="map-plan"]')
    for (const element of [...doors, ...chests, document.querySelector('[data-testid="map-boss"]')]) {
      const mark = element?.getBoundingClientRect()
      expect(mark?.width ?? 0).toBeGreaterThan(0)
      expect(mark?.left ?? -1).toBeGreaterThanOrEqual(box.left - 0.5)
      expect(mark?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(box.right + 0.5)
    }
  })
})
