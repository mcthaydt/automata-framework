// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DocumentBar from '#src/features/document/DocumentBar.svelte'
import type { SaveState } from '#src/shared/kit/storage/save-state.ts'

// The document's top bar, essentials only: Back, the level's name, Undo and Redo as icon buttons, and Save, the one
// primary action, which says where the level stands ("Save", "Saving…", "Saved").

interface Props {
  canUndo?: boolean
  canRedo?: boolean
  undoLabel?: string | undefined
  redoLabel?: string | undefined
  busy?: boolean
  save?: SaveState
}

function mount(props: Props = {}) {
  const handlers = { onback: vi.fn(), onundo: vi.fn(), onredo: vi.fn(), onsave: vi.fn() }
  render(DocumentBar, {
    heading: { title: 'Mossgate', file: 'levels/mossgate.af2d.json' },
    canUndo: props.canUndo ?? false,
    canRedo: props.canRedo ?? false,
    undoLabel: props.undoLabel,
    redoLabel: props.redoLabel,
    busy: props.busy ?? false,
    save: props.save ?? 'dirty',
    ...handlers,
  })
  return handlers
}

describe('DocumentBar', () => {
  it('heads the page with the level’s name, which takes focus; no file path or format on the bar', () => {
    mount()
    const heading = screen.getByRole('heading', { level: 1, name: 'Mossgate' })
    expect(heading).toHaveFocus()
    expect(screen.queryByText('levels/mossgate.af2d.json')).toBeNull()
    expect(screen.queryByText('Level project')).toBeNull()
    expect(screen.getByTestId('document-bar')).toHaveAttribute('data-path', 'levels/mossgate.af2d.json')
  })

  it('Save is the one primary button and says where the level stands', () => {
    mount({ save: 'dirty' })
    const save = screen.getByTestId('save')
    expect(save).toHaveAttribute('data-kind', 'primary')
    expect(save).toHaveTextContent('Save')
    cleanup()
    mount({ save: 'saving' })
    expect(screen.getByTestId('save')).toHaveTextContent('Saving…')
    cleanup()
    mount({ save: 'saved' })
    expect(screen.getByTestId('save')).toHaveTextContent('Saved')
    expect(document.querySelectorAll('[data-kind="primary"]')).toHaveLength(1)
  })

  it('Back, Undo and Redo are icon buttons, as the approved mockup draws them', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Back' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Redo' }).querySelector('svg')).not.toBeNull()
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

  it('Save and Back are disabled while a save or a conflict choice runs', () => {
    mount({ busy: true })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })
})
