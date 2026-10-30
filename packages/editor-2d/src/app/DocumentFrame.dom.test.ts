import {
  createToasts,
  type LifecycleDocument,
  type LifecycleWindow,
} from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { counterIds } from '../model/ids'
import { createProfileRegistry } from '../profiles/profile'
import { memoryWorkspace, textOf } from '../testing/memory-workspace'
import { noteText, plantedProfile } from '../testing/planted-profile'
import { createTestClock } from '../testing/test-clock'
import DocumentFrame from './DocumentFrame.svelte'
import { createDocumentController } from './document/document-controller'
import { createEditorApp } from './editor-app'

// Where an opened document goes until the Level view fills its canvas (plans ED2D.4c2a decision 10, ED2D.4c2b decisions
// 5 to 8): the top bar with Back, Undo, Redo and Save, the save state, the Restore and conflict dialogs and the toasts.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(options: { persistent?: boolean; autosave?: boolean; size?: [number, number] } = {}) {
  const clock = createTestClock()
  const workspace = { ...memoryWorkspace(clock), persistent: options.persistent ?? true }
  const registry = createProfileRegistry()
  registry.register(plantedProfile())
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  await workspace.store.write('notes/a.note', noteText('hello'))
  clock.advance(1000)
  if (options.autosave) {
    const first = await app.open('notes/a.note')
    if (first.status !== 'opened') throw new Error(first.status)
    first.document.history.apply('Edit', () => ({ text: 'kept' }))
    clock.advance(1000)
    await first.document.session.flush()
    first.document.dispose()
  }
  const opened = await app.open('notes/a.note')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  const onback = vi.fn()
  render(DocumentFrame, {
    geometry: stubGeometry(...(options.size ?? [1194, 834])),
    controller,
    toasts,
    clock,
    onback,
  })
  return { opened, controller, toasts, workspace, onback }
}

const status = (): HTMLElement => document.querySelector('[data-widget="status-line"]') as HTMLElement

describe('DocumentFrame', () => {
  it('heads the page with the document, which takes focus, and its profile', async () => {
    await mount()
    expect(screen.getByRole('heading', { level: 1, name: 'a.note' })).toHaveFocus()
    expect(screen.getByText('notes/a.note')).toBeInTheDocument()
    expect(screen.getByText('Planted note')).toBeInTheDocument()
  })

  it('leaves the profile out of the top bar on a phone', async () => {
    await mount({ size: [390, 844] })
    expect(screen.queryByText('Planted note')).toBeNull()
  })

  it('says the editing views are not here yet', async () => {
    await mount()
    expect(screen.getByText(/arrive with ED2D\.4c4/)).toBeInTheDocument()
  })

  it('Back reports to its owner', async () => {
    const { onback } = await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onback).toHaveBeenCalledOnce()
  })

  it('follows the save state, and Undo and Redo follow the history', async () => {
    const { opened } = await mount()
    expect(status()).toHaveTextContent('Saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    opened.document.history.apply('Type', () => ({ text: 'x' }))
    flushSync()
    expect(status()).toHaveTextContent('Unsaved changes')
    await userEvent.click(screen.getByRole('button', { name: 'Undo Type' }))
    expect(opened.document.history.state).toEqual({ text: 'hello' })
    await userEvent.click(screen.getByRole('button', { name: 'Redo Type' }))
    expect(opened.document.history.state).toEqual({ text: 'x' })
  })

  it('Save writes the file', async () => {
    const { opened, workspace } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'saved' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(status()).toHaveTextContent('Saved'))
    expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('saved', 1))
  })

  it('a conflict opens the dialog, and Keep mine writes over the file', async () => {
    const { opened, workspace } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'mine' }))
    await workspace.store.write('notes/a.note', noteText('theirs'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('dialog', { name: 'a.note changed since you opened it' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('mine', 1))
  })

  it('Take theirs shows the reloaded document', async () => {
    const { opened, workspace } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'mine' }))
    await workspace.store.write('notes/a.note', noteText('theirs'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Take theirs' }))
    expect(await screen.findByText('Reloaded a.note from the file.')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('asks Restore or Discard first when an autosave is on offer, and Restore applies it', async () => {
    const { controller } = await mount({ autosave: true })
    expect(screen.getByRole('dialog', { name: 'Restore your unsaved work?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore edits' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    let text: unknown
    controller.state.subscribe((state) => {
      text = state.document.history.state
    })()
    expect(text).toEqual({ text: 'kept' })
    expect(status()).toHaveTextContent('Unsaved changes')
    expect(screen.getByRole('button', { name: 'Undo Restore autosave' })).toBeEnabled()
  })

  it('Discard keeps the file as it was', async () => {
    await mount({ autosave: true })
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(status()).toHaveTextContent('Saved')
  })

  it('shows the toasts', async () => {
    const { toasts } = await mount()
    toasts.push({ kind: 'error', message: 'Could not save.' })
    expect(await screen.findByText('Could not save.')).toBeInTheDocument()
  })

  it('says so when this device keeps nothing', async () => {
    await mount({ persistent: false })
    expect(status()).toHaveTextContent('Not saved on this device')
  })
})
