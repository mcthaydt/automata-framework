// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConflictDialog from '#src/shared/kit/dialogs/ConflictDialog.svelte'

// The conflict: the file changed since it was opened, so
// nothing was written; Keep mine, Take theirs or Save as copy.

function mount(props: { open?: boolean; busy?: boolean } = {}) {
  const handlers = { onkeep: vi.fn(), ontake: vi.fn(), oncopy: vi.fn(), oncancel: vi.fn() }
  render(ConflictDialog, {
    open: props.open ?? true,
    path: 'a/mossgate.af2d.json',
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
    const dialog = screen.getByRole('dialog', { name: 'mossgate.af2d.json changed since you opened it' })
    expect(dialog).toHaveTextContent(/Nothing was overwritten/)
  })

  it('offers the three choices; Save as copy, which loses nothing, is primary and has focus', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take theirs' })).toHaveAttribute('data-kind', 'danger')
    const copy = screen.getByRole('button', { name: 'Save as copy' })
    expect(copy).toHaveAttribute('data-kind', 'primary')
    expect(copy).toHaveFocus()
  })

  it.each([
    ['Keep mine', 'onkeep'],
    ['Take theirs', 'ontake'],
    ['Save as copy', 'oncopy'],
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
    for (const name of ['Keep mine', 'Take theirs', 'Save as copy'])
      expect(screen.getByRole('button', { name })).toBeDisabled()
  })
})
