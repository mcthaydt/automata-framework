// Saving a document by patching its text (ED3D.5b steps 2 to 4; ED3D spec §5.3 flow 9, §8, §11 and ED3-o; kit spec §5
// flows 3 and 4): the kit's DocumentSession writes what the codec's patch gives, a refused patch holds Save, and the
// autosave keeps the model so Restore patches it into the file as it is now.

import type { AfSector } from '@automata/3d/level'
import { findRecovery, statPath } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import { createLevelEditor, type LevelEditor } from '../model/level-editor'
import type { LevelState } from '../model/level-state'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { LevelProfile } from '../profile/level-profile'
import { loadAuthored } from '../testing/fixtures'
import { createTestClock, memoryWorkspace, type TestClock, textOf } from '../testing/memory-workspace'
import { createPatchedDocument, type PatchedDocument } from './patched-document'

const PATH = 'levels/depot.af-sector.json'
const DEPOT = loadAuthored('depot.af-sector')

interface Setup<D> {
  readonly clock: TestClock
  readonly workspace: ReturnType<typeof memoryWorkspace>
  readonly editor: LevelEditor<D>
  readonly document: PatchedDocument
  /** The file's bytes as text now. */
  file(path?: string): Promise<string | undefined>
}

function parsed<D>(profile: LevelProfile<D>, text: string): D {
  const result = profile.parse(text)
  if (!result.ok) throw new Error('the fixture does not parse')
  return result.value
}

async function setup<D>(profile: LevelProfile<D>, text: string, path = PATH): Promise<Setup<D>> {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(path, text)
  clock.advance(1000)
  return open(profile, path, clock, workspace)
}

async function open<D>(
  profile: LevelProfile<D>,
  path: string,
  clock: TestClock,
  workspace: ReturnType<typeof memoryWorkspace>,
): Promise<Setup<D>> {
  const text = textOf(await workspace.store.read(path)) ?? ''
  const mtime = (await statPath(workspace.store, path))?.mtime
  const level = parsed(profile, text)
  const editor = createLevelEditor({ profile, level, now: clock.now })
  const document = createPatchedDocument<LevelState<D>, D>({
    workspace,
    clock,
    path,
    mtime,
    text,
    model: level,
    codec: profile,
    history: editor.history,
    modelOf: (state) => state.level,
    withModel: (model) => ({ level: model }),
  })
  return {
    clock,
    workspace,
    editor,
    document,
    file: async (at = path) => textOf(await workspace.store.read(at)),
  }
}

/** Lets the autosave's write, started by a timer, finish. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Sets a member of the depot's hall (the first sector) as one undo step. */
function setHall(editor: LevelEditor<AfSector>, member: 'light' | 'floor', value: number): void {
  editor.history.apply(`Set ${member}`, (state) => {
    const level = structuredClone(state.level) as unknown as { sectors: Record<string, unknown>[] }
    const hall = level.sectors[0]
    if (hall === undefined) throw new Error('the depot has no hall')
    hall[member] = value
    return { level: level as unknown as AfSector }
  })
}

function never(): never {
  throw new Error('no recovery')
}

describe('saving through the patch', () => {
  it('writes the patched text: one number changes and every other byte stays', async () => {
    const { editor, document, file } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    expect(document.session.status).toBe('dirty')
    expect(await document.save()).toEqual({ status: 'saved', path: PATH })
    expect(await file()).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
    expect(document.session.status).toBe('saved')
    expect(document.held).toBeUndefined()
  })

  it('patches the text of the last save on the next one', async () => {
    const { editor, document, file, clock } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    await document.save()
    clock.advance(10)
    setHall(editor, 'floor', 0.25)
    expect(await document.save()).toEqual({ status: 'saved', path: PATH })
    expect(await file()).toBe(
      DEPOT.replace('"light": 1,', '"light": 0.5,').replace('"floor": 0,', '"floor": 0.25,'),
    )
  })

  it('runs saves one at a time, each patching the text the one before it wrote', async () => {
    const { editor, document, file } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    const first = document.save()
    const copy = document.saveCopy()
    setHall(editor, 'floor', 0.25)
    const second = document.save()
    expect((await Promise.all([first, copy, second])).map((outcome) => outcome.status)).toEqual([
      'saved',
      'saved',
      'saved',
    ])
    expect(await file()).toBe(
      DEPOT.replace('"light": 1,', '"light": 0.5,').replace('"floor": 0,', '"floor": 0.25,'),
    )
    expect(document.session.status).toBe('saved')
  })

  it('writes each queued save’s own text and leaves the base equal to what is on disk', async () => {
    const { editor, document, file, workspace, clock } = await setup(afSectorProfile, DEPOT)
    const written: string[] = []
    const write = workspace.store.write.bind(workspace.store)
    workspace.store.write = (at, data, expected) => {
      written.push(typeof data === 'string' ? data : (textOf(data) ?? ''))
      return write(at, data, expected)
    }
    const reformattedDepot = `${JSON.stringify(editor.level, null, 2)}\n`
    const first = document.saveReformatted()
    const second = document.save()
    expect((await Promise.all([first, second])).map((outcome) => outcome.status)).toEqual(['saved', 'saved'])
    // The plain save patches what the reformatted save wrote: nothing changed, so it writes that text again.
    expect(written).toEqual([reformattedDepot, reformattedDepot])
    expect(await file()).toBe(reformattedDepot)
    clock.advance(10)
    setHall(editor, 'light', 0.5)
    expect((await document.save()).status).toBe('saved')
    expect(await file()).toBe(reformattedDepot.replace('"light": 1,', '"light": 0.5,'))
  })

  it('is a conflict, writing nothing, when the file changed behind the editor; Keep mine then writes it', async () => {
    const { editor, document, file, workspace, clock } = await setup(afSectorProfile, DEPOT)
    clock.advance(10)
    const theirs = DEPOT.replace('"name": "depot"', '"name": "theirs"')
    await workspace.store.write(PATH, theirs)
    setHall(editor, 'light', 0.5)
    expect(await document.save()).toEqual({ status: 'conflict' })
    expect(await file()).toBe(theirs)
    expect(await document.overwrite()).toEqual({ status: 'saved', path: PATH })
    // Keep mine patches the text the editor opened, so their change is replaced, not merged.
    expect(await file()).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
  })

  it('saves a copy beside the file and leaves the file alone', async () => {
    const { editor, document, file } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    expect(await document.saveCopy()).toEqual({ status: 'saved', path: 'levels/depot.af-sector copy.json' })
    expect(await file('levels/depot.af-sector copy.json')).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
    expect(await file()).toBe(DEPOT)
    expect(document.session.status).toBe('dirty')
  })
})

