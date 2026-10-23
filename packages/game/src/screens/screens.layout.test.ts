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

function mountScreen(id: 'title' | 'play' | 'paused' | 'paused-board') {
  if (id === 'title') return mountFixture(TitleScreen, { title: 'A game with a long title', onPlay: nothing })
  if (id === 'paused')
    return mountFixture(PausedScreen, {
      onResume: nothing,
      onQuit: nothing,
      onSettings: nothing,
      muted: false,
      onMute: nothing,
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
  play: ['pause', 'touch-0', 'touch-1', 'touch-2'],
  paused: ['resume', 'pause-mute', 'quit', 'settings'],
  'paused-board': ['resume', 'pause-mute', 'quit', 'settings'],
} as const

describe.each(['title', 'play', 'paused', 'paused-board'] as const)('%s screen layout contract', (screen) => {
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
