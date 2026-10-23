import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DeleteDialog from './DeleteDialog.svelte'

function mount(props: { open?: boolean } = {}) {
  const onconfirm = vi.fn()
  render(DeleteDialog, { open: true, name: 'mossgate.af2d.json', onconfirm, ...props })
  return { onconfirm }
}

describe('DeleteDialog', () => {
  it('draws nothing while closed', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the file and says what goes with it', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Delete mossgate.af2d.json?' })
    expect(dialog).toHaveTextContent('The file and its autosave')
    expect(dialog).toHaveTextContent('can’t be undone')
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
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-kind', 'danger')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-kind', 'plain')
  })

  it('Delete is named for what it does, confirms once and closes', async () => {
    const { onconfirm } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onconfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
