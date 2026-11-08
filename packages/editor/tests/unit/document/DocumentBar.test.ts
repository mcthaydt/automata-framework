// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DocumentBar from '#src/features/document/DocumentBar.svelte'

// The document's top bar: Back, the title over the path, the
// profile, then Undo, Redo and Save.

interface Props {
  canUndo?: boolean
  canRedo?: boolean
  undoLabel?: string | undefined
  redoLabel?: string | undefined
  busy?: boolean
  compact?: boolean
}

function mount(props: Props = {}) {
  const handlers = { onback: vi.fn(), onundo: vi.fn(), onredo: vi.fn(), onsave: vi.fn() }
  render(DocumentBar, {
    heading: { title: 'Mossgate', file: 'levels/mossgate.af2d.json' },
    profileLabel: 'Level project',
    canUndo: props.canUndo ?? false,
    canRedo: props.canRedo ?? false,
    undoLabel: props.undoLabel,
    redoLabel: props.redoLabel,
    busy: props.busy ?? false,
    compact: props.compact ?? false,
    ...handlers,
  })
  return handlers
}

describe('DocumentBar', () => {
  it('heads the page with the document’s title, its path and its profile, and takes focus', () => {
    mount()
    const heading = screen.getByRole('heading', { level: 1, name: 'Mossgate' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('levels/mossgate.af2d.json')).toBeInTheDocument()
    expect(screen.getByText('Level project')).toBeInTheDocument()
  })

  it('Undo and Redo are disabled with nothing to do', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('names Undo and Redo with the step they act on', async () => {
    const handlers = mount({ canUndo: true, canRedo: true, undoLabel: 'Paint', redoLabel: 'Erase' })
    await userEvent.click(screen.getByRole('button', { name: 'Undo Paint' }))
    await userEvent.click(screen.getByRole('button', { name: 'Redo Erase' }))
    expect(handlers.onundo).toHaveBeenCalledOnce()
    expect(handlers.onredo).toHaveBeenCalledOnce()
  })

  it('Back and Save report', async () => {
    const handlers = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handlers.onback).toHaveBeenCalledOnce()
    expect(handlers.onsave).toHaveBeenCalledOnce()
  })

  it('leaves the profile out on a phone, where the title needs the room', () => {
    mount({ compact: true })
    expect(screen.queryByText('Level project')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Mossgate' })).toBeInTheDocument()
  })

  it('Save and Back are disabled while a save or a conflict choice runs', () => {
    mount({ busy: true })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })
})
