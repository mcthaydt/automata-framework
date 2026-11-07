// G3-t's layout half (GAME-3D.1a part 2, DESIGN.md §12.3, §19): base-3d's own screens in `xx-long`, the pseudo-locale
// that lengthens every word, at 844 × 390 and 780 × 270 in Chromium, WebKit and Firefox: no word left in English and
// ui's layout contract met, every primary action reachable. The words come through the live copy (copy.svelte.ts),
// pseudo-localized here until the catalog compiles with Paraglide (the plan's log has why).
import '@automata/framework/theme.css'
import '@automata/framework'
import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@automata/content/locale'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { liveCopy } from '#src/features/screens/copy.svelte.ts'
import { BASE3D_COPY, type Base3dCopy } from '#src/features/screens/copy.ts'
import EndScreen from '#src/features/screens/EndScreen.svelte'
import { hudInPlay } from '#src/features/screens/hud.ts'
import SplashScreen from '#src/features/screens/SplashScreen.svelte'
import { Progress } from '#src/shared/progress.resource.ts'
import HudInPlay from '#src/testing/HudInPlay.svelte'
import { startSim } from '#src/testing/sim.ts'

/** `copy` with every word, and every word a function makes, in `xx-long`. */
function pseudo<T>(copy: T): T {
  if (typeof copy === 'string') return pseudoLocalize(copy) as T
  if (typeof copy === 'function')
    return ((...inputs: unknown[]) => pseudoLocalize((copy as (...a: unknown[]) => string)(...inputs))) as T
  if (copy !== null && typeof copy === 'object')
    return Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, pseudo(value)])) as T
  return copy
}

/** Every text and accessible name left in English. */
function untranslated(root: HTMLElement): string[] {
  const problems: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (hasRawText(text) && node.parentElement?.closest('[aria-hidden="true"]') === null)
      problems.push(`"${text.trim()}" is not in ${PSEUDO_LOCALE}`)
  }
  for (const element of root.querySelectorAll('[aria-label]')) {
    const label = element.getAttribute('aria-label') ?? ''
    if (hasRawText(label)) problems.push(`aria-label "${label}" is not in ${PSEUDO_LOCALE}`)
  }
  return problems
}

type Size = Parameters<typeof publishConditions>[1]
const SIZES = [
  { name: 'phone landscape', width: 844, height: 390, formFactor: 'phone-landscape' },
  { name: 'compact', width: 780, height: 270, formFactor: 'phone-landscape', heightTier: 'compact' },
] as unknown as readonly Size[]
/** The plain variant: no keyboard, no host strip, no TV scale (G3-v's variants are 1h's). */
const REST: Parameters<typeof publishConditions>[2] = { name: 'rest' }

const TITLE = pseudoLocalize('Ember Hall')

/** Each screen, how to show it, and its primary actions' test ids (none on the splash, which any key leaves). */
const SCREENS = {
  splash: [() => mount(SplashScreen, { target: document.body, props: { title: TITLE } }), []],
  end: [() => mount(EndScreen, { target: document.body, props: { time: '1:02', onMenu: () => {} } }), []],
  hud: [showHud, []],
} as const

/**
 * The HUD over the play screen (hud.layout.test.ts's fixture) with some embers taken. The play screen's own words are the
 * default screens' (DX.2d), so only the HUD's are read for English.
 */
async function showHud(): Promise<ReturnType<typeof mount>> {
  const sim = await startSim()
  sim.resource(Progress).taken = [0, 1, 2]
  hudInPlay.sim = sim
  return mount(HudInPlay, { target: document.body, props: { touch: false } })
}

describe(`base-3d’s screens in ${PSEUDO_LOCALE} (G3-t)`, () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    liveCopy.current = BASE3D_COPY.en
    document.body.replaceChildren()
  })

  for (const [name, [show, essentials]] of Object.entries(SCREENS))
    for (const size of SIZES)
      it(`${name} at ${size.width} x ${size.height}`, async () => {
        await page.viewport(size.width, size.height)
        const conditions = publishConditions(document.documentElement, size, REST)
        liveCopy.current = pseudo<Base3dCopy>(BASE3D_COPY.en)
        shown = await show()
        flushSync()
        await settleLayout()
        // The primary actions: each screen's buttons, found by their action ids or test ids.
        const actions = [
          ...essentials.map(byTestId),
          ...document.querySelectorAll<HTMLElement>('[data-action-id], .af-game-menu__actions button'),
        ]
        const words = document.querySelector<HTMLElement>('[data-testid="hud"]') ?? document.body
        expect([...untranslated(words), ...checkLayout(conditions, actions)]).toEqual([])
      })
})
