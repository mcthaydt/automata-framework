import {
  createMemoryStore,
  createToasts,
  type FolderStore,
  findRecovery,
  type LifecycleDocument,
  type LifecycleWindow,
  type Workspace,
} from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it, vi } from 'vitest'
import { counterIds } from '../../model/ids'
import { createProfileRegistry } from '../../profiles/profile'
import { memoryWorkspace, textOf } from '../../testing/memory-workspace'
import { type Note, noteText, plantedProfile } from '../../testing/planted-profile'
import { createTestClock } from '../../testing/test-clock'
import { createEditorApp, type OpenOutcome } from '../editor-app'
import { createDocumentController, type DocumentController, type DocumentState } from './document-controller'

// One open document's flows (plan ED2D.4c2b, decisions 5 to 9; kit spec §5 flows 3 and 4, §6): undo and redo, Save
// and what each of its outcomes does, the conflict choices, the Restore decision, and writing the journal before the
// page or the document goes away. Over the planted note profile, so nothing here depends on a real profile.

type Opened = Extract<OpenOutcome, { status: 'opened' }>

/** A page whose visibility a test flips, and whose listeners it counts. */
function fakePage() {
  const listeners = new Set<() => void>()
  const document: LifecycleDocument & { visibilityState: string } = {
    visibilityState: 'visible',
    addEventListener: (_type, run) => listeners.add(run),
    removeEventListener: (_type, run) => listeners.delete(run),
  }
  const window: LifecycleWindow = {
    addEventListener: (_type, run) => listeners.add(run),
    removeEventListener: (_type, run) => listeners.delete(run),
  }
  return {
    lifecycle: { document, window },
    hide(): void {
      document.visibilityState = 'hidden'
      for (const run of [...listeners]) run()
    },
    count: (): number => listeners.size,
  }
}

