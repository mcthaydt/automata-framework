// The end screen's action row with production CSS in Chromium, WebKit and Firefox (GAME-3D.1b
// part 2, follow-up from #300): the row is centred at a bounded width, so the primary's focus ring sits inside an
// equal margin on both sides rather than overhanging a full-width row's 12 px gutter on the left only.
import '@automata/framework/theme.css'
import '@automata/framework'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import EndScreen from '#src/features/screens/EndScreen.svelte'

/** The row's widest, in CSS px: 26rem. */
const ROW_MAX = 26 * 16

const screens = [
  {
    name: 'the end screen',
    mountIt: (target: HTMLElement) =>
      mount(EndScreen, { target, props: { time: '12.00 s', onMenu: () => {} } }),
  },
]

describe('the action row (GAME-3D.1b part 2)', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    document.body.replaceChildren()
  })

  for (const { name, mountIt } of screens)
    for (const [width, height] of [
      [844, 390],
      [390, 844],
    ] as const)
      it(`is centred on ${name} at ${width} x ${height}, no wider than 26rem`, async () => {
        await page.viewport(width, height)
        shown = mountIt(document.body)
        flushSync()
        await document.fonts.ready
        const bar = document.querySelector('.af-action-bar')?.getBoundingClientRect()
        expect(bar).toBeDefined()
        if (bar === undefined) return
        const left = bar.left
        const right = window.innerWidth - bar.right
        expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
        expect(bar.width).toBeLessThanOrEqual(ROW_MAX)
        // Never narrower than the screen leaves: the frame's 12–16 px gutter at most on a phone held upright.
        expect(left).toBeGreaterThanOrEqual(8)
        expect(bar.width).toBeGreaterThanOrEqual(Math.min(ROW_MAX, window.innerWidth - 2 * 16))
      })
})
