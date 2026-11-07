// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import { createDownloadStore } from '#src/shared/kit/storage/download-store.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'

// An open document: the top bar with Back, Undo, Redo and Save, the save state, the Restore and conflict
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
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback,
  })
  return { opened, controller, toasts, workspace, onback }
}

/** The status beside Save says where the level stands (there is no status bar); `data-save` is its state. */
const status = (): HTMLElement => screen.getByTestId('save-state')

describe('DocumentScreen', () => {
  it('heads the page with the document, which takes focus, and no status bar', async () => {
    await mount()
    expect(screen.getByRole('heading', { level: 1, name: 'a.note' })).toHaveFocus()
    expect(screen.queryByText('notes/a.note')).toBeNull()
    expect(document.querySelector('[data-widget="status-line"]')).toBeNull()
  })

  it('shows a view that is not built yet in plain words, saying the project is safe', async () => {
    await mount()
    expect(screen.getByRole('radio', { name: 'Note' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('heading', { name: 'Note is coming in a later update' })).toBeInTheDocument()
    expect(screen.getByText(/Your game is safe/)).toBeInTheDocument()
  })

  it('Back reports to its owner', async () => {
    const { onback } = await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onback).toHaveBeenCalledOnce()
  })

  describe('Back with unsaved changes', () => {
    const edited = async () => {
      const mounted = await mount()
      mounted.opened.document.history.apply('Type', () => ({ text: 'unsaved' }))
      flushSync()
      await userEvent.click(screen.getByRole('button', { name: 'Back' }))
      return { ...mounted, dialog: screen.getByRole('dialog', { name: 'Save your changes to a.note?' }) }
    }

    it('asks first, with Save, Don’t save and Cancel, Save the primary one', async () => {
      const { dialog, onback } = await edited()
      expect(onback).not.toHaveBeenCalled()
      expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveAttribute('data-kind', 'primary')
      expect(within(dialog).getByRole('button', { name: 'Don’t save' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('Save writes the file, then goes back', async () => {
      const { dialog, onback, workspace } = await edited()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => expect(onback).toHaveBeenCalledOnce())
      expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('unsaved', 1))
    })

    it('Don’t save goes back and leaves the file as it was', async () => {
      const { dialog, onback, workspace } = await edited()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Don’t save' }))
      await vi.waitFor(() => expect(onback).toHaveBeenCalledOnce())
      expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('hello'))
    })

    it('Cancel stays on the level with the edits', async () => {
      const { dialog, onback, opened } = await edited()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onback).not.toHaveBeenCalled()
      expect(opened.document.history.state).toEqual({ text: 'unsaved' })
    })
  })

  it('follows the save state, and Undo and Redo follow the history', async () => {
    const { opened } = await mount()
    expect(status()).toHaveAttribute('data-save', 'saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    opened.document.history.apply('Type', () => ({ text: 'x' }))
    flushSync()
    expect(status()).toHaveAttribute('data-save', 'dirty')
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
    flushSync()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(status()).toHaveAttribute('data-save', 'saved'))
    expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('saved', 1))
  })

  it('a conflict opens the dialog, and Keep mine writes over the file', async () => {
    const { opened, workspace } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'mine' }))
    await workspace.store.write('notes/a.note', noteText('theirs'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('dialog', { name: 'a.note was changed somewhere else' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Use mine' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(textOf(await workspace.store.read('notes/a.note'))).toBe(noteText('mine', 1))
  })

  it('Take theirs shows the reloaded document', async () => {
    const { opened, workspace } = await mount()
    opened.document.history.apply('Type', () => ({ text: 'mine' }))
    await workspace.store.write('notes/a.note', noteText('theirs'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Use theirs' }))
    expect(await screen.findByText('Reloaded a.note from the file.')).toBeInTheDocument()
    expect(status()).toHaveAttribute('data-save', 'saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('asks Restore or Discard first when an autosave is on offer, and Restore applies it', async () => {
    const { controller } = await mount({ autosave: true })
    expect(screen.getByRole('dialog', { name: 'Keep your changes from last time?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep my changes' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    let text: unknown
    controller.state.subscribe((state) => {
      text = state.document.history.state
    })()
    expect(text).toEqual({ text: 'kept' })
    expect(status()).toHaveAttribute('data-save', 'dirty')
    expect(screen.getByRole('button', { name: 'Undo Keep changes from last time' })).toBeEnabled()
  })

  it('the Restore dialog keeps the focus the heading would take, so a keyboard starts on the question', async () => {
    await mount({ autosave: true })
    expect(screen.getByRole('button', { name: 'Keep my changes' })).toHaveFocus()
  })

  it('Throw away keeps the file as it was', async () => {
    await mount({ autosave: true })
    await userEvent.click(screen.getByRole('button', { name: 'Throw away' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(status()).toHaveAttribute('data-save', 'saved')
  })

  it('shows the toasts', async () => {
    const { toasts } = await mount()
    toasts.push({ kind: 'error', message: 'Could not save.' })
    expect(await screen.findByText('Could not save.')).toBeInTheDocument()
  })

  it('says so when this device keeps nothing', async () => {
    await mount({ persistent: false })
    expect(status()).toHaveAttribute('data-save', 'device')
  })
})

async function mountLevel(size: [number, number] = [1194, 834], options: { share?: boolean } = {}) {
  const clock = createTestClock()
  const written: string[] = []
  const workspace = {
    ...memoryWorkspace(clock),
    exports: createDownloadStore({ now: clock.now, download: (file) => void written.push(file.name) }),
  }
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(...size),
    controller,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    workspace: options.share === true ? workspace : undefined,
    onback: () => {},
  })
  return { opened, written }
}

/** The view switcher; the Level view's inspector has tabs of its own (one is also "Level"). */
const switcher = (): HTMLElement => screen.getByRole('radiogroup', { name: 'Views' })

describe('DocumentScreen: the view switcher', () => {
  it('lists the four views in plain words and opens on the first, the Level view', async () => {
    await mountLevel()
    const options = within(switcher())
      .getAllByRole('radio')
      .map((option) => option.textContent?.trim())
    expect(options).toEqual(['Level', 'Map', 'Tiles', 'Characters'])
    expect(within(switcher()).getByRole('radio', { name: 'Level' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('level-view')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Views' })).toBeNull()
  })

  it('shows the chosen view and keeps the document and its history across views', async () => {
    const { opened } = await mountLevel()
    opened.document.history.apply('Rename', (project) => ({ ...(project as object), name: 'Moss' }))
    flushSync()
    await userEvent.click(within(switcher()).getByRole('radio', { name: 'Map' }))
    expect(screen.getByTestId('world-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo Rename' })).toBeEnabled()
    await userEvent.click(within(switcher()).getByRole('radio', { name: 'Level' }))
    expect(screen.getByTestId('level-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo Rename' })).toBeEnabled()
  })

  it('moves between views with the arrow keys and keeps focus on the switcher', async () => {
    await mountLevel()
    within(switcher()).getByRole('radio', { name: 'Level' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(switcher()).getByRole('radio', { name: 'Map' })).toHaveAttribute('aria-checked', 'true')
    expect(within(switcher()).getByRole('radio', { name: 'Map' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(within(switcher()).getByRole('radio', { name: 'Characters' })).toHaveFocus()
  })

  it('is a menu named after the open view on a phone', async () => {
    await mountLevel([390, 844])
    expect(screen.queryByRole('radiogroup', { name: 'Views' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Level' }))
    await userEvent.click(
      within(screen.getByRole('menu', { name: 'Level' })).getByRole('menuitem', { name: 'Tiles' }),
    )
    expect(screen.getByTestId('tilesets-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tiles' })).toBeInTheDocument()
  })
})

describe('DocumentScreen: rename', () => {
  it('renames the level by tapping its name, as one undo step, and keeps an empty name from being kept', async () => {
    const { opened } = await mountLevel()
    await userEvent.click(screen.getByRole('button', { name: 'Untitled platformer' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Rename' }))
    const field = dialog.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(field)
    expect(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled()
    await userEvent.type(field, 'Rooftops{Enter}')
    expect(screen.queryByRole('dialog', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Rooftops' })).toBeInTheDocument()
    expect(opened.document.history.undoLabel).toBe('Rename')
  })

  it('has no rename for a profile without one', async () => {
    await mount()
    expect(screen.queryByRole('button', { name: 'a.note' })).toBeNull()
  })
})

describe('DocumentScreen: Share', () => {
  it('offers Download, Share and Copy in browser storage, and Download keeps the level', async () => {
    const { written } = await mountLevel([1194, 834], { share: true })
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    const menu = within(screen.getByRole('menu', { name: 'Share' }))
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual([
      'Download',
      expect.stringMatching(/^Share/),
      'Copy',
    ])
    await userEvent.click(menu.getByRole('menuitem', { name: 'Download' }))
    expect(await screen.findByText('Downloaded your level.')).toBeInTheDocument()
    expect(written).toEqual([expect.stringMatching(/\.af2d\.json$/)])
  })

  it('has no Share menu where nothing can leave', async () => {
    await mountLevel()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
  })
})
