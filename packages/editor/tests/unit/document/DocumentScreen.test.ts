// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { componentOf } from '#src/app/editor-2d/views.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// An open document (plan ED2D.4c4a decision 1; the cases of the frame it replaced, plans ED2D.4c2a decision 10 and
// ED2D.4c2b decisions 5 to 8): the top bar with Back, Undo, Redo and Save, the save state, the Restore and conflict
// dialogs and the toasts, around the view the rail chose. The planted note lists one view that is not built; the level
// project lists six, of which Level is.

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
  render(DocumentScreen, {
    geometry: stubGeometry(...(options.size ?? [1194, 834])),
    controller,
    viewOf: componentOf,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback,
  })
  return { opened, controller, toasts, workspace, onback }
}

const status = (): HTMLElement => document.querySelector('[data-widget="status-line"]') as HTMLElement

describe('DocumentScreen', () => {
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

  it('shows a view that is not built yet in plain words, saying the project is safe', async () => {
    await mount()
    expect(screen.getByRole('tab', { name: 'Note' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Note is coming in a later update' })).toBeInTheDocument()
    expect(screen.getByText(/Your project is safe/)).toBeInTheDocument()
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

  it('announces an undo and a redo in a polite live region, by the step they act on (ED2D.8)', async () => {
    const { opened } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'x' }))
    flushSync()
    const heard = (): string => screen.getByTestId('history-announcement').textContent ?? ''
    expect(screen.getByTestId('history-announcement')).toHaveAttribute('aria-live', 'polite')
    expect(heard()).toBe('')
    await userEvent.click(screen.getByRole('button', { name: 'Undo Type' }))
    expect(heard()).toBe('Undid Type')
    await userEvent.click(screen.getByRole('button', { name: 'Redo Type' }))
    expect(heard()).toBe('Redid Type')
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

  it('the Restore dialog keeps the focus the heading would take, so a keyboard starts on the question', async () => {
    await mount({ autosave: true })
    expect(screen.getByRole('button', { name: 'Restore edits' })).toHaveFocus()
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

async function mountLevel(size: [number, number] = [1194, 834]) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(...size),
    controller,
    viewOf: componentOf,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  return { opened }
}

/** The rail's tabs; the Level view's inspector has tabs of its own (one is also "Level"). */
const rail = (): HTMLElement => screen.getByRole('tablist', { name: 'Views' })

describe('DocumentScreen: the rail', () => {
  it('lists the profile’s views and opens on the first, the Level view', async () => {
    await mountLevel()
    const tabs = within(rail())
      .getAllByRole('tab')
      .map((tab) => tab.textContent)
    expect(tabs).toEqual(['Level', 'World', 'Tilesets', 'Entities', 'Checks', 'Export'])
    expect(within(rail()).getByRole('tab', { name: 'Level' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('level-view')).toBeInTheDocument()
  })

  it('shows the chosen view and keeps the document and its history across views', async () => {
    const { opened } = await mountLevel()
    opened.document.history.apply('Rename', (project) => ({ ...(project as object), name: 'Moss' }))
    flushSync()
    await userEvent.click(within(rail()).getByRole('tab', { name: 'World' }))
    expect(screen.getByTestId('world-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo Rename' })).toBeEnabled()
    await userEvent.click(within(rail()).getByRole('tab', { name: 'Level' }))
    expect(screen.getByTestId('level-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo Rename' })).toBeEnabled()
  })

  it('moves between views with the arrow keys and keeps focus on the rail', async () => {
    await mountLevel()
    within(rail()).getByRole('tab', { name: 'Level' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(within(rail()).getByRole('tab', { name: 'World' })).toHaveAttribute('aria-selected', 'true')
    expect(within(rail()).getByRole('tab', { name: 'World' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(within(rail()).getByRole('tab', { name: 'Export' })).toHaveFocus()
  })

  it('is a tab bar along the foot below wide', async () => {
    await mountLevel([834, 1194])
    expect(screen.getByRole('tablist', { name: 'Views' })).toHaveAttribute('aria-orientation', 'horizontal')
  })
})
