// G3-v (DESIGN.md §14.4): the touch controls with production CSS in Chromium, WebKit and Firefox, at 844 × 390 and
// the compact 780 × 270, in every variant (rest, the host's reserved strips, the keyboard up): the stick zone and the
// five buttons keep their full size and stay on screen and hit-testable, and a point in the scene between them
// reaches the camera drag surface, never the host's strip.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import ControlsInPlay from '../testing/ControlsInPlay.svelte'

const BUTTONS = ['attack', 'action', 'shield', 'lock', 'item']
const ESSENTIALS = ['touch-stick', 'pause', ...BUTTONS]

const hit = (x: number, y: number): Element | null => document.elementFromPoint(x, y)

describe('G3-v: the touch controls layout', () => {
  for (const size of REFERENCE_SIZES.filter(({ name }) =>
    ['iphone-14-landscape', 'galaxy-chrome-landscape'].includes(name),
  )) {
    it(`keeps the stick and the five buttons full size, on screen and hit-testable, at ${size.width} x ${size.height}`, async () => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const label = variant.name
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(ControlsInPlay, {})
        await settleLayout()
        const essentials = variant.keyboard === undefined ? ESSENTIALS.map(byTestId) : []
        for (const problem of checkLayout(conditions, essentials)) problems.push(`${label}: ${problem}`)
        if (variant.keyboard === undefined) {
          const primary = 48 * conditions.geometry.scale
          for (const id of BUTTONS) {
            const box = byTestId(id).getBoundingClientRect()
            if (box.width < primary - 0.5 || box.height < primary - 0.5)
              problems.push(`${label}: ${id} is ${Math.round(box.width)}x${Math.round(box.height)}`)
          }
          for (const id of ESSENTIALS) {
            const box = byTestId(id).getBoundingClientRect()
            const at = hit(box.left + box.width / 2, box.top + box.height / 2)
            if (at === null || !byTestId(id).contains(at))
              problems.push(`${label}: ${id}'s centre is covered`)
          }
          // A scene point between the stick and the buttons reaches the drag surface.
          const stick = byTestId('touch-stick').getBoundingClientRect()
          const first = byTestId('attack').getBoundingClientRect()
          const x =
            (stick.right + Math.min(...BUTTONS.map((id) => byTestId(id).getBoundingClientRect().left))) / 2
          const y = Math.min(stick.top, first.top) + 4
          const scene = hit(x, y)
          if (scene === null || !byTestId('camera-drag').contains(scene))
            problems.push(`${label}: the scene between the groups does not reach the drag`)
          // Never in the host's strips.
          for (const strip of conditions.reserved) {
            if (variant.hostReserved === undefined) continue
            const inside = hit(strip.x + strip.width / 2, strip.y + strip.height / 2)
            if (inside !== null && byTestId('camera-drag').contains(inside))
              problems.push(`${label}: the drag surface reaches into the host's strip`)
          }
        }
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  }
})
