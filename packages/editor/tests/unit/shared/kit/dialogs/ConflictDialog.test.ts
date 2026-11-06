// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConflictDialog from '#src/shared/kit/dialogs/ConflictDialog.svelte'

// The conflict: the level was changed somewhere else since it was opened, so
// nothing was written; Use mine, Use theirs or Keep both.

function mount(props: { open?: boolean; busy?: boolean } = {}) {
  const handlers = { onkeep: vi.fn(), ontake: vi.fn(), oncopy: vi.fn(), oncancel: vi.fn() }
  render(ConflictDialog, {
    open: props.open ?? true,
    name: 'Mossgate',
    busy: props.busy ?? false,
    ...handlers,
  })
  return handlers
}

describe('ConflictDialog', () => {
  it('is closed when there is no conflict', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says the file changed and nothing was overwritten', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Mossgate was changed somewhere else' })
    expect(dialog).toHaveTextContent(/Nothing has been overwritten/)
  })

  it('offers the three choices; Keep both, which loses nothing, is primary and has focus', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Use mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use theirs' })).toHaveAttribute('data-kind', 'danger')
    const copy = screen.getByRole('button', { name: 'Keep both' })
    expect(copy).toHaveAttribute('data-kind', 'primary')
    expect(copy).toHaveFocus()
  })

  it.each([
    ['Use mine', 'onkeep'],
    ['Use theirs', 'ontake'],
    ['Keep both', 'oncopy'],
    ['Cancel', 'oncancel'],
  ] as const)('%s reports once', async (name, handler) => {
    const handlers = mount()
    await userEvent.click(screen.getByRole('button', { name }))
    expect(handlers[handler]).toHaveBeenCalledOnce()
    for (const [other, spy] of Object.entries(handlers))
      if (other !== handler) expect(spy).not.toHaveBeenCalled()
  })

  it('Escape cancels and changes nothing', async () => {
    const handlers = mount()
    await userEvent.keyboard('{Escape}')
    expect(handlers.oncancel).toHaveBeenCalledOnce()
    expect(handlers.onkeep).not.toHaveBeenCalled()
  })

  it('the three choices are disabled while one runs', () => {
    mount({ busy: true })
    for (const name of ['Use mine', 'Use theirs', 'Keep both'])
      expect(screen.getByRole('button', { name })).toBeDisabled()
  })
})
