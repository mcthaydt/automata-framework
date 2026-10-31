// The HUD's layout with production CSS in Chromium, WebKit and Firefox (DESIGN.md §9.5, GAME-3D.1e part 5a), at the
// phone sizes first: 844 × 390 and the compact 780 × 270. The hearts stay inside the frame's visible region, nothing
// covers the corner Pause, the boss bar keeps clear of the hearts, and the item chip sits above the touch row.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { Enemy, Fighter } from '../components.ts'
import { ENEMIES } from '../constants/enemies.ts'
import { ItemCode } from '../constants/items.ts'
import { Inventory, Progress } from '../resources.ts'
import HudInPlay from '../testing/HudInPlay.svelte'
import { startSim } from '../testing/sim.ts'
import { hudInPlay } from './hud.ts'

const rect = (selector: string): DOMRect => {
  const element = document.querySelector(selector)
  if (element === null) throw new Error(`no ${selector}`)
  return element.getBoundingClientRect()
}
const inside = (inner: DOMRect, outer: DOMRect) =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

describe('the HUD (GAME-3D.1e part 5a)', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    hudInPlay.sim?.dispose()
    hudInPlay.sim = undefined
    hudInPlay.openItems = undefined
    hudInPlay.openMap = undefined
    document.body.replaceChildren()
  })

  /** The fullest HUD: 10 hearts (the most the save holds), the sling with 30 pellets, and the Warden's bar. */
  async function fullest(touch: boolean): Promise<void> {
    const sim = await startSim()
    sim.resource(Progress).maxHealth = 20
    sim.resource(Progress).embers = 999
    Object.assign(sim.resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets: 30 })
    sim.spawn([
      [Enemy, { kind: ENEMIES.findIndex((type) => type.id === 'warden') + 1 }],
      [Fighter, { health: 24 }],
    ])
    hudInPlay.sim = sim
    hudInPlay.openItems = () => {}
    hudInPlay.openMap = () => {}
    shown = mount(HudInPlay, { target: document.body, props: { touch } })
    flushSync()
    await document.fonts.ready
    await nextFrame()
    await nextFrame()
  }

  for (const [width, height] of [
    [844, 390],
    [780, 270],
  ] as const) {
    it(`keeps the hearts, embers, boss bar and item chip in the frame, clear of Pause, at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      await fullest(false)
      const body = rect('.af-screen-frame__body')
      const pause = rect('[data-testid="pause"]')
      for (const part of [
        '[data-testid="hud-hearts"]',
        '[data-testid="hud-embers"]',
        '[data-testid="hud-boss"]',
        '[data-testid="hud-item"]',
        '[data-testid="hud-items"]',
        '[data-testid="hud-map"]',
      ]) {
        expect(inside(rect(part), body), `${part} inside the frame's body`).toBe(true)
        expect(overlaps(rect(part), pause), `${part} clear of Pause`).toBe(false)
      }
      expect(overlaps(rect('[data-testid="hud-hearts"]'), rect('[data-testid="hud-boss"]'))).toBe(false)
      expect(overlaps(rect('[data-testid="hud-map"]'), rect('[data-testid="hud-boss"]'))).toBe(false)
      for (const button of ['[data-testid="hud-items"]', '[data-testid="hud-map"]']) {
        expect(rect(button).height, button).toBeGreaterThanOrEqual(44)
        expect(rect(button).width, button).toBeGreaterThanOrEqual(44)
      }
      expect(document.querySelectorAll('[data-testid="hud-hearts"] svg')).toHaveLength(10)
    })

    it(`leaves the touch row to its buttons at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      await fullest(true)
      const row = rect('[data-testid="touch-buttons"]')
      for (const part of [
        '[data-testid="hud-hearts"]',
        '[data-testid="hud-embers"]',
        '[data-testid="hud-boss"]',
      ])
        expect(overlaps(rect(part), row), `${part} clear of the touch row`).toBe(false)
      expect(inside(rect('[data-testid="hud-hearts"]'), rect('.af-screen-frame__body'))).toBe(true)
    })
  }
})