const settle = async (): Promise<void> => {
  for (let n = 0; n < 5; n += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

interface Setup {
  readonly store?: Workspace['store']
  readonly journal?: Workspace['journal']
  readonly autosave?: boolean
  /** A second profile that claims notes too, so opening asks which one. */
  readonly rival?: boolean
}

async function setup(options: Setup = {}) {
  const clock = createTestClock()
  const base = memoryWorkspace(clock)
  const workspace: Workspace = {
    ...base,
    store: options.store ?? base.store,
    journal: options.journal ?? base.journal,
  }
  const registry = createProfileRegistry()
  registry.register(plantedProfile())
  if (options.rival) registry.register(plantedProfile({ id: 'rival', label: 'Rival note' }))
  const as = options.rival ? 'planted' : undefined
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  await workspace.store.write('a.note', noteText('hello'))
  clock.advance(1000)
  if (options.autosave) {
    const first = await app.open('a.note', as)
    if (first.status !== 'opened') throw new Error(first.status)
    first.document.history.apply('Edit', () => ({ text: 'from the autosave' }))
    clock.advance(1000)
    await first.document.session.flush()
    first.document.dispose()
  }
  const outcome = await app.open('a.note', as)
  if (outcome.status !== 'opened') throw new Error(outcome.status)
  const opened: Opened = outcome
  const toasts = createToasts({ clock })
  const page = fakePage()
  const controller = createDocumentController({ app, opened, toasts, lifecycle: page.lifecycle })
  return { app, workspace, clock, opened, toasts, page, controller }
}

function stateOf(controller: DocumentController): DocumentState {
  let current: DocumentState | undefined
  controller.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('no state')
  return current
}

const edit = (controller: DocumentController, text: string, label = 'Edit'): void => {
  stateOf(controller).document.history.apply(label, () => ({ text }) satisfies Note)
}

describe('the document controller', () => {
  it('starts with the document, its heading, its save state and nothing to undo', async () => {
    const { controller, opened } = await setup()
    expect(stateOf(controller)).toMatchObject({
      document: opened.document,
      heading: { title: 'a.note', file: 'a.note' },
      save: 'saved',
      canUndo: false,
      canRedo: false,
      undoLabel: undefined,
      redoLabel: undefined,
      recovery: undefined,
      conflict: false,
      busy: undefined,
    })
  })

  it('follows edits: the save state, and undo and redo with their labels', async () => {
    const { controller } = await setup()
    const seen: DocumentState[] = []
    controller.state.subscribe((state) => seen.push(state))
    edit(controller, 'one', 'Type')
    expect(stateOf(controller)).toMatchObject({
      save: 'dirty',
      canUndo: true,
      undoLabel: 'Type',
      canRedo: false,
    })
    controller.undo()
    expect(stateOf(controller)).toMatchObject({ canUndo: false, canRedo: true, redoLabel: 'Type' })
    expect(stateOf(controller).document.history.state).toEqual({ text: 'hello' })
    controller.redo()
    expect(stateOf(controller).document.history.state).toEqual({ text: 'one' })
    expect(seen.length).toBeGreaterThan(3)
  })

  it('Save writes the file and says nothing more: the status line shows Saved', async () => {
    const { controller, workspace, toasts } = await setup()
    edit(controller, 'saved text')
    await controller.save()
    expect(textOf(await workspace.store.read('a.note'))).toBe(noteText('saved text', 1))
    expect(stateOf(controller)).toMatchObject({ save: 'saved', busy: undefined, conflict: false })
    expect(toasts.items).toEqual([])
  })

  it('is busy while a save runs, and a second Save meanwhile does nothing', async () => {
    const { controller, workspace } = await setup()
    edit(controller, 'x')
    const write = vi.spyOn(workspace.store, 'write')
    const first = controller.save()
    expect(stateOf(controller).busy).toBe('save')
    await controller.save()
    await first
    expect(write).toHaveBeenCalledOnce()
    expect(stateOf(controller).busy).toBeUndefined()
  })

  describe('a conflict (G-m)', () => {
    async function conflicted() {
      const s = await setup()
      edit(s.controller, 'mine')
      await s.workspace.store.write('a.note', noteText('theirs'))
      await s.controller.save()
      return s
    }

    it('opens the dialog and overwrites nothing', async () => {
      const { controller, workspace } = await conflicted()
      expect(stateOf(controller).conflict).toBe(true)
      expect(textOf(await workspace.store.read('a.note'))).toBe(noteText('theirs'))
    })

    it('Keep mine writes the edits over the file', async () => {
      const { controller, workspace } = await conflicted()
      await controller.keepMine()
      expect(textOf(await workspace.store.read('a.note'))).toBe(noteText('mine', 1))
      expect(stateOf(controller)).toMatchObject({ conflict: false, save: 'saved', busy: undefined })
    })

    it('Save as copy writes the copy, names it, and leaves the file and the document’s path', async () => {
      const { controller, workspace, toasts } = await conflicted()
      await controller.saveCopy()
      expect(textOf(await workspace.store.read('a copy.note'))).toBe(noteText('mine', 1))
      expect(textOf(await workspace.store.read('a.note'))).toBe(noteText('theirs'))
      expect(stateOf(controller)).toMatchObject({ conflict: false })
      expect(stateOf(controller).document.path).toBe('a.note')
      expect(toasts.items).toEqual([
        expect.objectContaining({ kind: 'ok', message: 'Saved a copy as a copy.note.' }),
      ])
    })

    it('Take theirs reloads the file, lets the old document go and drops its autosave', async () => {
      const { controller, opened, workspace, toasts, clock } = await conflicted()
      clock.advance(1000)
      await opened.document.session.flush()
      const dispose = vi.spyOn(opened.document, 'dispose')
      await controller.takeTheirs()
      const state = stateOf(controller)
      expect(state.document).not.toBe(opened.document)
      expect(state.document.history.state).toEqual({ text: 'theirs' })
      expect(state).toMatchObject({ conflict: false, save: 'saved', canUndo: false, busy: undefined })
      expect(dispose).toHaveBeenCalledOnce()
      expect(await findRecovery(workspace.store, workspace.journal, 'a.note')).toBeUndefined()
      expect(toasts.items).toEqual([expect.objectContaining({ message: 'Reloaded a.note from the file.' })])
    })

    it('Take theirs on a file that no longer opens keeps the document and its edits', async () => {
      const { controller, opened, workspace, toasts } = await conflicted()
      await workspace.store.write('a.note', 'not a note')
      await controller.takeTheirs()
      const state = stateOf(controller)
      expect(state.document).toBe(opened.document)
      expect(state.document.history.state).toEqual({ text: 'mine' })
      expect(state.conflict).toBe(false)
      expect(toasts.items).toEqual([
        expect.objectContaining({ kind: 'error', message: expect.stringMatching(/a\.note/) }),
      ])
    })

    it('Take theirs reads the file with the document’s own profile, even when another claims it too', async () => {
      const s = await setup({ rival: true })
      edit(s.controller, 'mine')
      await s.workspace.store.write('a.note', noteText('theirs'))
      await s.controller.save()
      await s.controller.takeTheirs()
      expect(stateOf(s.controller).document.history.state).toEqual({ text: 'theirs' })
      expect(stateOf(s.controller).document.profile.id).toBe('planted')
    })

    it('Take theirs also drops an autosave that was still on offer', async () => {
      const s = await setup({ autosave: true })
      edit(s.controller, 'mine')
      await s.workspace.store.write('a.note', noteText('theirs'))
      await s.controller.save()
      await s.controller.takeTheirs()
      expect(stateOf(s.controller).recovery).toBeUndefined()
    })

    it('Cancel closes the dialog and changes nothing', async () => {
      const { controller } = await conflicted()
      controller.dismissConflict()
      expect(stateOf(controller)).toMatchObject({ conflict: false, save: 'dirty' })
    })
  })

  describe('a failed save', () => {
    function refusing(reason: 'quota' | 'denied') {
      const store = createMemoryStore()
      let refuse = false
      const write = store.write.bind(store)
      return {
        store: {
          ...store,
          write: async (...args: Parameters<typeof store.write>) =>
            refuse ? { ok: false as const, reason, message: 'No room.' } : write(...args),
        },
        refuseNow() {
          refuse = true
        },
        allow() {
          refuse = false
        },
      }
    }

    it('toasts the reason with Retry, and Retry saves again', async () => {
      const failing = refusing('quota')
      const { controller, toasts, workspace } = await setup({ store: failing.store })
      edit(controller, 'x')
      failing.refuseNow()
      await controller.save()
      const [toast] = toasts.items
      expect(toast).toMatchObject({ kind: 'error', message: 'Could not save a.note: No room.' })
      expect(toast?.action?.label).toBe('Retry')
      failing.allow()
      toasts.activate(toast?.id as string)
      await settle()
      expect(textOf(await workspace.store.read('a.note'))).toBe(noteText('x', 1))
    })

    it('a failed Save as copy says only that it failed', async () => {
      const failing = refusing('quota')
      const { controller, toasts } = await setup({ store: failing.store })
      edit(controller, 'x')
      failing.refuseNow()
      await controller.saveCopy()
      expect(toasts.items).toEqual([expect.objectContaining({ kind: 'error' })])
    })

    it('offers Re-grant when the workspace is a folder that denied', async () => {
      const failing = refusing('denied')
      const folder: FolderStore = {
        ...failing.store,
        kind: 'folder',
        name: 'game',
        requestAccess: async () => true,
      }
      const { controller, toasts } = await setup({ store: folder })
      edit(controller, 'x')
      failing.refuseNow()
      await controller.save()
      expect(toasts.items[0]?.action?.label).toBe('Re-grant')
    })
  })

  it('toasts an autosave that stops, once', async () => {
    const journal = createMemoryStore()
    const { controller, toasts, clock } = await setup({
      journal: {
        ...journal,
        write: async () => ({ ok: false, reason: 'quota', message: 'The disk is full.' }),
      },
    })
    edit(controller, 'x')
    clock.advance(1000)
    await settle()
    edit(controller, 'y')
    clock.advance(1000)
    await settle()
    expect(toasts.items).toEqual([
      expect.objectContaining({
        kind: 'warn',
        message: 'Autosave has stopped: The disk is full. Save to keep your edits.',
      }),
    ])
    expect(stateOf(controller).save).toBe('error')
    // The problem stays while a save runs and the status moves; it is not told again.
    await controller.save()
    expect(toasts.items).toHaveLength(1)
  })

  describe('recovery (G-l)', () => {
    it('holds the offered autosave until the person decides', async () => {
      const { controller } = await setup({ autosave: true })
      expect(stateOf(controller).recovery).toMatchObject({ baseChanged: false })
      expect(stateOf(controller).document.history.state).toEqual({ text: 'hello' })
    })

    it('Restore applies it as one undoable step and leaves the document dirty', async () => {
      const { controller } = await setup({ autosave: true })
      controller.restore()
      const state = stateOf(controller)
      expect(state.recovery).toBeUndefined()
      expect(state.document.history.state).toEqual({ text: 'from the autosave' })
      expect(state).toMatchObject({ save: 'dirty', canUndo: true, undoLabel: 'Restore autosave' })
    })

    it('Restore of an autosave that no longer parses keeps the file as saved and says why', async () => {
      const s = await setup({ autosave: true })
      const recovery = stateOf(s.controller).recovery
      if (recovery === undefined) throw new Error('no recovery')
      // The person's profile changed since: the payload is now refused.
      vi.spyOn(s.opened.document, 'restore').mockReturnValue({
        ok: false,
        error: [{ code: 'x', message: 'Not a note.' }],
      })
      s.controller.restore()
      expect(stateOf(s.controller).recovery).toBeUndefined()
      expect(stateOf(s.controller).document.history.state).toEqual({ text: 'hello' })
      expect(s.toasts.items[0]).toMatchObject({
        kind: 'error',
        message: expect.stringContaining('Not a note.'),
      })
      expect(await findRecovery(s.workspace.store, s.workspace.journal, 'a.note')).toBeDefined()
    })

    it('Discard removes the autosave', async () => {
      const { controller, workspace } = await setup({ autosave: true })
      await controller.discard()
      expect(stateOf(controller).recovery).toBeUndefined()
      expect(await findRecovery(workspace.store, workspace.journal, 'a.note')).toBeUndefined()
    })

    it('Discard with nothing on offer leaves the journal alone', async () => {
      const { controller, workspace, opened } = await setup()
      edit(controller, 'x')
      await opened.document.session.flush()
      await controller.discard()
      expect(await findRecovery(workspace.store, workspace.journal, 'a.note')).toBeDefined()
    })

    it('an autosave that could not be read is a warning; the document is open', async () => {
      const clock = createTestClock()
      const workspace = memoryWorkspace(clock)
      const registry = createProfileRegistry()
      registry.register(plantedProfile())
      const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
      await workspace.store.write('a.note', noteText('hello'))
      const outcome = await app.open('a.note')
      if (outcome.status !== 'opened') throw new Error(outcome.status)
      const toasts = createToasts({ clock })
      createDocumentController({
        app,
        opened: { ...outcome, recoveryError: 'The journal is unreadable.' },
        toasts,
        lifecycle: fakePage().lifecycle,
      })
      expect(toasts.items).toEqual([
        expect.objectContaining({
          kind: 'warn',
          message:
            'The autosave could not be read (The journal is unreadable.). The file is open as it was last saved.',
        }),
      ])
    })
  })

  describe('the page going away', () => {
    it('writes the journal when the page hides, before the autosave would have', async () => {
      const { controller, page, workspace } = await setup()
      edit(controller, 'unsaved')
      page.hide()
      await settle()
      expect(await findRecovery(workspace.store, workspace.journal, 'a.note')).toMatchObject({
        payload: noteText('unsaved', 1),
      })
    })

    it('follows the reloaded document after Take theirs', async () => {
      const s = await setup()
      edit(s.controller, 'mine')
      await s.workspace.store.write('a.note', noteText('theirs'))
      await s.controller.save()
      await s.controller.takeTheirs()
      expect(s.page.count()).toBe(2)
      edit(s.controller, 'after the reload')
      s.page.hide()
      await settle()
      expect(await findRecovery(s.workspace.store, s.workspace.journal, 'a.note')).toMatchObject({
        payload: noteText('after the reload', 1),
      })
    })

    it('close writes the journal first, then lets the document go and stops listening', async () => {
      const { controller, page, opened, workspace } = await setup()
      expect(page.count()).toBe(2)
      edit(controller, 'last edit')
      const dispose = vi.spyOn(opened.document, 'dispose')
      await controller.close()
      expect(await findRecovery(workspace.store, workspace.journal, 'a.note')).toMatchObject({
        payload: noteText('last edit', 1),
      })
      expect(dispose).toHaveBeenCalledOnce()
      expect(page.count()).toBe(0)
      await controller.close()
      expect(dispose).toHaveBeenCalledOnce()
    })

    it('after close, Save writes nothing', async () => {
      const { controller, workspace } = await setup()
      edit(controller, 'x')
      await controller.close()
      const write = vi.spyOn(workspace.store, 'write')
      await controller.save()
      expect(write).not.toHaveBeenCalled()
    })
  })
})