describe('a workspace that keeps nothing on this device', () => {
  it('shows the status `device` and still saves', async () => {
    const clock = createTestClock()
    const workspace = { ...memoryWorkspace(clock), persistent: false, reason: 'no OPFS' }
    await workspace.store.write(PATH, DEPOT)
    const { editor, document } = await open(afSectorProfile, PATH, clock, workspace)
    expect(document.session.status).toBe('device')
    setHall(editor, 'light', 0.5)
    expect((await document.save()).status).toBe('saved')
  })
})

describe('a refused patch holds Save (ED3-o)', () => {
  it('refuses Save, Keep mine and Save as copy with the path and reason, and writes nothing', async () => {
    const { editor, document, file, workspace } = await setup(afSectorProfile, DEPOT)
    const mtime = (await statPath(workspace.store, PATH))?.mtime
    setHall(editor, 'floor', 1e21)
    const refused = {
      status: 'refused',
      path: ['sectors', 0, 'floor'],
      reason: 'unwritable-value',
      detail: '1e+21 is too large to write without an exponent',
    }
    expect(await document.save()).toEqual(refused)
    expect(await document.overwrite()).toEqual(refused)
    expect(await document.saveCopy()).toEqual(refused)
    expect(document.held).toEqual(refused)
    expect(await file()).toBe(DEPOT)
    expect((await statPath(workspace.store, PATH))?.mtime).toBe(mtime)
    expect(await workspace.store.list('levels/depot.af-sector copy')).toEqual([])
    expect(document.session.status).toBe('dirty')
    expect(document.session.problem).toBeUndefined()
  })

  it('Save reformatted writes the whole model, which reopens to the same level, and releases Save', async () => {
    const { editor, document, file, clock, workspace } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'floor', 1e21)
    await document.save()
    expect(await document.saveReformatted()).toEqual({ status: 'saved', path: PATH })
    const written = (await file()) ?? ''
    expect(written).toBe(`${JSON.stringify(editor.level, null, 2)}\n`)
    expect(parsed(afSectorProfile, written)).toEqual(editor.level)
    expect(document.held).toBeUndefined()
    expect(document.session.status).toBe('saved')
    // The reformatted text is the new base: the next save patches it.
    clock.advance(10)
    setHall(editor, 'floor', 2)
    expect((await document.save()).status).toBe('saved')
    expect(written).toContain('"floor": 1e+21,')
    expect(await file()).toBe(written.replace('"floor": 1e+21,', '"floor": 2,'))
    expect(await workspace.journal.list()).toEqual([])
  })

  it('Save reformatted is a conflict when the file changed behind the editor', async () => {
    const { editor, document, file, workspace, clock } = await setup(afSectorProfile, DEPOT)
    clock.advance(10)
    await workspace.store.write(PATH, `${DEPOT} `)
    setHall(editor, 'floor', 1e21)
    expect(await document.saveReformatted()).toEqual({ status: 'conflict' })
    expect(await file()).toBe(`${DEPOT} `)
  })

  it('Export a copy downloads the reformatted level and leaves the file alone', async () => {
    const { editor, document, file, workspace } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'floor', 1e21)
    expect(await document.exportCopy()).toEqual({ status: 'exported', name: 'depot.af-sector.json' })
    expect(workspace.downloads.map((each) => [each.name, textOf(each.data)])).toEqual([
      ['depot.af-sector.json', `${JSON.stringify(editor.level, null, 2)}\n`],
    ])
    expect(await file()).toBe(DEPOT)
    expect(document.session.status).toBe('dirty')
  })

  it('Export a copy downloads the patched text when the patch works', async () => {
    const { editor, document, workspace } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    await document.exportCopy()
    expect(textOf(workspace.downloads[0]?.data)).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
  })

  it('refuses both when no text can hold the model', async () => {
    const { editor, document, file, workspace } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'floor', Number.POSITIVE_INFINITY)
    const reformatted = await document.saveReformatted()
    expect(reformatted).toMatchObject({
      status: 'refused',
      path: ['sectors', 0, 'floor'],
      reason: 'verify-failed',
    })
    expect(await document.exportCopy()).toMatchObject({ status: 'refused', reason: 'verify-failed' })
    expect(await file()).toBe(DEPOT)
    expect(workspace.downloads).toEqual([])
  })
})

