import { describe, expect, it } from 'vitest'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import type { OpenDocument, OpenOutcome } from '#src/shared/level-2d/session/editor-app-types.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile, savedCount } from '#src/testing/level-2d/planted-profile.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// Creating, opening and saving documents over the kit's workspace. The level project is the real
// profile; the planted note stands in for a second one, and for a codec that patches the text it loaded.

function setup(plant = false) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = plant ? createProfileRegistry() : createAppProfiles()
  if (plant) registry.register(plantedProfile())
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  return { app, workspace, clock, registry }
}

async function opened(outcome: OpenOutcome | Promise<OpenOutcome>): Promise<OpenDocument> {
  const result = await outcome
  if (result.status !== 'opened') throw new Error(`expected opened, got ${result.status}`)
  return result.document
}

describe('create', () => {
  it('writes the template’s working file and opens it clean', async () => {
    const { app, workspace } = setup()
    const document = await opened(app.create('level-project', 'blank'))
    expect(document.profile.id).toBe('level-project')
    expect(textOf(await workspace.store.read(document.path))).toMatch(/"format": "af2d"/)
    expect(document.session.status).toBe('saved')
    expect(document.history.canUndo).toBe(false)
  })

  it('creates every template of every profile and opens it the way an existing file opens', async () => {
    const { app, registry } = setup()
    registry.register(plantedProfile())
    for (const profile of registry.list()) {
      for (const template of profile.templates) {
        const document = await opened(app.create(profile.id, template.id))
        expect(document.profile.id, `${profile.id}/${template.id}`).toBe(profile.id)
        expect(profile.check(document.history.state, {}).filter((d) => d.severity === 'error')).toEqual([])
      }
    }
  })

  it('takes the document’s path from the profile’s working file export', async () => {
    const { app, workspace } = setup(true)
    const document = await opened(app.create('planted', 'two'))
    expect(document.path).toBe('notes/second.note')
    expect(textOf(await workspace.store.read('notes/second.note'))).toBe(noteText('second'))
  })

  it('puts a number before the extension when the path is taken, and keeps a compound extension whole', async () => {
    const { app } = setup()
    const first = await opened(app.create('level-project', 'blank'))
    const second = await opened(app.create('level-project', 'blank'))
    const third = await opened(app.create('level-project', 'blank'))
    expect(first.path.endsWith('.af2d.json')).toBe(true)
    expect(second.path).toBe(first.path.replace('.af2d.json', ' 2.af2d.json'))
    expect(third.path).toBe(first.path.replace('.af2d.json', ' 3.af2d.json'))
  })

  it('numbers a path in a folder inside the folder', async () => {
    const { app } = setup(true)
    await app.create('planted', 'two')
    const second = await opened(app.create('planted', 'two'))
    expect(second.path).toBe('notes/second 2.note')
  })

  it('says storageFailed, with the reason and nothing written, when the disk is full', async () => {
    const { workspace } = setup()
    const full = {
      ...workspace.store,
      write: () => Promise.resolve({ ok: false as const, reason: 'quota' as const, message: 'Disk full.' }),
    }
    const app = createEditorApp({
      workspace: { ...workspace, store: full },
      registry: createAppProfiles(),
      ids: counterIds(),
    })
    expect(await app.create('level-project', 'blank')).toEqual({
      status: 'storageFailed',
      path: 'untitled-project.af2d.json',
      reason: 'quota',
      message: 'Disk full.',
    })
    expect(await workspace.store.list()).toEqual([])
  })

  it('says storageFailed when the store cannot even be listed', async () => {
    const { workspace } = setup()
    const denied = {
      ...workspace.store,
      list: () => Promise.reject(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' })),
    }
    const app = createEditorApp({
      workspace: { ...workspace, store: denied },
      registry: createAppProfiles(),
      ids: counterIds(),
    })
    expect(await app.create('level-project', 'blank')).toMatchObject({
      status: 'storageFailed',
      path: 'untitled-project.af2d.json',
      reason: 'denied',
    })
  })

  it('numbers a file whose name starts with a dot after the whole name, and ignores a dot in a folder name', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const registry = createProfileRegistry()
    let path = '.hidden'
    registry.register(
      plantedProfile({
        exports: [{ id: 'note', label: 'Note', files: () => [{ path, contents: noteText('x') }] }],
      }),
    )
    const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
    await app.create('planted', 'two')
    expect((await opened(app.create('planted', 'two'))).path).toBe('.hidden 2')
    path = 'v1.2/a.note'
    await app.create('planted', 'two')
    expect((await opened(app.create('planted', 'two'))).path).toBe('v1.2/a 2.note')
  })

  it('refuses a profile or template the registry does not have', async () => {
    const { app } = setup()
    await expect(app.create('nope', 'blank')).rejects.toThrow('no profile "nope"')
    await expect(app.create('level-project', 'nope')).rejects.toThrow('no template "nope"')
  })
})

