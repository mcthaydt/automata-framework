// Opening a level from the workspace (ED3D.5b step 5; ED3D spec §5.3 flow 1, §8, §11): stat, read, the registry's
// profile, the checks run once, the autosave offered; and, beside a Last Light level, its facility file.
import { type ProjectStore, StorageError } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import { moveWing } from '../model/facility-edits'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { createTestClock, memoryWorkspace, textOf } from '../testing/memory-workspace'
import { createEditorApp, type OpenOutcome } from './editor-app'

const CLINIC = 'art/blockout-clinic/blockout.json'
const FACILITY = 'art/blockout-facility/facility.json'

async function appWith(files: Record<string, string | Uint8Array>) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  for (const [path, data] of Object.entries(files)) await workspace.store.write(path, data)
  clock.advance(1000)
  return { clock, workspace, app: createEditorApp({ workspace, clock }) }
}

function opened(outcome: OpenOutcome) {
  if (outcome.status !== 'opened') throw new Error(`expected the level to open, got ${outcome.status}`)
  return outcome
}

describe('open', () => {
  it('opens the depot with its profile, its editor and the checks run once', async () => {
    const { app } = await appWith({ 'depot.af-sector.json': loadAuthored('depot.af-sector') })
    const outcome = opened(await app.open('depot.af-sector.json'))
    expect(outcome.level.profile.id).toBe('af-sector')
    expect(outcome.level.path).toBe('depot.af-sector.json')
    const depot = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    expect(depot.ok && outcome.level.editor.level).toEqual(depot.ok && depot.value)
    expect(outcome.level.checks).toEqual(outcome.level.profile.checks(outcome.level.editor.level))
    expect(outcome.level.document.session.status).toBe('saved')
    expect(outcome.recovery).toBeUndefined()
    // An af-sector level has no facility to look for.
    expect(outcome.facility).toBeUndefined()
  })

  it('names the installed profiles', async () => {
    const { app } = await appWith({})
    expect(app.installed).toEqual(['af-sector', 'last-light-blockout'])
  })

  it('answers missing for a path with no file', async () => {
    const { app } = await appWith({})
    expect(await app.open('nope.json')).toEqual({ status: 'missing', path: 'nope.json' })
  })

  it('passes the read outcomes on, with the path', async () => {
    const { app } = await appWith({
      'other.json': '{"format": "other/1"}',
      'newer.json': loadAuthored('depot.af-sector').replace('"af-sector/1"', '"af-sector/2"'),
      'bytes.json': new Uint8Array([0xff, 0xfe]),
    })
    expect(await app.open('other.json')).toMatchObject({
      status: 'unrecognised',
      path: 'other.json',
      installed: ['af-sector', 'last-light-blockout'],
    })
    expect(await app.open('newer.json')).toMatchObject({
      status: 'invalid',
      path: 'newer.json',
      issues: [{ path: ['format'] }],
      installed: ['af-sector', 'last-light-blockout'],
    })
    expect(await app.open('bytes.json')).toEqual({ status: 'notText', path: 'bytes.json' })
  })

  it('answers storageFailed when the store refuses the read', async () => {
    const { workspace, clock } = await appWith({ 'a.json': '{}' })
    const store: ProjectStore = {
      ...workspace.store,
      read: () => Promise.reject(new StorageError('denied', 'not allowed')),
    }
    const app = createEditorApp({ workspace: { ...workspace, store }, clock })
    expect(await app.open('a.json')).toEqual({
      status: 'storageFailed',
      path: 'a.json',
      reason: 'denied',
      message: 'not allowed',
    })
  })

  it('offers an autosave newer than the file, and opens anyway when the journal cannot be read', async () => {
    const { app, clock, workspace } = await appWith({
      'depot.af-sector.json': loadAuthored('depot.af-sector'),
    })
    const first = opened(await app.open('depot.af-sector.json'))
    first.level.editor.history.apply('Rename', (state) => ({
      level: { ...(state.level as object), name: 'x' },
    }))
    await first.level.document.session.flush()
    first.level.document.dispose()
    const again = opened(await app.open('depot.af-sector.json'))
    expect(again.recovery?.payload).toBe(JSON.stringify(first.level.editor.level))
    expect(again.level.document.restore(again.recovery ?? never())).toEqual({ ok: true, baseChanged: false })

    const journal: ProjectStore = {
      ...workspace.journal,
      read: () => Promise.reject(new StorageError('io', 'journal broke')),
    }
    const broken = createEditorApp({ workspace: { ...workspace, journal }, clock })
    const outcome = opened(await broken.open('depot.af-sector.json'))
    expect(outcome.recovery).toBeUndefined()
    expect(outcome.recoveryError).toBe('journal broke')
  })
})

