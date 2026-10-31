// G3-t's layout half (GAME-3D.1a part 2, DESIGN.md §12.3, §19): base-3d's own screens in `xx-long`, the pseudo-locale
// that lengthens every word, at 844 × 390 and 780 × 270 in Chromium, WebKit and Firefox: no word left in English and
// ui's layout contract met, every primary action reachable. The words come through the live copy (copy.svelte.ts),
// pseudo-localized here until the catalog compiles with Paraglide (the plan's log has why).
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@mcthaydt/automata-content/locale'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { metres } from '../constants/index.ts'
import { newGame } from '../state/save.ts'
import { FIRST_AREA } from '../testing/sim.ts'
import { liveCopy } from './copy.svelte.ts'
import { BASE3D_COPY, type Base3dCopy } from './copy.ts'
import EndScreen from './EndScreen.svelte'
import GameOverScreen from './GameOverScreen.svelte'
import ItemsScreen from './ItemsScreen.svelte'
import LockModeSection from './LockModeSection.svelte'
import MapScreen from './MapScreen.svelte'
import { mapOf } from './map.ts'
import SplashScreen from './SplashScreen.svelte'

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

const TITLE = pseudoLocalize('The Cold Kiln')
const PLAN = mapOf(FIRST_AREA, {
  x: metres(0),
  z: metres(-2),
  facing: 0,
  heading: 0,
  visited: [],
  hasMap: true,
  hasCompass: false,
  flags: [],
})
const SAVE = {
  ...newGame(),
  items: { sling: true, bombs: true, hookchain: true },
  equipped: 'sling' as const,
}

/** Each screen, how to show it, and its primary actions' test ids (none on the splash, which any key leaves). */
const SCREENS = {
  splash: [() => mount(SplashScreen, { target: document.body, props: { title: TITLE } }), []],
  end: [() => mount(EndScreen, { target: document.body, props: { time: '1:02', onMenu: () => {} } }), []],
  'game over': [
    () => mount(GameOverScreen, { target: document.body, props: { onContinue: () => {}, onQuit: () => {} } }),
    [],
  ],
  'lock mode': [
    () => mount(LockModeSection, { target: document.body }),
    ['lock-mode-toggle', 'lock-mode-hold'],
  ],
  items: [
    () =>
      mount(ItemsScreen, {
        target: document.body,
        props: { save: SAVE, onEquip: () => {}, onBack: () => {} },
      }),
    ['corner-back'],
  ],
  map: [
    () => mount(MapScreen, { target: document.body, props: { plan: PLAN, onClose: () => {} } }),
    ['corner-back'],
  ],
} as const

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
        shown = show()
        flushSync()
        await settleLayout()
        // The primary actions: each screen's buttons, found by their action ids or test ids.
        const actions = [
          ...essentials.map(byTestId),
          ...document.querySelectorAll<HTMLElement>('[data-action-id], .af-game-menu__actions button'),
        ]
        expect([...untranslated(document.body), ...checkLayout(conditions, actions)]).toEqual([])
      })
})
