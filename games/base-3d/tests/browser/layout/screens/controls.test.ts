// G3-v (DESIGN.md §14.4): the touch controls with production CSS in Chromium, WebKit and Firefox, at 844 × 390 and
// the compact 780 × 270, in every variant (rest, the host's reserved strips, the keyboard up): the stick zone and the
// five buttons keep their full size and stay on screen and hit-testable, and a point in the scene between them
// reaches the camera drag surface, never the host's strip.
import '@automata/framework/theme.css'
import '@automata/framework'
import { STICKY_MARGIN_PX } from '@automata/framework'
import {
  byTestId,
  checkLayout,
  mountFixture,
  publishConditions,
  REFERENCE_SIZES,
  settleLayout,
  VARIANTS,
} from '@automata/framework/testing'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import ControlsInPlay from '#src/testing/ControlsInPlay.svelte'

const BUTTONS = ['roll']
const ESSENTIALS = ['touch-stick', 'pause', ...BUTTONS]

const hit = (x: number, y: number): Element | null => document.elementFromPoint(x, y)

describe('G3-v: the touch controls layout', () => {
  for (const size of REFERENCE_SIZES.filter(({ name }) =>
    ['iphone-14-landscape', 'galaxy-chrome-landscape'].includes(name),
  )) {
    it(`keeps the stick and the Roll button full size, on screen and hit-testable, at ${size.width} x ${size.height}`, async () => {
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
          // The scene reaches the drag surface: above the controls, always; and between the stick and the buttons
          // wherever they share a row with a gap wider than their sticky margins (ui's own rule: a tv-scale phone
          // wraps the five buttons onto a second row and leaves no such gap, which `checkLayout` still holds on screen).
          const pause = byTestId('pause').getBoundingClientRect()
          const stick = byTestId('touch-stick').getBoundingClientRect()
          const lefts = BUTTONS.map((id) => byTestId(id).getBoundingClientRect())
          const buttonsTop = Math.min(stick.top, ...lefts.map((box) => box.top))
          if (buttonsTop - pause.bottom > 8) {
            const above = hit(window.innerWidth / 2, (pause.bottom + buttonsTop) / 2)
            if (above === null || !byTestId('camera-drag').contains(above))
              problems.push(`${label}: the scene above the controls does not reach the drag`)
          }
          const gap = Math.min(...lefts.map((box) => box.left)) - stick.right
          const wide = gap > 2 * STICKY_MARGIN_PX + 4
          if (conditions.geometry.scale === 1 && !wide)
            problems.push(
              `${label}: the stick and the buttons leave a ${Math.round(gap)} px gap, under their sticky margins`,
            )
          if (wide) {
            const x = stick.right + gap / 2
            const y = Math.min(stick.top, ...lefts.map((box) => box.top)) + 4
            const scene = hit(x, y)
            if (scene === null || !byTestId('camera-drag').contains(scene))
              problems.push(`${label}: the scene between the groups does not reach the drag`)
          }
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
