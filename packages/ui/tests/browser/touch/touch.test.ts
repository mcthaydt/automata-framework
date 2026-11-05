import '#src/theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import CameraDragFixture from '#src/testing/CameraDragFixture.svelte'
import { byTestId, checkLayout, publishConditions } from '#src/testing/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/locale-fixture.ts'
import { settleLayout } from '#src/testing/settle.ts'
import TouchFixture from '#src/testing/TouchFixture.svelte'
import { STICKY_MARGIN_PX } from '#src/touch/touch-controls.ts'

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
        // With the keyboard up the frame scrolls and a game hides its touch controls (M4 spec §8): nothing to hit.
        if (variant.keyboard === undefined)
          for (const problem of hitProblems(show)) problems.push(`${label}: ${problem}`)
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })

  // A start-side button group reaches `STICKY_MARGIN_PX` past its buttons; that margin must not take the stick's
  // edge (review of #204).
  test('a start-side button’s sticky margin never takes the stick', async () => {
    const [rest] = VARIANTS
    const size = REFERENCE_SIZES.find((reference) => reference.name === 'desktop-720p')
    if (rest === undefined || size === undefined) throw new Error('no rest variant or desktop size')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, rest)
    const fixture = mountFixture(CameraDragFixture, { show: 'start-button' })
    await settleLayout()
    const stick = byTestId('touch-stick')
    const box = stick.getBoundingClientRect()
    const hit = document.elementFromPoint(box.right - 4, box.top + box.height / 2)
    await fixture.unmount()
    expect(hit !== null && stick.contains(hit)).toBe(true)
  })
})

/** The element hit at a point, as a description, for a failure message. */
const describeHit = (hit: Element | null): string =>
  hit === null ? 'nothing' : (hit.getAttribute('data-testid') ?? hit.className.toString() ?? hit.tagName)

/**
 * Hit testing (A-p, review of #204): each control's centre hits the control, and the scene between the corner row
 * and the controls, and the gap between the stick and the buttons where it is wider than the sticky margins, hit
 * the camera drag surface. Only the play screen's pass-through frame lets the pointer through to it.
 */
function hitProblems(show: 'default' | 'with-bar'): string[] {
  const problems: string[] = []
  const surface = byTestId('camera-drag')
  const at = (x: number, y: number) => document.elementFromPoint(x, y)
  for (const id of [...STICK_ESSENTIALS, ...(show === 'with-bar' ? BAR : [])]) {
    const control = byTestId(id)
    const box = control.getBoundingClientRect()
    const hit = at(box.left + box.width / 2, box.top + box.height / 2)
    if (hit === null || !control.contains(hit)) problems.push(`${id}'s centre hits ${describeHit(hit)}`)
  }
  const pause = byTestId('pause').getBoundingClientRect()
  const stick = byTestId('touch-stick').getBoundingClientRect()
  const below = show === 'with-bar' ? byTestId('bar-ready').getBoundingClientRect().top : stick.top
  if (below - pause.bottom > 4) {
    const hit = at(window.innerWidth / 2, (pause.bottom + below) / 2)
    if (hit === null || !surface.contains(hit))
      problems.push(`the scene hits ${describeHit(hit)}, not the drag`)
  }
  const buttons = document.querySelector('[data-touch-side="end"]')?.getBoundingClientRect()
  if (buttons !== undefined && buttons.left - stick.right > 2 * STICKY_MARGIN_PX + 4) {
    const hit = at((stick.right + buttons.left) / 2, stick.top + stick.height / 2)
    if (hit === null || !surface.contains(hit)) problems.push(`the overlay's gap hits ${describeHit(hit)}`)
  }
  return problems
}

// M4.12b (follow-up to #204): at a compact height the zone is one primary target tall while the ring stays
// `2 * TOUCH_STICK_RADIUS_PX` across, so the ring must be kept on screen. Its whole box lies inside the region the
// geometry owner leaves visible (the viewport less the safe area, Ruken's strip and what covers the page's foot), at
// rest and held with the thumb landing at each of the zone's corners. The keyboard variant is left out: with it up
// the frame scrolls and a game hides its touch controls (M4 spec §8).
const RING_SIZES = REFERENCE_SIZES.filter(
  (size) => size.heightTier === 'compact' || size.name === 'iphone-14-landscape',
)
const RING_VARIANTS = VARIANTS.filter((variant) => variant.keyboard === undefined)

const touchPointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
    pointerId: 11,
    clientX: x,
    clientY: y,
  })

/** Where the ring's box runs past `area`, by how many px on each side it does; empty when it is inside. */
function ringOutside(area: { x: number; y: number; width: number; height: number }): string[] {
  const ring = document.querySelector('.af-touch__stick-ring')?.getBoundingClientRect()
  if (ring === undefined) return ['no ring']
  const past = {
    left: area.x - ring.left,
    top: area.y - ring.top,
    right: ring.right - (area.x + area.width),
    bottom: ring.bottom - (area.y + area.height),
  }
  return Object.entries(past)
    .filter(([, by]) => by > 0.5)
    .map(([side, by]) => `the ring runs ${Math.round(by)} px past the ${side}`)
}

describe('the touch stick’s ring stays inside the visible area (M4.12b)', () => {
  test.each(RING_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const show of ['default', 'with-bar'] as const) {
      for (const variant of RING_VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(CameraDragFixture, { show })
        await settleLayout()
        const label = `${show} ${variant.name}`
        const area = conditions.geometry.visible
        for (const problem of ringOutside(area)) problems.push(`${label} at rest: ${problem}`)
        const zone = byTestId('touch-stick')
        const box = zone.getBoundingClientRect()
        const corners = {
          'top-left': [box.left + 1, box.top + 1],
          'top-right': [box.right - 1, box.top + 1],
          'bottom-left': [box.left + 1, box.bottom - 1],
          'bottom-right': [box.right - 1, box.bottom - 1],
        } as const
        for (const [corner, [x, y]] of Object.entries(corners)) {
          zone.dispatchEvent(touchPointer('pointerdown', x, y))
          await settleLayout()
          if (zone.dataset.stickState !== 'held') problems.push(`${label} ${corner}: the stick is not held`)
          for (const problem of ringOutside(area)) problems.push(`${label} held at ${corner}: ${problem}`)
          zone.dispatchEvent(touchPointer('pointerup', x, y))
          await settleLayout()
        }
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
