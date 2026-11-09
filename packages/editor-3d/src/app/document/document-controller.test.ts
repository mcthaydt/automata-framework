import { createToasts, type Toast } from '@automataframework/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../../format/af-sector.schema'
import type { LevelEditor } from '../../model/level-editor'
import { loadAuthored, loadFixture } from '../../testing/fixtures'
import { createTestClock, memoryWorkspace, textOf } from '../../testing/memory-workspace'
import { createEditorApp, type OpenOutcome } from '../editor-app'
import { createDocumentController, type DocumentState } from './document-controller'

// One open level's flows (plan ED3D.5c step 8; ED3D spec §5.3 flow 9, §8, §11; kit spec §5 flows 3 and 4): Save and
// each of its outcomes, the conflict's three choices, the held Save of a refused patch (ED3-o), Restore or Discard,
// and the journal written before the page or the level goes away. Over a memory workspace and the real app.

const PATH = 'depot/depot.json'
const DEPOT = loadAuthored('depot.af-sector')
const CLINIC = 'art/blockout-clinic/blockout.json'
const FACILITY = 'art/blockout-facility/facility.json'

function fakePage() {
  const listeners = new Map<string, Set<() => void>>()
  const on = (type: string, run: () => void): void => {
    const set = listeners.get(type) ?? new Set()
    set.add(run)
    listeners.set(type, set)
  }
  const off = (type: string, run: () => void): void => {
    listeners.get(type)?.delete(run)
  }
  const document = { visibilityState: 'visible', addEventListener: on, removeEventListener: off }
  return {
    lifecycle: { document, window: { addEventListener: on, removeEventListener: off } },
    count: (type: string): number => listeners.get(type)?.size ?? 0,
    hide(): void {
      document.visibilityState = 'hidden'
      for (const run of listeners.get('visibilitychange') ?? []) run()
    },
  }
}

async function setup(files: Record<string, string> = { [PATH]: DEPOT }, path = PATH) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  for (const [at, text] of Object.entries(files)) await workspace.store.write(at, text)
  clock.advance(1000)
  const app = createEditorApp({ workspace, clock })
  const outcome = await app.open(path)
  if (outcome.status !== 'opened') throw new Error(`expected ${path} to open, got ${outcome.status}`)
  const toasts = createToasts({ clock })
  const said: Toast[] = []
  toasts.subscribe((list) => said.splice(0, said.length, ...list))
  const page = fakePage()
  const controller = createDocumentController({ app, opened: outcome, toasts, lifecycle: page.lifecycle })
  let state = undefined as unknown as DocumentState
  controller.state.subscribe((next) => (state = next))
  return {
    clock,
    workspace,
    app,
    outcome,
    controller,
    said,
    page,
    current: () => state,
    file: async (at = path) => textOf(await workspace.store.read(at)),
  }
}

/** Sets a member of the depot's hall (its first sector) as one undo step. */
function setHall(editor: LevelEditor<unknown>, member: 'light' | 'floor', value: number): void {
  editor.history.apply(`Set ${member}`, (state) => {
    const level = structuredClone(state.level) as { sectors: Record<string, unknown>[] }
    const hall = level.sectors[0]
    if (hall === undefined) throw new Error('the depot has no hall')
    hall[member] = value
    return { level: level as unknown as AfSector }
  })
}

