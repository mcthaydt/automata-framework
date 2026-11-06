import { describe, expect, it } from 'vitest'
import { counterIds } from '../../shared/level-2d/model/ids'
import { printProject } from '../../shared/level-2d/model/project-codec'
import { createProfileRegistry, type ProjectContext } from '../../shared/level-2d/profiles/profile'
import { memoryWorkspace, textOf } from '../../testing/level-2d/memory-workspace'
import { noteText, plantedProfile } from '../../testing/level-2d/planted-profile'
import { withDefs } from '../../testing/level-2d/project-edit'
import { hollowmere, mossgate } from '../../testing/level-2d/samples'
import { createTestClock } from '../../testing/level-2d/test-clock'
import { createEditorApp } from './editor-app'
import { createAppProfiles } from './profiles'
import { listProjects } from './project-list'

// The project list Home shows (plan ED2D.4c1 step 5): projects, not files.

function setup() {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createAppProfiles()
  registry.register(plantedProfile())
  // A second profile that claims `.both` files, which the planted note claims too.
  registry.register(plantedProfile({ id: 'other', label: 'Other', sniff: (name) => name.endsWith('.both') }))
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  const write = async (path: string, data: string | Uint8Array): Promise<void> => {
    clock.advance(1000)
    await workspace.store.write(path, data)
  }
  return { app, workspace, registry, clock, write }
}

