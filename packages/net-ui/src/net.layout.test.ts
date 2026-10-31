import '@mcthaydt/automata-ui/theme.css'
import { findUnreachable, mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import NetLayoutFixture, { type NetShow } from './NetLayoutFixture.svelte'

// The connection badge and the reconnect overlay at every reference size and variant, English and xx-long, with production CSS
// (M7 spec §8): the badge is one small pill, the overlay a single row with Leave (48 px) that wraps, never clipped, never under
// the keyboard or the host's strip, and Leave reachable (scrolled to, where the room is too short). The tight sizes core's own
// primitives also run (down to 520 x 180 with the keyboard up) are not run: the row asks for the reference sizes, and a visible
// area of about 100 px cannot hold a 48 px Leave beside Back without covering it.
const SHOWS: readonly { show: NetShow; testId: string; essentials: readonly string[] }[] = [
  { show: 'connecting', testId: 'net-badge', essentials: [] },
  { show: 'degraded', testId: 'net-badge', essentials: [] },
  { show: 'reconnecting', testId: 'net-reconnect', essentials: ['net-reconnect'] },
  { show: 'expired', testId: 'net-reconnect', essentials: ['net-reconnect'] },
]

for (const locale of ['en', 'xx-long']) {
  describe(`net layout contract (${locale})`, () => {
    test.each([...REFERENCE_SIZES])('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        for (const { show, testId, essentials } of SHOWS) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mountFixture(NetLayoutFixture, { show, locale })
          await vi.waitFor(() => expect(byTestId(testId)).toBeTruthy())
          if (show === 'expired')
            await vi.waitFor(() => expect(byTestId('net-reconnect').dataset.state).toBe('expired'))
          await settleLayout()
          // Where the room is too short for the overlay it scrolls as a declared region; Leave must be reachable once scrolled to.
          const scrolls =
            testId === 'net-reconnect' && byTestId(testId).scrollHeight > byTestId(testId).clientHeight + 1
          const found = [
            ...checkLayout(conditions, scrolls ? [] : essentials.map(byTestId)),
            ...(testId === 'net-reconnect' ? leaveProblems(scrolls) : []),
          ]
          for (const problem of found) problems.push(`${variant.name} ${show}: ${problem}`)
          await fixture.unmount()
        }
      }
      expect(problems).toEqual([])
    })
  })
}

/** Leave is a 48 px primary action (scaled by the variant), in the overlay, and the overlay keeps a readable line of words. */
function leaveProblems(scrolls: boolean): string[] {
  const panel = byTestId('net-reconnect')
  const leave = panel.querySelector('button')
  if (leave === null) return ['the overlay has no Leave button']
  const problems: string[] = []
  if (scrolls) {
    leave.scrollIntoView({ block: 'nearest' })
    problems.push(...findUnreachable([leave]).map((problem) => `once scrolled to, ${problem}`))
    panel.scrollTop = 0
  }
  const scale =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--af-scale')) || 1
  const box = leave.getBoundingClientRect()
  if (box.height < 48 * scale - 0.5)
    problems.push(`Leave is ${Math.round(box.height)}px tall, under 48 px at this scale`)
  const text = panel.querySelector('.text')
  if (text !== null && text.clientHeight < Number.parseFloat(getComputedStyle(text).lineHeight) - 0.5)
    problems.push('the overlay shows less than one line of its words')
  return problems
}
