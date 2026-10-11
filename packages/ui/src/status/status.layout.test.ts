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
  'final-long': ['error-panel-message'],
} as const
const SHOWS = ['loader', 'boot-failure', 'error', 'error-long', 'final-long'] as const

/**
 * The panel's own checks (spec §3.4). Its message shows at least one whole line. And Back stays
 * reachable, unless the panel rose over the corner row because its actions could not fit
 * otherwise: by then the panel is down to its floor (padding, one line of message, the actions).
 * A final panel has no actions, so it never rises, and Back is its only way out.
 */
function panelProblems(show: (typeof SHOWS)[number]): string[] {
  if (show === 'loader') return []
  const panelId = show === 'boot-failure' ? 'boot-failure' : 'error-panel'
  const panel = byTestId(panelId)
  const message = byTestId(`${panelId}-message`)
  const line = Number.parseFloat(getComputedStyle(message).lineHeight)
  const problems: string[] = []
  if (message.clientHeight < line - 0.5)
    problems.push(`the message shows ${message.clientHeight}px, under one line`)
  const backBlocked = findUnreachable([byTestId('corner-back')])
  const atFloor = panel.offsetHeight <= Number.parseFloat(panel.style.minHeight) + 1
  if (backBlocked.length > 0 && (show === 'final-long' || !atFloor)) problems.push(...backBlocked)
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
        const found = [...checkLayout(conditions, ESSENTIALS[show].map(byTestId)), ...panelProblems(show)]
        for (const problem of found) problems.push(`${variant.name} ${show}: ${problem}`)
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
