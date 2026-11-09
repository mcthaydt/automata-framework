// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SyncConflictDialog from '#src/features/suite/shell/SyncConflictDialog.svelte'
import { conflictWords } from '#src/features/suite/shell/sync-conflict-words.ts'
import type { MergeAsk } from '#src/shared/kit/sync/git-engine.ts'

// A file changed here and on GitHub: the dialog says which, in words, and offers Keep mine, Keep GitHub's and Keep both.

const FEEL: MergeAsk = {
  path: 'content/feel/feel.toml',
  reason: 'both-changed',
  where: 'flash.intensity',
  keepBothPath: 'content/feel/feel-github.toml',
}

function mount(conflicts: readonly MergeAsk[] = [FEEL], extra: { busy?: boolean; failed?: boolean } = {}) {
  const handlers = { onchoose: vi.fn(), onlater: vi.fn() }
  render(SyncConflictDialog, {
    conflicts,
    busy: extra.busy ?? false,
    failed: extra.failed ?? false,
    ...handlers,
  })
  return handlers
}

describe('conflictWords', () => {
  it('both changed: three choices, Keep both (which loses nothing) the one to press', () => {
    const words = conflictWords(FEEL)
    expect(words.title).toBe('Feel changed here and on GitHub')
    expect(words.why).toBe('You and GitHub both changed Feel. They disagree about flash.intensity.')
    expect(words.options.map((o) => o.choice)).toEqual(['theirs', 'mine', 'both'])
    expect(words.primary).toBe('both')
    expect(words.options.find((o) => o.choice === 'both')?.detail).toBe(
      'Keep mine, and save GitHub’s next to it as feel-github.toml.',
    )
  })

  it('deleted here, changed on GitHub: two choices, the one that keeps the file is primary', () => {
    const words = conflictWords({ path: 'content/a.toml', reason: 'deleted-here' })
    expect(words.title).toBe('A was deleted here, but changed on GitHub')
    expect(words.options.map((o) => o.choice)).toEqual(['mine', 'theirs'])
    expect(words.primary).toBe('theirs')
  })

  it('deleted on GitHub, changed here', () => {
    const words = conflictWords({ path: 'content/a.toml', reason: 'deleted-there' })
    expect(words.title).toBe('A was deleted on GitHub, but changed here')
    expect(words.primary).toBe('mine')
  })
})

describe('SyncConflictDialog', () => {
  it('is closed when nothing waits', () => {
    mount([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the file and says what each choice does', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Feel changed here and on GitHub' })
    expect(dialog).toHaveTextContent('Nothing has been lost')
    expect(dialog).toHaveTextContent('GitHub gets what is on this device.')
    expect(dialog).toHaveTextContent('Your change here is dropped.')
  })

  it('puts the focus on the choice that loses nothing', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Keep both' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Keep GitHub’s' })).toHaveAttribute('data-kind', 'danger')
  })

  it.each([
    ['Keep mine', 'mine'],
    ['Keep GitHub’s', 'theirs'],
    ['Keep both', 'both'],
  ] as const)('%s reports the file and the choice once', async (name, choice) => {
    const handlers = mount()
    await userEvent.click(screen.getByRole('button', { name }))
    expect(handlers.onchoose).toHaveBeenCalledExactlyOnceWith(FEEL.path, choice)
    expect(handlers.onlater).not.toHaveBeenCalled()
  })

  it('Not now and Escape leave everything as it is', async () => {
    const handlers = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(handlers.onlater).toHaveBeenCalledOnce()
    expect(handlers.onchoose).not.toHaveBeenCalled()
  })

  it('says how many files wait, and asks about the first', () => {
    mount([FEEL, { path: 'content/audio/audio.toml', reason: 'both-changed' }])
    expect(screen.getByText('1 of 2 files')).toBeInTheDocument()
  })

  it('disables the choices while one is being carried out', () => {
    mount([FEEL], { busy: true })
    for (const name of ['Keep mine', 'Keep GitHub’s', 'Keep both'])
      expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('says when it could not reach GitHub, and that nothing changed', () => {
    mount([FEEL], { failed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t reach GitHub. Nothing changed. Try again.')
  })
})
