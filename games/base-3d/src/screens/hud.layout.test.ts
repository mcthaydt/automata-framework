// The HUD's layout with production CSS in Chromium, WebKit and Firefox, at the phone sizes first: 844 × 390 and the compact
// 780 × 270. The ember count stays inside the frame's visible region, clear of the corner Pause and of the touch row.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { Progress } from '../resources.ts'
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

describe('the HUD', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    hudInPlay.sim?.dispose()
    hudInPlay.sim = undefined
    document.body.replaceChildren()
  })

  async function show(touch: boolean): Promise<void> {
    const sim = await startSim()
    sim.resource(Progress).taken = [0, 1, 2, 3, 4]
    hudInPlay.sim = sim
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
    it(`keeps the ember count in the frame, clear of Pause, at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      await show(false)
      const count = rect('[data-testid="hud-embers"]')
      expect(inside(count, rect('.af-screen-frame__body'))).toBe(true)
      expect(overlaps(count, rect('[data-testid="pause"]'))).toBe(false)
    })

    it(`leaves the touch row to its button at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      await show(true)
      expect(overlaps(rect('[data-testid="hud-embers"]'), rect('[data-testid="touch-buttons"]'))).toBe(false)
    })
  }
})