describe('open', () => {
  it('opens a stored project, clean, with the history at its state', async () => {
    const { app, workspace } = setup()
    await workspace.store.write('mossgate.af2d.json', printProject(mossgate()))
    const outcome = await app.open('mossgate.af2d.json')
    expect(outcome.status).toBe('opened')
    if (outcome.status !== 'opened') return
    expect(outcome.recovery).toBeUndefined()
    expect(printProject(outcome.document.history.state as Project)).toBe(printProject(mossgate()))
    expect(outcome.document.session.status).toBe('saved')
  })

  it('says missing for a path with no file', async () => {
    const { app } = setup()
    expect(await app.open('gone.af2d.json')).toEqual({ status: 'missing', path: 'gone.af2d.json' })
  })

  it('says missing when the file is removed between the listing and the read', async () => {
    const { workspace } = setup()
    await workspace.store.write('a.af2d.json', printProject(mossgate()))
    const racing = { ...workspace.store, read: () => Promise.resolve(undefined) }
    const app = createEditorApp({
      workspace: { ...workspace, store: racing },
      registry: createAppProfiles(),
      ids: counterIds(),
    })
    expect(await app.open('a.af2d.json')).toEqual({ status: 'missing', path: 'a.af2d.json' })
  })

  it('hands back what readDocument says when the file does not open, with the path', async () => {
    const { app, workspace } = setup()
    await workspace.store.write('a.af2d.json', '{ nope')
    await workspace.store.write('readme.txt', 'hello')
    await workspace.store.write('bin.af2d.json', new Uint8Array([0xff, 0xfe]))
    const broken = await app.open('a.af2d.json')
    expect(broken).toMatchObject({ status: 'invalid', path: 'a.af2d.json', text: '{ nope' })
    expect(await app.open('readme.txt')).toEqual({
      status: 'unrecognised',
      path: 'readme.txt',
      text: 'hello',
    })
    expect(await app.open('bin.af2d.json')).toEqual({ status: 'notText', path: 'bin.af2d.json' })
  })

  it('asks which profile when two claim the file, and opens with the one chosen', async () => {
    const { app, workspace, registry } = setup()
    registry.register(plantedProfile({ sniff: () => true }))
    await workspace.store.write('x.af2d.json', printProject(mossgate()))
    const choice = await app.open('x.af2d.json')
    expect(choice.status).toBe('choose')
    if (choice.status !== 'choose') return
    expect(choice.candidates.map((profile) => profile.id)).toEqual(['level-project', 'planted'])
    const chosen = await opened(app.open('x.af2d.json', 'level-project'))
    expect(chosen.profile.id).toBe('level-project')
  })

  it('says storageFailed, with the reason, when the store refuses the read', async () => {
    const { workspace } = setup()
    await workspace.store.write('a.af2d.json', 'x')
    const refusing = {
      ...workspace.store,
      read: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
    }
    const locked = createEditorApp({
      workspace: { ...workspace, store: refusing },
      registry: createAppProfiles(),
      ids: counterIds(),
    })
    expect(await locked.open('a.af2d.json')).toEqual({
      status: 'storageFailed',
      path: 'a.af2d.json',
      reason: 'denied',
      message: 'no',
    })
  })
})

