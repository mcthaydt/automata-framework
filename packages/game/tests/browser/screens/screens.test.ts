import '@mcthaydt/automata-ui/theme.css'
import '#src/screens/screens.css'
import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@mcthaydt/automata-content/locale'
import {
  mountFixture,
  REFERENCE_SIZES,
  type ReferenceSize,
  VARIANTS,
  type Variant,
} from '@mcthaydt/automata-testing'
import { InputMethodTracker } from '@mcthaydt/automata-ui'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import type { TouchButton } from '#src/input/keys.ts'
import PausedScreen from '#src/screens/PausedScreen.svelte'
import PlayScreen from '#src/screens/PlayScreen.svelte'
import type { PausedSaves } from '#src/screens/saves-paused.ts'
import type { TitleSaves } from '#src/screens/saves-title.ts'
import { createPausedSavesView, createSlotsModel } from '#src/screens/saves-view.svelte.ts'
import { DEFAULT_SCREENS_COPY, type ScreensCopy } from '#src/screens/screens-copy.ts'
import TitleScreen from '#src/screens/TitleScreen.svelte'

// The default screens' layout contract (M1.6 spec §7) with production CSS, at every reference size and
// variant: no document scroll, whole 44 px targets (48 px primaries), nothing off screen or under the host's
// strip, and every essential action visible and hit-testable. Each runs in English and in the `xx-long`
// pseudo-locale (PRODUCT spec §4 item 7, DX.2d), where every word is about 40% longer, accented and bracketed, and a
// word that bypassed the screens' copy shows up as untranslated.
const nothing = (): void => {}

/** The languages each screen is laid out in: English, and the pseudo-locale whose words are about 40% longer. */
const LOCALES = ['en', PSEUDO_LOCALE] as const
type Locale = (typeof LOCALES)[number]

/** A word the game or the host supplies (a title, a touch label, a player's name), as it reads in `locale`. */
const say = (locale: Locale, text: string): string => (locale === PSEUDO_LOCALE ? pseudoLocalize(text) : text)

/** `value` with every word, and every word a function makes, in the pseudo-locale. */
function pseudo<T>(value: T): T {
  if (typeof value === 'string') return pseudoLocalize(value) as T
  if (typeof value === 'function')
    return ((...args: unknown[]) => pseudoLocalize((value as (...a: unknown[]) => string)(...args))) as T
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, pseudo(part)])) as T
  return value
}

const copyIn = (locale: Locale): { current: ScreensCopy } => ({
  current: locale === PSEUDO_LOCALE ? pseudo(DEFAULT_SCREENS_COPY) : DEFAULT_SCREENS_COPY,
})

/** Keys and pad buttons are labelled as the device prints them (M4 spec §4.6): the same in every language. */
const PRINTED_ON_DEVICE = '[data-prompt="key"], [data-prompt="pad"]'

/** The page's text that is not in the pseudo-locale: a word some screen shows without going through its copy. */
function untranslated(root: Element): string[] {
  const problems: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    // An icon hidden from assistive technology (the corner Pause's ‖ drawn as II) is a picture, not a word.
    if (!hasRawText(text) || node.parentElement?.closest(`${PRINTED_ON_DEVICE}, [aria-hidden="true"]`))
      continue
    problems.push(`"${text.trim()}" is not in ${PSEUDO_LOCALE}`)
  }
  for (const element of root.querySelectorAll('[aria-label]')) {
    const label = element.getAttribute('aria-label') ?? ''
    if (hasRawText(label)) problems.push(`aria-label "${label}" is not in ${PSEUDO_LOCALE}`)
  }
  return problems
}

const touchButtonsIn = (locale: Locale): TouchButton[] => [
  { id: 'touch-0', label: '←', keys: ['ArrowLeft'] },
  { id: 'touch-1', label: '→', keys: ['ArrowRight'] },
  { id: 'touch-2', label: say(locale, 'Space'), keys: ['Space'] },
]

/** Paused with a board of twelve rows (M5.7): the rows scroll, and Resume and Quit stay reachable. */
const boardIn = (locale: Locale) => ({
  load: () =>
    Promise.resolve({
      state: 'entries' as const,
      entries: Array.from({ length: 12 }, (_, i) => ({
        rank: i + 1,
        displayName: say(locale, `Player ${i + 1}`),
        score: 900 - i * 40,
        isMe: i === 3,
      })),
    }),
})

/** The title of a game with a save (M5.2): six slots, two of them saved, so the list scrolls where it must. */
function titleSaves(locale: Locale): TitleSaves {
  const meta = { version: 1, contentHash: 'abc', snapshot: false } as const
  const model = createSlotsModel()
  model.set([
    { kind: 'ready', slot: 0, meta: { ...meta, savedAt: 1_700_000_000_000, label: say(locale, 'Run 1') } },
    { kind: 'empty', slot: 1 },
    { kind: 'ready', slot: 2, meta: { ...meta, savedAt: 1_700_100_000_000 } },
    { kind: 'empty', slot: 3 },
    { kind: 'empty', slot: 4 },
    { kind: 'empty', slot: 5 },
  ])
  return {
    model,
    formatTime: (savedAt) => say(locale, new Date(savedAt).toUTCString()),
    onLoad: nothing,
    onNew: nothing,
    onDelete: nothing,
  }
}

