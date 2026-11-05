import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import LeaderboardPanel from '#src/status/LeaderboardPanel.svelte'
import type { LeaderboardCopy, LeaderboardView } from '#src/status/leaderboard-panel.ts'

// LeaderboardPanel (M5 spec §7): loading, entries (the player's row marked), empty, unavailable and offline. Rows are
// read, not chosen, so only the action row takes focus. Offline and unavailable never show a board kept here.

const copy: LeaderboardCopy = {
  title: 'Best runs',
  loading: 'Loading scores…',
  empty: 'No scores yet',
  unavailable: "Scores aren't available here",
  offline: "You're offline",
  you: 'You',
  more: (count) => `+${count} more`,
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(view: LeaderboardView, withActions = true) {
  const target = document.createElement('div')
  document.body.append(target)
  const actions = createRawSnippet(() => ({
    render: () => '<button type="button" data-testid="back">Back</button>',
  }))
  component = mount(LeaderboardPanel, {
    target,
    props: { view, copy, ...(withActions ? { actions } : {}) },
  })
  flushSync()
  const panel = target.querySelector<HTMLElement>('[data-leaderboard]')
  if (panel === null) throw new Error('no panel')
  return panel
}

const entries = [
  { rank: 1, displayName: 'Kite', score: 900, isMe: false },
  { rank: 2, displayName: 'Ash', score: 640, isMe: true },
]

describe('LeaderboardPanel', () => {
  it('shows its state as data-state and its title', () => {
    for (const view of [
      { state: 'loading' },
      { state: 'entries', entries },
      { state: 'empty' },
      { state: 'unavailable' },
      { state: 'offline' },
    ] as const) {
      const panel = open(view)
      expect(panel.dataset.state).toBe(view.state)
      expect(panel.textContent).toContain('Best runs')
      unmount(component!)
      component = undefined
      document.body.innerHTML = ''
    }
  })

  it("lists each entry's rank, name and score, and marks the player's row in words", () => {
    const panel = open({ state: 'entries', entries })
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-entry]')]
    expect(rows.map((row) => row.dataset.rank)).toEqual(['1', '2'])
    expect(rows[0]?.textContent).toContain('Kite')
    expect(rows[0]?.textContent).toContain('900')
    expect(rows[1]?.dataset.me).toBe('')
    expect(rows[1]?.textContent).toContain('You')
    expect(rows[0]?.dataset.me).toBeUndefined()
  })

  it('keeps the entries out of the focus order: only the action row takes focus', () => {
    const panel = open({ state: 'entries', entries })
    const focusable = [...panel.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]')].filter(
      (element) => element.tabIndex >= 0,
    )
    expect(focusable.map((element) => element.dataset.testid)).toEqual(['back'])
  })

  it.each([
    ['loading', 'Loading scores…'],
    ['empty', 'No scores yet'],
    ['unavailable', "Scores aren't available here"],
    ['offline', "You're offline"],
  ] as const)('says %s in words, in a polite live region, with no rows', (state, words) => {
    const panel = open({ state })
    const message = panel.querySelector<HTMLElement>('[data-leaderboard-message]')
    expect(message?.textContent?.trim()).toBe(words)
    expect(message?.getAttribute('role')).toBe('status')
    expect(panel.querySelectorAll('[data-entry]')).toHaveLength(0)
  })

  it('needs no action row', () => {
    const panel = open({ state: 'empty' }, false)
    expect(panel.querySelector('[data-leaderboard-actions]')).toBeNull()
  })
})