describe('save', () => {
  it('writes what the profile prints and reopens as the edited document (G-a)', async () => {
    const { app, workspace } = setup()
    const document = await opened(app.create('level-project', 'platformer'))
    document.history.apply('Rename', (project) => ({ ...(project as Project), name: 'Edited by a test' }))
    expect(document.session.status).toBe('dirty')
    expect(await document.save()).toEqual({ status: 'saved', path: document.path })
    expect(document.session.status).toBe('saved')
    const written = textOf(await workspace.store.read(document.path))
    expect(written).toBe(printProject(document.history.state as Project))
    const again = await opened(app.open(document.path))
    expect((again.history.state as Project).name).toBe('Edited by a test')
  })

  it('prints each save against the text of the one before, and the first against the text it was loaded as', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello', 4))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    await document.save()
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(5)
    document.history.apply('Edit', () => ({ text: 'two' }))
    await document.save()
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(6)
  })

  it('keeps the old base when a save fails, so the next print patches what is really on disk', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello', 1))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    // Someone rewrites the file behind the editor: the save is a conflict and writes nothing.
    await workspace.store.write('a.note', noteText('theirs', 9))
    expect(await document.save()).toEqual({ status: 'conflict' })
    // Keep mine writes without the check; it prints against the text this editor loaded, not the one it never read.
    expect(await document.overwrite()).toEqual({ status: 'saved', path: 'a.note' })
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(2)
  })

  it('hands Export the text it was loaded as, then the text of each save, but not of a copy (base)', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello', 4))
    const document = await opened(app.open('a.note'))
    expect(document.base()).toBe(noteText('hello', 4))
    document.history.apply('Edit', () => ({ text: 'one' }))
    expect(document.base()).toBe(noteText('hello', 4))
    await document.save()
    expect(document.base()).toBe(textOf(await workspace.store.read('a.note')))
    document.history.apply('Edit', () => ({ text: 'two' }))
    await document.saveCopy()
    expect(document.base()).toBe(textOf(await workspace.store.read('a.note')))
  })

  it('saves a copy beside the file and leaves the document on its own path', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello'))
    const document = await opened(app.open('a.note'))
    expect(await document.saveCopy()).toEqual({ status: 'saved', path: 'a copy.note' })
    expect(document.path).toBe('a.note')
    expect(textOf(await workspace.store.read('a copy.note'))).toMatch(/^NOTE\nhello\n/)
    expect(savedCount(textOf(await workspace.store.read('a copy.note')) ?? '')).toBe(1)
    // A copy is not the document's file: the next save still patches the text the document was loaded as.
    document.history.apply('Edit', () => ({ text: 'x' }))
    await document.save()
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(1)
  })

  it('does not let two saves in flight trade bases', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello', 0))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    const first = document.save()
    document.history.apply('Edit', () => ({ text: 'two' }))
    const second = document.save()
    expect((await first).status).toBe('saved')
    expect((await second).status).toBe('saved')
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(2)
  })

  it('stops autosaving after dispose', async () => {
    const { app, workspace, clock } = setup(true)
    await workspace.store.write('a.note', noteText('hello'))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    document.dispose()
    clock.advance(10_000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await workspace.journal.list()).toEqual([])
  })

  it('writes the journal after the debounce while the document is open', async () => {
    const { app, workspace, clock } = setup(true)
    await workspace.store.write('a.note', noteText('hello'))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    clock.advance(10_000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((await workspace.journal.list()).map((entry) => entry.path)).toEqual(['a.note.autosave'])
  })

  it('shows the device status, not saved, when the workspace keeps nothing on this device', async () => {
    const { workspace, registry, clock } = setup(true)
    await workspace.store.write('a.note', noteText('hello'))
    const app = createEditorApp({
      workspace: { ...workspace, persistent: false, reason: 'No private storage here.' },
      registry,
      ids: counterIds(),
      clock,
    })
    const document = await opened(app.open('a.note'))
    expect(document.session.status).toBe('device')
  })

  it('keeps the text of a Keep mine save as the base of the next save', async () => {
    const { app, workspace } = setup(true)
    await workspace.store.write('a.note', noteText('hello', 1))
    const document = await opened(app.open('a.note'))
    document.history.apply('Edit', () => ({ text: 'one' }))
    await workspace.store.write('a.note', noteText('theirs', 9))
    expect(await document.overwrite()).toEqual({ status: 'saved', path: 'a.note' })
    document.history.apply('Edit', () => ({ text: 'two' }))
    expect(await document.save()).toEqual({ status: 'saved', path: 'a.note' })
    expect(savedCount(textOf(await workspace.store.read('a.note')) ?? '')).toBe(3)
  })
})
