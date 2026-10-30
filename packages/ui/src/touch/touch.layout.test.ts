import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import CameraDragFixture from '../testing/CameraDragFixture.svelte'
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

// D-a (M4 spec §4.9, §13): with an ActionBar above the touch buttons, at every size and 780×270 above all, the
// buttons keep the primary size and cover no bar action; where all four do not fit one row, only the required three
// show, never shrunk.
const REQUIRED = ['touch-left', 'touch-right', 'touch-drop']
const BAR = ['bar-ready', 'bar-leave']

describe('touch controls under an ActionBar layout contract (D-a)', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      const conditions = publishConditions(document.documentElement, size, variant)
      const fixture = mountFixture(TouchFixture, { show: 'with-bar' })
      await settleLayout()
      const essentials = variant.keyboard === undefined ? [...REQUIRED, ...BAR].map(byTestId) : []
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
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

// M4.12 (M4 spec §16.7, A-q, A-r): a 3D play screen's touch input, with production CSS. The move stick's zone keeps
// twice the primary size (one primary of height at a compact height) and is required, so with an ActionBar at 780×270 it stays beside the required button. The
// camera drag surface lies under every control and never covers the host's reserved strip.
const STICK_ESSENTIALS = ['touch-stick', 'attack', 'pause']

/** Every reserved-strip point the surface would answer for, sampled every 8 px down the strip's middle. */
function surfaceHitsInside(strip: { x: number; y: number; width: number; height: number }): number {
  const surface = byTestId('camera-drag')
  let hits = 0
  for (let y = strip.y + 4; y < strip.y + strip.height; y += 8) {
    const hit = document.elementFromPoint(strip.x + strip.width / 2, y)
    if (hit !== null && surface.contains(hit)) hits += 1
  }
  return hits
}

describe('touch move stick and camera drag layout contract (M4.12)', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const show of ['default', 'with-bar'] as const) {
      for (const variant of VARIANTS) {
        const label = `${show} ${variant.name}`
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(CameraDragFixture, { show })
        await settleLayout()
        const essentials =
          variant.keyboard === undefined
            ? [...STICK_ESSENTIALS, ...(show === 'with-bar' ? BAR : [])].map(byTestId)
            : []
        for (const problem of checkLayout(conditions, essentials)) problems.push(`${label}: ${problem}`)
        const primary = 48 * conditions.geometry.scale
        // A compact height keeps one primary target of height; elsewhere the zone is square.
        const stickHeight = conditions.geometry.heightTier === 'compact' ? primary : 2 * primary
        const stick = byTestId('touch-stick').getBoundingClientRect()
        if (stick.width < 2 * primary - 0.5 || stick.height < stickHeight - 0.5)
          problems.push(`${label}: the stick is ${Math.round(stick.width)}x${Math.round(stick.height)}`)
        const attack = byTestId('attack').getBoundingClientRect()
        if (attack.width < primary - 0.5 || attack.height < primary - 0.5)
          problems.push(`${label}: attack is ${Math.round(attack.width)}x${Math.round(attack.height)}`)
        const surface = byTestId('camera-drag').getBoundingClientRect()
        for (const strip of conditions.reserved) {
          if (variant.hostReserved === undefined) continue
          const overlap =
            Math.min(surface.right, strip.x + strip.width) - Math.max(surface.left, strip.x) > 0.5 &&
            Math.min(surface.bottom, strip.y + strip.height) - Math.max(surface.top, strip.y) > 0.5
          if (overlap || surfaceHitsInside(strip) > 0)
            problems.push(`${label}: the camera drag surface reaches into the host's strip`)
        }
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
