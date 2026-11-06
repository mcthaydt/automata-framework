import '#src/theme.css'
import {
  findUnreachable,
  mountFixture,
  REFERENCE_SIZES,
  TIGHT_SIZES,
  VARIANTS,
} from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, errorPanelFloor, publishConditions } from '#src/testing/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/locale-fixture.ts'
import StatusFixture from '#src/testing/StatusFixture.svelte'
import { settleLayout } from '#src/testing/settle.ts'

// LoaderOverlay, the boot failure panel and an ErrorPanel at every reference size and variant,
// keyboard included, with production CSS (M1.6 spec §7, plan Task 11). A failure can arrive while
// the player is typing, so its actions must stay clear of the keyboard, down to the tight sizes
// where the keyboard leaves the least room. The contract runs in English and again in the xx-long pseudo-locale
// (PRODUCT spec §4 item 7).
const ESSENTIALS = {
  loader: ['loader-overlay'],
  'boot-failure': ['error-continue', 'boot-failure-message'],
  error: ['error-retry', 'error-dismiss', 'error-panel-message'],
  'error-long': ['error-retry', 'error-dismiss', 'error-panel-message'],
  'error-three': ['error-retry', 'error-dismiss', 'error-help', 'error-panel-message'],
  'final-long': ['error-panel-message'],
} as const
const SHOWS = ['loader', 'boot-failure', 'error', 'error-long', 'error-three', 'final-long'] as const

/** How wide `chars` characters of the message's font are, read from a probe beside it. */
function charsWide(beside: HTMLElement, chars: number): number {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;width:${chars}ch;font:inherit`
  beside.after(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

/** The width of the panel's content box: where the message can be at its widest. */
function contentWidth(panel: HTMLElement): number {
  const style = getComputedStyle(panel)
  return panel.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
}

/**
 * The message's own checks (spec §3.4): it shows at least one whole line, and it is at least 20
 * characters wide (or the whole panel, where that is narrower), so the actions never stand without
 * a readable reason; in a tight row, at least half that. Back's coverage is `checkLayout`'s.
 */
function messageProblems(show: (typeof SHOWS)[number]): string[] {
  if (show === 'loader') return []
  const message = byTestId(show === 'boot-failure' ? 'boot-failure-message' : 'error-panel-message')
  const panel = message.closest<HTMLElement>('[role="alert"]')
  if (panel === null) return ['the message is not in a panel']
  const line = Number.parseFloat(getComputedStyle(message).lineHeight)
  const problems: string[] = []
  if (message.clientHeight < line - 0.5)
    problems.push(`the message shows ${message.clientHeight}px, under one line`)
  const tight = panel.dataset.layout === 'row-tight'
  const readable = Math.min(charsWide(message, 20), contentWidth(panel)) / (tight ? 2 : 1)
  if (message.clientWidth < readable - 0.5)
    problems.push(
      `the message is ${message.clientWidth}px wide, under ${tight ? 'half of ' : ''}its readable width (${Math.round(readable)}px)`,
    )
  const box = message.getBoundingClientRect()
  const inner = panel.getBoundingClientRect()
  const style = getComputedStyle(panel)
  const right =
    inner.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight)
  if (box.right > right + 0.5)
    problems.push(`the message runs ${Math.round(box.right - right)}px past the panel`)
  return problems
}

/**
 * A panel with too little room for any layout scrolls as a whole (spec §3.4). Allowed only where
 * no layout fits the room the layer normally leaves it (its gutters taken off), and then each of
 * its essentials must be reachable once scrolled to.
 */
function overflowProblems(scrolled: readonly HTMLElement[]): string[] {
  const panel = scrolled[0]?.closest<HTMLElement>('[data-overflow]')
  if (panel === undefined || panel === null) return []
  const problems: string[] = []
  const layer = panel.parentElement as HTMLElement
  const style = getComputedStyle(layer)
  const gutter = Number.parseFloat(style.getPropertyValue('--af-gutter'))
  const top = Math.max(gutter, Number.parseFloat(style.getPropertyValue('--af-inset-top')) || 0)
  const room = layer.clientHeight - top - gutter
  const fit = errorPanelFloor(panel)
  if (!(fit > room)) problems.push(`the panel scrolls, but a layout (${fit}px) fits the room (${room}px)`)
  for (const element of scrolled) {
    element.scrollIntoView({ block: 'nearest' })
    problems.push(...findUnreachable([element]).map((problem) => `once scrolled to, ${problem}`))
  }
  panel.scrollTop = 0
  return problems
}

for (const locale of FIXTURE_LOCALES) {
  describe(`status layout contract (${locale})`, () => {
    test.each([...REFERENCE_SIZES, ...TIGHT_SIZES])('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        for (const show of SHOWS) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mountFixture(StatusFixture, { show, locale })
          await settleLayout()
          const essentials = ESSENTIALS[show].map(byTestId)
          const scrolled = essentials.filter((element) => element.closest('[data-overflow]') !== null)
          const found = [
            ...checkLayout(
              conditions,
              essentials.filter((element) => !scrolled.includes(element)),
            ),
            ...messageProblems(show),
            ...overflowProblems(scrolled),
            ...(locale === 'en' ? [] : findUntranslated(document.body)),
          ]
          for (const problem of found) problems.push(`${variant.name} ${show}: ${problem}`)
          await fixture.unmount()
        }
      }
      expect(problems).toEqual([])
    })
  })
}
