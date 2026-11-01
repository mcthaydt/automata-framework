import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { EDITOR_CASES, type OpenSuite, openCase } from '../testing/editor-cases'

// Focus order of the suite's one shell with Home or each 1.0 editor open, in Chromium, WebKit and Firefox at the phone and
// the wide size (editor suite spec §10, plan EDS.10 step 3). Tab walks the regions in the shell's own order (top bar, rail
// or tab bar, panel, canvas, inspector, dock, status), every stop is on screen, a closed drawer or sheet holds no stop, and
// the walk comes back round to where it began, so nothing is a trap. Dialog traps are the kit's `Dialog` tests.

const ORDER = ['topbar', 'rail', 'panel', 'canvas', 'inspector', 'dock', 'status'] as const

let opened: OpenSuite | undefined
afterEach(async () => {
  await opened?.handle.dispose()
  opened?.target.remove()
  opened = undefined
})

interface Stop {
  readonly region: string
  readonly label: string
}

/** Tabs through the page from its start until focus wraps to the first stop again (or `limit` steps pass). */
async function walk(limit: number): Promise<{ stops: Stop[]; wrapped: boolean }> {
  // Tab starts after wherever focus last was, so put the starting point at the top of the page.
  const start = document.body.insertBefore(document.createElement('span'), document.body.firstChild)
  start.tabIndex = -1
  start.focus()
  start.remove()
  const stops: Stop[] = []
  for (let step = 0; step < limit; step += 1) {
    await userEvent.tab()
    const focused = document.activeElement
    // Focus left the page (the browser's own chrome has the next stop): the walk is round.
    if (focused === null || focused === document.body) {
      if (stops.length > 0) return { stops, wrapped: true }
      continue
    }
    const region = focused.closest('[data-region]')?.getAttribute('data-region') ?? 'outside'
    const label =
      focused.getAttribute('aria-label') ?? focused.textContent?.trim().slice(0, 24) ?? focused.tagName
    const first = stops[0]
    if (first !== undefined && first.region === region && first.label === label && stops.length > 1)
      return { stops, wrapped: true }
    const box = focused.getBoundingClientRect()
    expect(box.width * box.height, `${region}/${label} is on screen`).toBeGreaterThan(0)
    stops.push({ region, label })
  }
  return { stops, wrapped: false }
}

const SAMPLE_SIZES: readonly EditorSize[] = SIZES.filter(
  (size) => size.name === 'phone-portrait' || size.name === 'ipad-pro-11-landscape',
)

describe.each(SAMPLE_SIZES)('Suite focus order at $name ($width x $height)', (size) => {
  test.each(EDITOR_CASES)('$name: regions in shell order, every stop shown, no trap', async (which) => {
    opened = await openCase(size, which)
    await arrived()
    const { stops, wrapped } = await walk(150)
    expect(stops.length, 'there are tab stops').toBeGreaterThan(2)
    expect(wrapped, 'focus left the page or came back to its first stop').toBe(true)
    const ranks = stops.map((stop) => ORDER.indexOf(stop.region as (typeof ORDER)[number]))
    expect(
      ranks.includes(-1),
      `a stop outside the shell: ${JSON.stringify(stops.filter((_, i) => ranks[i] === -1))}`,
    ).toBe(false)
    expect(ranks, 'regions are visited in the shell order').toEqual([...ranks].sort((a, b) => a - b))
  })
})
