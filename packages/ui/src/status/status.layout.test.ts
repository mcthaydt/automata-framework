import '../theme.css'
import {
  findUnreachable,
  mountFixture,
  REFERENCE_SIZES,
  TIGHT_SIZES,
  VARIANTS,
} from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import StatusFixture from '../testing/StatusFixture.svelte'
import { settleLayout } from '../testing/settle'

// LoaderOverlay, the boot failure panel and an ErrorPanel at every reference size and variant,
// keyboard included, with production CSS (M1.6 spec §7, plan Task 11). A failure can arrive while
// the player is typing, so its actions must stay clear of the keyboard, down to the tight sizes
// where the keyboard leaves the least room.
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

/**
 * The message's own checks (spec §3.4): it shows at least one whole line, at least 20 characters
 * wide, so the actions never stand without a readable reason. Back's coverage is `checkLayout`'s.
 */
function messageProblems(show: (typeof SHOWS)[number]): string[] {
  if (show === 'loader') return []
  const message = byTestId(show === 'boot-failure' ? 'boot-failure-message' : 'error-panel-message')
  const line = Number.parseFloat(getComputedStyle(message).lineHeight)
  const readable = charsWide(message, 20)
  const problems: string[] = []
  if (message.clientHeight < line - 0.5)
    problems.push(`the message shows ${message.clientHeight}px, under one line`)
  const panel = message.closest<HTMLElement>('[role="alert"]')
  const tight = panel?.dataset.layout === 'row-tight'
  if (message.clientWidth < readable - 0.5 && !tight)
    problems.push(
      `the message is ${message.clientWidth}px wide, under 20 characters (${Math.round(readable)}px)`,
    )
  // A narrow message is allowed only where the stacked panel cannot fit the room left to it.
  if (tight && panel !== null) {
    const layer = panel.parentElement as HTMLElement
    const style = getComputedStyle(layer)
    const room =
      layer.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
    const stacked = Number.parseFloat(panel.dataset.stackFloor ?? '')
    if (!(stacked > room))
      problems.push(`the row is tight, but the stacked panel (${stacked}px) fits the room (${room}px)`)
  }
  return problems
}

/**
 * A panel with too little room for any layout scrolls as a whole (spec §3.4). Allowed only where
 * the stacked panel cannot fit the room, and then each of its essentials must be reachable once
 * scrolled to.
 */
function overflowProblems(scrolled: readonly HTMLElement[]): string[] {
  const panel = scrolled[0]?.closest<HTMLElement>('[data-overflow]')
  if (panel === undefined || panel === null) return []
  const problems: string[] = []
  const layer = panel.parentElement as HTMLElement
  const style = getComputedStyle(layer)
  const room =
    layer.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
  const stacked = Number.parseFloat(panel.dataset.stackFloor ?? '')
  if (!(stacked > room))
    problems.push(`the panel scrolls, but the stacked panel (${stacked}px) fits the room (${room}px)`)
  for (const element of scrolled) {
    element.scrollIntoView({ block: 'nearest' })
    problems.push(...findUnreachable([element]).map((problem) => `once scrolled to, ${problem}`))
  }
  panel.scrollTop = 0
  return problems
}

describe('status layout contract', () => {
  test.each([...REFERENCE_SIZES, ...TIGHT_SIZES])('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      for (const show of SHOWS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(StatusFixture, { show })
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
        ]
        for (const problem of found) problems.push(`${variant.name} ${show}: ${problem}`)
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
