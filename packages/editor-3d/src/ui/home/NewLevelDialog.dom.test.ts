import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NewLevelDialog from './NewLevelDialog.svelte'

// New level's dialog (ED3D.13b; ED3-q): a name, Create, Cancel. Create with a blank name is disabled;
// Enter creates; the dialog closes when it is created.

function mount() {
  const oncreate = vi.fn()
  const onclose = vi.fn()
  render(NewLevelDialog, { props: { oncreate, onclose } })
  return { oncreate, onclose }
}

describe('NewLevelDialog', () => {
  it('asks for a name, and creates with it', async () => {
    const { oncreate, onclose } = mount()
    expect(screen.getByRole('dialog', { name: 'New level' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Level name' }), 'Boiler Room')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(oncreate).toHaveBeenCalledWith('Boiler Room')
    expect(onclose).toHaveBeenCalled()
  })

  it('creates on Enter', async () => {
    const { oncreate } = mount()
    await userEvent.type(screen.getByRole('textbox', { name: 'Level name' }), 'Annex{Enter}')
    expect(oncreate).toHaveBeenCalledWith('Annex')
  })

  it('keeps Create off until there is a name', async () => {
    const { oncreate } = mount()
    const create = screen.getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Level name' }), '{Enter}')
    expect(oncreate).not.toHaveBeenCalled()
  })

  it('Cancel closes without creating', async () => {
    const { oncreate, onclose } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onclose).toHaveBeenCalled()
    expect(oncreate).not.toHaveBeenCalled()
  })
})