describe('listProjects', () => {
  it('lists the projects of every profile, with what Home shows about each', async () => {
    const { workspace, registry, write } = setup()
    await write('mossgate.af2d.json', printProject(mossgate()))
    await write('empty.note', noteText(''))
    await write('bad.note', noteText('BAD'))
    const entries = await listProjects(workspace, registry)
    expect(entries.map((entry) => entry.path)).toEqual(['bad.note', 'empty.note', 'mossgate.af2d.json'])
    const [bad, empty, moss] = entries
    expect(bad).toMatchObject({
      status: 'ok',
      profile: { id: 'planted', label: 'Planted note' },
      errors: 1,
      warnings: 0,
    })
    expect(empty).toMatchObject({ status: 'ok', profile: { id: 'planted' }, errors: 0, warnings: 1 })
    expect(moss).toMatchObject({
      status: 'ok',
      profile: { id: 'level-project', label: 'Level project' },
      errors: 0,
      warnings: 0,
    })
  })

  it('carries the profile’s summary of a project that opens, and none for a profile without one', async () => {
    const { workspace, registry, write } = setup()
    await write('mossgate.af2d.json', printProject(mossgate()))
    await write('empty.note', noteText(''))
    const entries = await listProjects(workspace, registry)
    const moss = entries.find((entry) => entry.path === 'mossgate.af2d.json')
    const note = entries.find((entry) => entry.path === 'empty.note')
    expect(moss).toMatchObject({ status: 'ok', summary: { title: 'Mossgate' } })
    expect(moss?.status === 'ok' ? moss.summary?.facts.map((fact) => fact.label) : []).toEqual([
      'Levels',
      'Layers',
      'Entities',
      'Tilesets',
    ])
    expect(note).toMatchObject({ status: 'ok', summary: undefined })
  })

  it('carries the level the profile shows on a card, and none for a profile without previews', async () => {
    const { workspace, registry, write } = setup()
    await write('mossgate.af2d.json', printProject(mossgate()))
    await write('empty.note', noteText(''))
    const entries = await listProjects(workspace, registry)
    const moss = entries.find((entry) => entry.path === 'mossgate.af2d.json')
    const note = entries.find((entry) => entry.path === 'empty.note')
    expect(moss?.status === 'ok' ? moss.preview?.level : undefined).toBe(mossgate().levels[0]?.id)
    expect(moss?.status === 'ok' ? moss.preview?.project.name : undefined).toBe('Mossgate')
    expect(note).toMatchObject({ status: 'ok', preview: undefined })
  })

  it('stamps a preview with its images’ modification times, so a replaced image makes a new thumbnail', async () => {
    const { workspace, registry, write, clock } = setup()
    const withArt = withDefs(mossgate(), (defs) => ({
      ...defs,
      tilesets: defs.tilesets.map((set) => ({ ...set, image: 'assets/terrain.png' })),
    }))
    await write('mossgate.af2d.json', printProject(withArt))
    const stampOf = async () => {
      const entry = (await listProjects(workspace, registry)).find(
        (item) => item.path === 'mossgate.af2d.json',
      )
      return entry?.status === 'ok' ? entry.preview?.images : undefined
    }
    expect(await stampOf()).toBe('assets/terrain.png@missing')
    await write('assets/terrain.png', new Uint8Array([1]))
    const first = await stampOf()
    expect(first).toBe(`assets/terrain.png@${clock.now()}`)
    await write('assets/terrain.png', new Uint8Array([2]))
    expect(await stampOf()).not.toBe(first)
  })

  it('carries the store’s size and modification time', async () => {
    const { workspace, registry, write } = setup()
    const text = noteText('x')
    await write('a.note', text)
    const stored = (await workspace.store.list())[0]
    const [entry] = await listProjects(workspace, registry)
    expect(entry).toMatchObject({ size: new TextEncoder().encode(text).byteLength, mtime: stored?.mtime })
  })

  it('names a file by its last path segment, so a profile that sniffs the name claims one in a folder', async () => {
    const { workspace, registry, write } = setup()
    registry.register(
      plantedProfile({
        id: 'sheet',
        label: 'Sheet',
        sniff: (name) => name.startsWith('sheet-'),
        parse: () => ({ ok: true, value: { text: '' } }),
      }),
    )
    await write('folder/deeper/sheet-1.dat', 'rows')
    const [entry] = await listProjects(workspace, registry)
    expect(entry).toMatchObject({ path: 'folder/deeper/sheet-1.dat', status: 'ok', profile: { id: 'sheet' } })
  })

  it('puts the most recently changed first, then by path', async () => {
    const { workspace, registry, write } = setup()
    await write('old.note', noteText('a'))
    await write('b.note', noteText('b'))
    await write('new.note', noteText('c'))
    const paths = async (): Promise<string[]> =>
      (await listProjects(workspace, registry)).map((entry) => entry.path)
    expect(await paths()).toEqual(['new.note', 'b.note', 'old.note'])
    // Written in the same millisecond as new.note, so the two tie on time and the path decides.
    await workspace.store.write('a.note', noteText('d'))
    expect(await paths()).toEqual(['a.note', 'new.note', 'b.note', 'old.note'])
  })

  it('leaves out files no profile claims, however they look', async () => {
    const { workspace, registry, write } = setup()
    await write('readme.txt', 'hello')
    await write('picture.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff]))
    await write('assets/tiles.png', new Uint8Array([1, 2, 3]))
    expect(await listProjects(workspace, registry)).toEqual([])
  })

  it('lists a claimed file that does not open as broken, with the first reason', async () => {
    const { workspace, registry, write } = setup()
    await write('broken.af2d.json', '{\n  "format": "af2d",\n  oops\n}')
    await write('bin.note', new Uint8Array([0xff, 0xfe]))
    await write('huge.note', new Uint8Array(16 * 1024 * 1024 + 1))
    const entries = await listProjects(workspace, registry)
    expect(entries.map((entry) => [entry.path, entry.status])).toEqual([
      ['huge.note', 'broken'],
      ['bin.note', 'broken'],
      ['broken.af2d.json', 'broken'],
    ])
    expect(entries.map((entry) => (entry.status === 'broken' ? entry.message : ''))).toEqual([
      'The file is over 16 MB.',
      'The file is not text.',
      expect.stringContaining('JSON'),
    ])
    expect(entries[2]).toMatchObject({ profile: { id: 'level-project' } })
    expect(entries[0]).toMatchObject({ profile: { id: 'planted' } })
  })

  it('lists a file two profiles claim as ambiguous, with the candidates in registration order', async () => {
    const { workspace, registry, write } = setup()
    await write('x.both', noteText('x'))
    const [entry] = await listProjects(workspace, registry)
    expect(entry).toEqual({
      status: 'ambiguous',
      path: 'x.both',
      size: expect.any(Number),
      mtime: expect.any(Number),
      candidates: [
        { id: 'planted', label: 'Planted note' },
        { id: 'other', label: 'Other' },
      ],
    })
  })

  it('gives each check the workspace’s file paths as the assets', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const seen: (readonly string[] | undefined)[] = []
    const registry = createProfileRegistry()
    registry.register(
      plantedProfile({
        check: (_note, context: ProjectContext) => {
          seen.push(context.assets)
          return []
        },
      }),
    )
    await workspace.store.write('a.note', noteText('a'))
    await workspace.store.write('assets/tiles.png', new Uint8Array([1]))
    await listProjects(workspace, registry)
    expect(seen).toEqual([['a.note', 'assets/tiles.png']])
  })

  it('lists a claimed file the store cannot read as broken and the rest as usual', async () => {
    const { workspace, registry, write } = setup()
    await write('a.note', noteText('a'))
    await write('b.note', noteText('b'))
    const flaky = {
      ...workspace.store,
      read: (path: string) =>
        path === 'a.note'
          ? Promise.reject(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' }))
          : workspace.store.read(path),
    }
    const entries = await listProjects({ ...workspace, store: flaky }, registry)
    expect(entries.map((entry) => [entry.path, entry.status])).toEqual([
      ['b.note', 'ok'],
      ['a.note', 'broken'],
    ])
    expect(entries[1]).toMatchObject({ message: 'Not allowed' })
  })

  it('does not guess a profile for an unreadable file whose name two profiles claim', async () => {
    const { workspace, write } = setup()
    const registry = createProfileRegistry()
    registry.register(plantedProfile({ sniff: (name) => name.endsWith('.dup') }))
    registry.register(plantedProfile({ id: 'twin', label: 'Twin', sniff: (name) => name.endsWith('.dup') }))
    await write('x.dup', new Uint8Array([0xff, 0xfe]))
    expect(await listProjects(workspace, registry)).toEqual([])
  })

  it('skips a listed file that is gone by the time it is read', async () => {
    const { workspace, registry, write } = setup()
    await write('a.note', noteText('a'))
    const vanishing = { ...workspace.store, read: () => Promise.resolve(undefined) }
    expect(await listProjects({ ...workspace, store: vanishing }, registry)).toEqual([])
  })

  it('still says the file is broken when the profile gives no reason', async () => {
    const { workspace, write } = setup()
    const registry = createProfileRegistry()
    registry.register(plantedProfile({ parse: () => ({ ok: false, error: [] }) }))
    await write('a.note', noteText('a'))
    expect(await listProjects(workspace, registry)).toMatchObject([
      { status: 'broken', message: 'The file does not open.' },
    ])
  })

  it('names a profile by its id and label alone', async () => {
    const { workspace, registry, write } = setup()
    await write('a.note', noteText('a'))
    await write('x.both', noteText('x'))
    await write('broken.af2d.json', '{')
    const entries = await listProjects(workspace, registry)
    const refs = entries.flatMap((entry) =>
      entry.status === 'ambiguous' ? entry.candidates : [entry.profile],
    )
    expect(refs).toHaveLength(4)
    for (const ref of refs) expect(Object.keys(ref).sort()).toEqual(['id', 'label'])
  })

  it('rejects when the workspace cannot be listed at all, so Home can say so', async () => {
    const { workspace, registry } = setup()
    const denied = { ...workspace.store, list: () => Promise.reject(new Error('gone')) }
    await expect(listProjects({ ...workspace, store: denied }, registry)).rejects.toThrow('gone')
  })
})

describe('the app’s list, duplicate and remove', () => {
  it('list is listProjects over the app’s workspace and registry', async () => {
    const { app, write } = setup()
    await write('hollowmere.af2d.json', printProject(hollowmere()))
    expect((await app.list()).map((entry) => entry.path)).toEqual(['hollowmere.af2d.json'])
  })

  it('duplicate copies the bytes to the first unused “copy” name, and the list shows both', async () => {
    const { app, workspace, write } = setup()
    const text = printProject(mossgate())
    await write('mossgate.af2d.json', text)
    expect(await app.duplicate('mossgate.af2d.json')).toEqual({
      status: 'copied',
      path: 'mossgate copy.af2d.json',
    })
    expect(await app.duplicate('mossgate.af2d.json')).toEqual({
      status: 'copied',
      path: 'mossgate copy 2.af2d.json',
    })
    expect(textOf(await workspace.store.read('mossgate copy.af2d.json'))).toBe(text)
    expect((await app.list()).map((entry) => entry.path).sort()).toEqual([
      'mossgate copy 2.af2d.json',
      'mossgate copy.af2d.json',
      'mossgate.af2d.json',
    ])
  })

  it('duplicate also copies a file that does not open, byte for byte', async () => {
    const { app, workspace, write } = setup()
    await write('broken.af2d.json', '{ nope')
    expect(await app.duplicate('broken.af2d.json')).toEqual({
      status: 'copied',
      path: 'broken copy.af2d.json',
    })
    expect(textOf(await workspace.store.read('broken copy.af2d.json'))).toBe('{ nope')
  })

  it('duplicate keeps the file in its folder, and says missing for a path with no file', async () => {
    const { app, write } = setup()
    await write('notes/a.note', noteText('a'))
    expect(await app.duplicate('notes/a.note')).toEqual({ status: 'copied', path: 'notes/a copy.note' })
    expect(await app.duplicate('nope.note')).toEqual({ status: 'missing', path: 'nope.note' })
  })

  it('duplicate numbers a file in a folder whose name has a dot', async () => {
    const { app, write } = setup()
    await write('v1.2/a.note', noteText('a'))
    expect(await app.duplicate('v1.2/a.note')).toEqual({ status: 'copied', path: 'v1.2/a copy.note' })
  })

  it('duplicate reports a store that refuses, and writes nothing', async () => {
    const { workspace, registry, write } = setup()
    await write('a.note', noteText('a'))
    const full = {
      ...workspace.store,
      write: () => Promise.resolve({ ok: false as const, reason: 'quota' as const, message: 'Disk full.' }),
    }
    const app = createEditorApp({ workspace: { ...workspace, store: full }, registry, ids: counterIds() })
    expect(await app.duplicate('a.note')).toEqual({
      status: 'failed',
      path: 'a.note',
      reason: 'quota',
      message: 'Disk full.',
    })
  })

  it('remove deletes the file and its autosave, and the list drops it', async () => {
    const { app, workspace, write, clock } = setup()
    await write('a.note', noteText('a'))
    const outcome = await app.open('a.note')
    if (outcome.status !== 'opened') throw new Error(outcome.status)
    outcome.document.history.apply('Edit', () => ({ text: 'b' }))
    clock.advance(1000)
    await outcome.document.session.flush()
    outcome.document.dispose()
    expect(await workspace.journal.list()).toHaveLength(1)
    await app.remove('a.note')
    expect(await workspace.store.list()).toEqual([])
    expect(await workspace.journal.list()).toEqual([])
    expect(await app.list()).toEqual([])
  })

  it('remove of a path with no file is not an error', async () => {
    const { app } = setup()
    await expect(app.remove('nope.note')).resolves.toBeUndefined()
  })
})
