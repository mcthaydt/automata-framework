import '@mcthaydt/automata-ui/theme.css'
import './screens.css'
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
import type { TouchButton } from '../input/keys.ts'
import PausedScreen from './PausedScreen.svelte'
import PlayScreen from './PlayScreen.svelte'
import { CHANGED_ELSEWHERE_COPY, SAVE_SLOTS_COPY, SAVE_STATUS_COPY } from './saves-copy.ts'
import type { PausedSaves } from './saves-paused.ts'
import type { TitleSaves } from './saves-title.ts'
import { createPausedSavesView, createSlotsModel } from './saves-view.svelte.ts'
import TitleScreen from './TitleScreen.svelte'

// The default screens' layout contract (M1.6 spec §7) with production CSS, at every reference size and
// variant: no document scroll, whole 44 px targets (48 px primaries), nothing off screen or under the host's
// strip, and every essential action visible and hit-testable.
const nothing = (): void => {}
const touchButtons: TouchButton[] = [
  { id: 'touch-0', label: '←', keys: ['ArrowLeft'] },
  { id: 'touch-1', label: '→', keys: ['ArrowRight'] },
  { id: 'touch-2', label: 'Space', keys: ['Space'] },
]

/** Paused with a board of twelve rows (M5.7): the rows scroll, and Resume and Quit stay reachable. */
const board = {
  copy: {
    title: 'Scores',
    loading: 'Loading scores…',
    empty: 'No scores yet',
    unavailable: "Scores aren't available here",
    offline: "You're offline",
    you: 'You',
    more: (count: number) => `+${count} more`,
  },
  load: () =>
    Promise.resolve({
      state: 'entries' as const,
      entries: Array.from({ length: 12 }, (_, i) => ({
        rank: i + 1,
        displayName: `Player ${i + 1}`,
        score: 900 - i * 40,
        isMe: i === 3,
      })),
    }),
}

/** The title of a game with a save (M5.2): six slots, two of them saved, so the list scrolls where it must. */
function titleSaves(): TitleSaves {
  const meta = { version: 1, contentHash: 'abc', snapshot: false } as const
  const model = createSlotsModel()
  model.set([
    { kind: 'ready', slot: 0, meta: { ...meta, savedAt: 1_700_000_000_000, label: 'Run 1' } },
    { kind: 'empty', slot: 1 },
    { kind: 'ready', slot: 2, meta: { ...meta, savedAt: 1_700_100_000_000 } },
    { kind: 'empty', slot: 3 },
    { kind: 'empty', slot: 4 },
    { kind: 'empty', slot: 5 },
  ])
  return {
    model,
    copy: SAVE_SLOTS_COPY,
    formatTime: (savedAt) => new Date(savedAt).toUTCString(),
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
  return {
    view,
    statusCopy: SAVE_STATUS_COPY,
    choiceCopy: CHANGED_ELSEWHERE_COPY,
    onLoadNewer: nothing,
    onKeepPlaying: nothing,
  }
}

type ScreenId =
  | 'title'
  | 'title-saves'
  | 'play'
  | 'paused'
  | 'paused-board'
  | 'paused-saves'
  | 'paused-elsewhere'

function mountScreen(id: ScreenId) {
  if (id === 'title') return mountFixture(TitleScreen, { title: 'A game with a long title', onPlay: nothing })
  if (id === 'title-saves')
    return mountFixture(TitleScreen, {
      title: 'A game with a long title',
      onPlay: nothing,
      saves: titleSaves(),
    })
  if (id === 'paused')
    return mountFixture(PausedScreen, {
      onResume: nothing,
      onQuit: nothing,
      onSettings: nothing,
      muted: false,
      onMute: nothing,
    })
  if (id === 'paused-saves' || id === 'paused-elsewhere')
    return mountFixture(PausedScreen, {
      onResume: nothing,
      onQuit: nothing,
      onSettings: nothing,
      muted: false,
      onMute: nothing,
      ...(id === 'paused-saves' ? { board } : {}),
      saves: pausedSaves(id === 'paused-elsewhere'),
    })
  if (id === 'paused-board')
    return mountFixture(PausedScreen, {
      onResume: nothing,
      onQuit: nothing,
      onSettings: nothing,
      muted: false,
      onMute: nothing,
      board,
    })
  const tracker = new InputMethodTracker()
  tracker.note('touch')
  return mountFixture(PlayScreen, {
    onPause: nothing,
    tracker,
    touchButtons,
    onHold: nothing,
    onRelease: nothing,
  })
}

const ESSENTIALS = {
  title: ['play'],
  // The slot the list opens on is the newest save: Continue and Delete… are what a player does with it.
  'title-saves': ['save-slots-load', 'save-slots-delete'],
  play: ['pause', 'touch-0', 'touch-1', 'touch-2'],
  paused: ['resume', 'pause-mute', 'quit', 'settings'],
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
  'paused-board',
  'paused-saves',
  'paused-elsewhere',
] as const)('%s screen layout contract', (screen) => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size: ReferenceSize) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS as readonly Variant[]) {
      const conditions = publishConditions(document.documentElement, size, variant)
      const fixture = mountScreen(screen)
      await settleLayout()
      // The board loads asynchronously: the contract must see its rows, not the loading line.
      if (screen === 'paused-board')
        expect(document.querySelector('[data-leaderboard]')?.getAttribute('data-state')).toBe('entries')
      // With the keyboard open the frame scrolls what does not fit (ui spec §3.4); nothing may sit under
      // the keyboard, which `checkLayout` checks, but reaching an action may take a scroll.
      const essentials = variant.keyboard === undefined ? ESSENTIALS[screen].map(byTestId) : []
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
      await fixture.unmount()
    }
    expect(problems).toEqual([])
  })
})
