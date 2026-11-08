// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RecoveryDialog from '#src/shared/kit/dialogs/RecoveryDialog.svelte'
import type { Recovery } from '#src/shared/kit/storage/recovery.ts'

// Restore or Discard: asked before the document
// is worked on, and not dismissible, because either answer changes what is open.

const now = 1_700_000_000_000
const recovery: Recovery = { payload: 'x', savedAt: now - 2 * 60_000, baseChanged: false }

function mount(props: { recovery?: Recovery | undefined; busy?: boolean } = {}) {
  const onrestore = vi.fn()
  const ondiscard = vi.fn()
  render(RecoveryDialog, {
    path: 'levels/mossgate.af2d.json',
    recovery: 'recovery' in props ? props.recovery : recovery,
    now,
    busy: props.busy ?? false,
    onrestore,
    ondiscard,
  })
  return { onrestore, ondiscard }
}

describe('RecoveryDialog', () => {
  it('shows nothing with no autosave on offer', () => {
    mount({ recovery: undefined })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks, and tells which file, when the autosave was made and that the file is unchanged', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Restore your unsaved work?' })
    expect(dialog).toHaveTextContent('mossgate.af2d.json')
    expect(dialog).toHaveTextContent('2 min ago')
    expect(dialog).toHaveTextContent('Unchanged since the autosave began')
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })

  it('warns when the file changed too, since restoring replaces that change', () => {
    mount({ recovery: { ...recovery, baseChanged: true } })
    expect(screen.getByRole('alert')).toHaveTextContent(/replaces that change/)
  })

  it('Restore edits is the primary action and has focus', () => {
    mount()
    const restore = screen.getByRole('button', { name: 'Restore edits' })
    expect(restore).toHaveFocus()
    expect(restore).toHaveAttribute('data-kind', 'primary')
  })

  it('Restore edits and Discard each report once', async () => {
    const { onrestore, ondiscard } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Restore edits' }))
    expect(onrestore).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(ondiscard).toHaveBeenCalledOnce()
  })

  it('Escape does not close it: an answer is needed', async () => {
    const { onrestore, ondiscard } = mount()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onrestore).not.toHaveBeenCalled()
    expect(ondiscard).not.toHaveBeenCalled()
  })

  it('is disabled while busy', () => {
    mount({ busy: true })
    expect(screen.getByRole('button', { name: 'Restore edits' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
  })
})
