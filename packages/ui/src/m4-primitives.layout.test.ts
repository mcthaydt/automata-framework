import './theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, type Conditions, checkLayout, publishConditions } from './testing/layout-contract'
import PrimitivesFixture, { PRIMITIVE_SHOWS, type PrimitiveShow } from './testing/PrimitivesFixture.svelte'
import { settleLayout } from './testing/settle'

// U-a (M4 spec §4.12): each M4.6 primitive at every reference size and variant, keyboard, Ruken's strip and TV
// scale included, with production CSS, in Chromium, WebKit and Firefox. `checkLayout` holds every control to the
// target at the scale, keeps controls out from under the keyboard and the strip, and keeps the document still; each
// primitive names the parts a player must be able to reach.

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
 * The grid's page area is never shorter than one row of whole targets, however little room it is given: a shorter
 * one clips its tiles under the pager, where scrolling the frame cannot reach them.
 */
function gridProblems(show: PrimitiveShow, conditions: Conditions): string[] {
  if (show !== 'paged-grid') return []
  const area = byTestId('tile-0').closest<HTMLElement>('.af-paged__area')
  const target = 44 * conditions.geometry.scale
  const height = area?.clientHeight ?? 0
  return height + 0.5 < target
    ? [`the grid's page area is ${Math.round(height)}px, under one ${Math.round(target)}px row`]
    : []
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

describe('M4.6 primitives layout contract', () => {
  for (const show of PRIMITIVE_SHOWS) {
    test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(PrimitivesFixture, { show })
        await settleLayout()
        // A primitive that arrives with motion (the toast slides in) is measured where it comes to rest.
        await Promise.all(document.getAnimations().map((animation) => animation.finished))
        const found = [
          ...checkLayout(conditions, essentials(show, variant.keyboard !== undefined)),
          ...gridProblems(show, conditions),
          ...sliderProblems(show, conditions),
          ...toastProblems(show, conditions),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  }
})
