// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DeleteDialog from '#src/features/home/DeleteDialog.svelte'

function mount(props: { open?: boolean } = {}) {
  const onconfirm = vi.fn()
  render(DeleteDialog, { open: true, name: 'Mossgate', onconfirm, ...props })
  return { onconfirm }
}

describe('DeleteDialog', () => {
  it('draws nothing while closed', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the level by its name, not its file, and says it cannot come back', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Delete Mossgate?' })
    expect(dialog).toHaveTextContent('This level is deleted for good. You can’t undo this.')
    expect(dialog).not.toHaveTextContent(/workspace|\.json|autosave/)
  })

  it('puts focus on Cancel first, so a stray Enter keeps the file', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('Cancel closes without deleting', async () => {
    const { onconfirm } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onconfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape cancels', async () => {
    const { onconfirm } = mount()
    await userEvent.keyboard('{Escape}')
    expect(onconfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks Delete as the destructive action', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Delete level' })).toHaveAttribute('data-kind', 'danger')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-kind', 'plain')
  })

  it('Delete is named for what it does, confirms once and closes', async () => {
    const { onconfirm } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Delete level' }))
    expect(onconfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