/**
 * Paused for a game with a save (M5.2): the longest status line over the menu, or, once another device has changed
 * the slot being played, the choice; the line that says a Load newer failed is up in both.
 */
function pausedSaves(changedElsewhere: boolean): PausedSaves {
  const view = createPausedSavesView()
  view.status = 'offline-queued'
  view.changedElsewhere = changedElsewhere
  view.loadFailed = true
  return { view, onLoadNewer: nothing, onKeepPlaying: nothing }
}

type ScreenId =
  | 'title'
  | 'title-saves'
  | 'play'
  | 'paused'
  | 'paused-board'
  | 'paused-saves'
  | 'paused-elsewhere'
  | 'paused-reconnect'

function mountScreen(id: ScreenId, locale: Locale = 'en') {
  const copy = copyIn(locale)
  const title = say(locale, 'A game with a long title')
  if (id === 'title') return mountFixture(TitleScreen, { title, onPlay: nothing, copy })
  if (id === 'title-saves')
    return mountFixture(TitleScreen, { title, onPlay: nothing, saves: titleSaves(locale), copy })
  const pausedProps = {
    onResume: nothing,
    onQuit: nothing,
    onSettings: nothing,
    muted: false,
    onMute: nothing,
    copy,
  }
  if (id === 'paused') return mountFixture(PausedScreen, pausedProps)
  // Play paused because the controller was unplugged (M4-D9): the line that says so must not push the actions out of reach (FR.5).
  if (id === 'paused-reconnect') return mountFixture(PausedScreen, { ...pausedProps, reconnect: true })
  if (id === 'paused-saves' || id === 'paused-elsewhere')
    return mountFixture(PausedScreen, {
      ...pausedProps,
      ...(id === 'paused-saves' ? { board: boardIn(locale) } : {}),
      saves: pausedSaves(id === 'paused-elsewhere'),
    })
  if (id === 'paused-board') return mountFixture(PausedScreen, { ...pausedProps, board: boardIn(locale) })
  const tracker = new InputMethodTracker()
  tracker.note('touch')
  return mountFixture(PlayScreen, {
    onPause: nothing,
    tracker,
    touchButtons: touchButtonsIn(locale),
    onHold: nothing,
    onRelease: nothing,
    copy,
  })
}

const ESSENTIALS = {
  title: ['play'],
  // The slot the list opens on is the newest save: Continue and Delete… are what a player does with it.
  'title-saves': ['save-slots-load', 'save-slots-delete'],
  play: ['pause', 'touch-0', 'touch-1', 'touch-2'],
  paused: ['resume', 'pause-mute', 'quit', 'settings'],
  'paused-reconnect': ['resume', 'pause-mute', 'quit', 'settings'],
  'paused-board': ['resume', 'pause-mute', 'quit', 'settings'],
  'paused-saves': ['resume', 'pause-mute', 'quit', 'settings'],
  'paused-elsewhere': ['load-newer', 'keep-playing'],
} as const

// Chromium scrolls a focused button into view, so the contract above passes with the choice's buttons inside a body
// that scrolls, while WebKit and Firefox leave them clipped at 780 x 270 at TV scale. The structure is what holds in
// every engine: the buttons are the dialog's actions, outside the scroll region.
test('the choice of paused sits in the dialog actions, outside the body that scrolls (M5-D6)', async () => {
  await page.viewport(780, 270)
  const fixture = mountScreen('paused-elsewhere')
  await settleLayout()
  for (const id of ESSENTIALS['paused-elsewhere']) {
    const button = document.querySelector(`[data-testid="${id}"]`)
    expect(button, id).not.toBeNull()
    expect(button?.closest('[data-scroll-region]'), `${id} is inside the scroll region`).toBeNull()
  }
  await fixture.unmount()
})

describe.each([
  'title',
  'title-saves',
  'play',
  'paused',
  'paused-reconnect',
  'paused-board',
  'paused-saves',
  'paused-elsewhere',
] as const)('%s screen layout contract', (screen) => {
  describe.each(LOCALES)('in %s', (locale) => {
    test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size: ReferenceSize) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS as readonly Variant[]) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountScreen(screen, locale)
        await settleLayout()
        // The board loads asynchronously: the contract must see its rows, not the loading line.
        if (screen === 'paused-board')
          expect(document.querySelector('[data-leaderboard]')?.getAttribute('data-state')).toBe('entries')
        // With the keyboard open the frame scrolls what does not fit (ui spec §3.4); nothing may sit under
        // the keyboard, which `checkLayout` checks, but reaching an action may take a scroll.
        const essentials = variant.keyboard === undefined ? ESSENTIALS[screen].map(byTestId) : []
        for (const problem of checkLayout(conditions, essentials))
          problems.push(`${variant.name}: ${problem}`)
        if (locale === PSEUDO_LOCALE)
          for (const problem of untranslated(document.body)) problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect([...new Set(problems)]).toEqual([])
    })
  })
})
