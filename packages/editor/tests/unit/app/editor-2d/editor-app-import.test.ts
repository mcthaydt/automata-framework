import { describe, expect, it } from 'vitest'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { MAX_FILE_CHARS } from '#src/shared/level-2d/model/open-project.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// Importing a file the person picked (plan ED2D.4c2a step 3): the files a profile claims are kept in the workspace, the
// rest are refused with nothing written.

function setup() {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createAppProfiles()
  registry.register(plantedProfile())
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  return { app, workspace, registry, clock }
}

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text)
const paths = async (workspace: ReturnType<typeof setup>['workspace']): Promise<string[]> =>
  (await workspace.store.list()).map((entry) => entry.path)

describe('importFile', () => {
  it('keeps a project byte for byte under its own name, and Home lists it', async () => {
    const { app, workspace } = setup()
    const text = printProject(mossgate())
    expect(await app.importFile('mossgate.af2d.json', bytesOf(text))).toEqual({
      status: 'imported',
      name: 'mossgate.af2d.json',
      path: 'mossgate.af2d.json',
    })
    expect(textOf(await workspace.store.read('mossgate.af2d.json'))).toBe(text)
    expect((await app.list()).map((entry) => [entry.path, entry.status])).toEqual([
      ['mossgate.af2d.json', 'ok'],
    ])
    expect((await app.open('mossgate.af2d.json')).status).toBe('opened')
  })

  it('numbers a taken name before the extension, keeping a compound extension whole', async () => {
    const { app } = setup()
    const bytes = bytesOf(printProject(mossgate()))
    const first = await app.importFile('mossgate.af2d.json', bytes)
    const second = await app.importFile('mossgate.af2d.json', bytes)
    const third = await app.importFile('mossgate.af2d.json', bytes)
    expect([first, second, third].map((outcome) => outcome.status === 'imported' && outcome.path)).toEqual([
      'mossgate.af2d.json',
      'mossgate 2.af2d.json',
      'mossgate 3.af2d.json',
    ])
    expect(second).toMatchObject({ name: 'mossgate.af2d.json' })
  })

  it('does not take over a file whose name only starts the same', async () => {
    const { app, workspace } = setup()
    await workspace.store.write('mossgate 2.af2d.json', 'x')
    const outcome = await app.importFile('mossgate.af2d.json', bytesOf(printProject(mossgate())))
    expect(outcome).toMatchObject({ status: 'imported', path: 'mossgate.af2d.json' })
  })

  it('keeps a project that does not open, so the person can see why', async () => {
    const { app, workspace } = setup()
    expect(await app.importFile('broken.af2d.json', bytesOf('{ nope'))).toMatchObject({
      status: 'imported',
      path: 'broken.af2d.json',
    })
    expect(textOf(await workspace.store.read('broken.af2d.json'))).toBe('{ nope')
    expect((await app.list()).map((entry) => entry.status)).toEqual(['broken'])
  })

  it('keeps a file another profile claims, and a file two profiles claim', async () => {
    const { app, registry } = setup()
    registry.register(
      plantedProfile({ id: 'other', label: 'Other', sniff: (name) => name.endsWith('.both') }),
    )
    expect(await app.importFile('a.note', bytesOf(noteText('a')))).toMatchObject({ status: 'imported' })
    expect(await app.importFile('c.both', bytesOf(noteText('c')))).toMatchObject({ status: 'imported' })
  })

  it('refuses a file no profile claims, and writes nothing', async () => {
    const { app, workspace } = setup()
    expect(await app.importFile('readme.txt', bytesOf('hello'))).toEqual({
      status: 'refused',
      name: 'readme.txt',
      reason: 'unrecognised',
    })
    expect(await paths(workspace)).toEqual([])
  })

  it('refuses bytes that are not text, even under a name a profile claims', async () => {
    const { app, workspace } = setup()
    expect(await app.importFile('bin.af2d.json', new Uint8Array([0xff, 0xfe, 0x00]))).toEqual({
      status: 'refused',
      name: 'bin.af2d.json',
      reason: 'notText',
    })
    expect(await paths(workspace)).toEqual([])
  })

  it('refuses a file over 16 MB, and writes nothing', async () => {
    const { app, workspace } = setup()
    const outcome = await app.importFile('huge.af2d.json', new Uint8Array(MAX_FILE_CHARS + 1))
    expect(outcome).toEqual({ status: 'refused', name: 'huge.af2d.json', reason: 'tooLarge' })
    expect(await paths(workspace)).toEqual([])
  })

  it('names the file by its last path segment, so a picker that hands a folder path still lands in the workspace root', async () => {
    const { app } = setup()
    const outcome = await app.importFile('Downloads/mossgate.af2d.json', bytesOf(printProject(mossgate())))
    expect(outcome).toEqual({
      status: 'imported',
      name: 'mossgate.af2d.json',
      path: 'mossgate.af2d.json',
    })
  })

  it('says failed, with the reason, when the store is full or refuses', async () => {
    const { workspace, registry } = setup()
    const full = {
      ...workspace.store,
      write: () => Promise.resolve({ ok: false as const, reason: 'quota' as const, message: 'Disk full.' }),
    }
    const app = createEditorApp({ workspace: { ...workspace, store: full }, registry, ids: counterIds() })
    expect(await app.importFile('mossgate.af2d.json', bytesOf(printProject(mossgate())))).toEqual({
      status: 'failed',
      name: 'mossgate.af2d.json',
      reason: 'quota',
      message: 'Disk full.',
    })
    const denied = {
      ...workspace.store,
      list: () => Promise.reject(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' })),
    }
    const locked = createEditorApp({
      workspace: { ...workspace, store: denied },
      registry,
      ids: counterIds(),
    })
    expect(await locked.importFile('mossgate.af2d.json', bytesOf(printProject(mossgate())))).toEqual({
      status: 'failed',
      name: 'mossgate.af2d.json',
      reason: 'denied',
      message: 'Not allowed',
    })
  })
})