describe('the autosave and Restore', () => {
  it('journals the model and offers it on reopen; Restore is one step and Save patches it into the file as it is now', async () => {
    const first = await setup(afSectorProfile, DEPOT)
    setHall(first.editor, 'light', 0.5)
    first.clock.advance(1000)
    await settle()
    const recovery = await findRecovery(first.workspace.store, first.workspace.journal, PATH)
    expect(recovery?.payload).toBe(JSON.stringify(first.editor.level))
    first.document.dispose()

    const again = await open(afSectorProfile, PATH, first.clock, first.workspace)
    if (recovery === undefined) throw new Error('no recovery')
    expect(again.document.restore(recovery)).toEqual({ ok: true, baseChanged: false })
    expect(again.editor.history.undoLabel).toBe('Keep changes from last time')
    expect(again.editor.level).toEqual(first.editor.level)
    expect(again.document.session.status).toBe('dirty')
    expect((await again.document.save()).status).toBe('saved')
    expect(await again.file()).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,'))
  })

  it('restores over a file edited on disk after the editor opened it: says so, and Save keeps the file’s layout', async () => {
    const first = await setup(afSectorProfile, DEPOT)
    first.clock.advance(10)
    // Someone edits the file outside: a different layout and a different name.
    const theirs = DEPOT.replace('"ceiling": 4,', '"ceiling":   4,').replace(
      '"name": "depot"',
      '"name": "theirs"',
    )
    await first.workspace.store.write(PATH, theirs)
    first.clock.advance(10)
    setHall(first.editor, 'light', 0.5)
    first.clock.advance(1000)
    await settle()
    first.document.dispose()

    const again = await open(afSectorProfile, PATH, first.clock, first.workspace)
    const recovery = await findRecovery(first.workspace.store, first.workspace.journal, PATH)
    expect(recovery?.baseChanged).toBe(true)
    expect(again.document.restore(recovery ?? never())).toEqual({ ok: true, baseChanged: true })
    expect((await again.document.save()).status).toBe('saved')
    // The restored model wins (the name goes back), and every byte it did not change is the file's as it is now.
    expect(await again.file()).toBe(
      theirs.replace('"name": "theirs"', '"name": "depot"').replace('"light": 1,', '"light": 0.5,'),
    )
  })

  it('undo after Restore brings the file’s level back', async () => {
    const { editor, document } = await setup(afSectorProfile, DEPOT)
    const opened = editor.level
    const payload = JSON.stringify({ ...opened, name: 'restored' })
    document.restore({ payload, savedAt: 0, baseChanged: false })
    expect((editor.level as AfSector).name).toBe('restored')
    editor.history.undo()
    expect(editor.level).toBe(opened)
  })

  it('refuses a payload that no longer validates, and changes nothing', async () => {
    const { editor, document } = await setup(afSectorProfile, DEPOT)
    const result = document.restore({ payload: '{"format": "af-sector/1"}', savedAt: 0, baseChanged: false })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.length).toBeGreaterThan(0)
    const notJson = document.restore({ payload: 'not json', savedAt: 0, baseChanged: false })
    expect(notJson.ok === false && notJson.issues.map((issue) => issue.path)).toEqual([[]])
    expect(editor.history.canUndo).toBe(false)
  })

  it('discards the journal', async () => {
    const { editor, document, clock, workspace } = await setup(afSectorProfile, DEPOT)
    setHall(editor, 'light', 0.5)
    clock.advance(1000)
    await settle()
    expect(await findRecovery(workspace.store, workspace.journal, PATH)).toBeDefined()
    await document.discardRecovery()
    expect(await findRecovery(workspace.store, workspace.journal, PATH)).toBeUndefined()
  })

  it('stops autosaving once disposed', async () => {
    const { editor, document, clock, workspace } = await setup(afSectorProfile, DEPOT)
    document.dispose()
    setHall(editor, 'light', 0.5)
    clock.advance(5000)
    await settle()
    expect(await workspace.journal.list()).toEqual([])
  })
})