describe('the facility beside a Last Light level', () => {
  it('opens the facility in a sibling folder, with its own editor', async () => {
    const { app } = await appWith({
      [CLINIC]: loadFixture('blockout-clinic'),
      [FACILITY]: loadFixture('facility'),
    })
    const outcome = opened(await app.open(CLINIC))
    expect(outcome.level.profile.id).toBe('last-light-blockout')
    const facility = outcome.facility
    expect(facility?.status).toBe('opened')
    if (facility?.status !== 'opened') return
    expect(facility.facility.path).toBe(FACILITY)
    expect(facility.facility.editor.facility.wings.map((wing) => wing.id)).toEqual(['clinic', 'bay'])
    expect(facility.facility.recovery).toBeUndefined()
  })

  it('prefers a facility in the level’s own folder', async () => {
    const { app } = await appWith({
      [CLINIC]: loadFixture('blockout-clinic'),
      [FACILITY]: loadFixture('facility'),
      'art/blockout-clinic/facility.json': loadFixture('facility'),
    })
    const facility = opened(await app.open(CLINIC)).facility
    expect(facility?.status === 'opened' && facility.facility.path).toBe('art/blockout-clinic/facility.json')
  })

  it('finds one beside a level at the top of the workspace', async () => {
    const { app } = await appWith({
      'clinic.json': loadFixture('blockout-clinic'),
      'facility.json': loadFixture('facility'),
    })
    const facility = opened(await app.open('clinic.json')).facility
    expect(facility?.status === 'opened' && facility.facility.path).toBe('facility.json')
  })

  it('does not take the facility of another import root for a level one folder deep', async () => {
    const { app } = await appWith({
      'packA/blockout.json': loadFixture('blockout-clinic'),
      'packB/facility.json': loadFixture('facility'),
    })
    expect(opened(await app.open('packA/blockout.json')).facility).toEqual({ status: 'missing' })
  })

  it('is missing when there is none, and the level opens', async () => {
    const { app } = await appWith({
      [CLINIC]: loadFixture('blockout-clinic'),
      'elsewhere/x/facility.json': '{}',
    })
    expect(opened(await app.open(CLINIC)).facility).toEqual({ status: 'missing' })
  })

  it('is invalid, with its issues, when it does not parse; the level still opens', async () => {
    const { app } = await appWith({ [CLINIC]: loadFixture('blockout-clinic'), [FACILITY]: '{"wings": 3}' })
    const facility = opened(await app.open(CLINIC)).facility
    expect(facility?.status).toBe('invalid')
    if (facility?.status !== 'invalid') return
    expect(facility.path).toBe(FACILITY)
    expect(facility.issues.length).toBeGreaterThan(0)
  })

  it('is unreadable when it is not text', async () => {
    const { app } = await appWith({
      [CLINIC]: loadFixture('blockout-clinic'),
      [FACILITY]: new Uint8Array([0xff]),
    })
    expect(opened(await app.open(CLINIC)).facility).toEqual({
      status: 'unreadable',
      path: FACILITY,
      message: 'The file is not text.',
    })
  })

  it('saves a wing move through the facility codec, byte for byte', async () => {
    const { app, workspace } = await appWith({
      [CLINIC]: loadFixture('blockout-clinic'),
      [FACILITY]: loadFixture('facility'),
    })
    const facility = opened(await app.open(CLINIC)).facility
    if (facility?.status !== 'opened') throw new Error('no facility')
    expect(facility.facility.editor.run(moveWing({ wing: 'bay', offset: [10.875, -1, -6.6] })).ok).toBe(true)
    expect(await facility.facility.document.save()).toEqual({ status: 'saved', path: FACILITY })
    expect(textOf(await workspace.store.read(FACILITY))).toBe(
      loadFixture('facility').replace('"offset": [10.375, -1, -6.6]', '"offset": [10.875, -1, -6.6]'),
    )
  })
})

function never(): never {
  throw new Error('no recovery')
}
