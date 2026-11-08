import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/level-2d/profiles.ts'
import type { ProjectStore } from '#src/shared/kit/storage/project-store.ts'
import type { Workspace } from '#src/shared/kit/storage/workspace.ts'
import { createEditorApp, type OpenDocument } from '#src/shared/level-2d/documents/editor-app.ts'
import { openProblem } from '#src/shared/level-2d/documents/open-flow-model.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { exportContent } from '#src/shared/level-2d/profiles/level-project/content-export.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// Save on a game checkout writes the game files a level project exports, then the project file itself.

const LIST = `format = "af-editors/1"

[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`
const PROJECT = 'content/rooms/mossgate.af2d.json'
const GAME_FILES = exportContent(mossgate()).map((file) => `content/${file.path}`)

/** A checkout: the memory workspace flagged as served, with every write to the store recorded in order. */
function checkout() {
  const clock = createTestClock()
  const base = memoryWorkspace(clock)
  const writes: string[] = []
  const failing = new Set<string>()
  const store: ProjectStore = {
    ...base.store,
    write: async (path, data, expected) => {
      if (failing.has(path)) return { ok: false, reason: 'io', message: `Could not write ${path}.` }
      writes.push(path)
      return base.store.write(path, data, expected)
    },
  }
  const workspace: Workspace = { ...base, store, served: true }
  return { clock, workspace, writes, failing, base }
}

async function open(setup: ReturnType<typeof checkout>, list: string | null = LIST): Promise<OpenDocument> {
  const { workspace, base, clock } = setup
  await base.store.write(PROJECT, printProject(mossgate()))
  if (list !== null) await base.store.write('content/editors.toml', list)
  setup.writes.length = 0
  clock.advance(1000)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const outcome = await app.open(PROJECT)
  if (outcome.status !== 'opened') throw new Error(outcome.status)
  return outcome.document
}

const rename = (document: OpenDocument): void =>
  document.history.apply('Rename', (project) => ({ ...(project as object), name: 'Mossgate 2' }))

describe('Save on a checkout whose row names exports', () => {
  it('writes the game files, then the project, with the bytes the export makes', async () => {
    const setup = checkout()
    const document = await open(setup)
    rename(document)
    expect(await document.save()).toMatchObject({ status: 'saved', path: PROJECT })
    expect(setup.writes).toEqual([...GAME_FILES, PROJECT])
    const project = JSON.parse(textOf(await setup.base.store.read(PROJECT)) ?? '{}')
    expect(project.name).toBe('Mossgate 2')
    const exported = exportContent(document.history.state as ReturnType<typeof mossgate>)
    for (const file of exported)
      expect(textOf(await setup.base.store.read(`content/${file.path}`)), file.path).toBe(file.contents)
  })

  it('writes again on the next save, because the files it wrote are the versions it now expects', async () => {
    const setup = checkout()
    const document = await open(setup)
    rename(document)
    await document.save()
    setup.writes.length = 0
    document.history.apply('Rename', (project) => ({ ...(project as object), name: 'Mossgate 3' }))
    expect(await document.save()).toMatchObject({ status: 'saved' })
    expect(setup.writes).toEqual([...GAME_FILES, PROJECT])
  })

  it('stops with a conflict, writing nothing, when a game file changed on disk since it was opened', async () => {
    const setup = checkout()
    const document = await open(setup)
    setup.clock.advance(1000)
    await setup.base.store.write('content/world.toml', '# edited by hand\n')
    rename(document)
    expect(await document.save()).toEqual({ status: 'conflict' })
    expect(setup.writes).toEqual([])
    expect(document.session.status).toBe('dirty')
  })

  it('Keep mine writes all of them over whatever is there', async () => {
    const setup = checkout()
    const document = await open(setup)
    setup.clock.advance(1000)
    await setup.base.store.write('content/world.toml', '# edited by hand\n')
    setup.writes.length = 0
    rename(document)
    expect(await document.overwrite()).toMatchObject({ status: 'saved' })
    expect(setup.writes).toEqual([...GAME_FILES, PROJECT])
    expect(textOf(await setup.base.store.read('content/world.toml'))).not.toContain('edited by hand')
  })

  it('on a failure part-way, keeps what was written, stays dirty, shows the store’s message, and the next Save writes everything', async () => {
    const setup = checkout()
    const document = await open(setup)
    rename(document)
    setup.failing.add('content/world.toml')
    const outcome = await document.save()
    expect(outcome).toMatchObject({ status: 'failed', message: 'Could not write content/world.toml.' })
    expect(setup.writes).not.toContain(PROJECT)
    expect(document.session.status).toBe('error')
    expect(document.session.problem?.message).toBe('Could not write content/world.toml.')
    setup.failing.clear()
    setup.writes.length = 0
    expect(await document.save()).toMatchObject({ status: 'saved' })
    expect(setup.writes).toEqual([...GAME_FILES, PROJECT])
  })

  it('writes a level added since the file was opened, as a new file', async () => {
    const setup = checkout()
    const document = await open(setup)
    document.history.apply('Add a level', (project) => {
      const value = project as ReturnType<typeof mossgate>
      const [first] = value.levels
      if (first === undefined) throw new Error('no level')
      return { ...value, levels: [...value.levels, { ...first, id: 'extra', name: 'Extra' }] }
    })
    expect(await document.save()).toMatchObject({ status: 'saved' })
    expect(textOf(await setup.base.store.read('content/levels/extra.toml'))).toContain('id = "extra"')
  })

  it('says the document saves the game files', async () => {
    expect((await open(checkout())).gameFolder).toBe('content')
  })
})

