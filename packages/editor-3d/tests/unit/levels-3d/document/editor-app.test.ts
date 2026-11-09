// Opening a level from the workspace (ED3D.5b step 5; ED3D spec §5.3 flow 1, §8, §11): stat, read, the registry's
// profile, the checks run once, the autosave offered.
import { type ProjectStore, StorageError } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import { createEditorApp, type OpenOutcome } from '#src/features/levels-3d/document/editor-app.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { createTestClock, memoryWorkspace } from '#src/testing/memory-workspace.ts'

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
  })

  it('names the installed profiles', async () => {
    const { app } = await appWith({})
    expect(app.installed).toEqual(['af-sector'])
  })

  it('answers missing for a path with no file', async () => {
    const { app } = await appWith({})
    expect(await app.open('nope.json')).toEqual({ status: 'missing', path: 'nope.json' })
  })

  it('passes the read outcomes on, with the path', async () => {
    const { app } = await appWith({
      'other.json': '{"format": "other/1"}',
      'newer.json': loadAuthored('depot.af-sector').replace('"af-sector/2"', '"af-sector/3"'),
      'bytes.json': new Uint8Array([0xff, 0xfe]),
    })
    expect(await app.open('other.json')).toMatchObject({
      status: 'unrecognised',
      path: 'other.json',
      installed: ['af-sector'],
    })
    expect(await app.open('newer.json')).toMatchObject({
      status: 'invalid',
      path: 'newer.json',
      issues: [{ path: ['format'] }],
      installed: ['af-sector'],
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

function never(): never {
  throw new Error('no recovery')
}
