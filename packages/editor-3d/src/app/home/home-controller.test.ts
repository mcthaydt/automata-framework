import { createToasts, type ProjectStore, type Toast } from '@mcthaydt/automata-editor/kit/core'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { loadAuthored, loadFixture } from '../../testing/fixtures'
import { createTestClock, memoryWorkspace } from '../../testing/memory-workspace'
import type { PanelOutcome } from '../document/open-flow-model'
import { createEditorApp, type EditorApp, type OpenOutcome } from '../editor-app'
import { createHomeController } from './home-controller'

// The 3D editor's Home (plan ED3D.5c step 7): the kit's project browser over the app's list, with Open and the two
// imports. Run over a memory workspace and the real app, so each outcome is the one a person would meet.

const DEPOT = 'depot/depot.json'

async function setup(files: Record<string, string | Uint8Array> = {}, wrap?: (app: EditorApp) => EditorApp) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  for (const [path, data] of Object.entries(files)) {
    clock.advance(1000)
    await workspace.store.write(path, data)
  }
  const app = createEditorApp({ workspace, clock })
  const toasts = createToasts({ clock })
  const said: Toast[] = []
  toasts.subscribe((list) => said.splice(0, said.length, ...list))
  const opened: Extract<OpenOutcome, { status: 'opened' }>[] = []
  const problems: PanelOutcome[] = []
  const controller = createHomeController({
    app: wrap?.(app) ?? app,
    toasts,
    onOpened: (outcome) => opened.push(outcome),
    onProblem: (outcome) => problems.push(outcome),
  })
  let state = undefined as unknown as Parameters<Parameters<typeof controller.state.subscribe>[0]>[0]
  controller.state.subscribe((next) => (state = next))
  return { workspace, controller, opened, problems, said, current: () => state }
}

describe('the 3D Home controller', () => {
  it('lists the levels and the facility, newest first, with the first selected', async () => {
    const { controller, current } = await setup({
      [DEPOT]: loadAuthored('depot.af-sector'),
      'art/blockout-clinic/blockout.json': loadFixture('blockout-clinic'),
      'art/blockout-facility/facility.json': loadFixture('facility'),
      'art/readme.md': 'not a level',
    })
    await controller.refresh()
    expect(current().visible.map((entry) => entry.path)).toEqual([
      'art/blockout-facility/facility.json',
      'art/blockout-clinic/blockout.json',
      DEPOT,
    ])
    expect(current().selected).toBe('art/blockout-facility/facility.json')
  })

  it('searches by profile', async () => {
    const { controller, current } = await setup({
      [DEPOT]: loadAuthored('depot.af-sector'),
      'art/blockout-clinic/blockout.json': loadFixture('blockout-clinic'),
    })
    await controller.refresh()
    controller.search('last-light')
    expect(current().visible.map((entry) => entry.path)).toEqual(['art/blockout-clinic/blockout.json'])
  })

  it('opens the selected level and hands it to the owner', async () => {
    const { controller, opened, current } = await setup({ [DEPOT]: loadAuthored('depot.af-sector') })
    await controller.refresh()
    await controller.open()
    expect(opened.map((outcome) => outcome.level.path)).toEqual([DEPOT])
    expect(current().busy).toBeUndefined()
  })

  it('hands a file to look at to the owner, untoasted, and reads the list again', async () => {
    const { controller, problems, said } = await setup({
      'broken.json': loadAuthored('depot.af-sector').replace('"af-sector/1"', '"af-sector/2"'),
    })
    await controller.refresh()
    await controller.open('broken.json')
    expect(problems.map((outcome) => [outcome.status, outcome.path])).toEqual([['invalid', 'broken.json']])
    expect(said).toEqual([])
  })

  it('does not open a facility on its own: no panel, the summary’s reason as a toast, the app never asked', async () => {
    const asked: string[] = []
    const { controller, problems, opened, said } = await setup(
      { 'art/blockout-facility/facility.json': loadFixture('facility') },
      (app) => ({
        ...app,
        open: (path) => {
          asked.push(path)
          return app.open(path)
        },
      }),
    )
    await controller.refresh()
    await controller.open('art/blockout-facility/facility.json')
    await controller.open()
    expect(asked).toEqual([])
    expect(problems).toEqual([])
    expect(opened).toEqual([])
    expect(said.map((toast) => [toast.kind, toast.message])).toEqual([
      ['info', 'A facility opens with one of its levels: open a level beside it.'],
      ['info', 'A facility opens with one of its levels: open a level beside it.'],
    ])
  })

  it('toasts a file that went, and a store that refused', async () => {
    const { controller, said, current } = await setup(
      { [DEPOT]: loadAuthored('depot.af-sector') },
      (app) => ({
        ...app,
        open: async (path) =>
          path === 'gone.json'
            ? { status: 'missing', path }
            : { status: 'storageFailed', path, reason: 'denied', message: 'No access.' },
      }),
    )
    await controller.refresh()
    await controller.open('gone.json')
    await controller.open(DEPOT)
    expect(said.map((toast) => toast.message)).toEqual([
      'gone.json is no longer in this workspace.',
      'depot.json: No access.',
    ])
    expect(current().visible).toHaveLength(1)
  })

  it('imports a folder, says so, and selects the first file it brought in', async () => {
    const { controller, said, current } = await setup({ [DEPOT]: loadAuthored('depot.af-sector') })
    await controller.refresh()
    await controller.importFolder([
      { path: 'clinic/blockout.json', bytes: strToU8(loadFixture('blockout-clinic')) },
      { path: 'clinic/.DS_Store', bytes: new Uint8Array(1) },
    ])
    expect(said.map((toast) => [toast.kind, toast.message])).toEqual([
      ['warn', 'Imported 1 file into clinic; 1 left out (system files, unsafe names or over 16 MB).'],
    ])
    expect(current().selected).toBe('clinic/blockout.json')
  })

  it('imports a zip under its top folder, and refuses bytes that are not one', async () => {
    const { controller, said, current } = await setup()
    await controller.refresh()
    const zip = zipSync({ 'depot/depot.json': strToU8(loadAuthored('depot.af-sector')) })
    await controller.importZip({ name: 'depot.zip', bytes: zip })
    expect(current().selected).toBe('depot/depot.json')
    await controller.importZip({ name: 'notes.zip', bytes: strToU8('plain text') })
    expect(said.map((toast) => toast.kind)).toEqual(['ok', 'error'])
    expect(said[1]?.message).toMatch(/^Not a zip file/)
  })

  it('imports nothing for an empty pick', async () => {
    const { controller, said } = await setup()
    await controller.importFolder([])
    expect(said).toEqual([])
  })

  it('shows the list as unavailable when the workspace cannot be listed', async () => {
    const { controller, workspace, current } = await setup()
    const store = workspace.store as { list: ProjectStore['list'] }
    store.list = async () => {
      throw new Error('The disk is gone.')
    }
    await controller.refresh()
    expect(current()).toMatchObject({ phase: 'unavailable', message: 'The disk is gone.' })
  })

  it('creates a level from a name and opens it', async () => {
    const { controller, opened, workspace } = await setup()
    await controller.create('Annex')
    expect(opened.map((outcome) => outcome.level.path)).toEqual(['annex/annex.json'])
    expect((await workspace.store.list()).map((entry) => entry.path)).toContain('annex/annex.json')
  })

  it('says why a name was refused, and opens nothing', async () => {
    const { controller, opened, said } = await setup()
    await controller.create('   ')
    expect(opened).toEqual([])
    expect(said.map((toast) => toast.kind)).toEqual(['error'])
  })
})
