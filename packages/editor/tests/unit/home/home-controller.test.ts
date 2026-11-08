import { describe, expect, it, vi } from 'vitest'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { createHomeController, type HomeState, type LastOpened } from '#src/features/home/home-controller.ts'
import { createToasts, type ToastStore } from '#src/shared/kit/widgets/toasts.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import type { EditorApp, OpenOutcome, ProjectEntry } from '#src/shared/level-2d/session/editor-app-types.ts'
import type { ChoiceOutcome, PanelOutcome } from '#src/shared/level-2d/session/open-flow-model.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// The state machine behind Home (plan ED2D.4c2a step 5), over a memory workspace, the real level project and a planted
// second profile. The controller never navigates: it tells its owner when a document opened.

type Opened = Extract<OpenOutcome, { status: 'opened' }>

function setup(wrap: (app: EditorApp) => EditorApp = (app) => app, lastOpened?: LastOpened) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createAppProfiles()
  registry.register(plantedProfile())
  const real = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  const app = wrap(real)
  const toasts: ToastStore = createToasts({ clock })
  const opened: Opened[] = []
  const problems: (PanelOutcome | ChoiceOutcome)[] = []
  const controller = createHomeController({
    app,
    toasts,
    onOpened: (outcome) => opened.push(outcome),
    onProblem: (outcome) => problems.push(outcome),
    ...(lastOpened === undefined ? {} : { lastOpened }),
  })
  const write = async (path: string, data: string | Uint8Array): Promise<void> => {
    clock.advance(1000)
    await workspace.store.write(path, data)
  }
  const state = (): HomeState => {
    let current: HomeState | undefined
    controller.state.subscribe((value) => {
      current = value
    })()
    if (current === undefined) throw new Error('the store gave no state')
    return current
  }
  const messages = (): string[] => toasts.items.map((toast) => `${toast.kind}: ${toast.message}`)
  return { clock, workspace, registry, app, controller, toasts, opened, problems, write, state, messages }
}

async function seeded() {
  const harness = setup()
  await harness.write('mossgate.af2d.json', printProject(mossgate()))
  await harness.write('hollowmere.af2d.json', printProject(hollowmere()))
  await harness.write('notes/harbour.note', noteText('harbour'))
  await harness.controller.refresh()
  return harness
}

const paths = (state: HomeState): string[] => state.visible.map((entry) => entry.path)

describe('state', () => {
  it('starts loading and empty, and the store gives its state at once and after each change', async () => {
    const { controller, state } = setup()
    expect(state()).toEqual({
      phase: 'loading',
      entries: [],
      visible: [],
      query: '',
      selected: undefined,
      busy: undefined,
      message: undefined,
    })
    const seen: string[] = []
    const stop = controller.state.subscribe((value) => seen.push(value.phase))
    await controller.refresh()
    stop()
    await controller.refresh()
    expect(seen).toEqual(['loading', 'ready'])
  })

  it('lists the projects newest first and selects the first', async () => {
    const { state } = await seeded()
    expect(state().phase).toBe('ready')
    expect(paths(state())).toEqual(['notes/harbour.note', 'hollowmere.af2d.json', 'mossgate.af2d.json'])
    expect(state().selected).toBe('notes/harbour.note')
    expect(state().entries).toBe(state().visible)
  })

  it('is ready with nothing selected for an empty workspace', async () => {
    const { controller, state } = setup()
    await controller.refresh()
    expect(state()).toMatchObject({ phase: 'ready', entries: [], selected: undefined })
  })
})

describe('the last open project (ED2D.8)', () => {
  const remembering = (initial: string | undefined) => {
    let path = initial
    const writes: string[] = []
    const lastOpened: LastOpened = {
      read: () => path,
      write: (next) => {
        path = next
        writes.push(next)
      },
    }
    return { lastOpened, writes }
  }
  const seed = async (harness: ReturnType<typeof setup>) => {
    await harness.write('mossgate.af2d.json', printProject(mossgate()))
    await harness.write('hollowmere.af2d.json', printProject(hollowmere()))
    await harness.controller.refresh()
  }

  it('selects the project opened last time on the first listing instead of the newest', async () => {
    const harness = setup(undefined, remembering('mossgate.af2d.json').lastOpened)
    await seed(harness)
    expect(harness.state().selected).toBe('mossgate.af2d.json')
  })

  it('falls back to the newest when that project is gone, and keeps the person’s own choice on later listings', async () => {
    const gone = setup(undefined, remembering('deleted.af2d.json').lastOpened)
    await seed(gone)
    expect(gone.state().selected).toBe('hollowmere.af2d.json')
    const harness = setup(undefined, remembering('mossgate.af2d.json').lastOpened)
    await seed(harness)
    harness.controller.select('hollowmere.af2d.json')
    await harness.controller.refresh()
    expect(harness.state().selected).toBe('hollowmere.af2d.json')
  })

  it('writes the path of a project that opens, and nothing for one that does not', async () => {
    const { lastOpened, writes } = remembering(undefined)
    const harness = setup(undefined, lastOpened)
    await seed(harness)
    await harness.controller.open('mossgate.af2d.json')
    expect(writes).toEqual(['mossgate.af2d.json'])
    await harness.controller.open('missing.af2d.json')
    expect(writes).toEqual(['mossgate.af2d.json'])
  })
})

