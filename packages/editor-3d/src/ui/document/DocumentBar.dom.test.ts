import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DocumentBar from './DocumentBar.svelte'

// The level's top bar (plan ED3D.5c): Back, the file over its path, the profile, Undo, Redo and Save.

function mount(props: Record<string, unknown> = {}) {
  const handlers = { onback: vi.fn(), onundo: vi.fn(), onredo: vi.fn(), onsave: vi.fn(), onmode: vi.fn() }
  render(DocumentBar, {
    heading: { title: 'depot.json', file: 'levels/depot.json' },
    profile: 'af-sector',
    canUndo: true,
    canRedo: false,
    undoLabel: 'Set light',
    redoLabel: undefined,
    busy: false,
    compact: false,
    mode: 'plan',
    views: true,
    checks: { text: '2 warnings', tone: 'warn' },
    ...handlers,
    ...props,
  })
  return handlers
}

describe('DocumentBar', () => {
  it('heads the level with its file over its path and its profile, and takes the focus', () => {
    mount()
    const heading = screen.getByRole('heading', { name: 'depot.json' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('levels/depot.json')).toBeInTheDocument()
    expect(screen.getByText('af-sector')).toBeInTheDocument()
  })

  it('leaves the profile out on a phone', () => {
    mount({ compact: true })
    expect(screen.queryByText('af-sector')).toBeNull()
  })

  it('names Undo and Redo with their step and disables the one with nothing to do', async () => {
    const { onundo, onredo } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Undo Set light' }))
    expect(onundo).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(onredo).not.toHaveBeenCalled()
  })

  it('Save and Back act, and wait while a save runs', async () => {
    const { onsave, onback } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onsave).toHaveBeenCalledOnce()
    expect(onback).toHaveBeenCalledOnce()
  })

  it('disables Save and Back while busy', () => {
    mount({ busy: true })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('offers the views with Plan chosen; Split and 3D can be chosen, and Walk says why it cannot yet (ED3D.5d, 5e)', () => {
    mount()
    const views = screen.getByRole('radiogroup', { name: 'View' })
    expect(within(views).getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
    expect(within(views).getByRole('radio', { name: 'Split' })).not.toHaveAttribute('aria-disabled')
    expect(within(views).getByRole('radio', { name: '3D' })).not.toHaveAttribute('aria-disabled')
    const walk = within(views).getByRole('radio', { name: 'Walk' })
    expect(walk).toHaveAttribute('aria-disabled', 'true')
    expect(walk).toHaveAccessibleDescription(/^Not ready yet: /)
  })

  it('shows how the checks stand; below wide the views are left out, and on a phone the pill too (ED3D.5d)', () => {
    mount({ views: false, checks: { text: '1 problem', tone: 'bad' } })
    expect(screen.getByText('1 problem')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'View' })).toBeNull()
  })

  it('leaves the pill to the status line on a phone (ED3D.5d)', () => {
    mount({ compact: true, views: false })
    expect(screen.queryByTestId('checks-pill')).toBeNull()
  })

  it('opens the layers drawer from a Layers button below wide, and has none at wide (ED3D.5d)', async () => {
    const onlayers = vi.fn()
    mount({ layersOpen: false, onlayers })
    const layers = screen.getByRole('button', { name: 'Layers' })
    expect(layers).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(layers)
    expect(onlayers).toHaveBeenCalledOnce()
  })

  it('has no Layers button when the panel is always in view (ED3D.5d)', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull()
  })
})
