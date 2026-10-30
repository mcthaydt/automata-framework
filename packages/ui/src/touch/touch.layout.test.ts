import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { FIXTURE_LOCALES, findUntranslated } from '../testing/locale-fixture'
import { settleLayout } from '../testing/settle'
import TouchFixture from '../testing/TouchFixture.svelte'

// The touch buttons at every reference size and variant, with production CSS (M4 spec §6, §8): whole primary-size
// targets, on screen and hit-testable. With the on-screen keyboard up the frame scrolls (and a game hides its
// touch buttons while a text field has focus, §7), so nothing is essential there. Each contract runs in English and again
// in the xx-long pseudo-locale (PRODUCT spec §4 item 7).
const ACTIONS = ['touch-left', 'touch-right', 'touch-drop']
/** D-a's: the touch buttons that must show, and the bar's actions above them. */
const REQUIRED = ['touch-left', 'touch-right', 'touch-drop']
const BAR = ['bar-ready', 'bar-leave']

for (const locale of FIXTURE_LOCALES) {
  describe(`touch controls layout contract (${locale})`, () => {
    test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(TouchFixture, { locale })
        await settleLayout()
        const essentials = variant.keyboard === undefined ? ACTIONS.map(byTestId) : []
        const found = [
          ...checkLayout(conditions, essentials),
          ...(locale === 'en' ? [] : findUntranslated(document.body)),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
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

  // D-a (M4 spec §4.9, §13): with an ActionBar above the touch buttons, at every size and 780×270 above all, the
  // buttons keep the primary size and cover no bar action; where all four do not fit one row, only the required three
  // show, never shrunk.
  describe(`touch controls under an ActionBar layout contract (D-a, ${locale})`, () => {
    test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(TouchFixture, { show: 'with-bar', locale })
        await settleLayout()
        const essentials = variant.keyboard === undefined ? [...REQUIRED, ...BAR].map(byTestId) : []
        const found = [
          ...checkLayout(conditions, essentials),
          ...(locale === 'en' ? [] : findUntranslated(document.body)),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        const primary = 48 * conditions.geometry.scale
        for (const button of document.querySelectorAll<HTMLElement>('[data-touch-overlay] [data-action]')) {
          const { width, height } = button.getBoundingClientRect()
          if (width < primary - 0.5 || height < primary - 0.5)
            problems.push(
              `${variant.name}: ${button.dataset.action} is ${Math.round(width)}x${Math.round(height)}`,
            )
        }
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  })
}

describe('touch controls under an ActionBar (D-a)', () => {
  // At 780 x 270 one row holds all four; a 360 px phone does not, so there only the required three show.
  test('drops to the required buttons where one row cannot hold them all, and shows all four where it can', async () => {
    const sized = (name: string) => {
      const found = REFERENCE_SIZES.find((size) => size.name === name)
      if (found === undefined) throw new Error(`no reference size ${name}`)
      return found
    }
    const [rest] = VARIANTS
    if (rest === undefined) throw new Error('no rest variant')
    const narrowSize = sized('phone-small')
    await page.viewport(narrowSize.width, narrowSize.height)
    publishConditions(document.documentElement, narrowSize, rest)
    let fixture = mountFixture(TouchFixture, { show: 'with-bar' })
    await settleLayout()
    const shown = () =>
      [...document.querySelectorAll<HTMLElement>('[data-touch-overlay] [data-action]')].map(
        (b) => b.dataset.action,
      )
    const narrow = shown()
    await fixture.unmount()
    const wideSize = sized('desktop-720p')
    await page.viewport(wideSize.width, wideSize.height)
    publishConditions(document.documentElement, wideSize, rest)
    fixture = mountFixture(TouchFixture, { show: 'with-bar' })
    await settleLayout()
    expect(shown()).toEqual(['touch-left', 'touch-right', 'touch-emote', 'touch-drop'])
    await fixture.unmount()
    expect(narrow).toEqual(REQUIRED)
  })
})