const editorOf = (state: DocumentState) => state.level.editor
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('the 3D document controller', () => {
  it('heads the level with its file and starts saved, with nothing to undo', async () => {
    const { current } = await setup()
    expect(current()).toMatchObject({
      heading: { title: 'depot.json', file: PATH },
      save: 'saved',
      canUndo: false,
      canRedo: false,
      recovery: undefined,
      conflict: false,
      held: undefined,
      heldOpen: false,
      busy: undefined,
    })
  })

  it('undoes and redoes, naming the step', async () => {
    const { controller, current } = await setup()
    setHall(editorOf(current()), 'light', 0.5)
    expect(current()).toMatchObject({ canUndo: true, undoLabel: 'Set light', save: 'dirty' })
    controller.undo()
    expect(current()).toMatchObject({ canUndo: false, canRedo: true, redoLabel: 'Set light' })
    controller.redo()
    expect(current().canUndo).toBe(true)
  })

  it('saves the patched text and toasts nothing', async () => {
    const { controller, current, file, said } = await setup()
    setHall(editorOf(current()), 'light', 0.5)
    await controller.save()
    expect(await file()).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
    expect(current()).toMatchObject({ save: 'saved', busy: undefined })
    expect(said).toEqual([])
  })

  describe('a file changed behind the editor (ED3-k)', () => {
    async function conflicted() {
      const setupped = await setup()
      setHall(editorOf(setupped.current()), 'light', 0.5)
      setupped.clock.advance(1000)
      await setupped.workspace.store.write(PATH, DEPOT.replace('"light": 1,', '"light": 0.25,'))
      await setupped.controller.save()
      return setupped
    }

    it('opens the conflict dialog and writes nothing', async () => {
      const { current, file } = await conflicted()
      expect(current().conflict).toBe(true)
      expect(await file()).toContain('"light": 0.25,')
    })

    it('Keep mine writes the edits over it', async () => {
      const { controller, current, file } = await conflicted()
      await controller.keepMine()
      expect(current()).toMatchObject({ conflict: false, save: 'saved' })
      expect(await file()).toContain('"light": 0.5,')
    })

    it('Save as copy writes beside it and names the copy', async () => {
      const { controller, current, file, said } = await conflicted()
      await controller.saveCopy()
      expect(current().conflict).toBe(false)
      expect(await file('depot/depot copy.json')).toContain('"light": 0.5,')
      expect(said.map((toast) => toast.message)).toEqual(['Saved a copy as depot copy.json.'])
    })

    it('Take theirs reloads the file and drops the edits', async () => {
      const { controller, current, outcome, said } = await conflicted()
      await controller.takeTheirs()
      expect(current().level).not.toBe(outcome.level)
      expect(current()).toMatchObject({ conflict: false, save: 'saved', canUndo: false })
      expect(JSON.stringify(current().level.editor.level)).toContain('"light":0.25')
      expect(said.map((toast) => toast.message)).toEqual(['Reloaded depot.json from the file.'])
    })

    it('Take theirs of a file that no longer opens keeps the level and its edits', async () => {
      const { controller, current, outcome, workspace, said } = await conflicted()
      await workspace.store.write(PATH, '{ not json')
      await controller.takeTheirs()
      expect(current().level).toBe(outcome.level)
      expect(current().canUndo).toBe(true)
      expect(said[0]?.message).toBe('depot.json is not a level this editor opens')
    })

    it('Cancel closes the dialog and keeps the edits', async () => {
      const { controller, current } = await conflicted()
      controller.dismissConflict()
      expect(current()).toMatchObject({ conflict: false, save: 'dirty' })
    })
  })

  it('a failed save toasts the reason with Retry, which saves again', async () => {
    const { controller, current, workspace, said, file } = await setup()
    setHall(editorOf(current()), 'light', 0.5)
    const write = workspace.store.write.bind(workspace.store)
    let fail = true
    workspace.store.write = async (path, data, expected) =>
      fail ? { ok: false, reason: 'quota', message: 'The disk is full.' } : write(path, data, expected)
    await controller.save()
    expect(said.map((toast) => [toast.kind, toast.message, toast.action?.label])).toEqual([
      ['error', 'Could not save depot.json: The disk is full.', 'Retry'],
    ])
    fail = false
    said[0]?.action?.run()
    await settle()
    await settle()
    expect(await file()).toContain('"light": 0.5,')
  })

  describe('a change the patch cannot write (ED3-o)', () => {
    async function held() {
      const setupped = await setup()
      setHall(editorOf(setupped.current()), 'floor', 1e21)
      await setupped.controller.save()
      return setupped
    }

    it('holds Save, opens the held dialog with the path and reason, and writes nothing', async () => {
      const { current, file } = await held()
      expect(current()).toMatchObject({ heldOpen: true, save: 'dirty' })
      expect(current().held?.path).toEqual(['sectors', 0, 'floor'])
      expect(await file()).toBe(DEPOT)
    })

    it('a Save while held opens the dialog again and writes nothing', async () => {
      const { controller, current, file } = await held()
      controller.dismissHeld()
      expect(current().heldOpen).toBe(false)
      await controller.save()
      expect(current().heldOpen).toBe(true)
      expect(await file()).toBe(DEPOT)
    })

    it('a Save while a choice runs does nothing: it does not reopen the dialog under it', async () => {
      const { controller, current, workspace } = await held()
      const write = workspace.store.write.bind(workspace.store)
      let release: () => void = () => {}
      let called: () => void = () => {}
      const writing = new Promise<void>((resolve) => (called = resolve))
      workspace.store.write = (path, data, expected) =>
        new Promise((resolve) => {
          release = () => resolve(write(path, data, expected))
          called()
        })
      const reformatting = controller.saveReformatted()
      await writing
      expect(current()).toMatchObject({ busy: 'resolve', heldOpen: false })
      await controller.save()
      expect(current().heldOpen).toBe(false)
      release()
      await reformatting
      expect(current()).toMatchObject({ busy: undefined, held: undefined, heldOpen: false })
    })

    it('Save reformatted writes the whole file and lets Save go', async () => {
      const { controller, current, file, said } = await held()
      await controller.saveReformatted()
      expect(current()).toMatchObject({ held: undefined, heldOpen: false, save: 'saved' })
      expect(await file()).toContain('"floor": 1e+21')
      expect(said.map((toast) => toast.message)).toEqual(['Saved depot.json reformatted.'])
    })

    it('Export a copy downloads it and leaves the file alone', async () => {
      const { controller, current, file, workspace, said } = await held()
      await controller.exportCopy()
      expect(workspace.downloads.map((download) => download.name)).toEqual(['depot.json'])
      expect(await file()).toBe(DEPOT)
      expect(current()).toMatchObject({ heldOpen: false, save: 'dirty' })
      expect(said.map((toast) => toast.message)).toEqual(['Exported a copy as depot.json.'])
    })
  })

  describe('an autosave newer than the file', () => {
    async function withRecovery() {
      const first = await setup()
      setHall(editorOf(first.current()), 'light', 0.5)
      first.clock.advance(1000)
      await settle()
      await first.controller.close()
      const outcome = await first.app.open(PATH)
      if (outcome.status !== 'opened') throw new Error('expected the depot to open')
      const toasts = createToasts({ clock: first.clock })
      const said: Toast[] = []
      toasts.subscribe((list) => said.splice(0, said.length, ...list))
      const controller = createDocumentController({
        app: first.app,
        opened: outcome,
        toasts,
        lifecycle: fakePage().lifecycle,
      })
      let state = undefined as unknown as DocumentState
      controller.state.subscribe((next) => (state = next))
      return { ...first, controller, said, current: () => state }
    }

    it('is offered first, and Restore applies it as one undoable step', async () => {
      const { controller, current } = await withRecovery()
      expect(current().recovery).toBeDefined()
      controller.restore()
      expect(current()).toMatchObject({
        recovery: undefined,
        canUndo: true,
        undoLabel: 'Keep changes from last time',
      })
      expect(JSON.stringify(current().level.editor.level)).toContain('"light":0.5')
    })

    it('Discard throws it away', async () => {
      const { controller, current, workspace } = await withRecovery()
      await controller.discard()
      expect(current().recovery).toBeUndefined()
      expect(await workspace.journal.list()).toEqual([])
    })

    it('one that no longer validates stays on offer, with its first issue toasted', async () => {
      const { controller, current, said } = await withRecovery()
      const offered = current().recovery
      if (offered === undefined) throw new Error('expected an autosave')
      ;(offered as { payload: string }).payload = '{"format":"af-sector/1"}'
      controller.restore()
      expect(current().recovery).toBe(offered)
      expect(said[0]?.message).toMatch(/^The autosave no longer opens \(/)
    })
  })

  it('writes the journal when the page hides, and stops listening once closed', async () => {
    const { controller, current, page, workspace } = await setup()
    expect(page.count('visibilitychange')).toBe(1)
    setHall(editorOf(current()), 'light', 0.5)
    page.hide()
    await settle()
    expect((await workspace.journal.list()).length).toBe(1)
    await controller.close()
    expect(page.count('visibilitychange')).toBe(0)
    expect(page.count('pagehide')).toBe(0)
  })

  it('close writes the last edit to the journal before it lets the level go, and ignores a second close', async () => {
    const { controller, current, workspace } = await setup()
    setHall(editorOf(current()), 'light', 0.5)
    await controller.close()
    expect((await workspace.journal.list()).length).toBe(1)
    await controller.close()
    await controller.save()
    expect(current().busy).toBeUndefined()
  })

  it('close lets the facility beside a Last Light level go too', async () => {
    const { controller, outcome } = await setup(
      { [CLINIC]: loadFixture('blockout-clinic'), [FACILITY]: loadFixture('facility') },
      CLINIC,
    )
    const facility = (outcome as Extract<OpenOutcome, { status: 'opened' }>).facility
    if (facility?.status !== 'opened') throw new Error('expected the facility to open')
    let disposed = false
    const dispose = facility.facility.document.dispose
    ;(facility.facility.document as { dispose(): void }).dispose = () => {
      disposed = true
      dispose()
    }
    await controller.close()
    expect(disposed).toBe(true)
  })
})
