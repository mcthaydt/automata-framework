import './theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, type Conditions, checkLayout, publishConditions } from './testing/layout-contract'
import { FIXTURE_LOCALES, findUntranslated } from './testing/locale-fixture'
import PrimitivesFixture, {
  PRIMITIVE_SHOWS,
  type PrimitiveShow,
  WORDED_TILE,
} from './testing/PrimitivesFixture.svelte'
import { settleLayout } from './testing/settle'

// U-a (M4 spec §4.12): each M4.6 primitive at every reference size and variant, keyboard, Ruken's strip and TV
// scale included, with production CSS, in Chromium, WebKit and Firefox. `checkLayout` holds every control to the
// target at the scale, keeps controls out from under the keyboard and the strip, and keeps the document still; each
// primitive names the parts a player must be able to reach. Each runs in English and again in the xx-long pseudo-locale
// (PRODUCT spec §4 item 7), where every word it shows must be in xx-long.

/** The pager shows dots or, where they do not fit, a counter: either way it must be reachable. */
function pager(): HTMLElement[] {
  const dots = [...document.querySelectorAll<HTMLElement>('[data-pager-dot]')]
  return dots.length > 0 ? dots : [byTestId('pager-counter')]
}

const OVERLAYS: readonly PrimitiveShow[] = ['modal', 'sheet', 'toast']

/**
 * What a player must reach without scrolling. With the keyboard up the screen frame scrolls what does not fit (as
 * `screen-frame.layout.test.ts` holds), so a primitive inside the frame names none then; an overlay keeps its own.
 */
function essentials(show: PrimitiveShow, keyboard: boolean): HTMLElement[] {
  if (keyboard && !OVERLAYS.includes(show)) return []
  switch (show) {
    case 'split':
      return [byTestId('split-first'), byTestId('split-second')]
    case 'option-group':
      return ['low', 'medium', 'high'].map((value) => byTestId(`option-${value}`))
    case 'pager-dots':
      return pager()
    case 'paged-grid':
    case 'paged-grid-worded':
      return [byTestId('tile-0'), ...pager()]
    case 'controls':
      return [
        byTestId('button-primary'),
        byTestId('button-ghost'),
        byTestId('icon-button'),
        byTestId('toggle'),
      ]
    case 'slider':
      return [byTestId('slider').querySelector('input') as HTMLElement]
    case 'chip':
      return [byTestId('chip-danger')]
    case 'modal':
      return [
        document.querySelector<HTMLElement>('[data-modal-close]') as HTMLElement,
        byTestId('modal-done'),
      ]
    case 'sheet':
      return [
        document.querySelector<HTMLElement>('[data-modal-close]') as HTMLElement,
        byTestId('sheet-done'),
      ]
    case 'toast':
      return []
    case 'leaderboard':
    case 'leaderboard-offline':
      return [byTestId(`${show}-back`)]
    case 'save-status':
    case 'save-status-long':
      return []
  }
}

/** The slider's thumb is a whole target: the input is as tall as one, and so is the thumb drawn in it. */
function sliderProblems(show: PrimitiveShow, conditions: Conditions): string[] {
  if (show !== 'slider') return []
  const input = byTestId('slider').querySelector('input')
  const target = 44 * conditions.geometry.scale
  const height = input?.getBoundingClientRect().height ?? 0
  return height + 0.5 < target
    ? [`the slider is ${Math.round(height)}px tall, under ${Math.round(target)}px`]
    : []
}

/**
 * The grid's page area is never shorter than one row of the tiles the grid was asked for (`minTile`, at the scale),
 * however little room it is given: a shorter one clips its tiles under the pager, where scrolling the frame cannot
 * reach them. And a tile is never smaller than that, across or down.
 */
function gridProblems(show: PrimitiveShow, conditions: Conditions): string[] {
  if (show !== 'paged-grid' && show !== 'paged-grid-worded') return []
  const first = byTestId('tile-0')
  const area = first.closest<HTMLElement>('.af-paged__area')
  const tile = (show === 'paged-grid' ? 44 : WORDED_TILE) * conditions.geometry.scale
  const height = area?.clientHeight ?? 0
  const problems: string[] = []
  if (height + 0.5 < tile)
    problems.push(`the grid's page area is ${Math.round(height)}px, under one ${Math.round(tile)}px row`)
  const box = first.getBoundingClientRect()
  if (box.width + 0.5 < tile || box.height + 0.5 < tile)
    problems.push(`a tile is ${Math.round(box.width)}x${Math.round(box.height)}, under ${Math.round(tile)}px`)
  return problems
}

/**
 * The toast takes no taps (they pass through to what is under it), so it is not hit tested; it must be whole on
 * screen and clear of the keyboard and Ruken's strip.
 */
function toastProblems(show: PrimitiveShow, conditions: Conditions): string[] {
  if (show !== 'toast') return []
  const box = byTestId('toast').getBoundingClientRect()
  const problems: string[] = []
  if (box.left < -0.5 || box.top < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5)
    problems.push('the toast is not whole on screen')
  for (const area of conditions.reserved) {
    const overlaps =
      box.left < area.x + area.width &&
      box.right > area.x &&
      box.top < area.y + area.height &&
      box.bottom > area.y
    if (overlaps) problems.push('the toast is under a reserved area')
  }
  return problems
}

/**
 * The save status is read, not pressed, so it names no control; it must be whole inside the screen, wrap in its own
 * width instead of running past it, and keep clear of the keyboard and Ruken's strip.
 */
function saveStatusProblems(show: PrimitiveShow, conditions: Conditions): string[] {
  if (show !== 'save-status' && show !== 'save-status-long') return []
  const line = byTestId(show)
  const box = line.getBoundingClientRect()
  const problems: string[] = []
  if (box.left < -0.5 || box.right > innerWidth + 0.5) problems.push('the status runs past the screen')
  if (line.scrollWidth > line.clientWidth + 0.5) problems.push('the status is wider than its own box')
  const parent = line.parentElement
  if (parent !== null && box.right > parent.getBoundingClientRect().right + 0.5)
    problems.push('the status runs past its parent')
  for (const area of conditions.reserved) {
    const overlaps =
      box.left < area.x + area.width &&
      box.right > area.x &&
      box.top < area.y + area.height &&
      box.bottom > area.y
    if (overlaps) problems.push('the status is under a reserved area')
  }
  return problems
}

for (const locale of FIXTURE_LOCALES) {
  describe(`M4.6 primitives layout contract (${locale})`, () => {
    for (const show of PRIMITIVE_SHOWS) {
      test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
        await page.viewport(size.width, size.height)
        const problems: string[] = []
        for (const variant of VARIANTS) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mountFixture(PrimitivesFixture, { show, locale })
          await settleLayout()
          // A primitive that arrives with motion (the toast slides in) is measured where it comes to rest.
          await Promise.all(document.getAnimations().map((animation) => animation.finished))
          const found = [
            ...checkLayout(conditions, essentials(show, variant.keyboard !== undefined)),
            ...gridProblems(show, conditions),
            ...sliderProblems(show, conditions),
            ...toastProblems(show, conditions),
            ...saveStatusProblems(show, conditions),
            ...(locale === 'en' ? [] : findUntranslated(document.body)),
          ]
          for (const problem of found) problems.push(`${variant.name}: ${problem}`)
          await fixture.unmount()
        }
        expect(problems).toEqual([])
      })
    }
  })
}
