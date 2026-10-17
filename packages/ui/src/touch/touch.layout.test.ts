import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { settleLayout } from '../testing/settle'
import TouchFixture from '../testing/TouchFixture.svelte'

// The touch buttons at every reference size and variant, with production CSS (M4 spec §6, §8): whole primary-size
// targets, on screen and hit-testable. With the on-screen keyboard up the frame scrolls (and a game hides its
// touch buttons while a text field has focus, §7), so nothing is essential there.
const ACTIONS = ['touch-left', 'touch-right', 'touch-drop']

describe('touch controls layout contract', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      const conditions = publishConditions(document.documentElement, size, variant)
      const fixture = mountFixture(TouchFixture, {})
      await settleLayout()
      const essentials = variant.keyboard === undefined ? ACTIONS.map(byTestId) : []
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
      const primary = 48 * conditions.geometry.scale
      for (const action of ACTIONS) {
        const { width, height } = byTestId(action).getBoundingClientRect()
        if (width < primary - 0.5 || height < primary - 0.5)
          problems.push(`${variant.name}: ${action} is ${Math.round(width)}x${Math.round(height)}`)
      }
      await fixture.unmount()
    }
    expect(problems).toEqual([])
  })
})
