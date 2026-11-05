import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import SaveStatus from '#src/shared/ui/status/SaveStatus.svelte'
import type { SaveStatusCopy, SaveStatusState } from '#src/shared/ui/status/save-status.ts'

// SaveStatus (M5 spec §7): the host's save state in words, in a polite live region that is not focusable. It is
// hidden where the standalone session has nothing to sync (no `status`), and says "no grant" when the game was
// not given the saves grant, so a player is never told progress is kept when it is not.

const copy: SaveStatusCopy = {
  checking: 'Checking your progress…',
  syncing: 'Saving…',
  saved: 'Progress saved',
  'offline-queued': 'Offline: your progress will be saved when you are back online',
  retry: 'Could not save yet; trying again',
  conflict: 'Choose which progress to keep',
  recovered: 'Progress restored',
  'no-grant': "Progress won't be kept",
}

const STATES = Object.keys(copy) as SaveStatusState[]

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(status: SaveStatusState | undefined) {
  const props = $state<{ status: SaveStatusState | undefined; copy: SaveStatusCopy }>({ status, copy })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(SaveStatus, { target: host, props })
  flushSync()
  return {
    props,
    host,
    line: () => host.querySelector<HTMLElement>('[data-save-status]'),
    words: () => host.querySelector<HTMLElement>('[data-save-status-text]')?.textContent?.trim(),
  }
}

describe('SaveStatus', () => {
  it.each(STATES)('says %s in the caller’s words, with its state as data-state', (state) => {
    const { line, words } = open(state)
    expect(line()?.dataset.state).toBe(state)
    expect(words()).toBe(copy[state])
  })

  it('is a polite live region, so a change in the host’s state is announced', () => {
    const { line } = open('saved')
    expect(line()?.getAttribute('role')).toBe('status')
    expect(line()?.getAttribute('aria-live')).toBe('polite')
  })

  it('keeps the same element when the state changes, so the change is announced and not a new region', () => {
    const { props, line, words } = open('syncing')
    const before = line()
    props.status = 'saved'
    flushSync()
    expect(line()).toBe(before)
    expect(words()).toBe('Progress saved')
    expect(line()?.dataset.state).toBe('saved')
  })

  it('renders nothing at all where there is no status (standalone)', () => {
    const { host, line } = open(undefined)
    expect(line()).toBeNull()
    expect(host.textContent?.trim()).toBe('')
  })

  it('appears when a status arrives and goes when it is withdrawn', () => {
    const { props, line, words } = open(undefined)
    props.status = 'offline-queued'
    flushSync()
    expect(words()).toBe(copy['offline-queued'])
    props.status = undefined
    flushSync()
    expect(line()).toBeNull()
  })

  it('is not focusable and holds nothing to press', () => {
    const { line } = open('conflict')
    expect(line()?.querySelector('button, a[href], input, [tabindex]')).toBeNull()
    expect(line()?.hasAttribute('tabindex')).toBe(false)
  })

  // Tone is never colour alone: a state that needs the player’s notice or good news carries a glyph a sighted player
  // sees (hidden from assistive technology, which has the words) beside the words themselves.
  it.each([
    ['saved', 'success'],
    ['recovered', 'success'],
    ['offline-queued', 'warning'],
    ['retry', 'warning'],
    ['conflict', 'warning'],
    ['no-grant', 'warning'],
  ] as const)('%s is a %s state: a hidden glyph and its words', (state, tone) => {
    const { line } = open(state)
    expect(line()?.dataset.tone).toBe(tone)
    const glyph = line()?.querySelector('[data-save-status-glyph]')
    expect(glyph?.textContent?.length).toBeGreaterThan(0)
    expect(glyph?.getAttribute('aria-hidden')).toBe('true')
    expect(line()?.textContent).toContain(copy[state])
  })

  it.each(['checking', 'syncing'] as const)('%s is plain information, with no glyph', (state) => {
    const { line } = open(state)
    expect(line()?.dataset.tone).toBe('info')
    expect(line()?.querySelector('[data-save-status-glyph]')).toBeNull()
  })
})
