// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RecoveryDialog from '#src/shared/kit/dialogs/RecoveryDialog.svelte'
import type { Recovery } from '#src/shared/kit/storage/recovery.ts'

// Keep my changes or Throw away: asked before the document is worked on, and not dismissible, because either answer
// changes what is open.

const now = 1_700_000_000_000
const recovery: Recovery = { payload: 'x', savedAt: now - 2 * 60_000, baseChanged: false }

function mount(props: { recovery?: Recovery | undefined; busy?: boolean } = {}) {
  const onrestore = vi.fn()
  const ondiscard = vi.fn()
  render(RecoveryDialog, {
    name: 'Mossgate',
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

  it('asks in plain words, naming the level and when it was changed', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Keep your changes from last time?' })
    expect(dialog).toHaveTextContent(
      'You changed Mossgate 2 min ago and didn’t save. Your changes were kept.',
    )
    expect(dialog).not.toHaveTextContent(/autosave|on disk|\.json/)
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })

  it('warns when the file changed too, since restoring replaces that change', () => {
    mount({ recovery: { ...recovery, baseChanged: true } })
    expect(screen.getByRole('alert')).toHaveTextContent(/replaces that/)
  })

  it('Keep my changes is the primary action and has focus', () => {
    mount()
    const restore = screen.getByRole('button', { name: 'Keep my changes' })
    expect(restore).toHaveFocus()
    expect(restore).toHaveAttribute('data-kind', 'primary')
  })

  it('Keep my changes and Throw away each report once', async () => {
    const { onrestore, ondiscard } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Keep my changes' }))
    expect(onrestore).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Throw away' }))
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
    expect(screen.getByRole('button', { name: 'Keep my changes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Throw away' })).toBeDisabled()
  })
})