describe('refresh', () => {
  it('says the list is unavailable, with the store’s reason, and recovers on the next try', async () => {
    let failing = true
    const { controller, state, write } = setup((app) => ({
      ...app,
      list: () =>
        failing
          ? Promise.reject(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' }))
          : app.list(),
    }))
    await write('mossgate.af2d.json', printProject(mossgate()))
    await controller.refresh()
    expect(state()).toMatchObject({
      phase: 'unavailable',
      message: 'Not allowed',
      entries: [],
      selected: undefined,
    })
    failing = false
    await controller.refresh()
    expect(state()).toMatchObject({ phase: 'ready', message: undefined })
    expect(paths(state())).toEqual(['mossgate.af2d.json'])
  })

  it('stops showing the old list when the workspace can no longer be read', async () => {
    let failing = false
    const { controller, state, write } = setup((app) => ({
      ...app,
      list: () => (failing ? Promise.reject(new Error('gone')) : app.list()),
    }))
    await write('mossgate.af2d.json', printProject(mossgate()))
    await controller.refresh()
    expect(paths(state())).toEqual(['mossgate.af2d.json'])
    failing = true
    await controller.refresh()
    expect(state()).toMatchObject({
      phase: 'unavailable',
      entries: [],
      visible: [],
      selected: undefined,
    })
  })

  it('shows it is loading again, with no old reason, while a retry runs', async () => {
    const calls: Array<{
      resolve: (entries: readonly ProjectEntry[]) => void
      reject: (error: Error) => void
    }> = []
    const { controller, state } = setup((real) => ({
      ...real,
      list: () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    }))
    const first = controller.refresh()
    calls[0]?.reject(new Error('Not allowed'))
    await first
    expect(state()).toMatchObject({ phase: 'unavailable', message: 'Not allowed' })
    const retry = controller.refresh()
    expect(state()).toMatchObject({ phase: 'loading', message: undefined })
    calls[1]?.resolve([])
    await retry
    expect(state()).toMatchObject({ phase: 'ready', message: undefined })
  })

  it('keeps showing the list while it reloads', async () => {
    const { controller } = await seeded()
    const phases: string[] = []
    const stop = controller.state.subscribe((value) => phases.push(`${value.phase}:${value.entries.length}`))
    await controller.refresh()
    stop()
    expect(new Set(phases)).toEqual(new Set(['ready:3']))
  })

  it('drops the result of an older reload that finishes after a newer one', async () => {
    const calls: Array<(entries: readonly ProjectEntry[]) => void> = []
    const { controller, state } = setup((real) => ({
      ...real,
      list: () => new Promise((resolve) => calls.push(resolve)),
    }))
    const older = controller.refresh()
    const newer = controller.refresh()
    calls[1]?.([])
    await newer
    expect(state()).toMatchObject({ phase: 'ready', entries: [] })
    calls[0]?.([
      {
        status: 'ok',
        path: 'stale.note',
        size: 1,
        mtime: 1,
        profile: { id: 'planted', label: 'Planted note' },
        errors: 0,
        warnings: 0,
        summary: undefined,
        preview: undefined,
      },
    ])
    await older
    expect(state()).toMatchObject({ phase: 'ready', entries: [] })
  })

  it('drops the failure of an older reload that finishes after a newer one', async () => {
    const calls: Array<{
      resolve: (entries: readonly ProjectEntry[]) => void
      reject: (error: Error) => void
    }> = []
    const { controller, state } = setup((real) => ({
      ...real,
      list: () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    }))
    const older = controller.refresh()
    const newer = controller.refresh()
    calls[1]?.resolve([])
    await newer
    calls[0]?.reject(new Error('late'))
    await older
    expect(state()).toMatchObject({ phase: 'ready', entries: [], message: undefined })
  })
})

describe('search, select and step', () => {
  it('narrows the list, keeps a selection that still shows and falls to the first match when it does not', async () => {
    const { controller, state } = await seeded()
    controller.select('mossgate.af2d.json')
    controller.search('af2d')
    expect(paths(state())).toEqual(['hollowmere.af2d.json', 'mossgate.af2d.json'])
    expect(state().selected).toBe('mossgate.af2d.json')
    controller.search('hollow')
    expect(paths(state())).toEqual(['hollowmere.af2d.json'])
    expect(state().selected).toBe('hollowmere.af2d.json')
    expect(state().query).toBe('hollow')
    expect(state().entries).toHaveLength(3)
  })

  it('selects nothing when nothing matches and everything again when the search is cleared', async () => {
    const { controller, state } = await seeded()
    controller.search('zebra')
    expect(state()).toMatchObject({ visible: [], selected: undefined })
    controller.search('')
    expect(state().visible).toHaveLength(3)
    expect(state().selected).toBe('notes/harbour.note')
  })

  it('selects only what is shown', async () => {
    const { controller, state } = await seeded()
    controller.select('mossgate.af2d.json')
    expect(state().selected).toBe('mossgate.af2d.json')
    controller.select('nope.note')
    expect(state().selected).toBe('mossgate.af2d.json')
    controller.search('hollow')
    controller.select('mossgate.af2d.json')
    expect(state().selected).toBe('hollowmere.af2d.json')
  })

  it('steps through the shown list', async () => {
    const { controller, state } = await seeded()
    controller.step('ArrowDown')
    expect(state().selected).toBe('hollowmere.af2d.json')
    controller.step('End')
    expect(state().selected).toBe('mossgate.af2d.json')
    controller.step('ArrowLeft')
    expect(state().selected).toBe('hollowmere.af2d.json')
    controller.step('Home')
    expect(state().selected).toBe('notes/harbour.note')
  })
})

describe('open', () => {
  it('opens the path it is given, selects it and tells its owner', async () => {
    const { controller, state, opened } = await seeded()
    await controller.open('mossgate.af2d.json')
    expect(opened).toHaveLength(1)
    expect(opened[0]?.document.path).toBe('mossgate.af2d.json')
    expect(state().selected).toBe('mossgate.af2d.json')
    expect(state().busy).toBeUndefined()
  })

  it('opens the selection when it is given no path, and does nothing with no selection', async () => {
    const { controller, opened } = await seeded()
    await controller.open()
    expect(opened[0]?.document.path).toBe('notes/harbour.note')
    const empty = setup()
    await empty.controller.refresh()
    await empty.controller.open()
    expect(empty.opened).toEqual([])
    expect(empty.messages()).toEqual([])
  })

  it('hands a file no profile claims to its owner for the error panel, with no toast, and reads the list again', async () => {
    const { controller, opened, problems, write, messages, app } = await seeded()
    await write('readme.txt', 'hello')
    await controller.refresh()
    const list = vi.spyOn(app, 'list')
    await controller.open('readme.txt')
    expect(opened).toEqual([])
    expect(problems).toEqual([{ status: 'unrecognised', path: 'readme.txt', text: 'hello' }])
    expect(messages()).toEqual([])
    expect(list).toHaveBeenCalledOnce()
  })

  it('hands a file two profiles claim to its owner for the choice, and opens it with the one chosen', async () => {
    const { controller, opened, problems, write, registry } = await seeded()
    registry.register(plantedProfile({ id: 'rival', label: 'Rival note' }))
    await write('both.note', noteText('both'))
    await controller.refresh()
    await controller.open('both.note')
    expect(problems).toEqual([expect.objectContaining({ status: 'choose', path: 'both.note' })])
    await controller.open('both.note', 'rival')
    expect(opened).toHaveLength(1)
    expect(opened[0]?.document.profile.id).toBe('rival')
  })

  it('refreshes the list when the file was already gone', async () => {
    const { controller, workspace, state, messages } = await seeded()
    await workspace.store.remove('mossgate.af2d.json')
    await controller.open('mossgate.af2d.json')
    expect(messages()).toEqual(['error: mossgate.af2d.json is no longer in this workspace.'])
    expect(paths(state())).toEqual(['notes/harbour.note', 'hollowmere.af2d.json'])
  })

  it('hands a project that does not open to its owner with the profile’s errors', async () => {
    const { controller, write, problems, messages } = await seeded()
    await write('broken.af2d.json', '{ nope')
    await controller.refresh()
    await controller.open('broken.af2d.json')
    expect(problems).toEqual([expect.objectContaining({ status: 'invalid', path: 'broken.af2d.json' })])
    expect(messages()).toEqual([])
  })
})

describe('create', () => {
  it('makes the file from the template and tells its owner, without listing it yet', async () => {
    const { controller, opened, workspace } = setup()
    await controller.refresh()
    await controller.create('level-project', 'blank')
    expect(opened).toHaveLength(1)
    expect(opened[0]?.document.profile.id).toBe('level-project')
    expect((await workspace.store.list()).map((entry) => entry.path)).toEqual([opened[0]?.document.path])
  })

  it('says why when the store refuses, and writes nothing', async () => {
    const clock = createTestClock()
    const base = memoryWorkspace(clock)
    const full = {
      ...base,
      store: {
        ...base.store,
        write: () => Promise.resolve({ ok: false as const, reason: 'quota' as const, message: 'Disk full.' }),
      },
    }
    const app = createEditorApp({ workspace: full, registry: createAppProfiles(), ids: counterIds(), clock })
    const toasts = createToasts({ clock })
    const opened: Opened[] = []
    const controller = createHomeController({
      app,
      toasts,
      onOpened: (outcome) => opened.push(outcome),
      onProblem: () => {},
    })
    await controller.refresh()
    await controller.create('level-project', 'blank')
    expect(opened).toEqual([])
    expect(toasts.items.map((toast) => toast.message)).toEqual(['untitled-project.af2d.json: Disk full.'])
    expect(await base.store.list()).toEqual([])
  })
})

describe('duplicate', () => {
  it('copies the selection, says where, lists both and selects the copy', async () => {
    const { controller, state, messages } = await seeded()
    controller.select('mossgate.af2d.json')
    await controller.duplicate()
    expect(messages()).toEqual(['ok: Copied to mossgate copy.af2d.json.'])
    expect(paths(state())).toContain('mossgate copy.af2d.json')
    expect(paths(state())).toContain('mossgate.af2d.json')
    expect(state().selected).toBe('mossgate copy.af2d.json')
  })

  it('keeps the selection when the search hides the copy', async () => {
    const { controller, state } = await seeded()
    controller.select('mossgate.af2d.json')
    controller.search('mossgate.af2d')
    await controller.duplicate()
    expect(paths(state())).toEqual(['mossgate.af2d.json'])
    expect(state().selected).toBe('mossgate.af2d.json')
  })

  it('does nothing without a selection', async () => {
    const { controller, messages } = setup()
    await controller.refresh()
    await controller.duplicate()
    expect(messages()).toEqual([])
  })

  it('reports a file that is gone and refreshes the list', async () => {
    const { controller, workspace, messages, state } = await seeded()
    controller.select('hollowmere.af2d.json')
    await workspace.store.remove('hollowmere.af2d.json')
    await controller.duplicate()
    expect(messages()).toEqual(['error: hollowmere.af2d.json is no longer in this workspace.'])
    expect(paths(state())).toEqual(['notes/harbour.note', 'mossgate.af2d.json'])
  })
})

describe('remove', () => {
  it('deletes the file and its autosave and moves the selection to the next project', async () => {
    const { controller, state, workspace, messages, app } = await seeded()
    controller.select('hollowmere.af2d.json')
    const outcome = await app.open('hollowmere.af2d.json')
    if (outcome.status !== 'opened') throw new Error('hollowmere did not open')
    outcome.document.history.apply('Edit', (project) => ({ ...(project as Project), name: 'Edited' }))
    await outcome.document.session.flush()
    outcome.document.dispose()
    expect(await workspace.journal.list()).toHaveLength(1)
    await controller.remove()
    expect(paths(state())).toEqual(['notes/harbour.note', 'mossgate.af2d.json'])
    expect(state().selected).toBe('mossgate.af2d.json')
    expect(await workspace.journal.list()).toEqual([])
    expect(messages()).toEqual(['info: Deleted hollowmere.af2d.json.'])
  })

  it('moves back to the previous project when the last one goes, and to nothing when none is left', async () => {
    const { controller, state } = await seeded()
    controller.select('mossgate.af2d.json')
    await controller.remove()
    expect(state().selected).toBe('hollowmere.af2d.json')
    await controller.remove()
    await controller.remove()
    expect(state().entries).toEqual([])
    expect(state().selected).toBeUndefined()
    await controller.remove()
    expect(state().entries).toEqual([])
  })
})

describe('importFiles', () => {
  const file = (name: string, text: string) => ({ name, bytes: new TextEncoder().encode(text) })

  it('keeps the files a profile claims, says so, and selects the last one', async () => {
    const { controller, state, messages } = await seeded()
    await controller.importFiles([file('new.note', noteText('n'))])
    expect(messages()).toEqual(['ok: Imported new.note.'])
    expect(paths(state())).toContain('new.note')
    expect(state().selected).toBe('new.note')
  })

  it('names every file it refused and counts those it kept', async () => {
    const { controller, messages, state } = await seeded()
    await controller.importFiles([
      file('a.note', noteText('a')),
      file('b.note', noteText('b')),
      file('r.txt', 'hello'),
    ])
    expect(messages()).toEqual(['ok: Imported 2 files.', 'error: r.txt is not a project this editor opens.'])
    expect(state().selected).toBe('b.note')
  })

  it('does nothing for no files: it is not busy and does not read the workspace again', async () => {
    const list = vi.fn()
    const { controller, messages } = setup((real) => ({
      ...real,
      list: () => {
        list()
        return real.list()
      },
    }))
    await controller.refresh()
    const busy: Array<string | undefined> = []
    const stop = controller.state.subscribe((value) => busy.push(value.busy))
    await controller.importFiles([])
    stop()
    expect(busy).toEqual([undefined])
    expect(list).toHaveBeenCalledTimes(1)
    expect(messages()).toEqual([])
  })

  it('keeps the selection when the search hides what was kept', async () => {
    const { controller, state, messages } = await seeded()
    controller.select('mossgate.af2d.json')
    controller.search('af2d')
    await controller.importFiles([file('new.note', noteText('n'))])
    expect(messages()).toEqual(['ok: Imported new.note.'])
    expect(paths(state())).toEqual(['hollowmere.af2d.json', 'mossgate.af2d.json'])
    expect(state().selected).toBe('mossgate.af2d.json')
  })

  it('keeps the selection when nothing was kept', async () => {
    const { controller, state } = await seeded()
    controller.select('mossgate.af2d.json')
    await controller.importFiles([file('r.txt', 'hello')])
    expect(state().selected).toBe('mossgate.af2d.json')
  })
})

describe('busy', () => {
  it('names the action while it runs and clears it after', async () => {
    const { controller } = await seeded()
    const busy: Array<string | undefined> = []
    const stop = controller.state.subscribe((value) => busy.push(value.busy))
    await controller.open()
    await controller.duplicate()
    await controller.remove()
    await controller.importFiles([{ name: 'x.note', bytes: new TextEncoder().encode(noteText('x')) }])
    await controller.create('level-project', 'blank')
    stop()
    expect(busy.filter((value) => value !== undefined)).toEqual(
      expect.arrayContaining(['open', 'duplicate', 'remove', 'import', 'create']),
    )
    expect(busy.at(-1)).toBeUndefined()
  })

  it('ignores an action started while another is running', async () => {
    let release: () => void = () => {}
    const open = vi.fn<EditorApp['open']>()
    const { controller, state, app } = setup((real) => ({
      ...real,
      open: (path, as) => {
        open(path, as)
        return new Promise((resolve) => {
          release = () => resolve(real.open(path, as))
        })
      },
    }))
    await app.workspace.store.write('a.note', noteText('a'))
    await controller.refresh()
    const first = controller.open('a.note')
    expect(state().busy).toBe('open')
    await controller.open('a.note')
    await controller.duplicate()
    expect(open).toHaveBeenCalledTimes(1)
    release()
    await first
    expect(state().busy).toBeUndefined()
  })

  it('clears busy and says what went wrong when the app throws', async () => {
    const { controller, state, messages, write } = setup((real) => ({
      ...real,
      open: () => Promise.reject(new Error('boom')),
    }))
    await write('x.note', noteText('x'))
    await controller.refresh()
    await controller.open('x.note')
    expect(state().busy).toBeUndefined()
    expect(messages()).toEqual(['error: Something went wrong: boom'])
    await controller.create('level-project', 'nope')
    expect(state().busy).toBeUndefined()
    expect(messages().at(-1)).toBe(
      'error: Something went wrong: no template "nope" in profile "level-project"',
    )
  })
})
