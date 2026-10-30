import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import HeldSaveDialog from './HeldSaveDialog.svelte'

// The held Save (plan ED3D.5c, decision 6; ED3-o): the path the codec cannot keep and its reason, Save reformatted,
// Export a copy and Cancel.

const refused = {
  status: 'refused',
  path: ['sectors', 2, 'floor'],
  reason: 'unwritable-value',
  detail: '1e+21 has an exponent',
} as const

function mount(props: { open?: boolean; busy?: boolean } = {}) {
  const handlers = { onreformat: vi.fn(), onexport: vi.fn(), oncancel: vi.fn() }
  render(HeldSaveDialog, {
    open: props.open ?? true,
    path: 'levels/depot.json',
    refused,
    busy: props.busy ?? false,
    ...handlers,
  })
  return handlers
}

describe('HeldSaveDialog', () => {
  it('is closed until asked', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the file, the JSON path and the codec’s reason, and says nothing was written', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'depot.json can’t be saved as it is written' })
    expect(dialog).toHaveTextContent('sectors.2.floor')
    expect(dialog).toHaveTextContent('1e+21 has an exponent')
    expect(dialog).toHaveTextContent('Nothing was written.')
  })

  it('Save reformatted, primary and with the focus, closes it and runs once', async () => {
    const { onreformat, onexport, oncancel } = mount()
    const reformat = screen.getByRole('button', { name: 'Save reformatted' })
    expect(reformat).toHaveFocus()
    expect(reformat).toHaveAttribute('data-kind', 'primary')
    await userEvent.click(reformat)
    expect(onreformat).toHaveBeenCalledOnce()
    expect(onexport).not.toHaveBeenCalled()
    expect(oncancel).not.toHaveBeenCalled()
  })

  it('Export a copy closes it and runs once', async () => {
    const { onreformat, onexport, oncancel } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Export a copy' }))
    expect(onexport).toHaveBeenCalledOnce()
    expect(onreformat).not.toHaveBeenCalled()
    expect(oncancel).not.toHaveBeenCalled()
  })

  it('Cancel and Escape leave the edits as they are', async () => {
    const { oncancel } = mount()
    await userEvent.keyboard('{Escape}')
    expect(oncancel).toHaveBeenCalledOnce()
  })

  it('disables the two ways on while one runs', () => {
    mount({ busy: true })
    expect(screen.getByRole('button', { name: 'Save reformatted' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export a copy' })).toBeDisabled()
  })
})