describe('Save without exports', () => {
  it('writes only the project in browser storage, even with an editor list in it', async () => {
    const setup = checkout()
    const document = await open({ ...setup, workspace: { ...setup.workspace, served: false } })
    rename(document)
    expect(await document.save()).toMatchObject({ status: 'saved' })
    expect(setup.writes).toEqual([PROJECT])
    expect(document.gameFolder).toBeUndefined()
  })

  it('writes only the project on a checkout whose row has no exports', async () => {
    const setup = checkout()
    const document = await open(setup, LIST.replace('exports = "content"\n', ''))
    rename(document)
    expect(await document.save()).toMatchObject({ status: 'saved' })
    expect(setup.writes).toEqual([PROJECT])
  })

  it('writes only the project on a checkout with no editor list, and when the list does not load', async () => {
    for (const list of [null, 'format = "nonsense"']) {
      const setup = checkout()
      const document = await open(setup, list)
      rename(document)
      expect(await document.save()).toMatchObject({ status: 'saved' })
      expect(setup.writes).toEqual([PROJECT])
    }
  })
})

describe('A new level on a checkout', () => {
  it('is made in the folder the editor list lets the editor write, and opens', async () => {
    const setup = checkout()
    await setup.base.store.write('content/editors.toml', LIST)
    const app = createEditorApp({
      workspace: setup.workspace,
      registry: createAppProfiles(),
      ids: counterIds(),
      clock: setup.clock,
    })
    const outcome = await app.create('level-project', 'platformer')
    expect(outcome).toMatchObject({ status: 'opened' })
    expect(setup.writes).toEqual(['content/rooms/untitled-platformer.af2d.json'])
  })

  it('says plainly where levels go when the list gives the editor no folder for one', async () => {
    const setup = checkout()
    await setup.base.store.write(
      'content/editors.toml',
      LIST.replace('content/rooms/*.af2d.json', 'content/rooms/room-1.af2d.json'),
    )
    const app = createEditorApp({
      workspace: setup.workspace,
      registry: createAppProfiles(),
      ids: counterIds(),
      clock: setup.clock,
    })
    const outcome = await app.create('level-project', 'platformer')
    expect(outcome).toMatchObject({ status: 'storageFailed', path: '' })
    expect(outcome.status === 'storageFailed' && openProblem(outcome)).toBe(
      'Your game has no folder for new levels yet. Add one to content/editors.toml, then try again.',
    )
    expect(setup.writes).toEqual([])
  })
})
